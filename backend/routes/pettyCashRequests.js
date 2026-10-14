import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { authenticate } from '../middleware/auth.js';
import db from '../config/database.js';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';
import { assertProjectIsActive } from '../utils/branchProjects.js';
import { logAudit } from '../utils/auditLogger.js';
import { createNotification } from '../utils/notifications.js';
import { initialPettyCashReviewStage, nextPettyCashReviewStage } from '../utils/pettyCashReviewFlow.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const privateReceiptRoot = path.join(__dirname, '..', 'private_uploads', 'petty_cash');
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 20, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/gif', 'application/pdf']);
    if (!allowed.has(file.mimetype)) return callback(new Error('Receipts must be JPEG, PNG, GIF, or PDF files'));
    callback(null, true);
  }
});
const parseReceiptUpload = (req, res, next) => receiptUpload.any()(req, res, (error) => {
  if (error) return res.status(400).json({ message: error.message || 'Failed to read receipt files' });
  next();
});
const canRelease = (role) => ['admin', 'super_admin', 'ceo'].includes(role);
const canReviewLiquidation = canRelease;
const canCreate = (role) => ['engineer', 'admin', 'senior_project_manager', 'super_admin', 'ceo'].includes(role);
const visibleTo = async (cr, user) => {
  if (user.role !== 'engineer' || Number(cr.requested_by) === Number(user.id)) return true;
  const [rows] = await db.query(
    'SELECT 1 FROM petty_cash_request_reviews WHERE cash_request_id = ? AND reviewer_id = ? LIMIT 1',
    [cr.id, user.id]
  );
  return rows.length > 0;
};
const stageStatus = {
  engineer: 'For Engineer Review',
  super_admin: 'For Super Admin Review',
  ceo: 'For CEO Approval',
  admin: 'For Admin Review',
  senior_project_manager: 'For Senior Project Manager Review',
};
const statusStage = {
  ...Object.fromEntries(Object.entries(stageStatus).map(([stage, status]) => [status, stage])),
  // Keep existing requests already waiting in the previous flow actionable.
  'For Super Admin Final Approval': 'super_admin'
};
const reviewerLabel = (stage) => ({
  senior_project_manager: 'Senior Project Engineer',
  super_admin: 'Super Admin',
  ceo: 'CEO'
}[stage] || stage.replaceAll('_', ' '));
const assignReviewers = async (conn, cr, round, stage) => {
  const reviewerRole = stage === 'senior_project_manager' ? 'senior_project_manager' : stage;
  const [reviewers] = await conn.query(
    'SELECT id FROM employees WHERE role = ? AND is_active = 1 AND id <> ? ORDER BY id',
    [reviewerRole, cr.requested_by]
  );
  if (!reviewers.length) {
    const error = new Error(`No active ${reviewerLabel(stage)} reviewer is available other than the requester`);
    error.statusCode = 409;
    throw error;
  }
  for (const reviewer of reviewers) {
    await conn.query(
      'INSERT INTO petty_cash_request_reviews (cash_request_id, round_number, stage, reviewer_id) VALUES (?, ?, ?, ?)',
      [cr.id, round, stage, reviewer.id]
    );
  }
  await conn.query('UPDATE cash_requests SET status = ?, updated_at = NOW() WHERE id = ?', [stageStatus[stage], cr.id]);
  return reviewers.map(({ id }) => id);
};
const notifyReviewers = async (ids, cr) => {
  for (const id of ids) {
    await createNotification(id, 'Petty Cash Review', `${cr.cr_number} needs your review.`, 'System', cr.id, 'cash_request');
  }
};

const validateInput = (body) => {
  const payeeName = String(body.payee_name || '').trim();
  const payeeAddress = String(body.payee_address || '').trim();
  const project = String(body.project || '').trim();
  const purpose = String(body.purpose || '').trim();
  const dateNeeded = String(body.date_needed || '').trim();
  if (!payeeName || !project || !purpose || !/^\d{4}-\d{2}-\d{2}$/.test(dateNeeded)) {
    throw new Error('Payee, project, purpose, and a valid date needed are required');
  }
  const parsedDate = new Date(`${dateNeeded}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateNeeded) {
    throw new Error('Date needed is invalid');
  }
  const raw = body.details;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 15) {
    throw new Error('Enter 1 to 15 detail lines');
  }
  const details = raw.map((line) => {
    const description = String(line.description || '').trim();
    if (!description || description.length > 500) throw new Error('Each detail needs a description of 500 characters or fewer');
    const priced = Boolean(line.is_priced);
    if (!priced) return { description, is_priced: 0, quantity: null, unit: null, unit_cost: null, amount: null };
    const quantity = Number(line.quantity);
    const unitCost = Number(line.unit_cost);
    const twoDecimals = /^\d+(?:\.\d{1,2})?$/;
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0 ||
        !twoDecimals.test(String(line.quantity)) || !twoDecimals.test(String(line.unit_cost))) {
      throw new Error('Priced lines need a positive quantity and a non-negative unit cost');
    }
    const amount = Math.round(quantity * unitCost * 100) / 100;
    return { description, is_priced: 1, quantity, unit: String(line.unit || '').trim() || null, unit_cost: unitCost, amount };
  });
  const amount = Math.round(details.reduce((sum, line) => sum + (line.amount || 0), 0) * 100) / 100;
  if (amount <= 0) throw new Error('At least one priced line must have a positive amount');
  return { payeeName, payeeAddress, project, purpose, dateNeeded, details, amount };
};

const replaceDetails = async (conn, id, details) => {
  await conn.query('DELETE FROM petty_cash_request_details WHERE cash_request_id = ?', [id]);
  for (const [index, line] of details.entries()) {
    await conn.query(
      `INSERT INTO petty_cash_request_details
       (cash_request_id, line_number, description, quantity, unit, unit_cost, amount, is_priced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, index + 1, line.description, line.quantity, line.unit, line.unit_cost, line.amount, line.is_priced]
    );
  }
};

