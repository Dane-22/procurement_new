import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import db from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { modules, fail, moneyCents, lineCents, stageStatuses, finalRoleAlreadyApproved } from '../utils/requestWorkflowRules.js';
import { document, currentRound, access, votes, submit, review, transaction, event, setSourceStatus } from '../services/requestWorkflow.js';
import { linkedDocuments,recordMigrationReview,inventory } from '../services/requestWorkflowMigration.js';
import { referenceCache } from '../services/redisCache.js';

const router = express.Router();
const privateDirectory = fileURLToPath(new URL('../private/workflow-receipts/', import.meta.url));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 10 } });
const wrap = fn => async (req,res,next) => { try { await fn(req,res); } catch (error) { next(error); } };
const parseJSON = value => typeof value === 'string' ? JSON.parse(value) : value;
router.use(authenticate, (req,res,next) => { res.set('Cache-Control','private, no-store'); next(); });
router.get('/reference/options',wrap(async(req,res)=>res.json(await referenceCache('reference:workflow-options',300,async()=>({module_labels:{po:'Purchase Order',sr:'Service Request',cr:'Cash Request'},receipt_types:['image/png','image/jpeg','application/pdf']})))));
router.get('/migration/inventory',wrap(async(req,res)=>{
  if(req.user.role!=='admin')throw fail('Only Admin reviews migration candidates',403);
  res.json({requests:await inventory(db)});
}));
router.get('/:kind/:id/migration',wrap(async(req,res)=>{
  if(req.user.role!=='admin')throw fail('Only Admin reviews migration candidates',403);
  const row=await document(db,req.params.kind,req.params.id);
  res.json({links:await linkedDocuments(db,req.params.kind,row.id)});
}));
router.post('/:kind/:id/migration-restart',wrap(async(req,res)=>{
  res.json(await transaction(async conn=>{
    const row=await document(conn,req.params.kind,req.params.id,true);
    await recordMigrationReview(conn,req.user,req.params.kind,row,req.body);
    return submit(conn,req.user,req.params.kind,row.id,{migration:true});
  }));
}));

