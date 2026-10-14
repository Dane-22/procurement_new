import fs from 'node:fs/promises';

const workflowStatuses=['Draft','For Engineer Review','For Admin Review','For Senior Project Manager Review','For Super Admin Final Approval','Approved','Rejected','Returned','On Hold','Partial Received','Completed','Received'];
const cashStatuses=['For Procurement Review','For Department Head Review','For Super Admin Review','For CEO Approval','Cash Request Created','Payment Request Created','Payment Order Created','Paid','Released','Liquidation Submitted','Liquidation Returned','Closed'];
export async function columns(conn,table){const [rows]=await conn.query(`SHOW COLUMNS FROM \`${table}\``);return rows;}
async function addColumn(conn,table,name,type){
  if(!(await columns(conn,table)).some(c=>c.Field===name))await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${type}`);
}
async function indexColumn(conn,table,column,index){
  const [rows]=await conn.query('SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? AND SEQ_IN_INDEX=1 LIMIT 1',[table,column]);
  if(!rows.length)await conn.query(`CREATE INDEX \`${index}\` ON \`${table}\` (\`${column}\`)`);
}
async function mergeStatuses(conn,table,extra){
  const status=(await columns(conn,table)).find(c=>c.Field==='status');
  if(!status?.Type.startsWith('enum('))return;
  const existing=[...status.Type.matchAll(/'((?:''|[^'])*)'/g)].map(m=>m[1].replace(/''/g,"'"));
  const merged=[...new Set([...existing,...extra])];
  if(merged.length===existing.length)return;
  await conn.query(`ALTER TABLE \`${table}\` MODIFY COLUMN status ENUM(${merged.map(v=>conn.escape(v)).join(',')}) ${status.Null==='YES'?'NULL':'NOT NULL'} ${status.Default===null?'':`DEFAULT ${conn.escape(status.Default)}`}`);
}
async function createTablesFromMigration(conn,file){
  const sql=await fs.readFile(new URL(`../database/migrations/${file}`,import.meta.url),'utf8');
  // Only explicit CREATE TABLE definitions from allowlisted forward migrations.
  // Never execute their historical ALTER ENUM statements or any SQL dump/data inserts.
  for(const statement of sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(s=>/^CREATE TABLE\b/i.test(s))){
    await conn.query(statement.replace(/^CREATE TABLE(?:\s+IF NOT EXISTS)?/i,'CREATE TABLE IF NOT EXISTS'));
  }
}
export async function prepareRequestWorkflowSchema(pool){
  const conn=await pool.getConnection();let locked=false;
  try{
    const [lock]=await conn.query("SELECT GET_LOCK('procurement_workflow_schema',30) AS acquired");
    if(!lock[0].acquired)throw new Error('Another workflow schema migration is running');locked=true;
    // Check baseline tables before performing any DDL. This upgrade does not import base-schema dumps.
    for(const table of ['employees','cash_requests','purchase_orders','purchase_order_items','service_requests','payment_requests','payment_orders'])await columns(conn,table);
    for(const [name,type]of Object.entries({
      request_kind:"VARCHAR(20) NOT NULL DEFAULT 'standard'",payee_name:'VARCHAR(255) NULL',payee_address:'TEXT NULL',
      released_by:'INT NULL',released_at:'DATETIME NULL',release_amount:'DECIMAL(15,2) NULL',received_by:'INT NULL',received_at:'DATETIME NULL'
    }))await addColumn(conn,'cash_requests',name,type);
    await addColumn(conn,'payment_requests','cash_request_id','INT NULL');
    await indexColumn(conn,'payment_requests','cash_request_id','idx_payment_requests_cash_request_id');
    await addColumn(conn,'payment_orders','reimbursement_id','INT NULL');
    await indexColumn(conn,'payment_orders','reimbursement_id','idx_payment_orders_reimbursement_id');
    // These prerequisites were uncommitted locally before the original deployment,
    // so an older production database can be missing all of them.
    for(const file of ['add_petty_cash_requests.sql','add_petty_cash_reviews.sql','add_petty_cash_liquidation.sql','20261014_request_workflows.sql'])await createTablesFromMigration(conn,file);
    await addColumn(conn,'request_workflow_receipts','status',"VARCHAR(20) NOT NULL DEFAULT 'pending'");
    await addColumn(conn,'request_workflow_receipts','review_comment','TEXT NULL');
    for(const table of ['purchase_orders','service_requests','cash_requests','purchase_order_items']){
      if(table==='purchase_order_items')await addColumn(conn,table,'status',"VARCHAR(30) NOT NULL DEFAULT 'Pending'");
      await mergeStatuses(conn,table,[...workflowStatuses,...(table==='cash_requests'?cashStatuses:table==='service_requests'?['Payment Request Created','Payment Order Created','PO Created','Paid']:[])]);
    }
    await addColumn(conn,'purchase_order_items','received_quantity','DECIMAL(15,2) NOT NULL DEFAULT 0');
    if(!(await columns(conn,'purchase_order_items')).find(c=>c.Field==='quantity')?.Type.startsWith('decimal'))await conn.query('ALTER TABLE purchase_order_items MODIFY COLUMN quantity DECIMAL(15,2) NOT NULL');
    return {prerequisites:'cash, petty cash, liquidation and payment source columns ready',workflow:'ready'};
  }finally{
    if(locked)await conn.query("SELECT RELEASE_LOCK('procurement_workflow_schema')").catch(()=>{});
    conn.release();
  }
}
