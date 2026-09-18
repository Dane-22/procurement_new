import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import db from '../config/database.js';
import { createNotification, getSuperAdmins, getEngineers, getAdmins, getReviewersForPR, getSuperAdminReps } from '../utils/notifications.js';
import ExcelJS from 'exceljs';
import { resolveExcelTemplatePath } from '../utils/excelTemplatePath.js';
import { assertProjectIsActive } from '../utils/branchProjects.js';
import { assertOrderNumberUnlocked } from '../utils/orderNumberLocks.js';

const router = express.Router();

// Configure multer for PR accreditation file uploads
const prAccreditationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/pr-accreditation';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const prAccreditationUpload = multer({
  storage: prAccreditationStorage,
  limits: { fileSize: Infinity } // No file size limit as requested
});
const normalizePaymentTermsNote = (note) => {
  const normalized = note == null ? '' : String(note).trim();
  return normalized || null;
};
const normalizeSupplierName = (name) => {
  const normalized = name == null ? '' : String(name).trim();
  return normalized || null;
};
const createInputError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const roundMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

const sumScheduleAmounts = (schedules = []) => {
  return roundMoney(
    schedules.reduce((sum, schedule) => {
      const amount = Number(schedule?.amount);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0)
  );
};

const normalizePaymentSchedules = (paymentSchedules) => {
  if (paymentSchedules == null) return [];
  if (!Array.isArray(paymentSchedules)) {
    throw createInputError('payment_schedules must be an array');
  }

  const seenDates = new Set();
  const normalized = paymentSchedules.map((entry, index) => {
    const paymentDate = String(entry?.payment_date || '').trim();
    if (!paymentDate) {
      throw createInputError(`payment_schedules[${index}].payment_date is required`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      throw createInputError(`payment_schedules[${index}].payment_date must be YYYY-MM-DD`);
    }

    const parsedDate = new Date(`${paymentDate}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== paymentDate) {
      throw createInputError(`payment_schedules[${index}].payment_date is invalid`);
    }

    if (seenDates.has(paymentDate)) {
      throw createInputError(`Duplicate payment date found: ${paymentDate}`);
    }
    seenDates.add(paymentDate);

    const note = entry?.note == null ? null : String(entry.note).trim() || null;
    let amount = null;
    if (entry?.amount != null && entry.amount !== '') {
      const numericAmount = Number(entry.amount);
      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw createInputError(`payment_schedules[${index}].amount must be a non-negative number`);
      }
      amount = Number(numericAmount.toFixed(2));
    }

    return {
      payment_date: paymentDate,
      amount,
      note
    };
  });

  return normalized.sort((a, b) => a.payment_date.localeCompare(b.payment_date));
};

const replacePaymentSchedules = async (conn, purchaseRequestId, schedules, employeeId) => {
  await conn.query(
    'DELETE FROM purchase_request_payment_schedules WHERE purchase_request_id = ?',
    [purchaseRequestId]
  );

  if (!schedules.length) return;

  for (const schedule of schedules) {
    await conn.query(
      `INSERT INTO purchase_request_payment_schedules
      (purchase_request_id, payment_date, amount, note, created_by)
      VALUES (?, ?, ?, ?, ?)`,
      [purchaseRequestId, schedule.payment_date, schedule.amount, schedule.note, employeeId]
    );
  }
};

const getPaymentScheduleCount = async (conn, purchaseRequestId) => {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS count FROM purchase_request_payment_schedules WHERE purchase_request_id = ?',
    [purchaseRequestId]
  );
  return rows[0]?.count || 0;
};

const getExistingPaymentSchedules = async (conn, purchaseRequestId) => {
  const [rows] = await conn.query(
    'SELECT DATE_FORMAT(payment_date, "%Y-%m-%d") AS payment_date, amount, note FROM purchase_request_payment_schedules WHERE purchase_request_id = ?',
    [purchaseRequestId]
  );
  return rows || [];
};

const assertPaymentScheduleTotalsMatch = ({ paymentBasis, schedules, totalAmount }) => {
  if (paymentBasis !== 'debt') return;
  // Payment schedule UI is currently disabled — skip totals check when no schedules provided.
  if (!schedules || schedules.length === 0) return;

  const schedulesTotal = sumScheduleAmounts(schedules);
  const prTotal = roundMoney(totalAmount);
  if (schedulesTotal !== prTotal) {
    throw createInputError(`Payment schedule total (${schedulesTotal.toFixed(2)}) must match PR total (${prTotal.toFixed(2)}).`);
  }
};

// Check supplier accreditation status with fuzzy matching
router.get('/check-supplier-accreditation/:supplierName', authenticate, async (req, res) => {
  try {
    const supplierName = decodeURIComponent(req.params.supplierName);
    const normalizedInput = supplierName.trim().toLowerCase();

    // Fuzzy match against suppliers table
    const [suppliers] = await db.query(`
      SELECT id, supplier_name, accredited, accreditation_files, address
      FROM suppliers
      WHERE LOWER(supplier_name) LIKE ?
      ORDER BY
        CASE
          WHEN LOWER(supplier_name) = ? THEN 1
          WHEN LOWER(supplier_name) LIKE ? THEN 2
          WHEN LOWER(supplier_name) LIKE ? THEN 3
          ELSE 4
        END,
        LENGTH(supplier_name) ASC
      LIMIT 5
    `, [`%${normalizedInput}%`, normalizedInput, `${normalizedInput}%`, `%${normalizedInput}%`]);

    if (suppliers.length === 0) {
      return res.json({
        found: false,
        accredited: false,
        supplierId: null,
        supplierName: null,
        accreditationFiles: [],
        message: 'Supplier not found in database'
      });
    }

    // Use the best match (first result due to ORDER BY)
    const bestMatch = suppliers[0];
    let accreditationFiles = [];
    if (bestMatch.accreditation_files) {
      try {
        accreditationFiles = JSON.parse(bestMatch.accreditation_files);
      } catch (e) {
        accreditationFiles = [];
      }
    }

    res.json({
      found: true,
      accredited: bestMatch.accredited === 1,
      supplierId: bestMatch.id,
      supplierName: bestMatch.supplier_name,
      suggestedName: bestMatch.supplier_name !== supplierName ? bestMatch.supplier_name : null,
      accreditationFiles,
      address: bestMatch.address
    });
  } catch (error) {
    console.error('Check supplier accreditation error:', error);
    res.status(500).json({ message: 'Failed to check supplier accreditation: ' + error.message });
  }
});

// Get PR counts grouped by status (filtered by user role)
router.get('/counts', authenticate, async (req, res) => {
  try {
    const { view } = req.query;
    
    let baseFrom = `
      FROM purchase_requests pr
      JOIN employees e ON pr.requested_by = e.id
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
    `;

    const whereClauses = [];
    const whereParams = [];

    // Engineers see only their own PRs by default, but can view all with ?view=all
    if (req.user.role === 'engineer' && view !== 'all') {
      whereClauses.push('pr.requested_by = ?');
      whereParams.push(req.user.id);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `
      SELECT pr.status, COUNT(*) as count
      ${baseFrom}
      ${whereSql}
      GROUP BY pr.status
    `;

    const [rows] = await db.query(countQuery, whereParams);
    
    // Also get the total count of all PRs
    const totalCountQuery = `
      SELECT COUNT(*) as total
      ${baseFrom}
      ${whereSql}
    `;
    const [totalRows] = await db.query(totalCountQuery, whereParams);

    res.json({
      counts: rows,
      total: totalRows?.[0]?.total ?? 0
    });
  } catch (error) {
    console.error('Fetch purchase request counts error:', error);
    res.status(500).json({ message: 'Failed to fetch purchase request counts: ' + error.message });
  }
});

// Get all PRs (filtered by user role)
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const { view } = req.query;
    const q = String(req.query.q || '').trim();
    const pendingReview = req.query.pending_review === 'true';
    const myReviews = req.query.my_reviews; // 'pending' or 'reviewed'

    const statusesRaw = req.query.status;
    const statuses = Array.isArray(statusesRaw)
      ? statusesRaw
      : (typeof statusesRaw === 'string' && statusesRaw.length > 0)
        ? statusesRaw.split(',')
        : [];
    const normalizedStatuses = statuses
      .map((s) => String(s || '').trim())
      .filter(Boolean);

    let baseFrom = `
      FROM purchase_requests pr
      JOIN employees e ON pr.requested_by = e.id
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
    `;

    const whereClauses = [];
    const whereParams = [];

    // Filter for pending reviews for current user
    if (pendingReview || myReviews) {
      console.log('🔍 Fetching reviews for user:', req.user.id, 'role:', req.user.role, 'filter:', myReviews || 'pending');
      baseFrom = `
        FROM purchase_requests pr
        JOIN employees e ON pr.requested_by = e.id
        LEFT JOIN suppliers s ON pr.supplier_id = s.id
        JOIN purchase_request_reviews prr ON pr.id = prr.purchase_request_id
      `;
      whereClauses.push('prr.reviewer_id = ?');
      if (pendingReview || myReviews === 'pending') {
        whereClauses.push('prr.review_status = ?');
        whereParams.push(req.user.id, 'pending');
      } else if (myReviews === 'reviewed') {
        whereClauses.push('prr.review_status != ?');
        whereParams.push(req.user.id, 'pending');
      }
    }

    // Engineers see only their own PRs by default, but can view all with ?view=all
    if (req.user.role === 'engineer' && view !== 'all' && !pendingReview && !myReviews) {
      whereClauses.push('pr.requested_by = ?');
      whereParams.push(req.user.id);
    }

    if (normalizedStatuses.length > 0) {
      whereClauses.push(`pr.status IN (${normalizedStatuses.map(() => '?').join(', ')})`);
      whereParams.push(...normalizedStatuses);
    }

    if (q) {
      const like = `%${q}%`;
      whereClauses.push(`(
        pr.pr_number LIKE ?
        OR pr.project LIKE ?
        OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
        OR pr.supplier_name LIKE ?
        OR s.supplier_name LIKE ?
      )`);
      whereParams.push(like, like, like, like, like);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const listQuery = `
      SELECT pr.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             COALESCE(pr.supplier_name, s.supplier_name) as supplier_name,
             COALESCE(pr.supplier_name, s.supplier_name) as payee_name,
             COALESCE(pr.supplier_address, s.address) as payee_address,
             (SELECT COUNT(*) FROM purchase_request_payment_schedules prs WHERE prs.purchase_request_id = pr.id) as payment_schedule_count,
             (SELECT MIN(prs.payment_date) FROM purchase_request_payment_schedules prs WHERE prs.purchase_request_id = pr.id) as next_payment_date
      ${baseFrom}
      ${whereSql}
      ORDER BY pr.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      ${baseFrom}
      ${whereSql}
    `;

    const [prs] = await db.query(listQuery, [...whereParams, pageSize, offset]);
    const [countRows] = await db.query(countQuery, whereParams);

    res.json({
      purchaseRequests: prs,
      page,
      pageSize,
      total: countRows?.[0]?.total ?? 0
    });

    if (pendingReview) {
      console.log('🔍 Pending review results:', prs.length, 'PRs found');
      console.log('🔍 PR IDs:', prs.map(r => ({ id: r.id, pr_number: r.pr_number, status: r.status })));
    }
  } catch (error) {
    console.error('Fetch purchase requests error:', error);
    res.status(500).json({ message: 'Failed to fetch purchase requests: ' + error.message });
  }
});

// Get single PR with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    // 70-84
    const [prs] = await db.query(`
	      SELECT pr.*, 
	             e.first_name as requester_first_name, 
	             e.last_name as requester_last_name,
	             e.role as requester_role,
	             approver.first_name as approver_first_name,
	             approver.last_name as approver_last_name,
	             bypasser.first_name as bypassed_by_first_name,
	             bypasser.last_name as bypassed_by_last_name,
	             COALESCE(pr.supplier_name, s.supplier_name) as supplier_name,
	             COALESCE(pr.supplier_name, s.supplier_name) as payee_name,
	             COALESCE(pr.supplier_address, s.address) as payee_address,
	             s.address as supplier_address,
	             engineer_selected.supplier_name as engineer_supplier_name
	      FROM purchase_requests pr
	      JOIN employees e ON pr.requested_by = e.id
	      LEFT JOIN employees approver ON pr.approved_by = approver.id
	      LEFT JOIN employees bypasser ON pr.bypassed_by = bypasser.id
	      LEFT JOIN suppliers s ON pr.supplier_id = s.id
	      LEFT JOIN suppliers engineer_selected ON pr.supplier_id = engineer_selected.id
	      WHERE pr.id = ?
	    `, [req.params.id]);

    if (prs.length === 0) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const pr = prs[0];
    console.log('PR from DB:', pr);
    console.log('Supplier name from DB:', pr.supplier_name);

    // Get items for this PR
    const [items] = await db.query(`
      SELECT pri.*, i.item_name, i.unit, i.item_code
      FROM purchase_request_items pri
      JOIN items i ON pri.item_id = i.id
      WHERE pri.purchase_request_id = ?
    `, [req.params.id]);

    const [paymentSchedules] = await db.query(`
      SELECT id, purchase_request_id, DATE_FORMAT(payment_date, '%Y-%m-%d') as payment_date, amount, note, created_by, created_at, updated_at
      FROM purchase_request_payment_schedules
      WHERE purchase_request_id = ?
      ORDER BY payment_date ASC
    `, [req.params.id]);

    const [paidDvRows] = await db.query(`
      SELECT amount
      FROM disbursement_vouchers
      WHERE purchase_request_id = ? AND status = 'Paid'
    `, [req.params.id]);

    const formatDateLabel = (ymd) => {
      if (!ymd) return '-';
      const date = new Date(`${ymd}T00:00:00`);
      return Number.isNaN(date.getTime()) ? ymd : date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let paymentReviewNote = 'No payment schedules set';
    if (paymentSchedules.length > 0) {
      let remainingPaid = paidDvRows.reduce((sum, row) => {
        const amount = Number(row?.amount);
        return Number.isFinite(amount) ? sum + amount : sum;
      }, 0);

      const schedules = paymentSchedules.map((schedule) => ({
        payment_date: String(schedule.payment_date || '').trim(),
        amount: Number.isFinite(Number(schedule.amount)) && Number(schedule.amount) > 0 ? Number(schedule.amount) : 0
      }));

      const paidFlags = schedules.map(() => false);
      for (let index = 0; index < schedules.length; index += 1) {
        const scheduleAmount = schedules[index].amount;
        if (remainingPaid >= scheduleAmount) {
          paidFlags[index] = true;
          remainingPaid -= scheduleAmount;
        } else {
          break;
        }
      }

      if (!paidFlags[0]) {
        const firstDate = schedules[0].payment_date;
        paymentReviewNote = firstDate < todayYmd
          ? `First payment is not paid — OVERDUE: ${formatDateLabel(firstDate)}`
          : `First payment is not paid — UPCOMING: ${formatDateLabel(firstDate)}`;
      } else {
        const nextUpcomingUnpaidIndex = schedules.findIndex((schedule, index) => !paidFlags[index] && schedule.payment_date >= todayYmd);
        if (nextUpcomingUnpaidIndex !== -1) {
          paymentReviewNote = `Next upcoming payment: ${formatDateLabel(schedules[nextUpcomingUnpaidIndex].payment_date)}`;
        } else if (paidFlags.every(Boolean)) {
          paymentReviewNote = 'All scheduled payments are paid';
        } else {
          const firstUnpaidIndex = paidFlags.findIndex((paid) => !paid);
          if (firstUnpaidIndex !== -1) {
            paymentReviewNote = `First unpaid payment is overdue: ${formatDateLabel(schedules[firstUnpaidIndex].payment_date)}`;
          }
        }
      }
    }

    // Get per-item rejection remarks if PR is rejected or sent back to super_admin_rep
    let itemRemarks = [];
    if (pr.status === 'Rejected') {
      const [remarks] = await db.query(`
        SELECT pirr.purchase_request_item_id, pirr.item_id, pirr.remark, pirr.created_at,
               e.first_name as created_by_first_name, e.last_name as created_by_last_name
        FROM pr_item_rejection_remarks pirr
        LEFT JOIN employees e ON pirr.created_by = e.id
        WHERE pirr.purchase_request_id = ?
        ORDER BY pirr.created_at DESC
      `, [req.params.id]);
      itemRemarks = remarks;
    }

    // Add remarks to items
    const itemsWithRemarks = items.map(item => ({
      ...item,
      rejection_remarks: itemRemarks.filter(r => r.purchase_request_item_id === item.id)
    }));

    // Get review records for this PR
    const [reviews] = await db.query(`
      SELECT prr.*, 
             e.first_name as reviewer_first_name, 
             e.last_name as reviewer_last_name,
             e.role as reviewer_role,
             e.is_active as reviewer_is_active
      FROM purchase_request_reviews prr
      JOIN employees e ON prr.reviewer_id = e.id
      WHERE prr.purchase_request_id = ?
        AND e.is_active = 1
      ORDER BY prr.created_at ASC
    `, [req.params.id]);

    res.json({ purchaseRequest: { ...pr, items: itemsWithRemarks, payment_schedules: paymentSchedules, payment_review_note: paymentReviewNote, reviews } });
  } catch (error) {
    console.error('Fetch purchase request error:', error);
    res.status(500).json({ message: 'Failed to fetch purchase request: ' + error.message });
  }
});

// Create PR (engineer)
router.post('/', authenticate, prAccreditationUpload.array('accreditation_files', 5), async (req, res) => {
  let conn;
  try {
    console.log('📥 Received PR creation request');
    console.log('📦 Request body keys:', Object.keys(req.body));
    console.log('📦 Files received:', req.files?.length || 0);

    const { purpose, remarks, items, date_needed, project, project_address, order_number, save_as_draft, payment_basis, payment_terms_note, supplier_id, supplier_name, payment_schedules, is_item_request } = req.body;

    const isItemRequest = is_item_request === true || is_item_request === 'true';

    // Parse JSON strings from FormData
    let parsedItems = items;
    let parsedPaymentSchedules = payment_schedules;

    if (typeof items === 'string') {
      try {
        parsedItems = JSON.parse(items);
        console.log('✅ Parsed items:', parsedItems);
      } catch (e) {
        console.error('Failed to parse items:', e);
        parsedItems = [];
      }
    }

    if (typeof payment_schedules === 'string') {
      try {
        parsedPaymentSchedules = JSON.parse(payment_schedules);
        console.log('✅ Parsed payment_schedules:', parsedPaymentSchedules);
      } catch (e) {
        console.error('Failed to parse payment_schedules:', e);
        parsedPaymentSchedules = [];
      }
    }

    await assertProjectIsActive(project, { providedOrderNumber: order_number });
    const isDraft = save_as_draft === true;

    // Only validate required fields if NOT saving as draft
    if (!isDraft) {
      if (!date_needed || !String(date_needed).trim()) {
        return res.status(400).json({ message: 'Date needed is required' });
      }
      if (!purpose || !String(purpose).trim()) {
        return res.status(400).json({ message: 'Purpose is required' });
      }

      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        return res.status(400).json({ message: 'At least one item is required' });
      }

      const invalidItems = parsedItems.filter(item => {
        const up = Number(item.unit_price ?? item.estimated_unit_price ?? 0);
        return !isItemRequest && (!Number.isFinite(up) || up <= 0);
      });
      if (invalidItems.length > 0) {
        return res.status(400).json({ message: 'All items must have a unit price strictly greater than 0' });
      }
    }

    conn = await db.getConnection();
    await conn.beginTransaction();
    // 147-148

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Get the last PR number for this year/month (without initials)
    const [lastPrs] = await conn.query(
      "SELECT pr_number FROM purchase_requests WHERE pr_number LIKE ? ORDER BY pr_number DESC LIMIT 1",
      [`${year}-%`]  // This looks for year only
    );

    let counter = 1;
    if (lastPrs.length > 0) {
      const lastNumber = lastPrs[0].pr_number;
      const match = lastNumber.match(/-(\d{3})$/);
      if (match) {
        counter = parseInt(match[1], 10) + 1;
      }
    }

    const prNumber = `${year}-${month}-${String(counter).padStart(3, '0')}`;

    // Determine status based on requester role
    let status;
    if (isDraft) {
      status = 'Draft';
    } else if (isItemRequest) {
      status = 'For Admin Processing';
    } else if (req.user.role === 'engineer') {
      status = 'For Engineer Review';
    } else if (req.user.role === 'admin') {
      status = 'For Admin Review';
    } else {
      status = 'For Super Admin Final Approval';
    }

    const paymentBasis = payment_basis === 'non_debt' ? 'non_debt' : 'debt';
    const paymentTermsNote = normalizePaymentTermsNote(payment_terms_note);
    const paymentTermsCode = paymentTermsNote ? 'CUSTOM' : null;
    const freeTextSupplierName = isItemRequest ? 'TBD' : normalizeSupplierName(supplier_name);
    const normalizedPaymentSchedules = normalizePaymentSchedules(parsedPaymentSchedules);

    // Handle accreditation files and check supplier accreditation status
    const accreditationFiles = req.files || [];
    let supplierAccredited = null;
    let matchedSupplierId = supplier_id || null;

    // Check supplier accreditation status if supplier name is provided
    if (freeTextSupplierName && !isDraft && !isItemRequest) {
      const normalizedSupplierName = freeTextSupplierName.trim().toLowerCase();
      const [supplierCheck] = await conn.query(`
        SELECT id, accredited
        FROM suppliers
        WHERE LOWER(supplier_name) = ?
        LIMIT 1
      `, [normalizedSupplierName]);

      if (supplierCheck.length > 0) {
        supplierAccredited = supplierCheck[0].accredited === 1 ? 1 : 0;
        matchedSupplierId = supplierCheck[0].id;

        // If supplier is not accredited, set status to Pending Accreditation Review
        if (supplierAccredited === 0) {
          status = 'Pending Accreditation Review';
        }
      } else {
        supplierAccredited = 0; // Supplier not in database = not accredited
        status = 'Pending Accreditation Review';
      }
    }

    // Process accreditation files
    let accreditationFilesJson = null;
    if (accreditationFiles.length > 0) {
      const processedFiles = accreditationFiles.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        uploaded_at: new Date().toISOString()
      }));
      accreditationFilesJson = JSON.stringify(processedFiles);

      // If supplier exists in database, also link files to supplier record
      if (matchedSupplierId) {
        const [existingSupplierFiles] = await conn.query(
          'SELECT accreditation_files FROM suppliers WHERE id = ?',
          [matchedSupplierId]
        );

        let supplierFiles = [];
        if (existingSupplierFiles[0]?.accreditation_files) {
          try {
            supplierFiles = JSON.parse(existingSupplierFiles[0].accreditation_files);
          } catch (e) {
            supplierFiles = [];
          }
        }

        const updatedSupplierFiles = [...supplierFiles, ...processedFiles];
        await conn.query(
          'UPDATE suppliers SET accreditation_files = ? WHERE id = ?',
          [JSON.stringify(updatedSupplierFiles), matchedSupplierId]
        );
      }
    }

    // Payment schedule requirement is intentionally relaxed — the payment schedule
    // UI is currently disabled, so debt PRs are allowed without schedules.
    // if (!isDraft && paymentBasis === 'debt' && normalizedPaymentSchedules.length === 0) {
    //   return res.status(400).json({ message: 'At least one payment schedule is required for debt/with account PR.' });
    // }

    const normalizedItems = Array.isArray(parsedItems)
      ? parsedItems.map((item) => {
        const itemId = item.item_id ?? item.id;
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price ?? item.estimated_unit_price ?? 0);
        const totalPrice = quantity * unitPrice;

        if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Invalid item payload: each item requires item_id (or id) and quantity > 0');
        }

        return {
          itemId,
          quantity,
          unitPrice,
          totalPrice,
          remarks: item.remarks ?? item.notes ?? null
        }
      })
      : [];

    const computedTotalAmount = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const providedTotalAmount = req.body.total_amount !== undefined ? Number(req.body.total_amount) : null;
    const totalAmount = (providedTotalAmount !== null && providedTotalAmount > 0) ? providedTotalAmount : computedTotalAmount;
    assertPaymentScheduleTotalsMatch({
      paymentBasis,
      schedules: normalizedPaymentSchedules,
      totalAmount
    });

    let supplierAddress = null;

    // First, check if supplier_address was provided directly in the request
    if (req.body.supplier_address && String(req.body.supplier_address).trim()) {
      supplierAddress = String(req.body.supplier_address).trim();
      console.log('✅ Using supplier_address from request:', supplierAddress);
    }

    // If no direct address but supplier_id exists, get address from suppliers table
    if (!supplierAddress && supplier_id) {
      const [supRows] = await conn.query(
        'SELECT address from suppliers WHERE id = ? LIMIT 1',
        [supplier_id]
      );

      if (supRows.length === 0) {
        throw new Error('Invalid supplier_id; supplier not found');
      }

      supplierAddress = supRows[0].address ?? null;
      console.log('✅ Using address from suppliers table:', supplierAddress);
    }

    console.log('🎯 FINAL supplierAddress being saved:', supplierAddress);

    // 200-218
    const [result] = await conn.query(
      `INSERT INTO purchase_requests
      (pr_number, requested_by, purpose, remarks, status, date_needed, project, project_address, order_number, payment_basis, payment_terms_code, payment_terms_note, payment_terms_set_by, payment_terms_set_at, supplier_id, supplier_name, supplier_address, total_amount, accreditation_files, supplier_accredited)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prNumber,
        req.user.id,
        purpose || '',
        remarks ?? '',
        status,
        date_needed || null,
        project || null,
        project_address || null,
        order_number || null,
        paymentBasis,
        paymentTermsCode,
        paymentTermsNote,
        paymentTermsNote ? req.user.id : null,
        paymentTermsNote ? new Date() : null,
        supplier_id || null,
        freeTextSupplierName,
        supplierAddress,
        totalAmount,
        accreditationFilesJson,
        supplierAccredited
      ]
    );

    const prId = result.insertId;

    if (normalizedItems.length > 0) {
      for (const item of normalizedItems) {
        await conn.query(
          'INSERT INTO purchase_request_items (purchase_request_id, item_id, quantity, unit_price, total_price, remarks) VALUES (?, ?, ?, ?, ?, ?)',
          [prId, item.itemId, item.quantity, item.unitPrice, item.totalPrice, item.remarks]
        );
      }
    }

    await replacePaymentSchedules(conn, prId, normalizedPaymentSchedules, req.user.id);

    // Create review records for all required reviewers if NOT a draft
    if (!isDraft && status !== 'Pending Accreditation Review') {
      const reviewers = await getReviewersForPR(req.user.role);
      console.log('🔍 Reviewers for PR (before filtering):', reviewers);
      console.log('🔍 Requester ID:', req.user.id);

      // Filter out the requester themselves
      const filteredReviewers = reviewers.filter(reviewerId => reviewerId !== req.user.id);
      console.log('🔍 Reviewers for PR (after filtering):', filteredReviewers);

      // Create review records
      for (const reviewerId of filteredReviewers) {
        await conn.query(
          'INSERT INTO purchase_request_reviews (purchase_request_id, reviewer_id, review_status) VALUES (?, ?, ?)',
          [prId, reviewerId, 'pending']
        );
      }

      console.log('✅ Created review records for PR:', prId, 'with reviewers:', filteredReviewers);

      // Send notifications to all reviewers (excluding requester)
      for (const reviewerId of filteredReviewers) {
        await createNotification(
          reviewerId,
          'New PR Created',
          `Purchase Request ${prNumber} has been created and is ready for your review`,
          'PR Created',
          prId,
          'purchase_request'
        );
      }
    }
    await conn.commit();

    if (req.io) {
      req.io.emit('pr_created', { prId, pr_number: prNumber, status });
    }

    res.status(201).json({
      message: isDraft ? 'Draft saved successfully' : 'Purchase request created successfully',
      prId,
      pr_number: prNumber,
      status: status,
      payment_basis: paymentBasis,
      payment_terms_code: paymentTermsCode,
      payment_terms_note: paymentTermsNote,
      supplier_name: freeTextSupplierName,
      payment_schedules: normalizedPaymentSchedules
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Create purchase request error:', error);
    try { require('fs').appendFileSync('error.log', '\n[PR CREATE ERROR] ' + (error.stack || error.message) + '\n'); } catch (e) {}
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: statusCode === 500 ? 'Failed to create purchase request: ' + error.message : error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Update Draft PR (engineer only)
router.put('/:id/draft', authenticate, async (req, res) => {
  let conn;
  try {
    const { purpose, remarks, items, date_needed, project, project_address, order_number, payment_basis, payment_terms_note, supplier_id, supplier_name, payment_schedules } = req.body;
    // Check if PR exists and is draft
    const [prs] = await db.query('SELECT * FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (prs.length === 0) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const pr = prs[0];

    // Check project is active only if changed
    if (pr.project !== project) {
      await assertProjectIsActive(project, { providedOrderNumber: order_number });
    }

    // Only the original requester can update draft
    if (pr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can update this draft' });
    }

    // Only draft and pending accreditation PRs can be updated here
    if (pr.status !== 'Draft' && pr.status !== 'Pending Accreditation Review') {
      return res.status(400).json({ message: 'Only draft or pending accreditation purchase requests can be updated' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const normalizedItems = Array.isArray(items)
      ? items.map((item) => {
        const itemId = item.item_id ?? item.id;
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price ?? item.estimated_unit_price ?? 0);
        const totalPrice = quantity * unitPrice;

        if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Invalid item payload: each item requires item_id (or id) and quantity > 0');
        }

        return {
          itemId,
          quantity,
          unitPrice,
          totalPrice,
          remarks: item.remarks ?? item.notes ?? null
        };
      })
      : [];

    const computedTotalAmount = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const providedTotalAmount = req.body.total_amount !== undefined ? Number(req.body.total_amount) : null;
    const totalAmount = (providedTotalAmount !== null && providedTotalAmount > 0) ? providedTotalAmount : computedTotalAmount;

    let supplierAddress = null;
    const effectiveSupplierId = supplier_id ?? pr.supplier_id;

    if (effectiveSupplierId) {
      const [supRows] = await conn.query(
        'SELECT address FROM suppliers WHERE id = ? LIMIT 1',
        [effectiveSupplierId]
      );

      if (supRows.length === 0) {
        throw new Error('Invalid supplier_id: supplier not found');
      }

      supplierAddress = supRows[0].address ?? null;
    }

    const nextPaymentBasis = payment_basis ?? pr.payment_basis;
    const nextPaymentTermsNote = normalizePaymentTermsNote(payment_terms_note ?? pr.payment_terms_note);
    const nextPaymentTermsCode = nextPaymentTermsNote ? 'CUSTOM' : null;
    const nextSupplierName = hasOwn(req.body, 'supplier_name')
      ? normalizeSupplierName(supplier_name)
      : pr.supplier_name;
    const hasPaymentSchedulesField = hasOwn(req.body, 'payment_schedules');
    const normalizedPaymentSchedules = hasPaymentSchedulesField ? normalizePaymentSchedules(payment_schedules) : null;
    const schedulesForValidation = hasPaymentSchedulesField
      ? normalizedPaymentSchedules
      : await getExistingPaymentSchedules(conn, req.params.id);
    assertPaymentScheduleTotalsMatch({
      paymentBasis: nextPaymentBasis,
      schedules: schedulesForValidation,
      totalAmount
    });

    // Update PR details
    await conn.query(
      `UPDATE purchase_requests 
       SET purpose = ?, remarks = ?, date_needed = ?, project = ?, project_address = ?, order_number = ?, payment_basis = ?,
           payment_terms_code = ?, payment_terms_note = ?, payment_terms_set_by = ?, payment_terms_set_at = ?,
           supplier_id = ?, supplier_name = ?, supplier_address = ?, total_amount = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        purpose ?? pr.purpose,
        remarks ?? pr.remarks,
        date_needed || pr.date_needed,
        project || pr.project,
        project_address || pr.project_address,
        order_number || pr.order_number,
        nextPaymentBasis,
        nextPaymentTermsCode,
        nextPaymentTermsNote,
        nextPaymentTermsNote ? req.user.id : null,
        nextPaymentTermsNote ? new Date() : null,
        supplier_id ?? pr.supplier_id,
        nextSupplierName,
        supplierAddress,
        totalAmount,
        req.params.id
      ]
    );

    // Update items if provided
    if (normalizedItems.length > 0) {
      await conn.query('DELETE FROM purchase_request_items WHERE purchase_request_id = ?', [req.params.id]);

      for (const item of normalizedItems) {
        await conn.query(
          'INSERT INTO purchase_request_items (purchase_request_id, item_id, quantity, unit_price, total_price, remarks) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.id, item.itemId, item.quantity, item.unitPrice, item.totalPrice, item.remarks]
        );
      }
    }

    if (hasPaymentSchedulesField) {
      await replacePaymentSchedules(conn, req.params.id, normalizedPaymentSchedules, req.user.id);
    }

    await conn.commit();

    res.json({ message: 'Draft updated successfully', status: 'Draft' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Update draft error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: statusCode === 500 ? 'Failed to update draft: ' + error.message : error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Submit Draft PR (engineer only) - moves to For Super Admin Rep Review and notifies super_admin_rep
router.put('/:id/submit-draft', authenticate, async (req, res) => {
  let conn;
  try {
    // Check if PR exists and is draft
    const [prs] = await db.query('SELECT * FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (prs.length === 0) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const pr = prs[0];

    // Only the original requester can submit
    if (pr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can submit this draft' });
    }

    // Only draft PRs can be submitted
    if (pr.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft purchase requests can be submitted' });
    }

    // Validate required fields for submission
    if (!pr.purpose || !String(pr.purpose).trim()) {
      return res.status(400).json({ message: 'Purpose is required to submit' });
    }
    
    if (!pr.date_needed) {
      return res.status(400).json({ message: 'Date needed is required to submit' });
    }
    // Payment schedule requirement is intentionally relaxed — the payment schedule
    // UI is currently disabled, so debt PRs are allowed to be submitted without schedules.
    // if (pr.payment_basis === 'debt') {
    //   const scheduleCount = await getPaymentScheduleCount(db, req.params.id);
    //   if (scheduleCount === 0) {
    //     return res.status(400).json({ message: 'At least one payment schedule is required for debt/with account PR.' });
    //   }
    // }

    // Check if PR has valid items
    const [items] = await db.query(
      'SELECT unit_price FROM purchase_request_items WHERE purchase_request_id = ?',
      [req.params.id]
    );

    if (items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required to submit' });
    }

    const invalidItems = items.filter(item => !Number.isFinite(item.unit_price) || item.unit_price <= 0);
    if (invalidItems.length > 0) {
      return res.status(400).json({ message: 'All items must have a unit price strictly greater than 0 to submit' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Determine new status based on requester role
    let newStatus;
    if (pr.supplier_accredited === 0 || (pr.supplier_name && pr.supplier_accredited === 0)) {
      newStatus = 'Pending Accreditation Review';
    } else if (req.user.role === 'engineer') {
      newStatus = 'For Engineer Review';
    } else if (req.user.role === 'admin') {
      newStatus = 'For Admin Review';
    } else {
      newStatus = 'For Super Admin Final Approval';
    }

    // Update status
    await conn.query(
      "UPDATE purchase_requests SET status = ?, updated_at = NOW() WHERE id = ?",
      [newStatus, req.params.id]
    );

    // Create review records for all required reviewers (if not pending accreditation)
    const filteredReviewers = [];
    if (newStatus !== 'Pending Accreditation Review') {
      const reviewers = await getReviewersForPR(req.user.role);
      
      // Filter out the requester themselves
      const filtered = reviewers.filter(reviewerId => reviewerId !== req.user.id);
      filteredReviewers.push(...filtered);

      for (const reviewerId of filteredReviewers) {
        await conn.query(
          'INSERT INTO purchase_request_reviews (purchase_request_id, reviewer_id, review_status) VALUES (?, ?, ?)',
          [req.params.id, reviewerId, 'pending']
        );
      }
    }

    await conn.commit();

    // Send notifications to all reviewers (excluding requester)
    for (const reviewerId of filteredReviewers) {
      await createNotification(
        reviewerId,
        'New PR Created',
        `Purchase Request ${pr.pr_number} has been created and is ready for your review`,
        'PR Created',
        pr.id,
        'purchase_request'
      );
    }

    res.json({ message: 'Draft submitted successfully', status: newStatus });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Submit draft error:', error);
    res.status(500).json({ message: 'Failed to submit draft: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Review PR (for Engineers, Admins, Super Admin Rep)
router.post('/:id/review', authenticate, async (req, res) => {
  let conn;
  try {
    const { review_status, review_comment } = req.body;

    if (!review_status || !['approved', 'rejected'].includes(review_status)) {
      return res.status(400).json({ message: 'Invalid review status. Must be approved or rejected.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Get PR and check if user is a reviewer
    const [prs] = await conn.query(
      'SELECT pr.*, e.role as requester_role FROM purchase_requests pr JOIN employees e ON pr.requested_by = e.id WHERE pr.id = ?',
      [req.params.id]
    );

    if (prs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const pr = prs[0];

    const isSuperAdminReject = req.user.role === 'super_admin' && review_status === 'rejected';

    // Check if user is a reviewer for this PR
    const [reviewCheck] = await conn.query(
      'SELECT * FROM purchase_request_reviews WHERE purchase_request_id = ? AND reviewer_id = ?',
      [req.params.id, req.user.id]
    );

    if (reviewCheck.length === 0 && !isSuperAdminReject) {
      await conn.rollback();
      return res.status(403).json({ message: 'You are not authorized to review this PR' });
    }

    if (!isSuperAdminReject) {
      // Check if already reviewed
      if (reviewCheck[0].review_status !== 'pending') {
        await conn.rollback();
        return res.status(400).json({ message: 'You have already reviewed this PR' });
      }
    }

    // Validate that user's role matches the current status
    const currentStatus = pr.status;
    const userRole = req.user.role;

    if (!isSuperAdminReject) {
      if (currentStatus === 'For Engineer Review' && userRole !== 'engineer') {
        await conn.rollback();
        return res.status(403).json({ message: 'This purchase request is currently awaiting Engineer review. You do not have permission to review at this stage.' });
      }

      if (currentStatus === 'For Admin Review' && userRole !== 'admin') {
        await conn.rollback();
        return res.status(403).json({ message: 'This purchase request is currently awaiting Admin review. You do not have permission to review at this stage.' });
      }

      if (currentStatus === 'For Super Admin Rep Review' && userRole !== 'super_admin_rep') {
        await conn.rollback();
        return res.status(403).json({ message: 'This purchase request is currently awaiting Super Admin Representative review. You do not have permission to review at this stage.' });
      }

      if (currentStatus === 'For Super Admin Final Approval' && userRole !== 'super_admin') {
        await conn.rollback();
        return res.status(403).json({ message: 'This purchase request is currently awaiting Super Admin final approval. You do not have permission to review at this stage.' });
      }
    }

    // Update review record
    await conn.query(
      'UPDATE purchase_request_reviews SET review_status = ?, review_comment = ?, reviewed_at = NOW() WHERE purchase_request_id = ? AND reviewer_id = ?',
      [review_status, review_comment || null, req.params.id, req.user.id]
    );

    // If rejected, set PR status to Rejected
    if (review_status === 'rejected') {
      await conn.query(
        'UPDATE purchase_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
        ['Rejected', review_comment || 'Rejected by reviewer', req.params.id]
      );

      await conn.commit();

      // Notify requester
      await createNotification(
        pr.requested_by,
        'PR Rejected',
        `Your Purchase Request ${pr.pr_number} has been rejected`,
        'PR Rejected',
        pr.id,
        'purchase_request'
      );

      res.json({ message: 'PR rejected successfully', status: 'Rejected' });
      return;
    }

    // Determine next status based on which reviewer group has completed
    let newStatus;
    let notificationRecipients = [];
    let notificationTitle;
    let notificationMessage;

    console.log('🔍 Review workflow: PR ID:', req.params.id, 'Requester role:', pr.requester_role);

    if (pr.requester_role === 'engineer') {
      // Engineer requester: Engineers → Admins → Super Admin Rep → Super Admin
      // Check if all engineers have approved
      const [engineerReviews] = await conn.query(
        `SELECT prr.review_status 
         FROM purchase_request_reviews prr
         JOIN employees e ON prr.reviewer_id = e.id
         WHERE prr.purchase_request_id = ? AND e.role = 'engineer' AND e.is_active = 1`,
        [req.params.id]
      );

      console.log('🔍 Engineer reviews:', engineerReviews);

      const engineersApproved = engineerReviews.length > 0 && engineerReviews.every(r => r.review_status === 'approved');
      const engineersPending = engineerReviews.some(r => r.review_status === 'pending');
      const engineersRejected = engineerReviews.some(r => r.review_status === 'rejected');

      console.log('🔍 Engineers approved:', engineersApproved, 'pending:', engineersPending, 'rejected:', engineersRejected);

      if (engineersRejected) {
        // Engineers rejected, PR is rejected
        await conn.query(
          'UPDATE purchase_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
          ['Rejected', 'Rejected by engineer reviewer', req.params.id]
        );
        await conn.commit();
        res.json({ message: 'PR rejected by engineer reviewer', status: 'Rejected' });
        return;
      }

      if (engineersPending) {
        // Still waiting for engineers
        await conn.commit();
        res.json({ message: 'Review submitted successfully. Waiting for other engineers.' });
        return;
      }

      if (engineersApproved) {
        // Check if all admins have approved
        const [adminReviews] = await conn.query(
          `SELECT prr.review_status 
           FROM purchase_request_reviews prr
           JOIN employees e ON prr.reviewer_id = e.id
           WHERE prr.purchase_request_id = ? AND e.role = 'admin' AND e.is_active = 1`,
          [req.params.id]
        );

        console.log('🔍 Admin reviews:', adminReviews);

        const adminsApproved = adminReviews.length > 0 && adminReviews.every(r => r.review_status === 'approved');
        const adminsPending = adminReviews.some(r => r.review_status === 'pending');
        const adminsRejected = adminReviews.some(r => r.review_status === 'rejected');

        console.log('🔍 Admins approved:', adminsApproved, 'pending:', adminsPending, 'rejected:', adminsRejected);

        if (adminsRejected) {
          // Admins rejected, PR is rejected
          await conn.query(
            'UPDATE purchase_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
            ['Rejected', 'Rejected by admin reviewer', req.params.id]
          );
          await conn.commit();
          res.json({ message: 'PR rejected by admin reviewer', status: 'Rejected' });
          return;
        }

        if (adminsPending) {
          // Engineers done, move to Admin Review
          newStatus = 'For Admin Review';
          notificationRecipients = await getAdmins();
          notificationTitle = 'PR Ready for Admin Review';
          notificationMessage = `Purchase Request ${pr.pr_number} has been reviewed by engineers and is ready for admin review`;
        } else if (adminsApproved || adminReviews.length === 0) {
          // Admins done or no admins, check super admin rep
          const [repReviews] = await conn.query(
            `SELECT prr.review_status 
             FROM purchase_request_reviews prr
             JOIN employees e ON prr.reviewer_id = e.id
             WHERE prr.purchase_request_id = ? AND e.role = 'super_admin_rep' AND e.is_active = 1`,
            [req.params.id]
          );

          console.log('🔍 Super Admin Rep reviews:', repReviews);

          const repApproved = repReviews.length > 0 && repReviews.every(r => r.review_status === 'approved');
          const repPending = repReviews.some(r => r.review_status === 'pending');
          const repRejected = repReviews.some(r => r.review_status === 'rejected');

          console.log('🔍 Super Admin Rep approved:', repApproved, 'pending:', repPending, 'rejected:', repRejected);

          if (repRejected) {
            // Rep rejected, PR is rejected
            await conn.query(
              'UPDATE purchase_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
              ['Rejected', 'Rejected by Super Admin Representative', req.params.id]
            );
            await conn.commit();
            res.json({ message: 'PR rejected by Super Admin Representative', status: 'Rejected' });
            return;
          }

          const totalAmount = parseFloat(pr.total_amount) || 0;

          if (totalAmount >= 10000) {
            // Bypass Super Admin Rep and go directly to Super Admin Final Approval
            newStatus = 'For Super Admin Final Approval';
            notificationRecipients = await getSuperAdmins();
            notificationTitle = 'PR Ready for Final Approval';
            notificationMessage = `Purchase Request ${pr.pr_number} has been reviewed by admins and is ready for your final approval`;
            
            // Delete any pending super_admin_rep reviews since they are bypassed
            await conn.query(
              "DELETE FROM purchase_request_reviews WHERE purchase_request_id = ? AND reviewer_id IN (SELECT id FROM employees WHERE role = 'super_admin_rep') AND review_status = 'pending'",
              [req.params.id]
            );
          } else if (repPending) {
            // Admins done, move to Super Admin Rep Review
            newStatus = 'For Super Admin Rep Review';
            notificationRecipients = await getSuperAdminReps();
            notificationTitle = 'PR Ready for Super Admin Representative Review';
            notificationMessage = `Purchase Request ${pr.pr_number} has been reviewed by admins and is ready for Super Admin Representative review`;
          } else if (repApproved || repReviews.length === 0) {
            // All done or no rep, and amount < 10000
            newStatus = 'For Purchase';
            notificationRecipients = await getSuperAdmins(); // Notify super admins anyway
            notificationTitle = 'PR Approved (< 10,000)';
            notificationMessage = `Purchase Request ${pr.pr_number} has been approved by Super Admin Representative and is ready for PO creation`;
          }
        }
      }
    } else if (pr.requester_role === 'admin') {
      // Admin requester: Admins → Super Admin
      const [adminReviews] = await conn.query(
        `SELECT prr.review_status 
         FROM purchase_request_reviews prr
         JOIN employees e ON prr.reviewer_id = e.id
         WHERE prr.purchase_request_id = ? AND e.role = 'admin' AND e.is_active = 1`,
        [req.params.id]
      );

      console.log('🔍 Admin reviews (admin requester):', adminReviews);

      const adminsApproved = adminReviews.length > 0 && adminReviews.every(r => r.review_status === 'approved');
      const adminsPending = adminReviews.some(r => r.review_status === 'pending');
      const adminsRejected = adminReviews.some(r => r.review_status === 'rejected');

      if (adminsRejected) {
        await conn.query(
          'UPDATE purchase_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
          ['Rejected', 'Rejected by admin reviewer', req.params.id]
        );
        await conn.commit();
        res.json({ message: 'PR rejected by admin reviewer', status: 'Rejected' });
        return;
      }

      if (adminsPending) {
        await conn.commit();
        res.json({ message: 'Review submitted successfully. Waiting for other admins.' });
        return;
      }

      if (adminsApproved || adminReviews.length === 0) {
        const [repReviews] = await conn.query(
          `SELECT prr.review_status 
           FROM purchase_request_reviews prr
           JOIN employees e ON prr.reviewer_id = e.id
           WHERE prr.purchase_request_id = ? AND e.role = 'super_admin_rep' AND e.is_active = 1`,
          [req.params.id]
        );
        
        const repApproved = repReviews.length > 0 && repReviews.every(r => r.review_status === 'approved');
        const repPending = repReviews.some(r => r.review_status === 'pending');
        const repRejected = repReviews.some(r => r.review_status === 'rejected');

        if (repRejected) {
          await conn.query(
            'UPDATE purchase_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
            ['Rejected', 'Rejected by Super Admin Representative', req.params.id]
          );
          await conn.commit();
          res.json({ message: 'PR rejected by Super Admin Representative', status: 'Rejected' });
          return;
        }

        const totalAmount = parseFloat(pr.total_amount) || 0;

        if (totalAmount >= 10000) {
          // Bypass Super Admin Rep and go directly to Super Admin Final Approval
          newStatus = 'For Super Admin Final Approval';
          notificationRecipients = await getSuperAdmins();
          notificationTitle = 'PR Ready for Final Approval';
          notificationMessage = `Purchase Request ${pr.pr_number} has been reviewed by admins and is ready for your final approval`;
          
          // Delete any pending super_admin_rep reviews since they are bypassed
          await conn.query(
            "DELETE FROM purchase_request_reviews WHERE purchase_request_id = ? AND reviewer_id IN (SELECT id FROM employees WHERE role = 'super_admin_rep') AND review_status = 'pending'",
            [req.params.id]
          );
        } else if (repPending) {
          newStatus = 'For Super Admin Rep Review';
          notificationRecipients = await getSuperAdminReps();
          notificationTitle = 'PR Ready for Super Admin Representative Review';
          notificationMessage = `Purchase Request ${pr.pr_number} has been reviewed by admins and is ready for Super Admin Representative review`;
        } else if (repApproved || repReviews.length === 0) {
          newStatus = 'For Purchase';
          notificationRecipients = await getSuperAdmins();
          notificationTitle = 'PR Approved (< 10,000)';
          notificationMessage = `Purchase Request ${pr.pr_number} has been approved by Super Admin Representative and is ready for PO creation`;
        }
      }
    } else if (pr.requester_role === 'super_admin_rep') {
      // Super Admin Rep requester: Super Admin Rep → Super Admin
      const [repReviews] = await conn.query(
        `SELECT prr.review_status 
         FROM purchase_request_reviews prr
         JOIN employees e ON prr.reviewer_id = e.id
         WHERE prr.purchase_request_id = ? AND e.role = 'super_admin_rep' AND e.is_active = 1`,
        [req.params.id]
      );

      console.log('🔍 Super Admin Rep reviews (rep requester):', repReviews);

      const repApproved = repReviews.length > 0 && repReviews.every(r => r.review_status === 'approved');
      const repPending = repReviews.some(r => r.review_status === 'pending');
      const repRejected = repReviews.some(r => r.review_status === 'rejected');

      if (repRejected) {
        await conn.query(
          'UPDATE purchase_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
          ['Rejected', 'Rejected by Super Admin Representative', req.params.id]
        );
        await conn.commit();
        res.json({ message: 'PR rejected by Super Admin Representative', status: 'Rejected' });
        return;
      }

      if (repPending) {
        await conn.commit();
        res.json({ message: 'Review submitted successfully. Waiting for other Super Admin Representatives.' });
        return;
      }

      if (repApproved || repReviews.length === 0) {
        const totalAmount = parseFloat(pr.total_amount) || 0;
        if (totalAmount < 10000) {
          newStatus = 'For Purchase';
          notificationRecipients = await getSuperAdmins();
          notificationTitle = 'PR Approved (< 10,000)';
          notificationMessage = `Purchase Request ${pr.pr_number} has been approved by Super Admin Representative and is ready for PO creation`;
        } else {
          newStatus = 'For Super Admin Final Approval';
          notificationRecipients = await getSuperAdmins();
          notificationTitle = 'PR Ready for Final Approval';
          notificationMessage = `Purchase Request ${pr.pr_number} has been reviewed by all required reviewers and is ready for your final approval`;
        }
      }
    } else {
      // Super Admin requester: No review needed
      await conn.commit();
      res.json({ message: 'Review submitted successfully.' });
      return;
    }

    console.log('🔍 New status:', newStatus);

    if (newStatus) {
      await conn.query(
        `UPDATE purchase_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
        [newStatus, req.params.id]
      );

      await conn.commit();

      // Notify next reviewers
      for (const recipientId of notificationRecipients) {
        await createNotification(
          recipientId,
          notificationTitle,
          notificationMessage,
          'PR Review',
          pr.id,
          'purchase_request'
        );
      }

      res.json({ message: `Review submitted successfully. PR moved to ${newStatus}.`, status: newStatus });
    } else {
      await conn.commit();
      res.json({ message: 'Review submitted successfully. Waiting for other reviewers.' });
    }

  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Review PR error:', error);
    res.status(500).json({ message: 'Failed to review PR: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Approve/Reject PR by Super Admin (First Approval - to Super Admin Rep)
router.put('/:id/super-admin-first-approve', authenticate, requireSuperAdmin, async (req, res) => {
  let conn;
  try {
    const { status, remarks, item_remarks } = req.body;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [prs] = await conn.query('SELECT status, order_number FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (prs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Purchase request not found' });
    }
    await assertOrderNumberUnlocked(prs[0].order_number, 'approval');

    const currentStatus = prs[0].status;

    // Check if status is For Engineer Review - Super Admin cannot approve yet
    if (currentStatus === 'For Engineer Review') {
      await conn.rollback();
      return res.status(400).json({ message: 'This purchase request is currently awaiting Engineer review. Super Admin approval is not available at this stage.' });
    }

    if (currentStatus !== 'For Super Admin Final Approval' && currentStatus !== 'On Hold') {
      await conn.rollback();
      return res.status(400).json({ message: 'Invalid status for this approval step' });
    }

    // Check if all required reviewers have approved
    const [reviews] = await conn.query(
      `SELECT prr.review_status
       FROM purchase_request_reviews prr
       JOIN employees e ON prr.reviewer_id = e.id
       WHERE prr.purchase_request_id = ?
         AND e.is_active = 1`,
      [req.params.id]
    );

    if (reviews.length > 0) {
      const allApproved = reviews.every(r => r.review_status === 'approved');
      const anyRejected = reviews.some(r => r.review_status === 'rejected');

      if (!allApproved || anyRejected) {
        await conn.rollback();
        return res.status(400).json({
          message: 'Cannot approve: Not all required reviewers have approved this PR yet',
          reviews_status: reviews.map(r => r.review_status)
        });
      }
    }

    let newStatus;
    if (status === 'approved') {
      newStatus = 'For Purchase';
    } else if (status === 'hold') {
      newStatus = 'On Hold';
    } else if (status === 'rejected') {
      newStatus = 'For Super Admin Rep Review';
    } else {
      newStatus = 'Rejected';
    }

    await conn.query(
      'UPDATE purchase_requests SET status = ?, approved_by = ?, approved_at = NOW(), remarks = ? WHERE id = ?',
      [newStatus, req.user.id, remarks, req.params.id]
    );

    // Save per-item rejection remarks if rejecting
    if (status === 'rejected' && item_remarks && item_remarks.length > 0) {
      for (const itemRemark of item_remarks) {
        // Get the actual item_id from purchase_request_items table
        const [priResult] = await conn.query(
          'SELECT item_id FROM purchase_request_items WHERE id = ? AND purchase_request_id = ?',
          [itemRemark.item_id, req.params.id]
        );

        if (priResult.length > 0) {
          const actualItemId = priResult[0].item_id;
          await conn.query(
            'INSERT INTO pr_item_rejection_remarks (purchase_request_id, purchase_request_item_id, item_id, remark, created_by) VALUES (?, ?, ?, ?, ?)',
            [req.params.id, itemRemark.item_id, actualItemId, itemRemark.remark, req.user.id]
          );
        }
      }
    }

    await conn.commit();

    // Get PR details for notification
    const [prDetails] = await db.query('SELECT pr_number, requested_by FROM purchase_requests WHERE id = ?', [req.params.id]);
    const pr = prDetails[0];

    if (status === 'approved') {
      // Final approval - notify engineer
      await createNotification(
        pr.requested_by,
        'PR Fully Approved',
        `Your Purchase Request ${pr.pr_number} has been fully approved and is ready for purchase`,
        'PR Approved',
        req.params.id,
        'purchase_request'
      );

      // Also notify admins who can create POs
      const { getAdmins } = await import('../utils/notifications.js');
      const admins = await getAdmins();
      for (const adminId of admins) {
        await createNotification(
          adminId,
          'PR Ready for PO Creation',
          `Purchase Request ${pr.pr_number} has been approved and is ready for PO creation`,
          'PR Approved',
          req.params.id,
          'purchase_request'
        );
      }
    } else if (status === 'hold') {
      // On Hold - notify engineer
      await createNotification(
        pr.requested_by,
        'PR On Hold',
        `Your Purchase Request ${pr.pr_number} has been placed on hold by Super Admin${remarks ? ': ' + remarks : ''}`,
        'PR On Hold',
        req.params.id,
        'purchase_request'
      );
    } else {
      // Rejected - notify engineer
      await createNotification(
        pr.requested_by,
        'PR Rejected',
        `Your Purchase Request ${pr.pr_number} has been rejected. Please edit and resubmit your request.`,
        'PR Rejected',
        req.params.id,
        'purchase_request'
      );
    }

    // Emit real-time PR status update
    req.io.emit('pr_status_changed', {
      id: req.params.id,
      pr_number: pr.pr_number,
      status: newStatus,
      type: 'status_update',
      updated_by: 'super_admin'
    });

    res.json({ message: `Purchase request ${status} successfully`, status: newStatus });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Super Admin first approval error:', error);
    res.status(500).json({ message: 'Failed to update purchase request' });
  } finally {
    if (conn) conn.release();
  }
});

  // Bypass PR Approvals
  router.put('/:id/bypass', authenticate, async (req, res) => {
    let conn;
    try {
      const userRole = req.user.role;
      if (!['super_admin', 'super_admin_rep'].includes(userRole)) {
        return res.status(403).json({ message: 'Only Super Admin or Super Admin Representative can bypass PR approvals.' });
      }

      conn = await db.getConnection();
      await conn.beginTransaction();

      const [prs] = await conn.query(
        'SELECT pr.*, e.email as requester_email, e.first_name, e.last_name FROM purchase_requests pr JOIN employees e ON pr.requested_by = e.id WHERE pr.id = ?',
        [req.params.id]
      );
      if (prs.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Purchase request not found' });
      }

      const pr = prs[0];
      const totalAmount = parseFloat(pr.total_amount) || 0;

      // Super admin rep can only bypass if amount < 10000
      if (userRole === 'super_admin_rep' && totalAmount >= 10000) {
        await conn.rollback();
        return res.status(403).json({ message: 'Super Admin Representative can only bypass PRs with a total amount less than 10,000.' });
      }

      if (pr.status === 'For Purchase' || pr.status === 'Rejected') {
        await conn.rollback();
        return res.status(400).json({ message: `Cannot bypass PR. Current status is already ${pr.status}.` });
      }

      const newStatus = 'For Purchase';

      await conn.query(
        'UPDATE purchase_requests SET status = ?, is_bypassed = 1, bypassed_by = ? WHERE id = ?',
        [newStatus, req.user.id, req.params.id]
      );

      // Notify requester
      await createNotification(
        pr.requested_by,
        'PR Bypassed and Approved',
        `Your Purchase Request ${pr.pr_number} has been bypassed and approved by ${req.user.first_name} ${req.user.last_name} (${userRole === 'super_admin' ? 'Super Admin' : 'Super Admin Rep'}). It is now ready for PO creation.`,
        `/dashboard/purchase-requests/${pr.id}`
      );

      // Notify pending reviewers (Engineers, Admins, Super Admin Reps depending on current status)
      let pendingReviewers = [];
      if (pr.status === 'Pending' || pr.status === 'For Engineer Review') {
        pendingReviewers = await getEngineers();
      } else if (pr.status === 'For Admin Review') {
        pendingReviewers = await getAdmins();
      } else if (pr.status === 'For Super Admin Rep Review') {
        pendingReviewers = await getSuperAdminReps();
      } else if (pr.status === 'For Super Admin Final Approval') {
        pendingReviewers = await getSuperAdmins();
      }
      
      // Remove the user bypassing from the pending reviewers if they are in the list
      pendingReviewers = pendingReviewers.filter(id => id !== req.user.id);

      for (const reviewerId of pendingReviewers) {
        await createNotification(
          reviewerId,
          'PR Bypassed',
          `Purchase Request ${pr.pr_number} has been bypassed and approved by ${req.user.first_name} ${req.user.last_name}. Your review is no longer needed.`,
          `/dashboard/purchase-requests/${pr.id}`
        );
      }

      await conn.commit();
      res.json({ message: 'Purchase request bypassed successfully', status: newStatus });
    } catch (error) {
      if (conn) await conn.rollback();
      console.error('Error bypassing purchase request:', error);
      res.status(500).json({ message: 'Error bypassing purchase request' });
    } finally {
      if (conn) conn.release();
    }
  });

  // Process Item Request (Admin finalizes supplier and prices)
  router.put('/:id/process', authenticate, async (req, res) => {
    let conn;
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'super_admin_rep') {
        return res.status(403).json({ message: 'Only an Admin can process item requests.' });
      }

      const { supplier_id, supplier_name, payment_basis, payment_terms_note, items, payment_schedules } = req.body;

      let parsedItems = items;
      if (typeof items === 'string') {
        try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = []; }
      }

      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        return res.status(400).json({ message: 'At least one item is required' });
      }

      const invalidItems = parsedItems.filter(item => {
        const up = Number(item.unit_price ?? item.estimated_unit_price ?? 0);
        return !Number.isFinite(up) || up <= 0;
      });
      if (invalidItems.length > 0) {
        console.error('Process PR 400: All items must have a unit price strictly greater than 0', { invalidItems });
        return res.status(400).json({ message: 'All items must have a unit price strictly greater than 0' });
      }

      conn = await db.getConnection();
      await conn.beginTransaction();

      const [prs] = await conn.query('SELECT * FROM purchase_requests WHERE id = ?', [req.params.id]);
      if (prs.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Purchase request not found' });
      }

      const pr = prs[0];
      if (pr.status !== 'For Admin Processing') {
        console.error('Process PR 400: This PR is not in For Admin Processing status.', { status: pr.status });
        await conn.rollback();
        return res.status(400).json({ message: 'This PR is not in For Admin Processing status.' });
      }

      const pBasis = payment_basis === 'non_debt' ? 'non_debt' : 'debt';
      const pNote = normalizePaymentTermsNote(payment_terms_note);
      
      let supAddress = null;
      let matchedSupplierId = supplier_id || null;
      let freeTextSupplierName = normalizeSupplierName(supplier_name);
      
      if (matchedSupplierId === 'other') {
        if (!freeTextSupplierName) {
          console.error('Process PR 400: Supplier name is required for new supplier.');
          await conn.rollback();
          return res.status(400).json({ message: 'Supplier name is required for new supplier.' });
        }
        const [result] = await conn.query(
          'INSERT INTO suppliers (supplier_code, supplier_name) VALUES (?, ?)',
          [`SUP-${Date.now()}`, freeTextSupplierName]
        );
        matchedSupplierId = result.insertId;
      } else if (matchedSupplierId) {
        const [supRows] = await conn.query('SELECT id, supplier_name, address FROM suppliers WHERE id = ? LIMIT 1', [matchedSupplierId]);
        if (supRows.length > 0) {
          freeTextSupplierName = supRows[0].supplier_name;
          supAddress = supRows[0].address;
        } else {
          matchedSupplierId = null;
        }
      }

      if (!freeTextSupplierName) {
        console.error('Process PR 400: A valid supplier is required to process the item request.', { matchedSupplierId });
        await conn.rollback();
        return res.status(400).json({ message: 'A valid supplier is required to process the item request.' });
      }

      let totalAmount = 0;
      const normalizedItems = parsedItems.map(item => {
        const itemId = item.item_id ?? item.id;
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        const totalPrice = quantity * unitPrice;
        totalAmount += totalPrice;
        return { itemId, quantity, unitPrice, totalPrice };
      });

      const newStatus = 'For Engineer Review';

      // Auto-approve admin reviews since an admin has processed and finalized the request
      await conn.query(
        "UPDATE purchase_request_reviews SET review_status = 'approved', review_comment = 'Auto-approved during processing', reviewed_at = NOW() WHERE purchase_request_id = ? AND reviewer_id IN (SELECT id FROM employees WHERE role = 'admin')",
        [req.params.id]
      );

      await conn.query(
        `UPDATE purchase_requests SET 
          supplier_id = ?, 
          supplier_name = ?, 
          supplier_address = ?, 
          payment_basis = ?, 
          payment_terms_note = ?, 
          payment_terms_code = ?, 
          total_amount = ?, 
          status = ?
        WHERE id = ?`,
        [matchedSupplierId, freeTextSupplierName, supAddress, pBasis, pNote, pNote ? 'CUSTOM' : null, totalAmount, newStatus, req.params.id]
      );

      // Update prices in PR items
      for (const item of normalizedItems) {
        await conn.query(
          `UPDATE purchase_request_items SET unit_price = ?, total_price = ? WHERE purchase_request_id = ? AND item_id = ?`,
          [item.unitPrice, item.totalPrice, req.params.id, item.itemId]
        );
      }

      // Handle payment schedules
      await conn.query('DELETE FROM purchase_request_payment_schedules WHERE purchase_request_id = ?', [req.params.id]);
      if (pBasis === 'debt') {
        let parsedSchedules = payment_schedules;
        if (typeof payment_schedules === 'string') {
          try { parsedSchedules = JSON.parse(payment_schedules); } catch (e) { parsedSchedules = []; }
        }
        const schedules = normalizePaymentSchedules(parsedSchedules);
        
        let sumSchedules = 0;
        const scheduleValues = [];
        let hasInvalidSchedule = false;
        
        schedules.forEach(sched => {
          if (!sched.payment_date || !sched.amount) {
            hasInvalidSchedule = true;
          }
          sumSchedules += sched.amount;
          scheduleValues.push([req.params.id, sched.payment_date, sched.amount, sched.note]);
        });
        
        if (hasInvalidSchedule) {
          await conn.rollback();
          return res.status(400).json({ message: 'All payment schedules must have a valid date and amount.' });
        }
        
        if (Math.abs(sumSchedules - totalAmount) > 0.01) {
          await conn.rollback();
          return res.status(400).json({ message: 'Payment schedules total must equal the request total amount.' });
        }

        if (scheduleValues.length > 0) {
          await conn.query(
            'INSERT INTO purchase_request_payment_schedules (purchase_request_id, payment_date, amount, note) VALUES ?',
            [scheduleValues]
          );
        }
      }

      // Notify Engineers that the item request has been processed and is ready for their review
      const engineers = await getEngineers();
      for (const engId of engineers) {
        if (engId !== pr.requested_by) {
          await createNotification(
            engId,
            'Item Request Processed',
            `Purchase Request ${pr.pr_number} has been processed by ${req.user.first_name} and is ready for your review.`,
            `/dashboard/purchase-requests/${req.params.id}`
          );
        }
      }

      await conn.commit();
      res.json({ message: 'Item request processed successfully', status: newStatus });
    } catch (error) {
      if (conn) await conn.rollback();
      console.error('Error processing item request:', error);
      res.status(500).json({ message: 'Error processing item request' });
    } finally {
      if (conn) conn.release();
    }
  });

// Approve/Reject PR by Super Admin Rep (to Super Admin Final Approval)
router.put('/:id/super_admin_rep-approve', authenticate, async (req, res) => {
  let conn;
  try {
    const {
      status,
      rejection_reason,
      items,
      supplier_id,
      supplier_address,
      item_remarks
    } = req.body;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [prs] = await conn.query(
      'SELECT status, payment_basis, payment_terms_note, order_number FROM purchase_requests WHERE id = ?',
      [req.params.id]
    );
    if (prs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const currentStatus = prs[0].status;
    await assertOrderNumberUnlocked(prs[0].order_number, 'approval');

    if (currentStatus !== 'For Super Admin Rep Review') {
      await conn.rollback();
      return res.status(400).json({ message: 'Purchase request not ready for Super Admin Rep approval' });
    }

    let newStatus;
    let totalAmount = null;

    if (status === 'approved') {
      newStatus = 'For Super Admin Final Approval';
      if (prs[0].payment_basis === 'debt') {
        const scheduleCount = await getPaymentScheduleCount(conn, req.params.id);
        if (scheduleCount === 0) {
          await conn.rollback();
          return res.status(400).json({ message: 'At least one payment schedule is required before approval.' });
        }
      }

      // Validate supplier_id is provided
      if (!supplier_id) {
        await conn.rollback();
        return res.status(400).json({ message: 'Supplier is required for approval' });
      }

      // Fetch original items for comparison
      const [originalItems] = await conn.query(
        'SELECT id, quantity, unit, unit_price, item_id FROM purchase_request_items WHERE purchase_request_id = ?',
        [req.params.id]
      );

      // Track changes made by super_admin_rep
      const changes = [];

      // Update unit prices for items and calculate totals
      if (items && items.length > 0) {
        let calculatedTotal = 0;

        for (const item of items) {
          const unitPrice = parseFloat(item.unit_price) || 0;
          const totalPrice = unitPrice * item.quantity;
          calculatedTotal += totalPrice;

          // Find original item to compare
          const originalItem = originalItems.find(oi => oi.id === item.id);
          if (originalItem) {
            const changeDetails = [];
            if (originalItem.unit_price !== unitPrice && unitPrice > 0) {
              changeDetails.push(`unit price from ₱${originalItem.unit_price} to ₱${unitPrice}`);
            }
            if (originalItem.unit !== item.unit && item.unit) {
              changeDetails.push(`unit from "${originalItem.unit}" to "${item.unit}"`);
            }
            if (originalItem.quantity !== item.quantity) {
              changeDetails.push(`quantity from ${originalItem.quantity} to ${item.quantity}`);
            }
            if (changeDetails.length > 0) {
              changes.push({
                item_id: item.id,
                item_name: item.item_name || item.item_code,
                changes: changeDetails
              });
            }
          }

          // Update unit_price, total_price, and unit if provided
          await conn.query(
            'UPDATE purchase_request_items SET unit_price = ?, total_price = ?, unit = ? WHERE id = ?',
            [unitPrice, totalPrice, item.unit || null, item.id]
          );
        }

        totalAmount = calculatedTotal;
      }

      // Update PR status, total_amount, supplier_id and supplier_address
      await conn.query(
        'UPDATE purchase_requests SET status = ?, total_amount = ?, supplier_id = ?, supplier_name = NULL, supplier_address = ? WHERE id = ?',
        [
          newStatus,
          totalAmount,
          supplier_id,
          supplier_address || null,
          req.params.id
        ]
      );

      // Store changes info for notification
      req.changes = changes;
    } else {
      newStatus = 'Rejected';
      await conn.query(
        'UPDATE purchase_requests SET status = ?, rejection_reason = ? WHERE id = ?',
        [newStatus, rejection_reason || null, req.params.id]
      );

      // Save per-item rejection remarks
      if (item_remarks && item_remarks.length > 0) {
        for (const itemRemark of item_remarks) {
          // Get the actual item_id from purchase_request_items table
          const [priResult] = await conn.query(
            'SELECT item_id FROM purchase_request_items WHERE id = ? AND purchase_request_id = ?',
            [itemRemark.item_id, req.params.id]
          );

          if (priResult.length > 0) {
            const actualItemId = priResult[0].item_id;
            await conn.query(
              'INSERT INTO pr_item_rejection_remarks (purchase_request_id, purchase_request_item_id, item_id, remark, created_by) VALUES (?, ?, ?, ?, ?)',
              [req.params.id, itemRemark.item_id, actualItemId, itemRemark.remark, req.user.id]
            );
          }
        }
      }
    }

    await conn.commit();

    // Get PR details for notification
    const [prDetails] = await db.query('SELECT pr_number, requested_by FROM purchase_requests WHERE id = ?', [req.params.id]);
    const pr = prDetails[0];

    if (status === 'approved') {
      // Super Admin Rep approved - notify Super Admin for final approval
      const superAdmins = await getSuperAdmins();
      for (const adminId of superAdmins) {
        await createNotification(
          adminId,
          'PR Pending Final Approval',
          `Purchase Request ${pr.pr_number} has been reviewed by Super Admin Rep and requires your final approval`,
          'PR Approved',
          req.params.id,
          'purchase_request'
        );
      }

      // Notify engineer about any changes made by super_admin_rep
      if (req.changes && req.changes.length > 0) {
        const changesSummary = req.changes.map(c => `${c.item_name}: ${c.changes.join(', ')}`).join('; ');
        await createNotification(
          pr.requested_by,
          'PR Values Modified by Super Admin Rep',
          `Super Admin Rep modified values in your PR ${pr.pr_number}: ${changesSummary}`,
          'PR Modified',
          req.params.id,
          'purchase_request'
        );
      }
    } else {
      // Rejected - notify engineer and Super Admin
      await createNotification(
        pr.requested_by,
        'PR Rejected by Super Admin Rep',
        `Your Purchase Request ${pr.pr_number} has been rejected by Super Admin Rep. Please edit and resubmit your request.`,
        'PR Rejected',
        req.params.id,
        'purchase_request'
      );
    }

    // Emit real-time PR status update
    req.io.emit('pr_status_changed', {
      id: req.params.id,
      pr_number: pr.pr_number,
      status: newStatus,
      type: 'status_update',
      updated_by: 'super_admin_rep'
    });

    res.json({ message: `Purchase request ${status} successfully`, status: newStatus, total_amount: totalAmount });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Super Admin Rep approval error:', error);
    res.status(500).json({ message: 'Failed to update purchase request' });
  } finally {
    if (conn) conn.release();
  }
});

// Export PR to Excel
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    // Get PR details with items and supplier info
    const [prs] = await db.query(`
      SELECT pr.*, 
             e.first_name as requester_first_name, 
             e.last_name as requester_last_name,
             e.role as requester_role,
             approver.first_name as approver_first_name,
             approver.last_name as approver_last_name,
             bypasser.first_name as bypassed_by_first_name,
             bypasser.last_name as bypassed_by_last_name,
             COALESCE(pr.supplier_name, s.supplier_name) as supplier_name,
             COALESCE(pr.supplier_name, s.supplier_name) as payee_name,
             COALESCE(pr.supplier_address, s.address) as payee_address,
             s.address as supplier_address,
             engineer_selected.supplier_name as engineer_supplier_name
      FROM purchase_requests pr
      JOIN employees e ON pr.requested_by = e.id
      LEFT JOIN employees approver ON pr.approved_by = approver.id
      LEFT JOIN employees bypasser ON pr.bypassed_by = bypasser.id
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
      LEFT JOIN suppliers engineer_selected ON pr.supplier_id = engineer_selected.id
      WHERE pr.id = ?
    `, [req.params.id]);

    if (prs.length === 0) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const pr = prs[0];

    // Get PR items
    const [items] = await db.query(`
      SELECT pri.*, i.item_name, i.item_code, i.unit
      FROM purchase_request_items pri
      JOIN items i ON pri.item_id = i.id
      WHERE pri.purchase_request_id = ?
    `, [req.params.id]);

    // Get payment schedules (date string keeps timezone-safe comparisons)
    const [paymentSchedules] = await db.query(`
      SELECT DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date, amount, note
      FROM purchase_request_payment_schedules
      WHERE purchase_request_id = ?
      ORDER BY payment_date ASC
    `, [req.params.id]);

    // Get paid DV totals tied to this PR (actual released payments).
    const [paidDvRows] = await db.query(`
      SELECT amount
      FROM disbursement_vouchers
      WHERE purchase_request_id = ? AND status = 'Paid'
    `, [req.params.id]);

    // Fetch review records for this PR
    const [reviews] = await db.query(`
      SELECT prr.*, 
             e.first_name as reviewer_first_name, 
             e.last_name as reviewer_last_name,
             e.role as reviewer_role
      FROM purchase_request_reviews prr
      JOIN employees e ON prr.reviewer_id = e.id
      WHERE prr.purchase_request_id = ?
        AND e.is_active = 1
      ORDER BY prr.created_at ASC
    `, [req.params.id]);

    // Load template workbook dynamically based on PR status
    let templateName = 'PURCHASE REQUEST- FINAL-2026.xlsx';
    if (['Draft', 'Pending', 'For Engineer Review', 'Returned'].includes(pr.status)) {
      templateName = 'PURCHASE REQUEST- Engineer.xlsx';
    } else if (['For Admin Review'].includes(pr.status)) {
      templateName = 'PURCHASE REQUEST- Admin.xlsx';
    }

    const templatePath = resolveExcelTemplatePath(templateName);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.getWorksheet(1);

    // Format date helper
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    // Fill PR number (F6)
    worksheet.getCell('F6').value = pr.pr_number || '';

    // Fill supplier name (C8)
    worksheet.getCell('C8').value = pr.supplier_name || '';

    // Fill supplier address (C9)
    const supplierAddressCell = worksheet.getCell('C9');
    supplierAddressCell.value = pr.supplier_address || '';
    supplierAddressCell.font = { name: 'Times New Roman', size: 12, bold: true };

    // Fill project (C10)
    worksheet.getCell('C10').value = pr.project || '';

    // Fill order number (F10)
    worksheet.getCell('F10').value = pr.order_number || '';

    // Fill project address (C11)
    worksheet.getCell('C11').value = pr.project_address || '';

    // Fill date prepared (F8) - created_at
    worksheet.getCell('F8').value = formatDate(pr.created_at);

    // Fill date needed (F9)
    worksheet.getCell('F9').value = formatDate(pr.date_needed);

    // Fill items starting from row 14
    let rowNum = 14;
    items.forEach((item, index) => {
      const row = worksheet.getRow(rowNum);
      row.getCell(1).value = item.quantity; // A - QTY
      row.getCell(2).value = item.unit; // B - UNIT
      row.getCell(3).value = item.item_name || item.item_code; // C/D - DESCRIPTION (merged)
      row.getCell(5).value = parseFloat(item.unit_price) || 0; // E - UNIT COST
      row.getCell(6).value = parseFloat(item.total_price) || 0; // F - AMOUNT
      rowNum++;
    });

    // Add "*** NOTHING FOLLOWS ***" after items
    const nothingFollowsRow = worksheet.getRow(rowNum);
    nothingFollowsRow.getCell(3).value = '*** NOTHING FOLLOWS ***';

    // Add payment terms summary below "*** NOTHING FOLLOWS ***" without touching fixed template totals/signatures.
    const exportNoteLines = [];
    const paymentTermsNote = String(pr.payment_terms_note || '').trim();
    if (paymentTermsNote) {
      exportNoteLines.push(`Payment Terms: ${paymentTermsNote}`);
    }

    if (paymentSchedules.length > 0) {
      const today = new Date();
      const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const formatMoney = (value) => Number(value || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      const getDueLabel = (dateYmd, suffix = '') => {
        const base = dateYmd < todayYmd
          ? 'OVERDUE'
          : dateYmd === todayYmd
            ? 'DUE TODAY'
            : 'UPCOMING';
        return suffix ? `${base} ${suffix}` : base;
      };

      const firstUpcomingOrToday = paymentSchedules.find((schedule) => schedule.payment_date >= todayYmd);
      const targetSchedule = firstUpcomingOrToday || paymentSchedules[paymentSchedules.length - 1];

      if (targetSchedule?.payment_date) {
        const dueLabel = getDueLabel(targetSchedule.payment_date);

        const amountNumber = Number(targetSchedule.amount);
        const amountSuffix = Number.isFinite(amountNumber)
          ? ` | Amount: ${formatMoney(amountNumber)}`
          : '';

        exportNoteLines.push(`Next Payment: ${targetSchedule.payment_date}${amountSuffix}`);
        exportNoteLines.push(`Status: ${dueLabel}`);
      }

      // Compute first unpaid schedule using FIFO allocation of paid DV amount.
      let remainingPaid = paidDvRows.reduce((sum, row) => {
        const amount = Number(row?.amount);
        return Number.isFinite(amount) ? sum + amount : sum;
      }, 0);

      let firstPaidSchedule = null;
      let firstUnpaidSchedule = null;
      for (const schedule of paymentSchedules) {
        const amount = Number(schedule?.amount);
        const scheduleAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
        if (remainingPaid >= scheduleAmount) {
          if (!firstPaidSchedule) {
            firstPaidSchedule = {
              payment_date: schedule.payment_date,
              amount: scheduleAmount
            };
          }
          remainingPaid -= scheduleAmount;
          continue;
        }
        firstUnpaidSchedule = {
          payment_date: schedule.payment_date,
          amount: scheduleAmount
        };
        break;
      }

      if (firstPaidSchedule) {
        exportNoteLines.push(
          `First Paid Schedule: ${firstPaidSchedule.payment_date} | Amount: ${formatMoney(firstPaidSchedule.amount)} | PAID`
        );
      } else if (firstUnpaidSchedule) {
        exportNoteLines.push(
          `First Unpaid Schedule: ${firstUnpaidSchedule.payment_date} | Amount: ${formatMoney(firstUnpaidSchedule.amount)} | ${getDueLabel(firstUnpaidSchedule.payment_date, '(unpaid)')}`
        );
      } else {
        exportNoteLines.push('First Unpaid Schedule: None (all scheduled payments fulfilled)');
      }
    }

    const maxSummaryRow = 30; // Row 31 contains total; avoid overwriting template footer region.
    let noteRowNumber = rowNum + 1;
    for (const line of exportNoteLines) {
      if (noteRowNumber > maxSummaryRow) break;
      const mergeRange = `A${noteRowNumber}:F${noteRowNumber}`;
      try {
        worksheet.unMergeCells(mergeRange);
      } catch {
        // Ignore if row is not currently merged as A:F.
      }
      try {
        worksheet.mergeCells(mergeRange);
      } catch (mergeError) {
        console.warn(`Failed to merge note row ${noteRowNumber} (${mergeRange}):`, mergeError?.message || mergeError);
      }
      const cell = worksheet.getRow(noteRowNumber).getCell(1);
      cell.value = line;
      cell.font = { color: { argb: 'FF0000' } };
      noteRowNumber++;
    }

    // Fill total (F31)
    worksheet.getCell('F31').value = pr.total_amount || 0;

    // Fill requester name (A33) - "Prepared by" (A33:C34 is merged)
    const requesterName = `${pr.requester_first_name || ''} ${pr.requester_last_name || ''}`.trim();
    const requesterNameCell = worksheet.getCell('A33');
    requesterNameCell.style = {};
    requesterNameCell.value = requesterName || '';
    requesterNameCell.font = { name: 'Times New Roman', size: 12, bold: true, italic: false };
    requesterNameCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Calculate reviewer and approver names
    const getReviewerName = (review) => {
      const name = `${review.reviewer_first_name || ''} ${review.reviewer_last_name || ''}`.trim();
      return name || review.reviewer_name || 'Reviewer';
    };

    const getReviewerRoleLabel = (role) => {
      const labels = {
        engineer: 'Engineer',
        admin: 'Admin',
        super_admin: 'Super Admin'
      };
      return labels[role] || 'Reviewer';
    };

    const approvedReviewers = reviews.filter(review => review.review_status === 'approved');
    const rejectedReviewers = reviews.filter(review => review.review_status === 'rejected');
    const reviewedByText = approvedReviewers.length > 0
      ? getReviewerName(approvedReviewers[0])
      : rejectedReviewers.length > 0
        ? `${getReviewerName(rejectedReviewers[0])} (declined)`
        : (pr.reviewed_by_name || 'Pending review');

    // Populate Primary Reviewed By (D33:D34 is merged)
    const reviewedByCell = worksheet.getCell('D33');
    reviewedByCell.style = {};
    reviewedByCell.value = reviewedByText;
    reviewedByCell.font = { name: 'Times New Roman', size: 12, bold: true, italic: false };
    reviewedByCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const reviewedByRoleCell = worksheet.getCell('D35');
    reviewedByRoleCell.style = {}; // WIPE default template style to force italic!
    reviewedByRoleCell.value = 'Name and Signature';
    reviewedByRoleCell.font = { name: 'Times New Roman', size: 10, italic: true };
    reviewedByRoleCell.alignment = { horizontal: 'center', vertical: 'top' };

    // Populate Received By (Approver) (E33:F34 is merged)
    const approverName = pr.approver_first_name || pr.approver_last_name
      ? `${pr.approver_first_name || ''} ${pr.approver_last_name || ''}`.trim()
      : 'MARC JUSTIN E. ARZADON';

    const approverNameCell = worksheet.getCell('E33');
    
    // Only write General Manager if it's the final template, else leave what's there
    if (templateName === 'PURCHASE REQUEST- FINAL-2026.xlsx') {
      approverNameCell.style = {};
      approverNameCell.value = approverName;
      approverNameCell.font = { name: 'Times New Roman', size: 12, bold: true, italic: false };
      approverNameCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const e35 = worksheet.getCell('E35');
      e35.style = {};
      e35.value = 'General Manager';
      e35.font = { name: 'Times New Roman', size: 10, italic: true };
      e35.alignment = { horizontal: 'center', vertical: 'top' };
    }

    // Clear pre-drawn unused signature boxes below row 36 to ensure a clean slate
    for (let r = 37; r <= 50; r++) {
      const row = worksheet.getRow(r);
      for (let c = 1; c <= 8; c++) {
        const cell = row.getCell(c);
        cell.value = null;
        cell.border = {};
        cell.font = undefined; // Completely obliterate any fonts typed manually in the template
        cell.style = {}; // Destroy any other formatting (backgrounds, etc)
        // Note: We don't strictly unmerge here, but clearing borders and values hides them well.
      }
    }

    // Additional Reviewers Logic
    if (approvedReviewers.length > 1) {
      const additionalReviewedRows = [];
      for (let index = 1; index < approvedReviewers.length; index += 3) {
        additionalReviewedRows.push(approvedReviewers.slice(index, index + 3));
      }

      let currentRow = 37; // Start below the primary signature block
      for (const row of additionalReviewedRows) {
        const headerRow = worksheet.getRow(currentRow);
        const nameRow = worksheet.getRow(currentRow + 1);
        const roleRow = worksheet.getRow(currentRow + 2);

        for (let i = 0; i < 3; i++) {
          if (row[i]) {
            const columns = [1, 4, 5]; // Column A (1), Column D (4), Column E (5)
            const endCols = [3, 4, 6]; // Column C (3), Column D (4), Column F (6)
            const startCol = columns[i];
            const endCol = endCols[i];
            const colLetter1 = String.fromCharCode(64 + startCol);
            const colLetter2 = String.fromCharCode(64 + endCol);

            const borderStyle = { style: 'thin' };
            const fullBorder = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

            // 1. Unmerge first so we can style individual cells properly without ExcelJS bugs
            if (startCol !== endCol) {
              try { worksheet.unMergeCells(`${colLetter1}${currentRow}:${colLetter2}${currentRow}`); } catch(e) {}
              try { worksheet.unMergeCells(`${colLetter1}${currentRow + 1}:${colLetter2}${currentRow + 1}`); } catch(e) {}
              try { worksheet.unMergeCells(`${colLetter1}${currentRow + 2}:${colLetter2}${currentRow + 2}`); } catch(e) {}
            }

            // 2. Apply styles to EVERY cell in the block to ensure borders complete and fonts overwrite
            for (let c = startCol; c <= endCol; c++) {
              const hCell = headerRow.getCell(c);
              hCell.style = {}; // Wipes any rogue cursive fonts from the template
              hCell.font = { name: 'Times New Roman', size: 12, italic: false };
              hCell.alignment = { horizontal: 'left', vertical: 'bottom' };
              hCell.border = fullBorder;

              const nCell = nameRow.getCell(c);
              nCell.style = {};
              nCell.font = { name: 'Times New Roman', size: 12, bold: true, italic: false };
              nCell.alignment = { horizontal: 'center', vertical: 'middle' };
              nCell.border = fullBorder;

              const rCell = roleRow.getCell(c);
              rCell.style = {};
              rCell.font = { name: 'Times New Roman', size: 10, italic: true };
              rCell.alignment = { horizontal: 'center', vertical: 'top' };
              rCell.border = fullBorder;
            }

            // 3. Re-merge them perfectly
            if (startCol !== endCol) {
              try {
                worksheet.mergeCells(`${colLetter1}${currentRow}:${colLetter2}${currentRow}`);
                worksheet.mergeCells(`${colLetter1}${currentRow + 1}:${colLetter2}${currentRow + 1}`);
                worksheet.mergeCells(`${colLetter1}${currentRow + 2}:${colLetter2}${currentRow + 2}`);
              } catch (e) {
                // Ignore merge errors
              }
            }

            const headerCell = headerRow.getCell(startCol);
            headerCell.value = 'Reviewed by:';

            const nameCell = nameRow.getCell(startCol);
            nameCell.value = getReviewerName(row[i]);

            const roleCell = roleRow.getCell(startCol);
            roleCell.value = 'Name and Signature';
          }
        }
        currentRow += 4; // leave a blank row between groups
      }
    }

    // Generate filename
    const filename = `PR-${pr.pr_number}-${Date.now()}.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export PR error:', error);
    res.status(500).json({ message: 'Failed to export purchase request: ' + error.message });
  }
});

// Resubmit rejected PR (engineer)
router.put('/:id/resubmit', authenticate, async (req, res) => {
  let conn;
  try {
    const { purpose, remarks, items, date_needed, project, project_address, order_number, payment_basis, payment_terms_note, supplier_id, supplier_name, payment_schedules } = req.body;
    // Check if PR exists and is rejected
    const [prs] = await db.query('SELECT * FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (prs.length === 0) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const pr = prs[0];

    // Check project is active only if changed
    if (pr.project !== project) {
      await assertProjectIsActive(project, { providedOrderNumber: order_number });
    }
    const nextPaymentBasis = payment_basis ?? pr.payment_basis;
    const nextPaymentTermsNote = normalizePaymentTermsNote(payment_terms_note ?? pr.payment_terms_note);
    const nextPaymentTermsCode = nextPaymentTermsNote ? 'CUSTOM' : null;
    const nextSupplierName = hasOwn(req.body, 'supplier_name')
      ? normalizeSupplierName(supplier_name)
      : pr.supplier_name;
    const hasPaymentSchedulesField = hasOwn(req.body, 'payment_schedules');
    const normalizedPaymentSchedules = hasPaymentSchedulesField ? normalizePaymentSchedules(payment_schedules) : null;

    // Only the original requester can resubmit
    if (pr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can resubmit this PR' });
    }

    // Only rejected PRs can be resubmitted
    if (pr.status !== 'Rejected') {
      return res.status(400).json({ message: 'Only rejected purchase requests can be resubmitted' });
    }
    conn = await db.getConnection();
    await conn.beginTransaction();

    const normalizedItems = Array.isArray(items)
      ? items.map((item) => {
        const itemId = item.item_id ?? item.id;
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price ?? item.estimated_unit_price ?? 0);
        const totalPrice = quantity * unitPrice;

        if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Invalid item payload: each item requires item_id (or id) and quantity > 0');
        }

        return {
          itemId,
          quantity,
          unitPrice,
          totalPrice,
          remarks: item.remarks ?? item.notes ?? null
        }
      })
      : [];

    const computedTotalAmount = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const providedTotalAmount = req.body.total_amount !== undefined ? Number(req.body.total_amount) : null;
    const totalAmount = (providedTotalAmount !== null && providedTotalAmount > 0) ? providedTotalAmount : computedTotalAmount;
    const schedulesForValidation = hasPaymentSchedulesField
      ? normalizedPaymentSchedules
      : await getExistingPaymentSchedules(conn, req.params.id);
    assertPaymentScheduleTotalsMatch({
      paymentBasis: nextPaymentBasis,
      schedules: schedulesForValidation,
      totalAmount
    });

    let supplierAddress = null;
    const effectiveSupplierId = supplier_id ?? pr.supplier_id;

    if (effectiveSupplierId) {
      const [supRows] = await conn.query(
        'SELECT address FROM suppliers WHERE id = ? LIMIT 1',
        [effectiveSupplierId]
      );

      if (supRows.length === 0) {
        throw new Error('Invalid supplier_id: supplier not found');
      }

      supplierAddress = supRows[0].address ?? null;
    }

    // Update PR details and reset status to For Super Admin Rep Review, clear all pricing data
    await conn.query(
      `UPDATE purchase_requests 
       SET purpose = ?, remarks = ?, date_needed = ?, project = ?, project_address = ?, order_number = ?, 
           payment_basis = ?, payment_terms_code = ?, payment_terms_note = ?, payment_terms_set_by = ?, payment_terms_set_at = ?, supplier_id = ?,
           supplier_name = ?, status = 'For Super Admin Rep Review', approved_by = NULL, approved_at = NULL, 
           supplier_address = ?, rejection_reason = NULL, 
           total_amount = ?, updated_at = NOW()
       WHERE id = ?`,

      [purpose || pr.purpose,
      remarks ?? pr.remarks,
      date_needed || pr.date_needed,
      project || pr.project,
      project_address || pr.project_address,
      order_number || pr.order_number,
        nextPaymentBasis,
        nextPaymentTermsCode,
        nextPaymentTermsNote,
      nextPaymentTermsNote ? req.user.id : null,
      nextPaymentTermsNote ? new Date() : null,
      supplier_id ?? pr.supplier_id,
        nextSupplierName,
        supplierAddress,
        totalAmount,
      req.params.id
      ]
    );

    // Update items if provided
    if (normalizedItems.length > 0) {
      await conn.query('DELETE FROM purchase_request_items WHERE purchase_request_id = ?', [req.params.id]);

      for (const item of normalizedItems) {
        await conn.query(
          'INSERT INTO purchase_request_items (purchase_request_id, item_id, quantity, unit_price, total_price, remarks) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.id, item.itemId, item.quantity, item.unitPrice, item.totalPrice, item.remarks]
        );
      }
    }

    if (hasPaymentSchedulesField) {
      await replacePaymentSchedules(conn, req.params.id, normalizedPaymentSchedules, req.user.id);
    }

    if (nextPaymentBasis === 'debt') {
      const scheduleCount = await getPaymentScheduleCount(conn, req.params.id);
      if (scheduleCount === 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'At least one payment schedule is required for debt/with account PR.' });
      }
    }

    await conn.commit();

    // Notify Super Admin Reps about resubmitted PR
    const reps = await getSuperAdminReps();
    for (const repId of reps) {
      if (req.io) {
        req.io.to(`user_${repId}`).emit('notification', {
          title: 'PR Resubmitted',
          message: `Purchase Request ${pr.pr_number} has been resubmitted.`
        });
      }
    }

    try {
      const { logAudit } = await import('../utils/auditLogger.js');
      await logAudit(req.user.id, 'Request Resubmitted', 'purchase_requests', pr.id, JSON.stringify({ pr_number: pr.pr_number }));
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    res.json({ message: 'Purchase request resubmitted successfully', status: 'For Super Admin Rep Review' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
    }
    console.error('Resubmit PR error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: statusCode === 500 ? 'Failed to resubmit purchase request: ' + error.message : error.message });
  } finally {
    if (conn) conn.release();
  }
});

// Legacy endpoint - remove requireSuperAdmin restriction for backward compatibility
router.put('/:id/approve', authenticate, async (req, res) => {
  let conn;
  try {
    const { status, remarks } = req.body; // status is 'approved' or 'rejected' or something
    
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [prs] = await conn.query('SELECT order_number, status, total_amount, processed_by FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (prs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Purchase request not found' });
    }
    await assertOrderNumberUnlocked(prs[0].order_number, 'approval');

    const pr = prs[0];
    const currentStatus = pr.status;
    const userRole = req.user.role;

    // Validate role matches current status
    if (currentStatus === 'Under Admin Review' && userRole !== 'admin') {
      await conn.rollback();
      return res.status(403).json({ message: 'This PR is awaiting Admin review.' });
    }
    if (currentStatus === 'For Super Admin Rep Review' && userRole !== 'super_admin_rep') {
      await conn.rollback();
      return res.status(403).json({ message: 'This PR is awaiting Super Admin Rep review.' });
    }
    if (currentStatus === 'For Super Admin Final Approval' && userRole !== 'super_admin') {
      await conn.rollback();
      return res.status(403).json({ message: 'This PR is awaiting Super Admin Final approval.' });
    }

    if (userRole === 'admin' && currentStatus === 'Under Admin Review') {
      if (status === 'Rejected' || status === 'rejected') {
         // Return to processing admin
         await conn.query('UPDATE purchase_requests SET status = ?, remarks = ? WHERE id = ?', ['Pending Admin Processing', remarks || 'Returned by Admin', req.params.id]);
         // Optionally reset reviews
         await conn.query('DELETE FROM purchase_request_reviews WHERE purchase_request_id = ?', [req.params.id]);
      } else {
         // Insert or update review
         await conn.query('INSERT INTO purchase_request_reviews (purchase_request_id, reviewer_id, review_status, review_comment, reviewed_at) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE review_status = VALUES(review_status), review_comment = VALUES(review_comment), reviewed_at = NOW()', [req.params.id, req.user.id, 'approved', remarks]);
         
         // Check if all admins approved
         const [adminCountRes] = await conn.query("SELECT count(*) as count FROM users WHERE role = 'admin' AND is_active = 1");
         const [reviewCountRes] = await conn.query("SELECT count(*) as count FROM purchase_request_reviews WHERE purchase_request_id = ? AND review_status = 'approved'", [req.params.id]);
         
         if (reviewCountRes[0].count >= adminCountRes[0].count) {
           // All admins approved! Move to next stage based on amount
           let nextStatus = 'For Super Admin Rep Review';
           if (pr.total_amount >= 10000) {
             nextStatus = 'For Super Admin Final Approval';
             // Delete pending super admin rep reviews since they are bypassed
             await conn.query(
               "DELETE FROM purchase_request_reviews WHERE purchase_request_id = ? AND reviewer_id IN (SELECT id FROM employees WHERE role = 'super_admin_rep') AND review_status = 'pending'",
               [req.params.id]
             );
           }
           await conn.query('UPDATE purchase_requests SET status = ?, remarks = ? WHERE id = ?', [nextStatus, 'All admins approved', req.params.id]);
         }
      }
    } else if (userRole === 'admin' && (currentStatus === 'For Admin Processing' || currentStatus === 'Pending Admin Processing')) {
        if (status === 'Rejected' || status === 'rejected') {
          await conn.query('UPDATE purchase_requests SET status = ?, remarks = ? WHERE id = ?', ['Returned', remarks || 'Returned by Admin', req.params.id]);
        } else {
          await conn.query('UPDATE purchase_requests SET status = ?, remarks = ? WHERE id = ?', ['Under Admin Review', remarks || 'Approved for Admin Review', req.params.id]);
        }
    } else if (userRole === 'super_admin_rep' && currentStatus === 'For Super Admin Rep Review') {
       if (status === 'Rejected' || status === 'rejected') {
         await conn.query('UPDATE purchase_requests SET status = ?, remarks = ? WHERE id = ?', ['Pending Admin Processing', remarks || 'Returned by Super Admin Rep', req.params.id]);
       } else {
         await conn.query('UPDATE purchase_requests SET status = ?, approved_by = ?, approved_at = NOW(), remarks = ? WHERE id = ?', ['Completed', req.user.id, remarks, req.params.id]);
       }
    } else if (userRole === 'super_admin' && currentStatus === 'For Super Admin Final Approval') {
       if (status === 'Rejected' || status === 'rejected') {
         await conn.query('UPDATE purchase_requests SET status = ?, remarks = ? WHERE id = ?', ['Pending Admin Processing', remarks || 'Returned by Super Admin', req.params.id]);
       } else {
         await conn.query('UPDATE purchase_requests SET status = ?, approved_by = ?, approved_at = NOW(), remarks = ? WHERE id = ?', ['Completed', req.user.id, remarks, req.params.id]);
       }
    }

    await conn.commit();
    res.json({ message: `Purchase request ${status} successfully` });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update purchase request' });
  } finally {
    if (conn) conn.release();
  }
});

// Mark PR as Received (engineer only, only when status is Completed)
router.put('/:id/received', authenticate, async (req, res) => {
  try {
    // Check if PR exists
    const [prs] = await db.query('SELECT * FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (prs.length === 0) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const pr = prs[0];

    // Only the original requester can mark as received
    if (pr.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Only the original requester can mark this PR as received' });
    }

    // Only Completed PRs can be marked as Received
    if (pr.status !== 'Completed') {
      return res.status(400).json({ message: 'Only completed purchase requests can be marked as received' });
    }

    await db.query(
      'UPDATE purchase_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      ['Received', req.params.id]
    );

    res.json({ message: 'Purchase request marked as received successfully', status: 'Received' });
  } catch (error) {
    console.error('Mark received error:', error);
    res.status(500).json({ message: 'Failed to mark purchase request as received' });
  }
});

// Update PR status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const [prs] = await db.query('SELECT order_number, status FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (prs.length === 0) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }
    await assertOrderNumberUnlocked(prs[0].order_number, 'status update');

    const currentStatus = prs[0].status;
    const userRole = req.user.role;

    const isSuperAdminOverride = req.user.role === 'super_admin' && (status === 'On Hold' || status === 'Rejected');

    if (!isSuperAdminOverride) {
      // Validate that user's role matches the current status
      if (currentStatus === 'For Engineer Review' && userRole !== 'engineer') {
        return res.status(403).json({ message: 'This purchase request is currently awaiting Engineer review. You do not have permission to update the status at this stage.' });
      }

      if (currentStatus === 'For Admin Review' && userRole !== 'admin') {
        return res.status(403).json({ message: 'This purchase request is currently awaiting Admin review. You do not have permission to update the status at this stage.' });
      }

      if (currentStatus === 'For Super Admin Rep Review' && userRole !== 'super_admin_rep') {
        return res.status(403).json({ message: 'This purchase request is currently awaiting Super Admin Rep review. You do not have permission to update the status at this stage.' });
      }

      if (currentStatus === 'For Super Admin Final Approval' && userRole !== 'super_admin') {
        return res.status(403).json({ message: 'This purchase request is currently awaiting Super Admin final approval. You do not have permission to update the status at this stage.' });
      }
    }

    await db.query(
      'UPDATE purchase_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    );

    res.json({ message: `Purchase request status updated to ${status} successfully`, status });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update purchase request status' });
  }
});

// Delete Purchase Request (Draft only for creator, any status for Super Admin)
router.delete('/:id', authenticate, async (req, res) => {
  let conn;
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const [prs] = await db.query('SELECT * FROM purchase_requests WHERE id = ?', [req.params.id]);
    
    if (prs.length === 0) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    const pr = prs[0];

    // Access control check
    if (!isSuperAdmin) {
      if (pr.requested_by !== req.user.id) {
        return res.status(403).json({ message: 'Only the original requester can delete this purchase request' });
      }
      if (pr.status !== 'Draft') {
        return res.status(400).json({ message: 'Only draft purchase requests can be deleted' });
      }
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query('DELETE FROM purchase_request_items WHERE purchase_request_id = ?', [req.params.id]);
    await conn.query('DELETE FROM purchase_request_reviews WHERE purchase_request_id = ?', [req.params.id]);
    await conn.query('DELETE FROM purchase_request_payment_schedules WHERE purchase_request_id = ?', [req.params.id]);
    await conn.query('DELETE FROM pr_item_rejection_remarks WHERE purchase_request_id = ?', [req.params.id]);
    await conn.query('DELETE FROM purchase_requests WHERE id = ?', [req.params.id]);

    await conn.commit();

    if (isSuperAdmin) {
      try {
        const { logAudit } = await import('../utils/auditLogger.js');
        await logAudit(req.user.id, 'Request Deleted', 'purchase_requests', req.params.id, JSON.stringify({ pr_number: pr.pr_number, project: pr.project }));
      } catch (auditErr) {
        console.error('Audit log error:', auditErr);
      }
    }

    res.json({ message: 'Purchase request deleted successfully' });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error('Delete purchase request error:', error);
    res.status(500).json({ message: 'Failed to delete purchase request: ' + error.message });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
