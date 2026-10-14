import { modules,fail } from '../utils/requestWorkflowRules.js';
export async function linkedDocuments(conn,kind,id) {
  const column=kind==='po'?'purchase_order_id':kind==='sr'?'service_request_id':'cash_request_id';
  const links=[];
  for(const table of ['purchase_orders','payment_requests','payment_orders','disbursement_vouchers']) {
    const [columns]=await conn.query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
    const fields=columns.map(c=>c.COLUMN_NAME);
    if(!fields.includes(column))continue;
    const [rows]=await conn.query(`SELECT id,status${fields.includes('amount')?',amount':''}${fields.includes('total_amount')?',total_amount':''} FROM ${table} WHERE ${column}=?`,[id]);
    for(const row of rows)links.push({table,...row});
  }
  // Include indirect vouchers via payment documents; these can already be paid.
  const [dvColumns]=await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='disbursement_vouchers'");
  for(const [table,columnName] of [['payment_requests','payment_request_id'],['payment_orders','payment_order_id']]) {
    if(!dvColumns.some(c=>c.COLUMN_NAME===columnName))continue;
    const ids=links.filter(l=>l.table===table).map(l=>l.id);
    if(!ids.length)continue;
    const [vouchers]=await conn.query(`SELECT id,status,amount FROM disbursement_vouchers WHERE ${columnName} IN (?)`,[ids]);
    for(const voucher of vouchers)if(!links.some(l=>l.table==='disbursement_vouchers'&&Number(l.id)===Number(voucher.id)))links.push({table:'disbursement_vouchers',...voucher});
  }
  return links.sort((a,b)=>a.table.localeCompare(b.table)||a.id-b.id);
}
export async function inventory(conn) {
  const records=[];
  for(const [kind,module]of Object.entries(modules)) {
    const [rows]=await conn.query(`SELECT *,${module.number} AS number FROM ${module.table} ${kind==='cr'?"WHERE COALESCE(request_kind,'standard')<>'petty_cash'":''} ORDER BY id`);
    for(const row of rows) {
      const links=await linkedDocuments(conn,kind,row.id);
      // A single Paid/Received status cannot prove BOTH payment and fulfillment.
      const issues=[];
      const [owner]=await conn.query('SELECT id FROM employees WHERE id=?',[row[module.owner]]);
      if(!owner.length)issues.push('Missing requester/preparer employee');
      if(kind==='po'){
        const [items]=await conn.query('SELECT id FROM purchase_order_items WHERE purchase_order_id=?',[row.id]);
        if(!items.length)issues.push('Missing PO line items');
        const [sourceRows]=row.purchase_request_id ? await conn.query('SELECT id FROM purchase_requests WHERE id=?',[row.purchase_request_id]) : await conn.query('SELECT id FROM service_requests WHERE id=?',[row.service_request_id]);
        if(!sourceRows.length)issues.push('Missing source PR/SR');
      }
      const total=kind==='po'?Number(row.total_amount):Number(row.amount)*Number(row.quantity ?? 1);
      const paid=links.filter(l=>l.table==='disbursement_vouchers'&&l.status==='Paid').reduce((sum,l)=>sum+Number(l.amount),0);
      const fullyClosed=['Completed','Received','Closed'].includes(row.status)&&total>0&&(paid>=total || kind==='cr'&&Number(row.release_amount)>=total);
      records.push({id:row.id,number:row.number,status:row.status,module:kind,links,issues,classification:issues.length?'repair_required':fullyClosed?'historical_verify':'restart_review_required'});
    }
  }
  return records;
}
export async function recordMigrationReview(conn,user,kind,row,body) {
  if(user.role!=='admin')throw fail('Admin must review linked documents',403);
  if(!String(body.note||'').trim())throw fail('Record the linked-document handling decision');
  const links=await linkedDocuments(conn,kind,row.id);
  // Require all live links to be explicitly acknowledged; do not cancel or delete them automatically.
  const acknowledged=Array.isArray(body.links)?body.links:[];
  for(const link of links) {
    const choice=acknowledged.find(a=>a.table===link.table&&Number(a.id)===Number(link.id)&&a.status===link.status);
    if(!choice || !String(choice.note||'').trim())throw fail(`Review ${link.table} #${link.id} and record its disposition`,409);
  }
  await conn.query('INSERT INTO request_workflow_migration_reviews(module,document_id,reviewed_by,linked_documents,note) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE reviewed_by=VALUES(reviewed_by),linked_documents=VALUES(linked_documents),note=VALUES(note),reviewed_at=NOW()',[kind,row.id,user.id,JSON.stringify(links.map(l=>({...l,note:acknowledged.find(a=>a.table===l.table&&Number(a.id)===Number(l.id))?.note}))),String(body.note).slice(0,10000)]);
}