router.get('/', wrap(async (req,res) => {
  const rows = [];
  for (const [kind, module] of Object.entries(modules)) {
    const [documents] = await db.query(`SELECT d.id,d.${module.number} AS number,d.${module.owner} AS owner_id,d.status,d.updated_at,e.first_name,e.last_name,
      r.id AS round_id,r.round_number,r.stage,r.status AS approval_status,r.total_amount,
      CASE WHEN r.status='review' AND EXISTS(SELECT 1 FROM request_workflow_reviews v WHERE v.round_id=r.id AND v.stage=r.stage AND v.reviewer_id=? AND v.role=? AND v.decision='pending'
      AND (r.stage<>'final' OR NOT EXISTS(SELECT 1 FROM request_workflow_reviews done JOIN employees active ON active.id=done.reviewer_id AND active.is_active=1 AND active.role=done.role WHERE done.round_id=r.id AND done.stage='final' AND done.role=v.role AND done.decision='approved'))) THEN 1 ELSE 0 END AS can_review
      FROM ${module.table} d JOIN employees e ON e.id=d.${module.owner}
      LEFT JOIN request_workflow_rounds r ON r.id=(SELECT latest.id FROM request_workflow_rounds latest WHERE latest.module=? AND latest.document_id=d.id ORDER BY latest.round_number DESC LIMIT 1)
      WHERE ${kind === 'cr' ? "COALESCE(d.request_kind,'standard')<>'petty_cash' AND" : ''}
      (? IN ('admin','super_admin','ceo') OR d.${module.owner}=? OR EXISTS(SELECT 1 FROM request_workflow_reviews mine JOIN request_workflow_rounds mr ON mr.id=mine.round_id WHERE mr.module=? AND mr.document_id=d.id AND mine.reviewer_id=?)
       ${kind === 'po' ? "OR EXISTS(SELECT 1 FROM purchase_requests p WHERE p.id=d.purchase_request_id AND p.requested_by=?) OR EXISTS(SELECT 1 FROM service_requests s WHERE s.id=d.service_request_id AND s.requested_by=?) OR EXISTS(SELECT 1 FROM request_workflow_events receiver WHERE receiver.module='po' AND receiver.document_id=d.id AND receiver.action='receiver_assigned' AND JSON_EXTRACT(receiver.payload,'$.receiver_id')=?)" : ''})
      ORDER BY d.updated_at DESC,d.id DESC LIMIT 200`, [req.user.id,req.user.role,kind, req.user.role, req.user.id,kind,req.user.id,...(kind === 'po' ? [req.user.id,req.user.id,req.user.id] : [])]);
    rows.push(...documents.map(d => ({...d,module:kind})));
  }
  res.json({ requests: rows.sort((a,b) => new Date(b.updated_at)-new Date(a.updated_at)), limit_per_module:200 });
}));
router.get('/:kind/:id', wrap(async (req,res) => {
  const { kind,id } = req.params;
  const row = await document(db,kind,id);
  await access(db,req.user,kind,row);
  const round = await currentRound(db,kind,id);
  const [history] = await db.query('SELECT * FROM request_workflow_rounds WHERE module=? AND document_id=? ORDER BY round_number DESC',[kind,id]);
  const [reviews] = await db.query('SELECT v.*,e.first_name,e.last_name,IF(e.is_active=1 AND e.role=v.role,1,0) AS is_active FROM request_workflow_reviews v JOIN request_workflow_rounds r ON r.id=v.round_id JOIN employees e ON e.id=v.reviewer_id WHERE r.module=? AND r.document_id=? ORDER BY r.round_number,v.id',[kind,id]);
  const [receipts] = await db.query('SELECT id,round_id,actor_id,event_key,original_name,amount,details,verified_by,verified_at,confirmed_at,status,review_comment,created_at FROM request_workflow_receipts WHERE module=? AND document_id=? ORDER BY id',[kind,id]);
  const [events] = await db.query('SELECT id,actor_id,action,payload,created_at FROM request_workflow_events WHERE module=? AND document_id=? ORDER BY id DESC LIMIT 100',[kind,id]);
  const [items] = kind === 'po' ? await db.query('SELECT poi.*,i.item_name FROM purchase_order_items poi LEFT JOIN items i ON i.id=poi.item_id WHERE poi.purchase_order_id=? ORDER BY poi.id',[id]) : [[]];
  const mine = reviews.find(v => v.round_id === round?.id && v.stage === round?.stage && Number(v.reviewer_id) === Number(req.user.id) && v.role===req.user.role && v.is_active===1 && v.decision === 'pending');
  const activeVotes = reviews.filter(v => v.round_id === round?.id && v.stage === round?.stage);
  const canReview = round?.status === 'review' && mine && !(round.stage === 'final' && finalRoleAlreadyApproved(activeVotes,req.user.role));
  const paymentReady=kind==='cr'?await cashPaymentReady(db,row.id):true;
  const canUpload=kind==='po'?Boolean(await canReceive(db,req.user,row)):kind==='cr'?req.user.role==='admin'&&paymentReady:Number(row.requested_by)===Number(req.user.id);
  let schedules=[],suppliers=[];
  if(kind!=='po'){
    const [scheduled]=await db.query(`SELECT payment_date,amount,note FROM ${kind==='sr'?'service_request':'cash_request'}_payment_schedules WHERE ${kind==='sr'?'service_request':'cash_request'}_id=? ORDER BY payment_date`,[id]);schedules=scheduled;
    const [choices]=await db.query('SELECT id,supplier_name FROM suppliers ORDER BY supplier_name');suppliers=choices;
  }
  res.json({ document:row,round,history,reviews,receipts,events,items,schedules,suppliers,payment_ready:paymentReady,can_review:Boolean(canReview),can_upload_receipt:canUpload });
}));
router.post('/:kind/:id/draft',wrap(async(req,res)=>{
  res.json(await transaction(async conn=>{
    const {kind,id}=req.params;
    if(kind==='po')throw fail('Edit PO lines on the Purchase Orders page');
    const row=await document(conn,kind,id,true),round=await currentRound(conn,kind,id,true);
    if(Number(row.requested_by)!==Number(req.user.id))throw fail('Only the original requester may edit',403);
    if(row.status!=='Draft'||round&&!['withdrawn','rejected'].includes(round.status))throw fail('Withdraw for correction before editing',409);
    const purpose=String(req.body.purpose||'').trim(),quantity=String(req.body.quantity || '1');
    if(!purpose)throw fail('Purpose is required');
    const cents=lineCents(req.body.amount,quantity);if(!cents)throw fail('Request total must be positive');
    if(kind==='sr'&&!req.body.supplier_id)throw fail('Choose the quoted supplier');
    const schedules=req.body.payment_schedules;
    if(!Array.isArray(schedules)||!schedules.length||schedules.length>50)throw fail('Enter 1 to 50 payment schedules');
    const seen=new Set();let sum=0;
    for(const schedule of schedules){
      const date=String(schedule.payment_date||'');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||seen.has(date))throw fail('Payment dates must be valid and unique');
      seen.add(date);sum+=moneyCents(schedule.amount);
    }
    if(sum!==cents)throw fail('Schedules must equal unit price × quantity');
    if(req.body.supplier_id){const [exists]=await conn.query('SELECT id FROM suppliers WHERE id=?',[req.body.supplier_id]);if(!exists.length)throw fail('Supplier not found');}
    await conn.query(`UPDATE ${modules[kind].table} SET purpose=?,description=?,amount=?,quantity=?,supplier_id=?,updated_at=NOW() WHERE id=?`,[purpose,String(req.body.description||'').slice(0,10000),req.body.amount,quantity,req.body.supplier_id||null,id]);
    const table=kind==='sr'?'service_request':'cash_request';
    await conn.query(`DELETE FROM ${table}_payment_schedules WHERE ${table}_id=?`,[id]);
    for(const schedule of schedules)await conn.query(`INSERT INTO ${table}_payment_schedules(${table}_id,payment_date,amount,note) VALUES(?,?,?,?)`,[id,schedule.payment_date,schedule.amount,String(schedule.note||'').slice(0,1000)]);
    if(round)await event(conn,kind,row,round,req.user,'draft_corrected');
    return {message:'Draft corrected; submit a fresh review round when ready'};
  }));
}));
router.post('/:kind/:id/submit', wrap(async (req,res) => res.json(await transaction(conn => submit(conn,req.user,req.params.kind,req.params.id)))));
router.post('/:kind/:id/review', wrap(async (req,res) => res.json(await transaction(conn => review(conn,req.user,req.params.kind,req.params.id,req.body.decision,req.body.comment)))));
router.post('/:kind/:id/hold', wrap(async (req,res) => {
  res.json(await transaction(async conn => {
    const row = await document(conn,req.params.kind,req.params.id,true);
    const round = await currentRound(conn,req.params.kind,row.id,true);
    if (!round || round.status !== 'review' || !String(req.body.comment || '').trim()) throw fail('An active review and hold reason are required');
    const assigned = await votes(conn,round);
    if (!assigned.some(v => Number(v.reviewer_id) === Number(req.user.id) && Number(v.is_active) === 1)) throw fail('Only an active assigned reviewer can hold this stage',403);
    await conn.query("UPDATE request_workflow_rounds SET status='hold',held_stage=stage,updated_at=NOW() WHERE id=?",[round.id]);
    await setSourceStatus(conn,req.params.kind,row.id,'On Hold');
    await event(conn,req.params.kind,row,round,req.user,'hold',{comment:req.body.comment});
    return { message:'Request placed on hold' };
  }));
}));
router.post('/:kind/:id/resume', wrap(async (req,res) => {
  res.json(await transaction(async conn => {
    const row = await document(conn,req.params.kind,req.params.id,true);
    const round = await currentRound(conn,req.params.kind,row.id,true);
    if (!round || round.status !== 'hold') throw fail('Request is not on hold',409);
    const assigned = await votes(conn,round,round.held_stage);
    if (!assigned.some(v => Number(v.reviewer_id) === Number(req.user.id) && Number(v.is_active) === 1)) throw fail('Only an assigned reviewer may resolve this hold',403);
    await conn.query("UPDATE request_workflow_rounds SET status='review',stage=held_stage,held_stage=NULL,updated_at=NOW() WHERE id=?",[round.id]);
    await setSourceStatus(conn,req.params.kind,row.id,stageStatuses[round.held_stage]);
    await event(conn,req.params.kind,row,round,req.user,'resumed');
    return {message:'Review resumed'};
  }));
}));
router.post('/:kind/:id/withdraw', wrap(async (req,res) => {
  res.json(await transaction(async conn => {
    const row = await document(conn,req.params.kind,req.params.id,true);
    const round = await currentRound(conn,req.params.kind,row.id,true);
    if (Number(row[modules[req.params.kind].owner]) !== Number(req.user.id)) throw fail('Only the owner may withdraw for editing',403);
    if (round && !['review','hold','rejected'].includes(round.status)) throw fail('Downstream/approved documents require individual amendment review',409);
    if (round) {
      await conn.query("UPDATE request_workflow_rounds SET status='withdrawn',updated_at=NOW() WHERE id=?",[round.id]);
      await event(conn,req.params.kind,row,round,req.user,'withdrawn');
    }
    await setSourceStatus(conn,req.params.kind,row.id,'Draft');
    return {message:'Draft ready for correction; previous approvals are retained as history'};
  }));
}));

