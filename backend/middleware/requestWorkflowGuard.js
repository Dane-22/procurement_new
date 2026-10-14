import db from '../config/database.js';
import { authenticate } from './auth.js';
import { modules,fail } from '../utils/requestWorkflowRules.js';
import { document,currentRound,access,submit,review,transaction } from '../services/requestWorkflow.js';

async function lease(req,res,name){
  const conn=await db.getConnection();
  const [result]=await conn.query('SELECT GET_LOCK(?,5) AS acquired',[name]);
  if(!result[0].acquired){conn.release();throw fail('Request is being changed; retry shortly',409);}
  let released=false;
  const release=async()=>{if(released)return;released=true;try{await conn.query('SELECT RELEASE_LOCK(?)',[name]);}finally{conn.release();}};
  res.once('finish',release);res.once('close',release);
  return conn;
}

// Register BEFORE the legacy routers so their broad role/status endpoints cannot bypass rounds.
export const guardModule = kind => [authenticate, async (req,res,next) => {
  try {
    res.set('Cache-Control','private, no-store');
    if(!['GET','HEAD'].includes(req.method))res.once('finish',()=>{if(res.statusCode<400)req.io?.emit('workflow_refresh',{module:kind});});
    const match=req.path.match(/^\/(\d+)(?:\/([^/]+))?/);
    if (!match) {
      if (kind === 'po' && req.method === 'POST' && req.path === '/') {
        if (req.user.role !== 'admin') throw fail('Only Admin prepares Purchase Orders',403);
        req.body.save_as_draft=true; // Explicitly submit through the workflow once preparation is complete.
        const sourceKind=req.body.service_request_id ? 'sr' : null;
        await lease(req,res,sourceKind ? `workflow-payment:sr:${req.body.service_request_id}` : `workflow-po-source:pr:${req.body.purchase_request_id}`);
        if (sourceKind) {
          if(!Array.isArray(req.body.items)||!req.body.items.length)throw fail('SR-based POs require service/item lines for receiving');
          const source=await document(db,'sr',req.body.service_request_id);
          const round=await currentRound(db,'sr',source.id);
          if (round?.status!=='approved') throw fail('Source SR needs new-flow approval',409);
        } else {
          const [rows]=await db.query('SELECT status,payment_basis FROM purchase_requests WHERE id=?',[req.body.purchase_request_id]);
          if (rows[0]?.status!=='For Purchase' || rows[0]?.payment_basis==='non_debt') throw fail('Select an approved debt PR in For Purchase',409);
        }
      }
      return next();
    }
    const [,id,action]=match;
    const row=await document(db,kind,id);
    await access(db,req.user,kind,row);
    if (['GET','HEAD'].includes(req.method)) return next();
    if (['submit','submit-draft'].includes(action) || (action==='status' && req.body.status==='Pending Approval')) return res.json(await transaction(conn=>submit(conn,req.user,kind,id)));
    if (['admin-review','admin-approve','super-admin-approve','approve','review'].includes(action)) {
      const decision=String(req.body.decision || req.body.review_status || req.body.status || '').toLowerCase();
      return res.json(await transaction(conn=>review(conn,req.user,kind,id,decision,req.body.comment || req.body.remarks || req.body.rejection_reason)));
    }
    if (['received','receive'].includes(action)) throw fail('Record receipt evidence and verification in Request Workflows',409);
    if (action==='status') throw fail('Use workflow actions; direct status changes are disabled',409);
    if (action==='resubmit') throw fail('Withdraw for correction, edit the Draft, then submit a fresh review round in Request Workflows',409);
    if (!action || req.method==='DELETE') {
      const conn=await lease(req,res,`workflow-payment:${kind}:${id}`);
      const fresh=await document(conn,kind,id);
      if (Number(row[modules[kind].owner])!==Number(req.user.id)) throw fail('Only the document owner may edit',403);
      if (fresh.status!=='Draft') throw fail('Only Draft requests may be edited; withdraw submitted requests first',409);
      const round=await currentRound(db,kind,id);
      if (round && !['withdrawn','rejected'].includes(round.status)) throw fail('Workflow history cannot be removed or edited through a legacy route',409);
      if (req.method==='DELETE' && round) throw fail('Documents with workflow history cannot be deleted',409);
    }
    next();
  } catch(error) { res.status(error.statusCode || 503).json({message:error.statusCode ? error.message : 'Workflow schema/database unavailable; run the workflow migration'}); }
}];

