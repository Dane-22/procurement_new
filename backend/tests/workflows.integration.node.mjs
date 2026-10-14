import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import db from '../config/database.js';
import router from '../routes/requestWorkflows.js';
import {guardModule} from '../middleware/requestWorkflowGuard.js';
import {initialStage,nextStage,lineCents,stageComplete} from '../utils/requestWorkflowRules.js';
import {referenceCache,connectRedis,closeRedis} from '../services/redisCache.js';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {initSocket} from '../utils/socket.js';
import {prepareRequestWorkflowSchema,columns} from '../services/requestWorkflowSchema.js';
import pettyCashRouter from '../routes/pettyCashRequests.js';
import cashRouter from '../routes/cashRequests.js';
import paymentRequestRouter from '../routes/paymentRequests.js';
import paymentOrderRouter from '../routes/paymentOrders.js';
import dvRouter from '../routes/disbursementVouchers.js';
const socketClient=createRequire(new URL('../../frontend/package.json',import.meta.url))('socket.io-client').io;

assert.match(process.env.DB_NAME,/^procurement_workflow_test_\d+$/);
const app=express();app.use(express.json());app.use('/api/workflows',router);
app.use('/api/purchase-orders',...guardModule('po'));app.put('/api/purchase-orders/:id/status',(req,res)=>res.json({bypassed:true}));
app.use('/api/petty-cash-requests',pettyCashRouter);app.use('/api/cash-requests',cashRouter);
app.use('/api/payment-requests',paymentRequestRouter);app.use('/api/payment-orders',paymentOrderRouter);app.use('/api/disbursement-vouchers',dvRouter);
const users={engineer:1,engineer2:2,admin:3,admin2:4,senior:5,super_admin:6,super2:7,ceo:8,ceo2:9};
const roles={engineer:'engineer',engineer2:'engineer',admin:'admin',admin2:'admin',senior:'senior_project_manager',super_admin:'super_admin',super2:'super_admin',ceo:'ceo',ceo2:'ceo'};
const auth=name=>`Bearer ${jwt.sign({id:users[name]},process.env.JWT_SECRET||'your-secret-key')}`;
const post=(name,path,body={})=>supertest(app).post(`/api/workflows${path}`).set('Authorization',auth(name)).send(body);
const get=(name,path)=>supertest(app).get(`/api/workflows${path}`).set('Authorization',auth(name));
const vote=(name,kind,id)=>post(name,`/${kind}/${id}/review`,{decision:'approved'});
const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70,0,255,217]);
async function cr(id,owner,price,quantity=1){
 await db.query("INSERT INTO cash_requests(id,cr_number,requested_by,purpose,amount,quantity,cr_type,request_kind,status) VALUES(?,?,?,'Test cash',?,?,'payment_request','standard','Draft')",[id,`TEST-CR-${id}`,owner,price,quantity]);
 await db.query('INSERT INTO cash_request_payment_schedules(cash_request_id,payment_date,amount) VALUES(?,?,?)',[id,'2030-01-01',(lineCents(price,quantity)/100).toFixed(2)]);
}
before(async()=>{
 const migration=await fs.readFile(new URL('../database/migrations/20261014_request_workflows.sql',import.meta.url),'utf8');
 for(const statement of migration.replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.query(statement);
 for(const [name,id]of Object.entries(users))await db.query('INSERT INTO employees(id,employee_no,first_name,last_name,password,role,is_active) VALUES(?,?,?,?,?,?,1)',[id,`TEST-${id}`,name,'Workflow','unused',roles[name]]);
 await cr(1,1,'1000.00',2);await cr(2,3,'100000.00');await cr(3,8,'10.00');await cr(4,1,'900.00');await cr(5,1,'100.00');
 await db.query("INSERT INTO purchase_requests(id,pr_number,requested_by,purpose,status,total_amount,payment_basis) VALUES(1,'TEST-PR',1,'Test PO source','For Purchase',100,'debt')");
 await db.query("INSERT INTO purchase_orders(id,po_number,purchase_request_id,prepared_by,total_amount,status,po_date) VALUES(1,'TEST-PO',1,3,100,'Draft','2030-01-01')");
 await db.query('INSERT INTO purchase_order_items(id,purchase_order_id,item_id,quantity,unit_price,total_price) VALUES(1,1,1,2,50,100)');
 await db.query("INSERT INTO service_requests(id,sr_number,requested_by,purpose,service_type,supplier_id,amount,quantity,sr_type,status) VALUES(1,'TEST-SR',1,'Test service','Service',1,50,2,'payment_request','Draft')");
 await db.query("INSERT INTO service_request_payment_schedules(service_request_id,payment_date,amount) VALUES(1,'2030-01-01',100)");
});
after(async()=>{
 const [receipts]=await db.query('SELECT stored_name FROM request_workflow_receipts');
 for(const receipt of receipts)await fs.unlink(new URL(`../private/workflow-receipts/${receipt.stored_name}`,import.meta.url)).catch(()=>{});
 await db.end();
 await closeRedis();
});
test('rules: role entry, decimal totals and exact threshold',()=>{
 assert.equal(initialStage('cr','ceo'),'final');assert.equal(initialStage('po','admin'),'admin');
 assert.equal(nextStage('admin',9999999),'senior_project_manager');assert.equal(nextStage('admin',10000000),'final');
 assert.equal(lineCents('19.99','2.50'),4998);
 assert.equal(stageComplete('final',[{role:'super_admin',decision:'approved',is_active:1}]),false);
 assert.throws(()=>lineCents('1.001',1));
});
test('sequential all-member groups, self/out-of-order/duplicate prevention',async()=>{
 assert.equal((await post('engineer','/cr/1/submit')).status,200);
 assert.equal((await vote('engineer','cr',1)).status,403);
 assert.equal((await vote('admin','cr',1)).status,403);
 assert.equal((await vote('engineer2','cr',1)).status,200);
 assert.equal((await vote('admin','cr',1)).status,200);
 assert.equal((await get('admin','/cr/1')).body.round.stage,'admin');
 assert.equal((await vote('admin','cr',1)).status,409);
 assert.equal((await vote('admin2','cr',1)).status,200);
 assert.equal((await get('admin','/cr/1')).body.round.stage,'senior_project_manager');
 assert.equal((await vote('senior','cr',1)).status,200);
 assert.equal((await get('engineer','/cr/1')).body.document.status,'Approved');
});
test('high value requires one approval from EACH role, concurrency is serialized',async()=>{
 assert.equal((await post('admin','/cr/2/submit')).status,200);
 assert.equal((await vote('admin2','cr',2)).status,200);
 const simultaneous=await Promise.all([vote('super_admin','cr',2),vote('super2','cr',2)]);
 assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
 assert.equal((await get('admin','/cr/2')).body.round.status,'review');
 assert.equal((await vote('ceo','cr',2)).status,200);
 assert.equal((await get('admin','/cr/2')).body.round.status,'approved');
});
test('higher-role requester follows diagram; self-exclusion retains both roles',async()=>{
 assert.equal((await post('ceo','/cr/3/submit')).status,200);
 assert.equal((await vote('ceo','cr',3)).status,403);
 assert.equal((await vote('ceo2','cr',3)).status,200);
 assert.equal((await get('ceo','/cr/3')).body.round.status,'review');
 assert.equal((await vote('super_admin','cr',3)).status,200);
});
test('rejection, correction and fresh-round history',async()=>{
 assert.equal((await post('engineer','/cr/4/submit')).status,200);
 assert.equal((await post('engineer2','/cr/4/review',{decision:'rejected',comment:'Revise scope'})).status,200);
 assert.equal((await post('engineer','/cr/4/submit')).status,200);
 const detail=(await get('engineer','/cr/4')).body;
 assert.equal(detail.history.length,2);assert.equal(detail.round.round_number,2);
 assert.ok(detail.reviews.some(v=>v.decision==='rejected'));
});
test('cash release requires Admin, signature receipt, no overrelease or duplicate event',async()=>{
 const upload=(who,key,amount)=>supertest(app).post('/api/workflows/cr/1/receipts').set('Authorization',auth(who)).field('event_key',key).field('amount',amount).field('details','{"signed_receipt":true}').attach('receipt',jpeg,'signed.jpg');
 assert.equal((await upload('engineer','test-event-001','2000.00')).status,403);
 assert.equal((await upload('admin','test-event-001','1000.00')).status,409);
 await db.query("INSERT INTO payment_requests(id,pr_number,cash_request_id,payee_name,purpose,amount,status) VALUES(1,'TEST-PAY',1,'Requester','Cash release',2000,'Approved')");
 const release=await upload('admin','test-event-001','1000.00');assert.equal(release.status,201);
 assert.equal((await upload('admin','test-event-001','1000.00')).status,409);
 assert.equal((await upload('admin','test-event-002','1000.01')).status,400);
 assert.equal((await post('admin',`/cr/1/receipts/${release.body.receipt_id}/confirm`)).status,403);
 assert.equal((await post('engineer',`/cr/1/receipts/${release.body.receipt_id}/confirm`)).status,200);
 assert.notEqual((await get('engineer','/cr/1')).body.document.status,'Received');
 const second=await upload('admin','test-event-002','1000.00');assert.equal(second.status,201);
 assert.equal((await post('engineer',`/cr/1/receipts/${second.body.receipt_id}/confirm`)).status,200);
 assert.equal((await get('engineer','/cr/1')).body.document.status,'Received');
 assert.equal((await get('engineer2',`/cr/3/receipts/${release.body.receipt_id}/download`)).status,403);
});
test('PO: legacy status endpoint cannot bypass approval; line receiving needs verified evidence',async()=>{
 assert.equal((await supertest(app).put('/api/purchase-orders/1/status').set('Authorization',auth('admin')).send({status:'Approved'})).status,409);
 assert.equal((await post('admin','/po/1/submit')).status,200);
 assert.equal((await vote('admin2','po',1)).status,200);assert.equal((await vote('senior','po',1)).status,200);
 const upload=await supertest(app).post('/api/workflows/po/1/receipts').set('Authorization',auth('engineer')).field('event_key','test-po-event-1').field('details','{"items":[{"line_id":1,"quantity":"1"}]}').attach('receipt',jpeg,'delivery.jpg');
 assert.equal(upload.status,201);
 assert.equal((await get('admin','/po/1')).body.items[0].received_quantity,'0.00');
 assert.equal((await post('admin',`/po/1/receipts/${upload.body.receipt_id}/verify`)).status,200);
 assert.equal((await get('admin','/po/1')).body.document.status,'Partial Received');
 assert.equal((await post('admin',`/po/1/receipts/${upload.body.receipt_id}/verify`)).status,409);
});
test('SR service acceptance is distinct from approval; Admin verifies receipt',async()=>{
 assert.equal((await post('engineer','/sr/1/submit')).status,200);
 for(const who of ['engineer2','admin','admin2','senior'])assert.equal((await vote(who,'sr',1)).status,200);
 const upload=await supertest(app).post('/api/workflows/sr/1/receipts').set('Authorization',auth('engineer')).field('event_key','test-sr-event-1').field('details','{"service_completed":true}').attach('receipt',jpeg,'service.jpg');
 assert.equal(upload.status,201);
 assert.equal((await get('engineer','/sr/1')).body.document.status,'Approved');
 assert.equal((await post('admin',`/sr/1/receipts/${upload.body.receipt_id}/verify`)).status,200);
 assert.equal((await get('engineer','/sr/1')).body.document.status,'Received');
});
test('live response headers and pending inbox assignment',async()=>{
 const response=await get('engineer2','/');assert.equal(response.status,200);
 assert.equal(response.headers['cache-control'],'private, no-store');
 assert.ok(response.body.requests.some(r=>r.module==='cr'&&r.id===4&&r.can_review===1));
});
test('hold/resume requires active assignment; empty or inactive groups cannot be skipped',async()=>{
 assert.equal((await post('engineer','/cr/5/submit')).status,200);
 assert.equal((await post('admin','/cr/5/hold',{comment:'Wait for documents'})).status,403);
 assert.equal((await post('engineer2','/cr/5/hold',{comment:'Wait for documents'})).status,200);
 assert.equal((await vote('engineer2','cr',5)).status,409);
 assert.equal((await post('admin','/cr/5/resume')).status,403);
 assert.equal((await post('engineer2','/cr/5/resume')).status,200);
 await db.query('UPDATE employees SET is_active=0 WHERE id=5');
 await cr(6,1,'100.00');
 assert.equal((await post('engineer','/cr/6/submit')).status,409);
 await db.query('UPDATE employees SET is_active=1 WHERE id=5');
});
test('migration preserves approved history and requires every linked-document disposition',async()=>{
 await db.query("INSERT INTO payment_orders(id,po_number,service_request_id,status,amount) VALUES(1,'TEST-LINK',1,'Approved',100)");
 const links=(await get('admin','/sr/1/migration')).body.links;
 assert.equal(links.length,1);
 assert.equal((await post('admin','/sr/1/migration-restart',{note:'Restart unpaid/unfulfilled',links:[]})).status,409);
 assert.equal((await post('admin','/sr/1/migration-restart',{note:'Preserve existing link and prevent duplicate processing',links:links.map(l=>({...l,note:'Retain existing document; source approval required before payment'}))})).status,200);
 const detail=(await get('admin','/sr/1')).body;
 assert.equal(detail.round.round_number,2);assert.equal(detail.document.status,'For Engineer Review');
 assert.ok(detail.history.some(r=>r.status==='superseded'));
 const [remaining]=await db.query('SELECT id FROM payment_orders WHERE id=1');assert.equal(remaining.length,1);
});
test('20 simultaneous users/read requests fetch uncached SQL views',async()=>{
 const start=Date.now();
 const results=await Promise.all(Array.from({length:20},(_,i)=>get(i%2?'admin':'engineer2','/')));
 assert.ok(results.every(r=>r.status===200 && r.headers['cache-control']==='private, no-store'));
 console.log(`20 concurrent workflow views: ${Date.now()-start} ms total on isolated test database`);
});
test('Redis-disabled reference cache fallback is bounded and workflow data cannot opt in',async()=>{
 assert.equal(await connectRedis(),null);
 let count=0;
 const value=await referenceCache('reference:test',10,async()=>{count++;return {types:['po','sr','cr']};});
 assert.deepEqual(value.types,['po','sr','cr']);
 await referenceCache('reference:test',10,async()=>{count++;return {};});assert.equal(count,1);
 await assert.rejects(()=>referenceCache('workflow:approval',10,async()=>({approved:true})));
});
test('receipt correction retains evidence and does not consume delivery quantities',async()=>{
 const upload=await supertest(app).post('/api/workflows/po/1/receipts').set('Authorization',auth('engineer')).field('event_key','test-po-correct-1').field('details','{"items":[{"line_id":1,"quantity":"1"}]}').attach('receipt',jpeg,'wrong-delivery.jpg');
 assert.equal(upload.status,201);
 assert.equal((await post('admin',`/po/1/receipts/${upload.body.receipt_id}/return`,{comment:'Receipt quantity does not match delivery'})).status,200);
 assert.equal((await get('admin','/po/1')).body.items[0].received_quantity,'1.00');
 const corrected=await supertest(app).post('/api/workflows/po/1/receipts').set('Authorization',auth('engineer')).field('event_key','test-po-correct-2').field('details','{"items":[{"line_id":1,"quantity":"1"}]}').attach('receipt',jpeg,'correct-delivery.jpg');
 assert.equal(corrected.status,201);assert.equal((await post('admin',`/po/1/receipts/${corrected.body.receipt_id}/verify`)).status,200);
 assert.equal((await get('admin','/po/1')).body.document.status,'Completed');
 const [source]=await db.query('SELECT status FROM purchase_requests WHERE id=1');assert.equal(source[0].status,'Completed');
});
test('draft correction validates total and schedules before resubmission',async()=>{
 assert.equal((await post('engineer','/cr/6/draft',{purpose:'Adjusted scope',amount:'10.00',quantity:'2',payment_schedules:[{payment_date:'2030-01-01',amount:'10.00'}]})).status,400);
 assert.equal((await post('engineer','/cr/6/draft',{purpose:'Adjusted scope',amount:'10.00',quantity:'2',payment_schedules:[{payment_date:'2030-01-01',amount:'20.00'}]})).status,200);
 assert.equal((await post('engineer','/cr/6/submit')).status,200);
 assert.equal((await get('engineer','/cr/6')).body.round.total_amount,'20.00');
});
test('Socket.IO rejects missing tokens and client-supplied foreign rooms',async()=>{
 const server=createServer(express()),io=initSocket(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=`http://127.0.0.1:${server.address().port}`;
 const unauthorized=socketClient(address,{transports:['websocket'],reconnection:false});
 const authorized=socketClient(address,{auth:{token:auth('engineer').slice(7)},transports:['websocket'],reconnection:false});
 try{
  const error=await new Promise(resolve=>unauthorized.on('connect_error',resolve));assert.match(error.message,/Authentication/);
  await new Promise((resolve,reject)=>{authorized.on('connect',resolve);authorized.on('connect_error',reject);});
  let forbidden=false;authorized.on('forbidden',()=>{forbidden=true;});authorized.emit('join',3);
  await new Promise(resolve=>setTimeout(resolve,30));io.to('user_3').emit('forbidden',{});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(forbidden,false);
  const own=new Promise(resolve=>authorized.once('allowed',resolve));io.to('user_1').emit('allowed',{ok:true});assert.equal((await own).ok,true);
 }finally{unauthorized.close();authorized.close();await new Promise(resolve=>io.close(resolve));}
});
test('older production schema upgrade restores all failing list endpoints and is repeatable without losing records',async()=>{
 // This test operates ONLY in the uniquely named temporary test database.
 assert.match(process.env.DB_NAME,/^procurement_workflow_test_\d+$/);
 const cashColumns=await columns(db,'cash_requests');
 const status=cashColumns.find(c=>c.Field==='status');
 const existing=[...status.Type.matchAll(/'((?:''|[^'])*)'/g)].map(m=>m[1]);
 await db.query(`ALTER TABLE cash_requests MODIFY COLUMN status ENUM(${[...existing,'Legacy Held'].map(v=>db.escape(v)).join(',')}) NULL`);
 await db.query("INSERT INTO cash_requests(id,cr_number,requested_by,purpose,amount,quantity,status) VALUES(88,'TEST-LEGACY',1,'Preserve older record',10,1,'Legacy Held')");
 // An older schema cannot contain these links, so clear synthetic links before removing the columns.
 await db.query('UPDATE payment_requests SET cash_request_id=NULL');
 const [beforeCash]=await db.query('SELECT id,cr_number,purpose,amount,quantity,status FROM cash_requests ORDER BY id');
 const [beforePayment]=await db.query('SELECT id,pr_number,amount,status FROM payment_requests ORDER BY id');
 for(const table of ['petty_cash_liquidation_receipts','petty_cash_liquidation_reviews','petty_cash_liquidation_expenses','petty_cash_liquidation_submissions','petty_cash_liquidations','petty_cash_request_reviews','petty_cash_request_details'])await db.query(`DROP TABLE IF EXISTS ${table}`);
 for(const name of ['request_kind','payee_name','payee_address','released_by','released_at','release_amount','received_by','received_at'])await db.query(`ALTER TABLE cash_requests DROP COLUMN ${name}`);
 await db.query('ALTER TABLE payment_requests DROP COLUMN cash_request_id');
 if((await columns(db,'payment_orders')).some(c=>c.Field==='reimbursement_id'))await db.query('ALTER TABLE payment_orders DROP COLUMN reimbursement_id');
 await prepareRequestWorkflowSchema(db);await prepareRequestWorkflowSchema(db);
 const [afterCash]=await db.query('SELECT id,cr_number,purpose,amount,quantity,status FROM cash_requests ORDER BY id');
 const [afterPayment]=await db.query('SELECT id,pr_number,amount,status FROM payment_requests ORDER BY id');
 assert.deepEqual(afterCash,beforeCash);assert.deepEqual(afterPayment,beforePayment);
 const [legacy]=await db.query('SELECT request_kind FROM cash_requests WHERE id=88');assert.equal(legacy[0].request_kind,'standard');
 assert.ok((await columns(db,'cash_requests')).find(c=>c.Field==='status').Type.includes("'Legacy Held'"));
 for(const route of ['/api/workflows','/api/cash-requests?kind=standard','/api/petty-cash-requests','/api/payment-requests','/api/payment-orders','/api/disbursement-vouchers']){
   const response=await supertest(app).get(route).set('Authorization',auth('admin'));
   assert.equal(response.status,200,`${route}: ${JSON.stringify(response.body)}`);
 }
});