router.post('/:kind/:id/receipts', upload.single('receipt'), wrap(async (req,res) => {
  const file = req.file;
  const isPNG = file?.buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJPEG = file?.buffer[0] === 255 && file?.buffer[1] === 216 && file?.buffer[2] === 255;
  const isPDF = file?.buffer.subarray(0,5).toString() === '%PDF-';
  const mime = isPNG ? 'image/png' : isJPEG ? 'image/jpeg' : isPDF ? 'application/pdf' : null;
  if (!mime) throw fail('Attach a PNG, JPEG or PDF receipt (maximum 10 MB)');
  const details = parseJSON(req.body.details || '{}');
  const key = String(req.body.event_key || '');
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw fail('A valid receipt event key is required');
  const stored = randomUUID();
  await fs.mkdir(privateDirectory,{recursive:true});
  await fs.writeFile(path.join(privateDirectory,stored),file.buffer,{flag:'wx'});
  try {
    const result = await transaction(async conn => {
      const {kind,id} = req.params;
      const row = await document(conn,kind,id,true);
      const round = await currentRound(conn,kind,id,true);
      if (!round || round.status !== 'approved') throw fail('Only approved requests can receive fulfillment/release evidence',409);
      await access(conn,req.user,kind,row);
      if (kind === 'cr' ? req.user.role !== 'admin' : kind === 'sr' ? Number(row.requested_by) !== Number(req.user.id) : !(await canReceive(conn,req.user,row))) throw fail('You cannot record this receipt event',403);
      const [duplicate] = await conn.query('SELECT id FROM request_workflow_receipts WHERE module=? AND document_id=? AND event_key=?',[kind,id,key]);
      if (duplicate.length) throw fail('This receipt event is already recorded',409);
      let cents = null;
      if (kind === 'cr') {
        if(!await cashPaymentReady(conn,id))throw fail('Approve the linked Payment Request/Order before releasing cash',409);
        if(details.signed_receipt!==true)throw fail('A signed release receipt is required');
        cents = moneyCents(req.body.amount);
        const [released] = await conn.query("SELECT COALESCE(SUM(amount),0) AS total FROM request_workflow_receipts WHERE module='cr' AND document_id=?",[id]);
        const baseline=Math.round(Number(row.release_amount || 0)*100);
        if (!cents || cents + Math.max(baseline,Math.round(Number(released[0].total)*100)) > Math.round(Number(round.total_amount)*100)) throw fail('Release exceeds the approved remaining amount');
      }
      if (kind === 'po') {
        if (!Array.isArray(details.items) || !details.items.length) throw fail('Receipt needs delivered PO line quantities');
        const seen = new Set();
        for (const item of details.items) {
          if (seen.has(Number(item.line_id))) throw fail('Duplicate receipt line');
          seen.add(Number(item.line_id));
          const qty = Number(item.quantity);
          if (!Number.isFinite(qty) || qty <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(item.quantity))) throw fail('Positive delivered quantity required');
          const [lines] = await conn.query('SELECT quantity,received_quantity FROM purchase_order_items WHERE id=? AND purchase_order_id=? FOR UPDATE',[item.line_id,id]);
          const [pending] = await conn.query("SELECT details FROM request_workflow_receipts WHERE module='po' AND document_id=? AND verified_at IS NULL AND status<>'returned'",[id]);
          const pendingQty = pending.reduce((sum,r) => sum + (parseJSON(r.details).items || []).filter(i=>Number(i.line_id)===Number(item.line_id)).reduce((s,i)=>s+Number(i.quantity),0),0);
          if (!lines[0] || qty + pendingQty + Number(lines[0].received_quantity || 0) > Number(lines[0].quantity)) throw fail('Delivered quantity exceeds the remaining PO line quantity');
        }
      }
      if (kind === 'sr') {
        if (details.service_completed !== true) throw fail('Confirm the service was actually completed');
        const [existing] = await conn.query("SELECT id FROM request_workflow_receipts WHERE module='sr' AND document_id=? AND status<>'returned'",[id]);
        if (existing.length) throw fail('Service acceptance already recorded; correct the existing event',409);
      }
      const [insert] = await conn.query('INSERT INTO request_workflow_receipts(module,document_id,round_id,actor_id,event_key,original_name,stored_name,mime_type,amount,details) VALUES(?,?,?,?,?,?,?,?,?,?)',[kind,id,round.id,req.user.id,key,path.basename(file.originalname).slice(0,255),stored,mime,cents === null ? null : (cents/100).toFixed(2),JSON.stringify(details)]);
      if(kind==='cr')await conn.query('UPDATE cash_requests SET release_amount=COALESCE(release_amount,0)+?,released_by=?,released_at=NOW() WHERE id=?',[(cents/100).toFixed(2),req.user.id,id]);
      await event(conn,kind,row,round,req.user,kind === 'cr' ? 'cash_released' : 'receipt_uploaded',{receipt_id:insert.insertId});
      return {message:'Receipt event recorded',receipt_id:insert.insertId};
    });
    res.status(201).json(result);
  } catch(error) { await fs.unlink(path.join(privateDirectory,stored)).catch(()=>{}); throw error; }
}));
async function canReceive(conn,user,row) {
  const [owner] = await conn.query('SELECT requested_by FROM purchase_requests WHERE id=? UNION SELECT requested_by FROM service_requests WHERE id=?',[row.purchase_request_id || null,row.service_request_id || null]);
  if (owner.some(o=>Number(o.requested_by)===Number(user.id))) return true;
  const [assigned] = await conn.query("SELECT id FROM request_workflow_events WHERE module='po' AND document_id=? AND action='receiver_assigned' AND JSON_EXTRACT(payload,'$.receiver_id')=? ORDER BY id DESC LIMIT 1",[row.id,user.id]);
  return user.role === 'engineer' && assigned.length > 0;
}
async function cashPaymentReady(conn,id){
  const [records]=await conn.query("SELECT id FROM payment_requests WHERE cash_request_id=? AND status IN ('Approved','DV Created','Paid') UNION SELECT id FROM payment_orders WHERE cash_request_id=? AND status IN ('Approved','DV Created')",[id,id]);
  return records.length>0;
}
router.post('/po/:id/receiver', wrap(async(req,res) => {
  if (req.user.role !== 'admin') throw fail('Only Admin assigns receiving Engineers',403);
  res.json(await transaction(async conn=>{
    const row=await document(conn,'po',req.params.id,true), round=await currentRound(conn,'po',row.id,true);
    if (!round) throw fail('Submit the PO first');
    const [eligible]=await conn.query("SELECT id FROM employees WHERE id=? AND role='engineer' AND is_active=1",[req.body.receiver_id]);
    if (!eligible.length) throw fail('Choose an active Engineer');
    await event(conn,'po',row,round,req.user,'receiver_assigned',{receiver_id:Number(req.body.receiver_id)});
    return {message:'Receiving Engineer assigned'};
  }));
}));
router.post('/:kind/:id/receipts/:receiptId/verify', wrap(async(req,res)=>{
  if (req.user.role !== 'admin') throw fail('Only Admin verifies receipts',403);
  res.json(await transaction(async conn=>{
    const {kind,id,receiptId}=req.params;
    const row=await document(conn,kind,id,true), round=await currentRound(conn,kind,id,true);
    if (!round || round.status !== 'approved' || kind === 'cr') throw fail('Use requester confirmation for cash releases');
    const [receipts]=await conn.query('SELECT * FROM request_workflow_receipts WHERE id=? AND module=? AND document_id=? FOR UPDATE',[receiptId,kind,id]);
    const receipt=receipts[0];
    if (!receipt || receipt.verified_at || receipt.status==='returned') throw fail('Receipt is missing, returned or already verified',409);
    if (kind === 'po') {
      for (const item of parseJSON(receipt.details).items) {
        const [lines]=await conn.query('SELECT quantity,received_quantity FROM purchase_order_items WHERE id=? AND purchase_order_id=? FOR UPDATE',[item.line_id,id]);
        if (!lines[0] || Number(lines[0].received_quantity || 0)+Number(item.quantity)>Number(lines[0].quantity)) throw fail('Quantity changed; inspect this receipt',409);
        await conn.query("UPDATE purchase_order_items SET received_quantity=COALESCE(received_quantity,0)+?,status=CASE WHEN COALESCE(received_quantity,0)>=quantity THEN 'Completed' ELSE 'Partial Received' END WHERE id=? AND purchase_order_id=?",[item.quantity,item.line_id,id]);
      }
      const [remaining]=await conn.query('SELECT COUNT(*) AS count FROM purchase_order_items WHERE purchase_order_id=? AND COALESCE(received_quantity,0)<quantity',[id]);
      await setSourceStatus(conn,kind,id,remaining[0].count === 0 ? 'Completed' : 'Partial Received');
      // PR approval routes remain unchanged. Source completion is based on all linked PO fulfillment.
      if (!remaining[0].count && row.purchase_request_id) {
        const [unfinished]=await conn.query("SELECT COUNT(*) AS count FROM purchase_orders WHERE purchase_request_id=? AND status NOT IN ('Completed','Cancelled')",[row.purchase_request_id]);
        if (!unfinished[0].count) await conn.query("UPDATE purchase_requests SET status='Completed' WHERE id=?",[row.purchase_request_id]);
      }
    } else await setSourceStatus(conn,kind,id,'Received');
    await conn.query("UPDATE request_workflow_receipts SET verified_by=?,verified_at=NOW(),status='verified' WHERE id=?",[req.user.id,receiptId]);
    await event(conn,kind,row,round,req.user,'receipt_verified',{receipt_id:Number(receiptId)});
    return {message:'Receipt verified'};
  }));
}));
router.post('/cr/:id/receipts/:receiptId/confirm',wrap(async(req,res)=>{
  res.json(await transaction(async conn=>{
    const row=await document(conn,'cr',req.params.id,true),round=await currentRound(conn,'cr',row.id,true);
    if (Number(row.requested_by)!==Number(req.user.id)) throw fail('Only the original requester confirms cash receipt',403);
    if (!round || round.status!=='approved') throw fail('Request needs current approval',409);
    const [receipts]=await conn.query("SELECT * FROM request_workflow_receipts WHERE id=? AND module='cr' AND document_id=? FOR UPDATE",[req.params.receiptId,row.id]);
    if (!receipts[0] || receipts[0].confirmed_at) throw fail('Release missing or already confirmed',409);
    await conn.query('UPDATE request_workflow_receipts SET confirmed_at=NOW() WHERE id=?',[req.params.receiptId]);
    const [confirmed]=await conn.query("SELECT COALESCE(SUM(amount),0) AS total FROM request_workflow_receipts WHERE module='cr' AND document_id=? AND confirmed_at IS NOT NULL",[row.id]);
    if (Math.round(Number(confirmed[0].total)*100)===Math.round(Number(round.total_amount)*100)) {
      await setSourceStatus(conn,'cr',row.id,'Received');
      await conn.query('UPDATE cash_requests SET received_by=?,received_at=NOW() WHERE id=?',[req.user.id,row.id]);
    }
    await event(conn,'cr',row,round,req.user,'cash_receipt_confirmed',{receipt_id:Number(req.params.receiptId)});
    return {message:'Cash receipt confirmed'};
  }));
}));
router.post('/:kind/:id/receipts/:receiptId/return',wrap(async(req,res)=>{
  if(req.user.role!=='admin'||req.params.kind==='cr')throw fail('Admin may return unverified delivery/service receipts only',403);
  if(!String(req.body.comment||'').trim())throw fail('A correction reason is required');
  res.json(await transaction(async conn=>{
    const {kind,id,receiptId}=req.params,row=await document(conn,kind,id,true),round=await currentRound(conn,kind,id,true);
    const [receipts]=await conn.query('SELECT * FROM request_workflow_receipts WHERE id=? AND module=? AND document_id=? FOR UPDATE',[receiptId,kind,id]);
    if(!receipts[0]||receipts[0].verified_at||receipts[0].status==='returned'||round?.status!=='approved')throw fail('Receipt cannot be returned in its current state',409);
    await conn.query("UPDATE request_workflow_receipts SET status='returned',review_comment=?,verified_by=? WHERE id=?",[String(req.body.comment).slice(0,4000),req.user.id,receiptId]);
    await event(conn,kind,row,round,req.user,'receipt_returned',{receipt_id:Number(receiptId),comment:req.body.comment});
    return {message:'Receipt returned for correction; upload a corrected receipt event'};
  }));
}));
router.get('/:kind/:id/receipts/:receiptId/download',wrap(async(req,res)=>{
  const row=await document(db,req.params.kind,req.params.id); await access(db,req.user,req.params.kind,row);
  const [receipts]=await db.query('SELECT * FROM request_workflow_receipts WHERE id=? AND module=? AND document_id=?',[req.params.receiptId,req.params.kind,row.id]);
  if (!receipts[0]) throw fail('Receipt not found',404);
  res.type(receipts[0].mime_type); res.set('Content-Disposition',`attachment; filename="${receipts[0].original_name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`);
  res.sendFile(path.join(privateDirectory,path.basename(receipts[0].stored_name)));
}));
router.use((error,req,res,next)=>{
  if (res.headersSent) return next(error);
  console.error('Workflow error:',error.message);
  res.status(error.statusCode || (error.code === 'ER_NO_SUCH_TABLE' ? 503 : error instanceof SyntaxError || error instanceof multer.MulterError ? 400 : 500)).json({message:error.code === 'ER_NO_SUCH_TABLE' ? 'Apply the request workflow schema migration before using this module' : error.statusCode || error instanceof SyntaxError || error instanceof multer.MulterError ? error.message : 'Request workflow operation failed'});
});
export default router;
