import db from '../config/database.js';
import { modules, fail, lineCents, initialStage, nextStage, stageStatuses, stageComplete, finalRoleAlreadyApproved } from '../utils/requestWorkflowRules.js';
import { assertOrderNumberUnlocked } from '../utils/orderNumberLocks.js';

export async function document(conn, kind, id, lock = false) {
  const module = modules[kind];
  if (!module || !/^\d+$/.test(String(id))) throw fail('Unknown request', 404);
  const [rows] = await conn.query(`SELECT d.*, e.role AS owner_role FROM ${module.table} d JOIN employees e ON e.id=d.${module.owner} WHERE d.id=? ${lock ? 'FOR UPDATE' : ''}`, [id]);
  const row = rows[0];
  if (!row || (kind === 'cr' && row.request_kind === 'petty_cash')) throw fail('Request not found', 404);
  return row;
}
export async function currentRound(conn, kind, id, lock = false) {
  const [rows] = await conn.query(`SELECT * FROM request_workflow_rounds WHERE module=? AND document_id=? ORDER BY round_number DESC LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`, [kind, id]);
  return rows[0];
}
export async function access(conn, user, kind, row) {
  if (Number(row[modules[kind].owner]) === Number(user.id) || ['admin', 'super_admin', 'ceo'].includes(user.role)) return;
  const [reviewers] = await conn.query('SELECT 1 FROM request_workflow_reviews v JOIN request_workflow_rounds r ON r.id=v.round_id WHERE r.module=? AND r.document_id=? AND v.reviewer_id=? LIMIT 1', [kind, row.id, user.id]);
  if (reviewers.length) return;
  if (kind === 'po') {
    const [receivers]=await conn.query("SELECT 1 FROM request_workflow_events WHERE module='po' AND document_id=? AND action='receiver_assigned' AND JSON_EXTRACT(payload,'$.receiver_id')=? LIMIT 1",[row.id,user.id]);
    if(user.role==='engineer'&&receivers.length)return;
    const [sources] = await conn.query('SELECT 1 FROM purchase_requests WHERE id=? AND requested_by=? UNION SELECT 1 FROM service_requests WHERE id=? AND requested_by=?', [row.purchase_request_id || null, user.id, row.service_request_id || null, user.id]);
    if (sources.length) return;
  }
  throw fail('You cannot access this request', 403);
}
export async function totalCents(conn, kind, row) {
  if (kind !== 'po') return lineCents(row.amount, row.quantity ?? 1);
  const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id=? ORDER BY id', [row.id]);
  if (!items.length) throw fail('A purchase order needs line items');
  return items.reduce((sum, item) => sum + lineCents(item.unit_price, item.quantity), 0);
}
export async function votes(conn, round, stage = round.stage) {
  const [rows] = await conn.query('SELECT v.*, IF(e.is_active=1 AND e.role=v.role,1,0) AS is_active, e.first_name, e.last_name FROM request_workflow_reviews v JOIN employees e ON e.id=v.reviewer_id WHERE v.round_id=? AND v.stage=? ORDER BY v.id', [round.id, stage]);
  return rows;
}
export async function setSourceStatus(conn, kind, id, status) {
  await conn.query(`UPDATE ${modules[kind].table} SET status=?, updated_at=NOW() WHERE id=?`, [status, id]);
}
export async function event(conn, kind, row, round, user, action, extra = {}) {
  const [assigned] = await conn.query('SELECT DISTINCT reviewer_id FROM request_workflow_reviews WHERE round_id=?', [round.id]);
  const [admins] = await conn.query("SELECT id FROM employees WHERE role='admin' AND is_active=1");
  const recipients = [...new Set([Number(row[modules[kind].owner]), user.id, ...assigned.map(v => v.reviewer_id), ...admins.map(v => v.id)])];
  if(kind==='po'){
    const [owners]=await conn.query('SELECT requested_by FROM purchase_requests WHERE id=? UNION SELECT requested_by FROM service_requests WHERE id=?',[row.purchase_request_id||null,row.service_request_id||null]);
    recipients.push(...owners.map(o=>o.requested_by));
  }
  await conn.query('INSERT INTO request_workflow_events(module,document_id,round_id,actor_id,action,payload,recipients) VALUES(?,?,?,?,?,?,?)', [kind, row.id, round.id, user.id, action, JSON.stringify({ number: row[modules[kind].number], stage: round.stage, ...extra }), JSON.stringify([...new Set(recipients)])]);
}
export async function transaction(fn) {
  const conn = await db.getConnection();
  try { await conn.beginTransaction(); const value = await fn(conn); await conn.commit(); return value; }
  catch (error) { await conn.rollback(); throw error; }
  finally { for(const name of conn.workflowLocks || [])await conn.query('SELECT RELEASE_LOCK(?)',[name]).catch(()=>{}); conn.workflowLocks=[]; conn.release(); }
}
export async function submit(conn, user, kind, id, { migration = false } = {}) {
  const lock=`workflow-payment:${kind}:${id}`;
  const [locked]=await conn.query('SELECT GET_LOCK(?,5) AS acquired',[lock]);
  if(!locked[0].acquired)throw fail('Downstream processing is in progress; retry shortly',409);
  conn.workflowLocks=[...(conn.workflowLocks || []),lock];
  const row = await document(conn, kind, id, true);
  const owner = Number(row[modules[kind].owner]);
  if (migration ? user.role !== 'admin' : owner !== Number(user.id)) throw fail('Only the owner may submit; migration requires Admin', 403);
  await assertOrderNumberUnlocked(row.order_number, 'workflow submission');
  const old = await currentRound(conn, kind, id, true);
  if (!migration && !['Draft', 'Rejected', 'Returned'].includes(row.status) && !['rejected'].includes(old?.status)) throw fail('Withdraw/revise the request before resubmitting', 409);
  if (migration) {
    const [review] = await conn.query('SELECT 1 FROM request_workflow_migration_reviews WHERE module=? AND document_id=?', [kind, id]);
    if (!review.length) throw fail('Review and record linked-document handling before restarting this request', 409);
  }
  const cents = await totalCents(conn, kind, row);
  if (cents <= 0) throw fail('Full request total must be positive');
  if (kind !== 'po') {
    if (!row.purpose?.trim()) throw fail('Purpose is required');
    const table = kind === 'sr' ? 'service_request_payment_schedules' : 'cash_request_payment_schedules';
    const column = kind === 'sr' ? 'service_request_id' : 'cash_request_id';
    const [schedules] = await conn.query(`SELECT amount FROM ${table} WHERE ${column}=?`, [id]);
    if (!schedules.length || schedules.reduce((sum, s) => sum + Math.round(Number(s.amount) * 100), 0) !== cents) throw fail('Payment schedules must equal unit price × quantity');
    if (kind === 'sr' && !row.supplier_id) throw fail('Select the quoted supplier before submitting');
  } else {
    if (row.owner_role !== 'admin') throw fail('Purchase Orders must be prepared by Admin');
    // Existing PO creation marks the source PO Created; require proof of its approval.
    if (row.purchase_request_id) {
      const [sources] = await conn.query('SELECT status, approved_by, payment_basis FROM purchase_requests WHERE id=? FOR UPDATE', [row.purchase_request_id]);
      if (!sources[0] || sources[0].payment_basis === 'non_debt' || !['For Purchase', 'PO Created', 'Completed'].includes(sources[0].status)) throw fail('PO source must be an approved debt PR');
    } else if (row.service_request_id) {
      const sourceRound = await currentRound(conn, 'sr', row.service_request_id, true);
      if (sourceRound?.status !== 'approved') throw fail('Approve the source SR before submitting its PO');
    } else throw fail('An approved source request is required');
  }
  const first = initialStage(kind, row.owner_role);
  const stages = first === 'engineer' ? ['engineer', 'admin', cents < 10000000 ? 'senior_project_manager' : 'final'] : first === 'admin' ? ['admin', cents < 10000000 ? 'senior_project_manager' : 'final'] : ['final'];
  const [employees] = await conn.query('SELECT id,role FROM employees WHERE is_active=1 AND id<>? ORDER BY id', [owner]);
  for (const stage of stages) {
    const roles = stage === 'final' ? ['super_admin', 'ceo'] : [stage];
    for (const role of roles) if (!employees.some(e => e.role === role)) throw fail(`No eligible ${role} reviewer. Assign an authorized replacement before submission.`, 409);
  }
  if (old) await conn.query("UPDATE request_workflow_rounds SET status='superseded',updated_at=NOW() WHERE id=?", [old.id]);
  const [result] = await conn.query('INSERT INTO request_workflow_rounds(module,document_id,round_number,owner_id,owner_role,total_amount,stage) VALUES(?,?,?,?,?,?,?)', [kind, id, (old?.round_number || 0) + 1, owner, row.owner_role, (cents / 100).toFixed(2), first]);
  const round = { id: result.insertId, stage: first };
  for (const stage of stages) for (const employee of employees.filter(e => stage === 'final' ? ['super_admin','ceo'].includes(e.role) : e.role === stage)) {
    await conn.query('INSERT INTO request_workflow_reviews(round_id,reviewer_id,role,stage) VALUES(?,?,?,?)', [round.id, employee.id, employee.role, stage]);
  }
  await setSourceStatus(conn, kind, id, stageStatuses[first]);
  await event(conn, kind, row, round, user, migration ? 'migration_restart' : 'submitted');
  return { status: stageStatuses[first], round_id: round.id };
}
export async function review(conn, user, kind, id, decision, comment) {
  if (!['approved','rejected'].includes(decision)) throw fail('Choose approved or rejected');
  if (decision === 'rejected' && !String(comment || '').trim()) throw fail('A rejection reason is required');
  const row = await document(conn, kind, id, true);
  const round = await currentRound(conn, kind, id, true);
  if (!round || round.status !== 'review') throw fail('No active review round', 409);
  if (Number(row[modules[kind].owner]) === Number(user.id)) throw fail('You cannot review your own request', 403);
  if (await totalCents(conn, kind, row) !== Math.round(Number(round.total_amount) * 100)) throw fail('The amount changed; restart approval', 409);
  let assigned = await votes(conn, round);
  const mine = assigned.find(v => Number(v.reviewer_id) === Number(user.id) && v.role === user.role && Number(v.is_active) === 1);
  if (!mine) throw fail('You are not assigned to the active stage', 403);
  if (mine.decision !== 'pending' || (round.stage === 'final' && finalRoleAlreadyApproved(assigned, user.role))) throw fail('This reviewer/role has already approved in this round', 409);
  await conn.query('UPDATE request_workflow_reviews SET decision=?,comment=?,reviewed_at=NOW() WHERE id=?', [decision, String(comment || '').slice(0,4000) || null, mine.id]);
  if (decision === 'rejected') {
    await conn.query("UPDATE request_workflow_rounds SET status='rejected',updated_at=NOW() WHERE id=?", [round.id]);
    await setSourceStatus(conn, kind, id, 'Rejected');
  } else {
    assigned = await votes(conn, round);
    if (stageComplete(round.stage, assigned)) {
      const stage = nextStage(round.stage, Math.round(Number(round.total_amount) * 100));
      if (stage) {
        round.stage = stage;
        await conn.query('UPDATE request_workflow_rounds SET stage=?,updated_at=NOW() WHERE id=?', [stage, round.id]);
        await setSourceStatus(conn, kind, id, stageStatuses[stage]);
      } else {
        await conn.query("UPDATE request_workflow_rounds SET status='approved',updated_at=NOW() WHERE id=?", [round.id]);
        await setSourceStatus(conn, kind, id, 'Approved');
        if (kind !== 'po') await conn.query(`UPDATE ${modules[kind].table} SET approved_by=?,approved_at=NOW() WHERE id=?`, [user.id,id]);
      }
    }
  }
  await event(conn, kind, row, round, user, decision, { comment: String(comment || '').slice(0,4000) });
  return { message: 'Review recorded' };
}