// SQL advisory locks serialize legacy downstream creation for the same source across workers.
export async function guardPaymentSource(req,res,next) {
  if (req.method!=='POST' || req.path!=='/') return next();
  const kind=req.body.service_request_id ? 'sr' : req.body.cash_request_id ? 'cr' : null;
  if (!kind) return next();
  let conn, lock;
  try {
    const id=req.body.service_request_id || req.body.cash_request_id;
    conn=await db.getConnection(); lock=`workflow-payment:${kind}:${id}`;
    const [acquired]=await conn.query('SELECT GET_LOCK(?,5) AS acquired',[lock]);
    if (Number(acquired[0].acquired)!==1) throw fail('Source is being processed; retry shortly',409);
    const row=await document(conn,kind,id),round=await currentRound(conn,kind,id);
    if (!round || round.status!=='approved' || row.status!=='Approved') throw fail('Source needs current workflow approval and must not already have a payment document',409);
    const column=kind==='sr' ? 'service_request_id' : 'cash_request_id';
    for (const table of ['payment_requests','payment_orders']) {
      const [linked]=await conn.query(`SELECT id FROM ${table} WHERE ${column}=? AND status NOT IN ('Cancelled','Rejected') LIMIT 1`,[id]);
      if (linked.length) throw fail('This source already has a linked payment document; review it individually',409);
    }
    req.body.amount=Number(round.total_amount); // Never trust client totals for approved source processing.
    let released=false;
    const release=async()=>{ if(released)return; released=true; try{await conn.query('SELECT RELEASE_LOCK(?)',[lock]);}finally{conn.release();} };
    res.once('finish',release); res.once('close',release);
    next();
  } catch(error) {
    if(conn){if(lock)await conn.query('SELECT RELEASE_LOCK(?)',[lock]).catch(()=>{});conn.release();}
    res.status(error.statusCode || 503).json({message:error.statusCode ? error.message : 'Workflow database unavailable'});
  }
}

// Linked-document changes cannot bypass a source's restarted approval.
export const guardLinkedDocument = table => [authenticate, async(req,res,next)=>{
  if(['GET','HEAD'].includes(req.method))return next();
  try{
    res.once('finish',()=>{if(res.statusCode<400)req.io?.emit('workflow_refresh',{});});
    const id=req.path.match(/^\/(\d+)/)?.[1];
    let linked=id ? (await db.query(`SELECT * FROM ${table} WHERE id=?`,[id]))[0][0] : req.body;
    if(!linked)return next();
    if(table==='disbursement_vouchers' && !linked.service_request_id && !linked.cash_request_id && !linked.purchase_order_id){
      for(const [fk,paymentTable]of [['payment_request_id','payment_requests'],['payment_order_id','payment_orders']])if(linked[fk]){
        const [source]=await db.query(`SELECT * FROM ${paymentTable} WHERE id=?`,[linked[fk]]);linked={...linked,...source[0]};
      }
    }
    for(const [kind,fk]of [['po','purchase_order_id'],['sr','service_request_id'],['cr','cash_request_id']])if(linked[fk]){
      if(kind==='cr'){
        const [records]=await db.query('SELECT request_kind FROM cash_requests WHERE id=?',[linked[fk]]);
        if(records[0]?.request_kind==='petty_cash')continue;
      }
      const round=await currentRound(db,kind,linked[fk]);
      if(round?.status!=='approved')throw fail('Linked source requires new-flow approval before downstream changes/payment',409);
      if(kind==='cr'&&req.path.endsWith('/mark-paid')&&req.user.role!=='admin')throw fail('Only Admin releases cash',403);
    }
    next();
  }catch(error){res.status(error.statusCode||503).json({message:error.statusCode?error.message:'Workflow database unavailable'});}
}];
