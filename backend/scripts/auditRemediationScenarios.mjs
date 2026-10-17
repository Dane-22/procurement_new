import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import request from 'supertest';
import { prepareAuditRemediationSchema } from '../services/auditRemediationSchema.js';
import { prepareRequestWorkflowSchema } from '../services/requestWorkflowSchema.js';

export async function auditRemediationScenarios(ctx) {
  const {scenario,call,db,app,token,newPR,approvePR,newRequest,approveWorkflow,prBody,base,row,status,seed} = ctx;
  await scenario('Migration: additive upgrade is repeatable and preserves rows and existing statuses', async () => {
    const [before] = await db.query('SELECT COUNT(*) AS count FROM purchase_requests');
    const [columnsBefore] = await db.query("SHOW COLUMNS FROM reimbursements LIKE 'status'");
    assert.match(process.env.DB_NAME,/^procurement_flow_test_\d+$/);
    await db.query('DROP TABLE IF EXISTS po_admin_reviews');
    await prepareRequestWorkflowSchema(db);
    await prepareRequestWorkflowSchema(db);
    const [poReviewColumns] = await db.query('SHOW COLUMNS FROM po_admin_reviews');
    assert.ok(poReviewColumns.some(column=>column.Field==='is_current'));
    await prepareAuditRemediationSchema(db);
    await prepareAuditRemediationSchema(db);
    const [after] = await db.query('SELECT COUNT(*) AS count FROM purchase_requests');
    const [columnsAfter] = await db.query("SHOW COLUMNS FROM reimbursements LIKE 'status'");
    assert.deepEqual(after,before);assert.deepEqual(columnsAfter,columnsBefore);
  });
  await scenario('Security: deactivation invalidates profile and uploads; anonymous uploads write nothing', async () => {
    const uploadRoot = new URL('../uploads/',import.meta.url);
    const before = (await fs.readdir(uploadRoot)).sort();
    const response = await request(app).post('/api/uploads').attach('image',Buffer.from('Synthetic image'),'audit.png');
    assert.equal(response.status,401);
    assert.deepEqual((await fs.readdir(uploadRoot)).sort(),before);
    await db.query('UPDATE employees SET is_active=0 WHERE id=2');
    try {
      await call('reviewer','get','/auth/me',undefined,403);
      await call('reviewer','post','/uploads',{},403);
    } finally {await db.query('UPDATE employees SET is_active=1 WHERE id=2');}
  });
  await scenario('PR: corrected round preserves rejection history and completes without old votes', async () => {
    const id = await newPR();
    await call('reviewer','post',`/purchase-requests/${id}/review`,{review_status:'rejected',review_comment:'Preserve this decision'});
    await call('owner','put',`/purchase-requests/${id}/resubmit`,prBody());
    const detail = await call('owner','get',`/purchase-requests/${id}`);
    assert.equal(detail.purchaseRequest.review_history.length,1);
    assert.ok(detail.purchaseRequest.review_history[0].reviews.some(review=>review.review_comment==='Preserve this decision'&&review.review_status==='rejected'));
    assert.ok(detail.purchaseRequest.reviews.every(review=>review.review_status==='pending'));
    await approvePR(id);
  });
  await scenario('PR: draft submission preserves PR full-chain role routing', async () => {
    for (const [who,expected] of [['senior','For Engineer Review'],['admin','For Admin Review']]) {
      const id = await newPR({save_as_draft:true},who);
      await call(who,'put',`/purchase-requests/${id}/submit-draft`,{});
      await status('purchase_requests',id,expected);
    }
  });
  await scenario('PR: concurrent corrections create one fresh review set and one history snapshot', async () => {
    const id=await newPR();
    await call('reviewer','post',`/purchase-requests/${id}/review`,{review_status:'rejected'});
    const replies=await Promise.all([1,2].map(()=>request(app).put(`/api/purchase-requests/${id}/resubmit`).set('Authorization',`Bearer ${token('owner')}`).send(prBody())));
    assert.deepEqual(replies.map(reply=>reply.status).sort(),[200,400]);
    const [history]=await db.query('SELECT COUNT(*) AS count FROM purchase_request_review_history WHERE purchase_request_id=?',[id]);
    assert.equal(Number(history[0].count),1);
    await approvePR(id);
  });
  await scenario('Suppliers: GET is read-only and repeated accreditation does not duplicate reviews', async () => {
    const supplierName='AUTOTEST explicit accreditation';
    const id = await newPR({supplier_id:null,supplier_name:supplierName});
    const [before] = await db.query('SELECT COUNT(*) AS count FROM suppliers');
    await call('admin','get','/suppliers');await call('admin','get','/suppliers');
    const [after] = await db.query('SELECT COUNT(*) AS count FROM suppliers');
    assert.deepEqual(before,after);
    for (const who of ['admin','senior','ceo']) await call(who,'put',`/suppliers/${encodeURIComponent(supplierName)}/accredit`,{accredited:true},403);
    await call('super','put',`/suppliers/${encodeURIComponent(supplierName)}/accredit`,{accredited:true});
    await status('purchase_requests',id,'For Engineer Review');
    const [first] = await db.query('SELECT COUNT(*) AS count FROM purchase_request_reviews WHERE purchase_request_id=?',[id]);
    assert.ok(Number(first[0].count)>0);
    await call('super','put',`/suppliers/${encodeURIComponent(supplierName)}/accredit`,{accredited:true});
    const [second] = await db.query('SELECT COUNT(*) AS count FROM purchase_request_reviews WHERE purchase_request_id=?',[id]);
    assert.deepEqual(second,first);
    await call('super','put',`/suppliers/${encodeURIComponent(supplierName)}/accredit`,{accredited:false});
    await call('reviewer','post',`/purchase-requests/${id}/review`,{review_status:'approved'},409);
    await call('super','put',`/suppliers/${encodeURIComponent(supplierName)}/accredit`,{accredited:true});
  });
  await scenario('Payment Order: deletion responds, restores source and cannot grant approval by status edit', async () => {
    const id = await newRequest('cr',{cr_type:'payment_order'});await approveWorkflow('cr',id);
    const payment = await call('owner','post','/payment-orders',{cash_request_id:id,...base,payee_name:'Synthetic payee',amount:1},201);
    await call('admin','patch',`/payment-orders/${payment.id}/status`,{status:'Approved'},409);
    await call('admin','delete',`/payment-orders/${payment.id}`);
    assert.equal(await row('payment_orders',payment.id),undefined);
    await status('cash_requests',id,'Approved');
    await call('admin','delete',`/payment-orders/${payment.id}`,undefined,404);
  });
  await scenario('Payment Request: SR rejection permits recreation and direct approval stays blocked', async () => {
    const id=await newRequest('sr');await approveWorkflow('sr',id);
    const body={service_request_id:id,...base,payee_name:'Synthetic payee',amount:100};
    await call('admin','post','/payment-requests',{...body,status:'Approved'},400);
    const payment=await call('owner','post','/payment-requests',body,201);
    await call('admin','put',`/payment-requests/${payment.id}/status`,{status:'Approved'},409);
    await call('super','put',`/payment-requests/${payment.id}/approve`,{status:'rejected',rejection_reason:'Revise source'});
    await status('service_requests',id,'Approved');
    const replacement=await call('owner','post','/payment-requests',body,201);
    await call('admin','delete',`/payment-requests/${replacement.id}`);
    await status('service_requests',id,'Approved');
    const final=await call('owner','post','/payment-requests',body,201);
    await call('super','put',`/payment-requests/${final.id}/approve`,{status:'approved'});
    await call('admin','delete',`/payment-requests/${final.id}`,undefined,409);
  });
  await scenario('Payment Order: concurrent reimbursement creation keeps distinct numbers and trusted totals', async () => {
    const sources=[];
    for(let index=0;index<2;index++){
      const reimbursement=await call('owner','post','/reimbursements',{...base,payee:'Synthetic payee',amount:100,payment_schedules:[{payment_date:'2030-01-01',amount:100}]},201);
      await call('admin','put',`/reimbursements/${reimbursement.reimbursementId}/approve`,{status:'approved'});
      await call('super','put',`/reimbursements/${reimbursement.reimbursementId}/approve`,{status:'approved'});
      sources.push(reimbursement.reimbursementId);
    }
    const replies=await Promise.all(sources.map(id=>request(app).post('/api/payment-orders').set('Authorization',`Bearer ${token('admin')}`).send({...base,reimbursement_id:id,payee_name:'Synthetic payee',amount:1})));
    assert.ok(replies.every(reply=>reply.status===201),JSON.stringify(replies.map(reply=>reply.body)));
    assert.notEqual(replies[0].body.po_number,replies[1].body.po_number);
    for(const reply of replies)assert.equal(Number((await row('payment_orders',reply.body.id)).amount),100);
  });
  await scenario('Payment Request: concurrent PR conversion cannot duplicate or override the approved total', async () => {
    const id=await newPR({payment_basis:'non_debt'});await approvePR(id);
    const body={...base,purchase_request_id:id,payee_name:'Synthetic payee',amount:1};
    const replies=await Promise.all([1,2].map(()=>request(app).post('/api/payment-requests').set('Authorization',`Bearer ${token('owner')}`).send(body)));
    assert.deepEqual(replies.map(reply=>reply.status).sort(),[201,409]);
    const payment=replies.find(reply=>reply.status===201).body;
    assert.equal(Number((await row('payment_requests',payment.id)).amount),100);
  });
  await scenario('PO export: packaged workbook preserves numeric quantity, line amounts and grand total', async () => {
    const pr=await newPR();await approvePR(pr);
    const po=await call('admin','post','/purchase-orders',{purchase_request_id:pr,supplier_id:1,project:base.project,items:[{item_id:1,quantity:2,unit_price:50}]},201);
    const response=await request(app).get(`/api/purchase-orders/${po.poId}/export`).set('Authorization',`Bearer ${token('admin')}`).buffer(true).parse((res,done)=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>done(null,Buffer.concat(chunks)));});
    assert.equal(response.status,200);
    const ExcelJS=(await import('exceljs')).default;
    const book=new ExcelJS.Workbook();await book.xlsx.load(response.body);
    const sheet=book.worksheets[0];
    assert.equal(sheet.getCell('A12').value,2);assert.equal(sheet.getCell('F12').value,50);
    assert.equal(sheet.getCell('G12').value,100);assert.equal(sheet.getCell('G29').value,100);
    assert.equal(sheet.getCell('G5').value,(await row('purchase_orders',po.poId)).po_number);
  });
  await scenario('DV: status edits cannot bypass certification; concurrent releases pay once', async () => {
    const pr=await newPR();await approvePR(pr);
    const po=await call('admin','post','/purchase-orders',{purchase_request_id:pr,supplier_id:1,project:base.project,items:[{item_id:1,quantity:2,unit_price:50}]},201);
    await approveWorkflow('po',po.poId,'admin');
    const schedules=await call('admin','get',`/disbursement-vouchers/schedules?source_type=purchase_order&source_id=${po.poId}`);
    const voucher=await call('admin','post','/disbursement-vouchers',{purchase_order_id:po.poId,schedule_id:schedules.schedules[0].id,particulars:'Synthetic concurrency check'},201);
    await call('admin','put',`/disbursement-vouchers/${voucher.dvId}`,{status:'Paid'},409);
    await call('super','put',`/disbursement-vouchers/${voucher.dvId}/certify-manager`,{},409);
    await call('admin','put',`/disbursement-vouchers/${voucher.dvId}/certify-accounting`,{});
    await call('admin','put',`/disbursement-vouchers/${voucher.dvId}`,{particulars:'Changed after certification'},409);
    await call('super','put',`/disbursement-vouchers/${voucher.dvId}/certify-manager`,{});
    const [today]=await db.query("SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS day");
    const replies=await Promise.all([1,2].map(()=>request(app).put(`/api/disbursement-vouchers/${voucher.dvId}/mark-paid`).set('Authorization',`Bearer ${token('admin')}`).send({payment_date:today[0].day})));
    assert.deepEqual(replies.map(reply=>reply.status).sort(),[200,409]);
    await status('disbursement_vouchers',voucher.dvId,'Paid');
    await call('admin','delete',`/disbursement-vouchers/${voucher.dvId}`,undefined,409);
  });
  await scenario('Dashboard: full counts exceed five-row activity and payments reconcile without duplication', async () => {
    for(let index=0;index<7;index++)await newPR({save_as_draft:true});
    const summary=await call('owner','get','/reports/summary');
    const [counts]=await db.query("SELECT COUNT(*) AS total,SUM(status IN ('Pending','For Approval','Pending Accreditation Review','For Engineer Review','For Admin Review','For Senior Project Manager Review','For Super Admin Final Approval','For Procurement Review','For Admin Approval','For CEO Approval')) AS pending FROM purchase_requests WHERE requested_by=1");
    assert.ok(summary.stats.totalPRs>5);assert.equal(summary.stats.totalPRs,Number(counts[0].total));assert.equal(summary.stats.pendingPRs,Number(counts[0].pending));
    const paid=summary.monthlyPayments.reduce((sum,entry)=>sum+entry.amount,0);
    const [expected]=await db.query("SELECT SUM(amount) AS total FROM disbursement_vouchers WHERE status='Paid' AND payment_date=CURDATE()");
    assert.equal(paid,Number(expected[0].total));
    const other=await call('reviewer','get','/reports/summary');
    assert.equal(other.stats.totalPRs,0);assert.equal(other.monthlyPayments.length,0);
  });
  await scenario('Attachments: private legacy files require owner or authorized staff, including encoded URLs', async () => {
    const made=await call('owner','post','/reimbursements',{...base,payee:'Synthetic payee',amount:100,payment_schedules:[{payment_date:'2030-01-01',amount:100}]},201);
    const filename=`audit-remediation-${Date.now()}.png`;
    const filePath=`/uploads/reimbursements/${filename}`;
    const directory=new URL('../uploads/reimbursements/',import.meta.url);
    const file=new URL(filename,directory);
    await fs.mkdir(directory,{recursive:true});await fs.writeFile(file,'Synthetic private receipt');
    try {
      await seed('reimbursement_attachments',{reimbursement_id:made.reimbursementId,file_path:filePath,file_name:filename,file_size:25,mime_type:'image/png',uploaded_by:1});
      const anonymous=await request(app).get(filePath);assert.equal(anonymous.status,401);
      const encoded=await request(app).get(filePath.replace('reimbursements','%72eimbursements'));assert.equal(encoded.status,401);
      const foreign=await request(app).get(filePath).set('Authorization',`Bearer ${token('reviewer')}`);assert.equal(foreign.status,403);
      const owner=await request(app).get(filePath).set('Authorization',`Bearer ${token('owner')}`);assert.equal(owner.status,200);assert.equal(owner.headers['cache-control'],'private, no-store');
      const admin=await request(app).get(filePath).set('Authorization',`Bearer ${token('admin')}`);assert.equal(admin.status,200);
    } finally {await fs.unlink(file);}
  });
  await scenario('CORS: disallowed origins return a controlled rejection', async () => {
    const response=await request(app).get('/api/health').set('Origin','https://untrusted.invalid');
    assert.equal(response.status,403);assert.equal(response.headers['access-control-allow-origin'],undefined);
  });
}