const getRequest = async (conn, id) => {
  const [rows] = await conn.query(
    `SELECT cr.*, e.first_name AS requester_first_name, e.last_name AS requester_last_name,
            releaser.first_name AS releaser_first_name, releaser.last_name AS releaser_last_name
     FROM cash_requests cr
     JOIN employees e ON e.id = cr.requested_by
     LEFT JOIN employees releaser ON releaser.id = cr.released_by
     WHERE cr.id = ? AND cr.request_kind = 'petty_cash'`, [id]
  );
  return rows[0];
};

const getLiquidation = async (conn, cashRequestId) => {
  const [headers] = await conn.query('SELECT * FROM petty_cash_liquidations WHERE cash_request_id = ?', [cashRequestId]);
  if (!headers.length) return null;
  const liquidation = headers[0];
  const [submissions] = await conn.query(
    'SELECT * FROM petty_cash_liquidation_submissions WHERE liquidation_id = ? ORDER BY round_number', [liquidation.id]
  );
  const [expenses] = await conn.query(
    `SELECT x.*, GROUP_CONCAT(r.id ORDER BY r.id) AS receipt_ids,
            GROUP_CONCAT(r.original_name ORDER BY r.id SEPARATOR '||') AS receipt_names
     FROM petty_cash_liquidation_expenses x
     JOIN petty_cash_liquidation_submissions s ON s.id = x.submission_id
     LEFT JOIN petty_cash_liquidation_receipts r ON r.expense_id = x.id
     WHERE s.liquidation_id = ?
     GROUP BY x.id ORDER BY s.round_number, x.expense_date, x.id`,
    [liquidation.id]
  );
  const [reviews] = await conn.query(
    `SELECT r.*, e.first_name, e.last_name FROM petty_cash_liquidation_reviews r
     JOIN employees e ON e.id = r.reviewer_id WHERE r.liquidation_id = ? ORDER BY r.id`,
    [liquidation.id]
  );
  const mappedExpenses = expenses.map((expense) => ({
    ...expense,
    receipt_ids: expense.receipt_ids ? expense.receipt_ids.split(',').map(Number) : [],
    receipt_names: expense.receipt_names ? expense.receipt_names.split('||') : []
  }));
  return {
    ...liquidation,
    submissions: submissions.map((submission) => ({
      ...submission,
      expenses: mappedExpenses.filter((expense) => Number(expense.submission_id) === Number(submission.id))
    })),
    current_submission: submissions.find((submission) => Number(submission.round_number) === Number(liquidation.current_round)) || null,
    expenses: mappedExpenses.filter((expense) => Number(expense.submission_id) === Number(submissions.find((submission) => Number(submission.round_number) === Number(liquidation.current_round))?.id)),
    reviews
  };
};

