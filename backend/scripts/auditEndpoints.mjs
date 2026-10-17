// Review-only smoke audit. Never writes to the source database or calls external services.
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
dotenv.config({path:new URL('../.env',import.meta.url)});
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = '';
process.env.BRANCHES_API_URL = 'data:application/json,'+encodeURIComponent(JSON.stringify([{id:'audit',branch_name:'Audit project',order_number:'AUDIT01',is_active:true}]));
const source = process.env.DB_NAME || 'procurement_db';
const temporary = `procurement_audit_test_${Date.now()}`;
const control = await mysql.createConnection({host:process.env.DB_HOST || 'localhost',port:process.env.DB_PORT || 3306,user:process.env.DB_USER || 'root',password:process.env.DB_PASSWORD || ''});
let db, io;
const results = [];
try {
  await control.query(`CREATE DATABASE ${control.escapeId(temporary)}`);
  const [tables] = await control.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'",[source]);
  for (const row of tables) await control.query(`CREATE TABLE ${control.escapeId(temporary)}.${control.escapeId(row.TABLE_NAME)} LIKE ${control.escapeId(source)}.${control.escapeId(row.TABLE_NAME)}`);
  process.env.DB_NAME = temporary;
  db = (await import('../config/database.js')).default;
  const {prepareRequestWorkflowSchema} = await import('../services/requestWorkflowSchema.js');
  await prepareRequestWorkflowSchema(db);
  await (await import('../services/auditRemediationSchema.js')).prepareAuditRemediationSchema(db);
  (await import('../utils/logger.js')).default.silent = true;
  const roles = ['engineer','procurement','admin','senior_project_manager','ceo','super_admin'];
  for (const [index, role] of roles.entries()) await db.query('INSERT INTO employees(id,employee_no,first_name,last_name,password,role,is_active) VALUES(?,?,?,?,?,?,1)',[index+1,`AUDIT-${index+1}`,'Synthetic',role,'unused',role]);
  await db.query("INSERT INTO employees(id,employee_no,first_name,last_name,password,role,is_active) VALUES(99,'AUDIT-INACTIVE','Synthetic','Inactive','unused','engineer',0)");
  const server = await import('../server.js'); io = server.io;
  const {app} = server;
  const inventory = [];
  app._router.stack.forEach(layer => {
    if(layer.route) {for(const method of Object.keys(layer.route.methods)) inventory.push({method,path:layer.route.path});return;}
    if(!layer.handle?.stack) return;
    const mount = layer.regexp.source.replaceAll('\\/','/').replace(/^\^/,'').split('/?')[0];
    layer.handle.stack.forEach(child => {if(child.route) for(const method of Object.keys(child.route.methods)) inventory.push({method,path:mount+(child.route.path==='/'?'':child.route.path)});});
  });
  const materialize = path => path.replace(/:kind/g,'cr').replace(/:role/g,'engineer').replace(/:orderNumber/g,'AUDIT-MISSING').replace(/:supplierName/g,'AUDIT-MISSING').replace(/:[A-Za-z_]+/g,'2147483000');
  const publicPaths = new Set(['/api/health','/api/auth/login','/api/auth/procurement','/api/auth/sync-password','/api/notifications/vapid-public-key']);
  for(const endpoint of inventory) {
    if(endpoint.method==='options') continue;
    const url = materialize(endpoint.path);
    let request = supertest(app)[endpoint.method](url).timeout(10000);
    if(!['get','head'].includes(endpoint.method)) request = request.send({});
    const response = await request;
    results.push({phase:'unauthenticated',...endpoint,status:response.status,expected:publicPaths.has(endpoint.path)?'public or input validation':'401',ok:publicPaths.has(endpoint.path)?response.status<500:response.status===401,message:response.body.message});
  }
  for(const [index, role] of roles.entries()) {
    const token = jwt.sign({id:index+1},process.env.JWT_SECRET || 'your-secret-key');
    for(const endpoint of inventory.filter(e=>e.method==='get')) {
      // Backup is checked only without credentials: do not generate database dumps.
      if(endpoint.path==='/api/settings/backup') continue;
      const response = await supertest(app).get(materialize(endpoint.path)).set('Authorization',`Bearer ${token}`).timeout(10000);
      results.push({phase:'authenticated-read',role,...endpoint,status:response.status,expected:':id missing => 404; role restricted => 403; valid lists => 200',ok:response.status<500,message:response.body.message});
    }
  }
  const inactive = await supertest(app).get('/api/auth/me').set('Authorization',`Bearer ${jwt.sign({id:99},process.env.JWT_SECRET || 'your-secret-key')}`);
  results.push({phase:'inactive-account',method:'get',path:'/api/auth/me',status:inactive.status,expected:'403',ok:inactive.status===403});
  // Exercise nonempty detail and Excel export queries with synthetic linked documents.
  const seed = async (table, supplied) => {
    const [columns] = await db.query(`SHOW COLUMNS FROM ${db.escapeId(table)}`);
    const row = {};
    for(const column of columns) {
      if(column.Extra.includes('GENERATED')) continue;
      if(Object.hasOwn(supplied,column.Field)) {row[column.Field]=supplied[column.Field];continue;}
      if(column.Null==='YES' || column.Default!==null || column.Extra.includes('auto_increment')) continue;
      row[column.Field] = column.Type.startsWith('enum(') ? column.Type.match(/'([^']*)'/)[1] : /int|decimal|float|double|bit/.test(column.Type) ? 1 : /date|time/.test(column.Type) ? '2030-01-01' : column.Type==='json' ? '[]' : 'AUDIT';
    }
    const keys=Object.keys(row);
    await db.query(`INSERT INTO ${db.escapeId(table)} (${keys.map(k=>db.escapeId(k)).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(row));
  };
  await seed('categories',{id:101,category_name:'Audit category',created_by:3});
  await seed('items',{id:101,item_code:'AUDIT-ITEM',item_name:'Audit item',category_id:101,unit:'pcs',status:'Active',is_active:1,created_by:3});
  await seed('suppliers',{id:101,supplier_code:'AUDIT-SUP',supplier_name:'Audit supplier',status:'Active'});
  await seed('purchase_requests',{id:101,pr_number:'AUDIT-PR',requested_by:1,purpose:'Audit request',total_amount:100,status:'Draft',supplier_id:101,supplier_name:'Audit supplier',project:'Audit project',order_number:'AUDIT01'});
  await seed('purchase_request_items',{id:101,purchase_request_id:101,item_id:101,quantity:2,unit_price:50,total_price:100});
  await seed('purchase_orders',{id:101,po_number:'AUDIT-PO',purchase_request_id:101,supplier_id:101,prepared_by:3,total_amount:100,status:'Draft',po_date:'2030-01-01'});
  await seed('purchase_order_items',{id:101,purchase_order_id:101,item_id:101,quantity:2,unit_price:50,total_price:100});
  await seed('service_requests',{id:101,sr_number:'AUDIT-SR',requested_by:1,purpose:'Audit service',amount:50,quantity:2,status:'Draft',supplier_id:101});
  await seed('cash_requests',{id:101,cr_number:'AUDIT-CR',requested_by:1,purpose:'Audit cash',amount:50,quantity:2,status:'Draft',request_kind:'standard'});
  await seed('reimbursements',{id:101,rmb_number:'AUDIT-RMB',requested_by:1,purpose:'Audit reimbursement',amount:100,status:'Draft'});
  await seed('payment_requests',{id:101,pr_number:'AUDIT-PAY',purchase_request_id:101,requested_by:3,payee_name:'Audit supplier',purpose:'Audit payment',amount:100,status:'Approved'});
  await seed('payment_orders',{id:101,po_number:'AUDIT-PAYORDER',service_request_id:101,requested_by:3,payee_name:'Audit supplier',purpose:'Audit payment order',amount:100,status:'Pending'});
  await seed('disbursement_vouchers',{id:101,dv_number:'AUDIT-DV',purchase_order_id:101,supplier_id:101,prepared_by:3,amount:100,status:'Draft'});
  const privileged=jwt.sign({id:6},process.env.JWT_SECRET || 'your-secret-key');
  const ExcelJS=(await import('exceljs')).default;
  for(const module of ['items','suppliers','categories','purchase-requests','purchase-orders','service-requests','cash-requests','reimbursements','payment-requests','payment-orders','disbursement-vouchers']) {
    const detail=await supertest(app).get(`/api/${module}/101`).set('Authorization',`Bearer ${privileged}`).timeout(10000);
    results.push({phase:'seeded-detail',method:'get',path:`/api/${module}/101`,status:detail.status,expected:200,ok:detail.status===200,message:detail.body.message});
    if(['items','suppliers','categories'].includes(module)) continue;
    const response=await supertest(app).get(`/api/${module}/101/export`).set('Authorization',`Bearer ${privileged}`).buffer(true).parse((res,done)=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>done(null,Buffer.concat(chunks)));}).timeout(15000);
    let worksheets=0, error;
    if(response.status===200) try { const book=new ExcelJS.Workbook();await book.xlsx.load(response.body);worksheets=book.worksheets.length; }catch(e){error=e.message;}
    results.push({phase:'seeded-excel-export',method:'get',path:`/api/${module}/101/export`,status:response.status,expected:'200 and valid XLSX',worksheets,ok:response.status===200&&worksheets>0,error});
  }
  await db.query("UPDATE reimbursements SET status='For Purchase',project='Audit project',order_number='AUDIT01' WHERE id=101");
  const creation=await supertest(app).post('/api/payment-orders').set('Authorization',`Bearer ${privileged}`).send({reimbursement_id:101,project:'Audit project',order_number:'AUDIT01',payee_name:'Audit payee',amount:100});
  const [created]=await db.query("SELECT reimbursement_id,amount FROM payment_orders WHERE po_number<>'AUDIT-PAYORDER' ORDER BY id DESC LIMIT 1");
  results.push({phase:'source-link-integrity',method:'post',path:'/api/payment-orders',status:creation.status,expected:'201 and reimbursement_id=101',stored:created[0],ok:creation.status===201&&Number(created[0]?.reimbursement_id)===101,message:creation.body.message});
  const output = {at:new Date().toISOString(),source:'Local schema cloned without records; synthetic users only',inventory,results,summary:{routes:inventory.length,checks:results.length,failed:results.filter(r=>!r.ok).length}};
  await fs.mkdir(new URL('../../docs/audit/',import.meta.url),{recursive:true});
  await fs.writeFile(new URL('../../docs/audit/endpoint-results-2026-10-17.json',import.meta.url),JSON.stringify(output,null,2));
  console.log(JSON.stringify(output.summary));
  console.log(JSON.stringify(results.filter(r=>!r.ok),null,2));
  process.exitCode = output.summary.failed ? 1 : 0;
} finally {
  if(io) await new Promise(resolve=>io.close(resolve));
  if(db) await db.end();
  if(!/^procurement_audit_test_\d+$/.test(temporary)) throw new Error('Invalid temporary database name');
  await control.query(`DROP DATABASE ${control.escapeId(temporary)}`);
  await control.end();
}