const parseLiquidationInput = (body) => {
  let expenses;
  try { expenses = typeof body.expenses === 'string' ? JSON.parse(body.expenses) : body.expenses; }
  catch { throw Object.assign(new Error('Expense details are invalid'), { statusCode: 400 }); }
  if (!Array.isArray(expenses) || expenses.length < 1 || expenses.length > 20) {
    throw Object.assign(new Error('Enter 1 to 20 expense lines'), { statusCode: 400 });
  }
  expenses = expenses.map((expense, index) => {
    const expenseDate = String(expense.expense_date || '').trim();
    const description = String(expense.description || '').trim();
    const amountText = String(expense.amount ?? '').trim();
    const amount = Number(amountText);
    const parsedDate = new Date(`${expenseDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== expenseDate ||
        !description || description.length > 500 || !/^\d+(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error(`Expense line ${index + 1} needs a valid date, description, and positive amount`), { statusCode: 400 });
    }
    return { expense_date: expenseDate, description, amount: Math.round(amount * 100) / 100, vendor: String(expense.vendor || '').trim().slice(0, 255) || null };
  });
  const cashReturnedText = String(body.cash_returned ?? '0').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cashReturnedText) || !Number.isFinite(Number(cashReturnedText))) {
    throw Object.assign(new Error('Cash returned must be a non-negative amount with up to two decimal places'), { statusCode: 400 });
  }
  return {
    expenses,
    actualSpent: Math.round(expenses.reduce((sum, expense) => sum + expense.amount, 0) * 100) / 100,
    cashReturned: Math.round(Number(cashReturnedText) * 100) / 100,
    returnReference: String(body.return_reference || '').trim().slice(0, 255) || null,
    notes: String(body.notes || '').trim() || null
  };
};

router.get('/', authenticate, async (req, res) => {
  try {
    const where = req.user.role === 'engineer' ? 'AND (cr.requested_by = ? OR EXISTS (SELECT 1 FROM petty_cash_request_reviews mine WHERE mine.cash_request_id = cr.id AND mine.reviewer_id = ?))' : '';
    const params = req.user.role === 'engineer' ? [req.user.id, req.user.id] : [];
    const [rows] = await db.query(
      `SELECT cr.*, e.first_name AS requester_first_name, e.last_name AS requester_last_name,
       liquidations.status AS liquidation_status, liquidations.current_round AS liquidation_round,
       EXISTS (SELECT 1 FROM petty_cash_request_reviews mine WHERE mine.cash_request_id = cr.id
         AND mine.reviewer_id = ? AND mine.decision = 'pending'
         AND mine.stage = CASE cr.status
           WHEN 'For Engineer Review' THEN 'engineer'
           WHEN 'For Admin Review' THEN 'admin'
           WHEN 'For Super Admin Review' THEN 'super_admin'
           WHEN 'For CEO Approval' THEN 'ceo'
           WHEN 'For Senior Project Manager Review' THEN 'senior_project_manager'
           WHEN 'For Super Admin Final Approval' THEN 'super_admin' END
         AND mine.round_number = (SELECT MAX(round_number) FROM petty_cash_request_reviews WHERE cash_request_id = cr.id)) AS can_review
       FROM cash_requests cr JOIN employees e ON e.id = cr.requested_by
       LEFT JOIN petty_cash_liquidations liquidations ON liquidations.cash_request_id = cr.id
       WHERE cr.request_kind = 'petty_cash' ${where}
       ORDER BY cr.created_at DESC, cr.id DESC`, [req.user.id, ...params]
    );
    res.json({ pettyCashRequests: rows });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load petty cash requests', detail: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const cr = await getRequest(db, req.params.id);
    if (!cr) return res.status(404).json({ message: 'Petty cash request not found' });
    if (!await visibleTo(cr, req.user)) return res.status(403).json({ message: 'Not authorized' });
    const [details] = await db.query(
      'SELECT * FROM petty_cash_request_details WHERE cash_request_id = ? ORDER BY line_number', [cr.id]
    );
    const [reviews] = await db.query(
      `SELECT r.round_number, r.stage, r.decision, r.comment, r.reviewed_at,
              e.first_name, e.last_name, r.reviewer_id
       FROM petty_cash_request_reviews r JOIN employees e ON e.id = r.reviewer_id
       WHERE r.cash_request_id = ? ORDER BY r.round_number, r.id`, [cr.id]
    );
    const currentRound = reviews.reduce((max, row) => Math.max(max, row.round_number), 0);
    const canReview = reviews.some((row) => row.round_number === currentRound &&
      row.stage === statusStage[cr.status] && row.decision === 'pending' && Number(row.reviewer_id) === Number(req.user.id));
    const liquidation = await getLiquidation(db, cr.id);
    res.json({ pettyCashRequest: { ...cr, details, reviews, can_review: canReview, liquidation } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load petty cash request', detail: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  if (!canCreate(req.user.role)) return res.status(403).json({ message: 'Not authorized to create petty cash requests' });
  let input;
  try { input = validateInput(req.body); } catch (error) { return res.status(400).json({ message: error.message }); }
  let conn;
  try {
    await assertProjectIsActive(input.project, { providedOrderNumber: req.body.order_number });
    conn = await db.getConnection();
    await conn.beginTransaction();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const initials = `${String(req.user.first_name || '')[0] || ''}${String(req.user.last_name || '')[0] || ''}`.toUpperCase();
    const [last] = await conn.query(
      "SELECT cr_number FROM cash_requests WHERE cr_number LIKE ? ORDER BY cr_number DESC LIMIT 1 FOR UPDATE",
      [`PCR-${initials}-${month}-%`]
    );
    const sequence = last.length ? Number(last[0].cr_number.slice(-3)) + 1 : 1;
    const number = `PCR-${initials}-${month}-${String(sequence).padStart(3, '0')}`;
    const [result] = await conn.query(
      `INSERT INTO cash_requests
       (cr_number, requested_by, purpose, description, amount, quantity, unit, project, project_address,
        date_needed, order_number, cr_type, request_kind, payee_name, payee_address, status)
       VALUES (?, ?, ?, ?, ?, 1, 'cash', ?, ?, ?, ?, 'petty_cash', 'petty_cash', ?, ?, 'Draft')`,
      [number, req.user.id, input.purpose, String(req.body.description || '').trim() || null,
        input.amount, input.project, String(req.body.project_address || '').trim() || null,
        input.dateNeeded, String(req.body.order_number || '').trim() || null, input.payeeName, input.payeeAddress || null]
    );
    await replaceDetails(conn, result.insertId, input.details);
    await conn.commit();
    await logAudit(req.user.id, 'Petty Cash Request Created', 'cash_requests', result.insertId, JSON.stringify({ cr_number: number, amount: input.amount }));
    res.status(201).json({ id: result.insertId, cr_number: number, status: 'Draft' });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(error.statusCode || 500).json({ message: error.message });
  } finally { conn?.release(); }
});

router.put('/:id', authenticate, async (req, res) => {
  let input;
  try { input = validateInput(req.body); } catch (error) { return res.status(400).json({ message: error.message }); }
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM cash_requests WHERE id = ? AND request_kind = 'petty_cash' FOR UPDATE", [req.params.id]
    );
    const cr = rows[0];
    if (!cr) { await conn.rollback(); return res.status(404).json({ message: 'Petty cash request not found' }); }
    if (Number(cr.requested_by) !== Number(req.user.id)) { await conn.rollback(); return res.status(403).json({ message: 'Only the requester can edit this request' }); }
    if (!['Draft', 'Rejected', 'Returned'].includes(cr.status)) { await conn.rollback(); return res.status(400).json({ message: 'Request can no longer be edited' }); }
    await assertProjectIsActive(input.project, { providedOrderNumber: req.body.order_number });
    await conn.query(
      `UPDATE cash_requests SET purpose = ?, description = ?, amount = ?, project = ?, project_address = ?,
       date_needed = ?, order_number = ?, payee_name = ?, payee_address = ?, status = 'Draft', updated_at = NOW()
       WHERE id = ?`,
      [input.purpose, String(req.body.description || '').trim() || null, input.amount, input.project,
        String(req.body.project_address || '').trim() || null, input.dateNeeded,
        String(req.body.order_number || '').trim() || null, input.payeeName, input.payeeAddress || null, cr.id]
    );
    await replaceDetails(conn, cr.id, input.details);
    await conn.commit();
    await logAudit(req.user.id, 'Petty Cash Request Updated', 'cash_requests', cr.id, JSON.stringify({ amount: input.amount }));
    res.json({ message: 'Petty cash request updated', status: 'Draft' });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(error.statusCode || 500).json({ message: error.message });
  } finally { conn?.release(); }
});

router.post('/:id/submit', authenticate, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM cash_requests WHERE id = ? AND request_kind = 'petty_cash' FOR UPDATE", [req.params.id]);
    const cr = rows[0];
    if (!cr) { await conn.rollback(); return res.status(404).json({ message: 'Petty cash request not found' }); }
    if (Number(cr.requested_by) !== Number(req.user.id)) { await conn.rollback(); return res.status(403).json({ message: 'Only the requester can submit this request' }); }
    if (!['Draft', 'Returned', 'Rejected'].includes(cr.status)) { await conn.rollback(); return res.status(400).json({ message: 'Only draft or returned requests can be submitted' }); }
    const [details] = await conn.query('SELECT COUNT(*) AS line_count FROM petty_cash_request_details WHERE cash_request_id = ?', [cr.id]);
    if (!cr.payee_name || Number(cr.amount) <= 0 || !details[0].line_count) { await conn.rollback(); return res.status(400).json({ message: 'Complete the payee, amount and detail lines before submitting' }); }
    const [rounds] = await conn.query('SELECT COALESCE(MAX(round_number), 0) AS last_round FROM petty_cash_request_reviews WHERE cash_request_id = ?', [cr.id]);
    const round = Number(rounds[0].last_round) + 1;
    const stage = initialPettyCashReviewStage(req.user.role);
    const reviewers = await assignReviewers(conn, cr, round, stage);
    await conn.commit();
    await Promise.allSettled([
      logAudit(req.user.id, 'Petty Cash Request Submitted', 'cash_requests', cr.id, JSON.stringify({ round, stage })),
      notifyReviewers(reviewers, cr)
    ]);
    res.json({ message: 'Petty cash request submitted', status: stageStatus[stage] });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(error.statusCode || 500).json({ message: error.message });
  } finally { conn?.release(); }
});

router.post('/:id/review', authenticate, async (req, res) => {
  const decision = String(req.body.decision || '');
  const comment = String(req.body.comment || '').trim();
  if (!['approved', 'rejected'].includes(decision) || (decision === 'rejected' && !comment)) {
    return res.status(400).json({ message: 'A valid decision and rejection reason are required' });
  }
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM cash_requests WHERE id = ? AND request_kind = 'petty_cash' FOR UPDATE", [req.params.id]);
    const cr = rows[0];
    if (!cr) { await conn.rollback(); return res.status(404).json({ message: 'Petty cash request not found' }); }
    const stage = statusStage[cr.status];
    if (!stage) { await conn.rollback(); return res.status(400).json({ message: 'This request is not awaiting review' }); }
    const [rounds] = await conn.query('SELECT MAX(round_number) AS round_number FROM petty_cash_request_reviews WHERE cash_request_id = ?', [cr.id]);
    const round = Number(rounds[0].round_number);
    const [mine] = await conn.query(
      "SELECT id FROM petty_cash_request_reviews WHERE cash_request_id = ? AND round_number = ? AND stage = ? AND reviewer_id = ? AND decision = 'pending'",
      [cr.id, round, stage, req.user.id]
    );
    const expectedRole = stage === 'senior_project_manager' ? 'senior_project_manager' : stage;
    // Old final-stage assignments included CEOs; honor those records until their requests finish.
    const validReviewerRole = req.user.role === expectedRole ||
      (stage === 'super_admin' && cr.status === 'For Super Admin Final Approval' && req.user.role === 'ceo');
    if (!mine.length || !validReviewerRole || Number(cr.requested_by) === Number(req.user.id)) {
      await conn.rollback(); return res.status(403).json({ message: 'You have no pending review assignment for this stage' });
    }
    await conn.query('UPDATE petty_cash_request_reviews SET decision = ?, comment = ?, reviewed_at = NOW() WHERE id = ?', [decision, comment || null, mine[0].id]);
    let nextStatus = cr.status;
    let nextReviewers = [];
    if (decision === 'rejected') {
      nextStatus = 'Rejected';
      await conn.query("UPDATE cash_requests SET status = 'Rejected', remarks = ?, approved_by = NULL, approved_at = NULL, updated_at = NOW() WHERE id = ?", [comment, cr.id]);
    } else {
      const [pending] = await conn.query(
        "SELECT COUNT(*) AS count FROM petty_cash_request_reviews WHERE cash_request_id = ? AND round_number = ? AND stage = ? AND decision = 'pending'",
        [cr.id, round, stage]
      );
      if (Number(pending[0].count) === 0) {
        const [requesters] = await conn.query('SELECT role FROM employees WHERE id = ?', [cr.requested_by]);
        const nextStage = nextPettyCashReviewStage(stage, requesters[0]?.role, cr.amount, cr.status);
        if (nextStage) {
          nextReviewers = await assignReviewers(conn, cr, round, nextStage);
          nextStatus = stageStatus[nextStage];
        } else {
          nextStatus = 'Approved';
          await conn.query("UPDATE cash_requests SET status = 'Approved', approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?", [req.user.id, cr.id]);
        }
      }
    }
    await conn.commit();
    await Promise.allSettled([
      logAudit(req.user.id, 'Petty Cash Review', 'cash_requests', cr.id, JSON.stringify({ round, stage, decision, comment, nextStatus })),
        ...(nextReviewers.length ? [notifyReviewers(nextReviewers, cr)] : []),
      ...(['Rejected', 'Approved'].includes(nextStatus) ? [createNotification(cr.requested_by,
        `Petty Cash ${nextStatus}`, `${cr.cr_number} is ${nextStatus.toLowerCase()}${comment ? `: ${comment}` : ''}.`,
        'System', cr.id, 'cash_request')] : [])
    ]);
    res.json({ message: 'Review recorded', status: nextStatus });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(error.statusCode || 500).json({ message: error.message });
  } finally { conn?.release(); }
});

router.post('/:id/release', authenticate, async (req, res) => {
  if (!canRelease(req.user.role)) return res.status(403).json({ message: 'Not authorized to release cash' });
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM cash_requests WHERE id = ? AND request_kind = 'petty_cash' FOR UPDATE", [req.params.id]
    );
    const cr = rows[0];
    if (!cr) { await conn.rollback(); return res.status(404).json({ message: 'Petty cash request not found' }); }
    if (cr.status !== 'Approved' || cr.released_at) { await conn.rollback(); return res.status(400).json({ message: 'Only an approved, unreleased request can be released' }); }
    await conn.query(
      "UPDATE cash_requests SET status = 'Released', released_by = ?, released_at = NOW(), release_amount = amount WHERE id = ?",
      [req.user.id, cr.id]
    );
    await conn.commit();
    await logAudit(req.user.id, 'Petty Cash Released', 'cash_requests', cr.id, JSON.stringify({ amount: Number(cr.amount), payee_name: cr.payee_name }));
    await createNotification(cr.requested_by, 'Petty Cash Released', `${cr.cr_number} has been released. Confirm receipt after the payee receives the cash.`, 'System', cr.id, 'cash_request');
    res.json({ message: 'Cash release recorded', status: 'Released' });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(500).json({ message: 'Failed to record cash release', detail: error.message });
  } finally { conn?.release(); }
});

router.post('/:id/receive', authenticate, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM cash_requests WHERE id = ? AND request_kind = 'petty_cash' FOR UPDATE", [req.params.id]
    );
    const cr = rows[0];
    if (!cr) { await conn.rollback(); return res.status(404).json({ message: 'Petty cash request not found' }); }
    if (Number(cr.requested_by) !== Number(req.user.id)) { await conn.rollback(); return res.status(403).json({ message: 'Only the requester can confirm receipt' }); }
    if (cr.status !== 'Released' || !cr.released_at) { await conn.rollback(); return res.status(400).json({ message: 'Cash has not been released' }); }
    await conn.query(
      "UPDATE cash_requests SET status = 'Received', received_by = ?, received_at = NOW() WHERE id = ?",
      [req.user.id, cr.id]
    );
    await conn.commit();
    await logAudit(req.user.id, 'Petty Cash Receipt Confirmed', 'cash_requests', cr.id);
    res.json({ message: 'Cash receipt confirmed', status: 'Received' });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(500).json({ message: 'Failed to confirm receipt', detail: error.message });
  } finally { conn?.release(); }
});

router.post('/:id/liquidation', authenticate, parseReceiptUpload, async (req, res) => {
  let input;
  try { input = parseLiquidationInput(req.body); }
  catch (error) { return res.status(error.statusCode || 400).json({ message: error.message }); }

  const receiptByExpense = new Map();
  for (const file of req.files || []) {
    const match = /^receipt_(\d+)$/.exec(file.fieldname);
    const index = match ? Number(match[1]) : -1;
    if (index < 0 || index >= input.expenses.length) return res.status(400).json({ message: 'Receipt files must be attached to an expense line' });
    receiptByExpense.set(index, [...(receiptByExpense.get(index) || []), file]);
  }
  if (input.expenses.some((_expense, index) => !receiptByExpense.has(index))) {
    return res.status(400).json({ message: 'Attach at least one receipt to every expense line' });
  }

  let conn;
  const writtenFiles = [];
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [requests] = await conn.query("SELECT * FROM cash_requests WHERE id = ? AND request_kind = 'petty_cash' FOR UPDATE", [req.params.id]);
    const cr = requests[0];
    if (!cr) { await conn.rollback(); return res.status(404).json({ message: 'Petty Cash Request not found' }); }
    if (Number(cr.requested_by) !== Number(req.user.id)) { await conn.rollback(); return res.status(403).json({ message: 'Only the requester can submit liquidation' }); }
    if (!['Received', 'Liquidation Returned'].includes(cr.status)) { await conn.rollback(); return res.status(400).json({ message: 'Liquidation can be submitted after cash receipt or after Finance returns it for correction' }); }

    const [existingRows] = await conn.query('SELECT * FROM petty_cash_liquidations WHERE cash_request_id = ? FOR UPDATE', [cr.id]);
    let liquidationId;
    let round;
    if (existingRows.length) {
      const existing = existingRows[0];
      if (existing.status !== 'Returned') { await conn.rollback(); return res.status(409).json({ message: 'A liquidation is already being reviewed or has been closed' }); }
      liquidationId = existing.id;
      round = Number(existing.current_round) + 1;
      await conn.query(
        `UPDATE petty_cash_liquidations SET status = 'Submitted', current_round = ?, finance_comment = NULL,
         reviewed_by = NULL, reviewed_at = NULL, verified_cash_returned = NULL WHERE id = ?`, [round, liquidationId]
      );
    } else {
      round = 1;
      const [result] = await conn.query(
        "INSERT INTO petty_cash_liquidations (cash_request_id, status, current_round) VALUES (?, 'Submitted', ?)", [cr.id, round]
      );
      liquidationId = result.insertId;
    }
    const [submissionResult] = await conn.query(
      `INSERT INTO petty_cash_liquidation_submissions
       (liquidation_id, round_number, actual_spent, cash_returned, return_reference, notes, submitted_by, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [liquidationId, round, input.actualSpent, input.cashReturned, input.returnReference, input.notes, req.user.id]
    );
    const submissionId = submissionResult.insertId;
    await fs.mkdir(path.join(privateReceiptRoot, String(liquidationId)), { recursive: true });
    const extensionForMime = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'application/pdf': '.pdf' };
    for (const [index, expense] of input.expenses.entries()) {
      const [expenseResult] = await conn.query(
        `INSERT INTO petty_cash_liquidation_expenses (submission_id, expense_date, vendor, description, amount)
         VALUES (?, ?, ?, ?, ?)`, [submissionId, expense.expense_date, expense.vendor, expense.description, expense.amount]
      );
      for (const file of receiptByExpense.get(index)) {
        const storedName = `${crypto.randomUUID()}${extensionForMime[file.mimetype]}`;
        const fullPath = path.join(privateReceiptRoot, String(liquidationId), storedName);
        await fs.writeFile(fullPath, file.buffer, { flag: 'wx', mode: 0o600 });
        writtenFiles.push(fullPath);
        await conn.query(
          `INSERT INTO petty_cash_liquidation_receipts
           (expense_id, original_name, stored_name, mime_type, file_size, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [expenseResult.insertId, path.basename(file.originalname).slice(0, 255), storedName, file.mimetype, file.size, req.user.id]
        );
      }
    }
    await conn.query("UPDATE cash_requests SET status = 'Liquidation Submitted', updated_at = NOW() WHERE id = ?", [cr.id]);
    await conn.commit();
    await Promise.allSettled([
      logAudit(req.user.id, 'Petty Cash Liquidation Submitted', 'cash_requests', cr.id,
        JSON.stringify({ round, actual_spent: input.actualSpent, cash_returned: input.cashReturned })),
      (async () => {
        const [reviewers] = await db.query("SELECT id FROM employees WHERE role IN ('admin', 'super_admin', 'ceo') AND is_active = 1");
        await Promise.all(reviewers.map(({ id }) => createNotification(id, 'Petty Cash Liquidation Review',
          `${cr.cr_number} liquidation needs Finance review.`, 'System', cr.id, 'cash_request')));
      })()
    ]);
    res.status(201).json({ message: 'Liquidation submitted for Finance review', status: 'Liquidation Submitted', round });
  } catch (error) {
    if (conn) await conn.rollback();
    await Promise.allSettled(writtenFiles.map((file) => fs.unlink(file)));
    res.status(error.statusCode || 500).json({ message: 'Failed to submit petty cash liquidation', detail: error.message });
  } finally { conn?.release(); }
});

router.post('/:id/liquidation/review', authenticate, async (req, res) => {
  if (!canReviewLiquidation(req.user.role)) return res.status(403).json({ message: 'Finance reviewer access is required' });
  const decision = String(req.body.decision || '');
  const comment = String(req.body.comment || '').trim();
  if (!['closed', 'returned'].includes(decision) || (decision === 'returned' && !comment)) {
    return res.status(400).json({ message: 'Choose close or return; a reason is required to return a liquidation' });
  }
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [requests] = await conn.query("SELECT * FROM cash_requests WHERE id = ? AND request_kind = 'petty_cash' FOR UPDATE", [req.params.id]);
    const cr = requests[0];
    if (!cr) { await conn.rollback(); return res.status(404).json({ message: 'Petty Cash Request not found' }); }
    const [liquidations] = await conn.query('SELECT * FROM petty_cash_liquidations WHERE cash_request_id = ? FOR UPDATE', [cr.id]);
    const liquidation = liquidations[0];
    if (!liquidation || liquidation.status !== 'Submitted' || cr.status !== 'Liquidation Submitted') {
      await conn.rollback(); return res.status(409).json({ message: 'No submitted liquidation is awaiting review' });
    }
    const round = Number(liquidation.current_round);
    const [submissions] = await conn.query(
      'SELECT * FROM petty_cash_liquidation_submissions WHERE liquidation_id = ? AND round_number = ?', [liquidation.id, round]
    );
    const submission = submissions[0];
    if (!submission) { await conn.rollback(); return res.status(409).json({ message: 'Liquidation submission is missing' }); }

    let verifiedReturned = null;
    if (decision === 'closed') {
      verifiedReturned = Number(req.body.verified_cash_returned);
      if (!Number.isFinite(verifiedReturned) || verifiedReturned < 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(req.body.verified_cash_returned))) {
        await conn.rollback(); return res.status(400).json({ message: 'Enter the cash return amount verified by Finance' });
      }
      const [expenseSums] = await conn.query(
        `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS line_count,
          (SELECT COUNT(*) FROM petty_cash_liquidation_receipts r JOIN petty_cash_liquidation_expenses e2 ON e2.id = r.expense_id WHERE e2.submission_id = ?) AS receipt_count
         FROM petty_cash_liquidation_expenses WHERE submission_id = ?`, [submission.id, submission.id]
      );
      const cents = (value) => Math.round(Number(value) * 100);
      if (Number(expenseSums[0].line_count) < 1 || Number(expenseSums[0].receipt_count) < Number(expenseSums[0].line_count)) {
        await conn.rollback(); return res.status(400).json({ message: 'Every expense must have at least one receipt attached' });
      }
      if (cents(verifiedReturned) !== cents(submission.cash_returned)) {
        await conn.rollback(); return res.status(400).json({ message: 'Verified cash returned must match the amount reported by the requester' });
      }
      if (cents(expenseSums[0].amount) + cents(verifiedReturned) !== cents(cr.release_amount)) {
        await conn.rollback(); return res.status(400).json({ message: 'Expenses plus verified cash returned must equal the amount released before Finance can close this request' });
      }
    }
    await conn.query(
      `INSERT INTO petty_cash_liquidation_reviews
       (liquidation_id, round_number, reviewer_id, decision, comment, verified_cash_returned, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [liquidation.id, round, req.user.id, decision, comment || null, verifiedReturned]
    );
    if (decision === 'returned') {
      await conn.query(
        "UPDATE petty_cash_liquidations SET status = 'Returned', finance_comment = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
        [comment, req.user.id, liquidation.id]
      );
      await conn.query("UPDATE cash_requests SET status = 'Liquidation Returned', updated_at = NOW() WHERE id = ?", [cr.id]);
    } else {
      await conn.query(
        "UPDATE petty_cash_liquidations SET status = 'Closed', finance_comment = ?, reviewed_by = ?, reviewed_at = NOW(), verified_cash_returned = ?, closed_at = NOW() WHERE id = ?",
        [comment || null, req.user.id, verifiedReturned, liquidation.id]
      );
      await conn.query("UPDATE cash_requests SET status = 'Closed', updated_at = NOW() WHERE id = ?", [cr.id]);
    }
    await conn.commit();
    await Promise.allSettled([
      logAudit(req.user.id, decision === 'closed' ? 'Petty Cash Liquidation Closed' : 'Petty Cash Liquidation Returned',
        'cash_requests', cr.id, JSON.stringify({ round, comment, verified_cash_returned: verifiedReturned })),
      createNotification(cr.requested_by, decision === 'closed' ? 'Petty Cash Closed' : 'Petty Cash Liquidation Returned',
        decision === 'closed' ? `${cr.cr_number} has been reconciled and closed.` : `${cr.cr_number} liquidation needs corrections: ${comment}`,
        'System', cr.id, 'cash_request')
    ]);
    res.json({ message: decision === 'closed' ? 'Petty Cash reconciled and closed' : 'Liquidation returned for correction', status: decision === 'closed' ? 'Closed' : 'Liquidation Returned' });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(error.statusCode || 500).json({ message: 'Failed to review petty cash liquidation', detail: error.message });
  } finally { conn?.release(); }
});

router.get('/:id/liquidation/receipts/:receiptId', authenticate, async (req, res) => {
  try {
    const cr = await getRequest(db, req.params.id);
    if (!cr) return res.status(404).json({ message: 'Petty Cash Request not found' });
    if (!await visibleTo(cr, req.user) && !canReviewLiquidation(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
    const [rows] = await db.query(
      `SELECT r.*, l.id AS liquidation_id FROM petty_cash_liquidation_receipts r
       JOIN petty_cash_liquidation_expenses e ON e.id = r.expense_id
       JOIN petty_cash_liquidation_submissions s ON s.id = e.submission_id
       JOIN petty_cash_liquidations l ON l.id = s.liquidation_id
       WHERE r.id = ? AND l.cash_request_id = ?`, [req.params.receiptId, cr.id]
    );
    const receipt = rows[0];
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
    const fullPath = path.join(privateReceiptRoot, String(receipt.liquidation_id), receipt.stored_name);
    res.download(fullPath, receipt.original_name);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ message: 'Receipt file is unavailable' });
    res.status(500).json({ message: 'Failed to download receipt', detail: error.message });
  }
});

router.get('/:id/export', authenticate, async (req, res) => {
  try {
    const cr = await getRequest(db, req.params.id);
    if (!cr) return res.status(404).json({ message: 'Petty cash request not found' });
    if (!await visibleTo(cr, req.user)) return res.status(403).json({ message: 'Not authorized' });
    const [details] = await db.query(
      'SELECT * FROM petty_cash_request_details WHERE cash_request_id = ? ORDER BY line_number', [cr.id]
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(resolveExcelTemplatePath('PURCHASE REQUEST- FINAL-2026.xlsx'));
    const sheet = workbook.worksheets[0];
    const date = (value) => value ? new Date(value).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' }) : '';
    sheet.getCell('A5').value = 'PETTY CASH REQUEST';
    sheet.getCell('A8').value = 'PAYEE:';
    sheet.getCell('C8').value = cr.payee_name || '';
    sheet.getCell('C9').value = cr.payee_address || '';
    sheet.getCell('C10').value = cr.project || '';
    sheet.getCell('C11').value = cr.project_address || '';
    sheet.getCell('E5').value = 'Petty Cash Request No.';
    sheet.getCell('F5').value = cr.cr_number;
    sheet.getCell('F8').value = date(cr.created_at);
    sheet.getCell('F9').value = date(cr.date_needed);
    sheet.getCell('E10').value = 'Payment Basis:';
    sheet.getCell('F10').value = 'Cash';
    for (let row = 14; row <= 28; row += 1) {
      for (const column of ['A', 'B', 'C', 'E', 'F']) sheet.getCell(`${column}${row}`).value = null;
    }
    details.forEach((line, index) => {
      const row = 14 + index;
      if (line.is_priced) {
        sheet.getCell(`A${row}`).value = Number(line.quantity);
        sheet.getCell(`B${row}`).value = line.unit || '';
        sheet.getCell(`E${row}`).value = Number(line.unit_cost);
        sheet.getCell(`F${row}`).value = Number(line.amount);
      }
      sheet.getCell(`C${row}`).value = line.description;
    });
    sheet.getCell('C29').value = '*** NOTHING FOLLOWS ***';
    sheet.getCell('A30').value = 'GRAND TOTAL';
    sheet.getCell('F31').value = Number(cr.amount);
    sheet.getCell('A32').value = 'Prepared by:';
    sheet.getCell('D32').value = '';
    sheet.getCell('E32').value = 'Received by:';
    sheet.getCell('A33').value = `${cr.requester_first_name || ''} ${cr.requester_last_name || ''}`.trim().toUpperCase();
    sheet.getCell('A35').value = 'Prepared by';
    sheet.getCell('D33').value = '';
    sheet.getCell('E33').value = 'MARC JUSTIN E. ARZADON';
    sheet.getCell('D35').value = '';
    sheet.getCell('E35').value = 'General Manager';
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Petty_Cash_Request_${cr.cr_number}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to export petty cash request', detail: error.message });
  }
});

export default router;
