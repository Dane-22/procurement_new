import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import db from '../config/database.js';
import { getReviewersForPR } from '../utils/notifications.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/accreditation';
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

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all suppliers
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    // Fetch unique suppliers from purchase requests that are not in suppliers table
    const [prSuppliers] = await db.query(`
      SELECT DISTINCT
        pr.supplier_name,
        pr.supplier_address
      FROM purchase_requests pr
      WHERE pr.supplier_name IS NOT NULL
        AND pr.supplier_name != ''
        AND pr.supplier_name NOT IN (SELECT supplier_name FROM suppliers WHERE status = 'Active')
      GROUP BY pr.supplier_name, pr.supplier_address
      ORDER BY pr.supplier_name
    `);

    // Insert new suppliers from PR requests into suppliers table
    for (const prSupplier of prSuppliers) {
      const supplierCode = 'SUP' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
      await db.query(
        'INSERT INTO suppliers (supplier_code, supplier_name, address, status) VALUES (?, ?, ?, ?)',
        [supplierCode, prSupplier.supplier_name, prSupplier.supplier_address, 'Active']
      );
    }

    // Fetch all suppliers (including newly inserted ones)
    const [suppliers] = await db.query(`
      SELECT s.*, COUNT(si.item_id) as items_count
      FROM suppliers s
      LEFT JOIN supplier_items si ON s.id = si.supplier_id
      WHERE s.status = 'Active'
      GROUP BY s.id
      ORDER BY s.supplier_name
    `);

    // For each supplier, also fetch accreditation files from purchase_requests
    for (const supplier of suppliers) {
      // Fetch accreditation files from purchase_requests table
      const [prFiles] = await db.query(`
        SELECT accreditation_files
        FROM purchase_requests
        WHERE supplier_name = ?
          AND accreditation_files IS NOT NULL
          AND accreditation_files != ''
      `, [supplier.supplier_name]);

      // Parse and merge files from purchase_requests
      let prFilesList = [];
      for (const pr of prFiles) {
        try {
          const files = JSON.parse(pr.accreditation_files);
          if (Array.isArray(files)) {
            prFilesList.push(...files);
          }
        } catch (e) {
          console.error('Failed to parse accreditation_files from PR:', e);
        }
      }

      // Parse files from suppliers table
      let supplierFilesList = [];
      if (supplier.accreditation_files) {
        try {
          supplierFilesList = JSON.parse(supplier.accreditation_files);
          if (!Array.isArray(supplierFilesList)) {
            supplierFilesList = [];
          }
        } catch (e) {
          console.error('Failed to parse accreditation_files from supplier:', e);
          supplierFilesList = [];
        }
      }

      // Merge files, deduplicating by filename
      const allFilesMap = new Map();
      supplierFilesList.forEach(file => {
        allFilesMap.set(file.filename, file);
      });
      prFilesList.forEach(file => {
        allFilesMap.set(file.filename, file);
      });

      // Update supplier with merged files
      supplier.accreditation_files = JSON.stringify(Array.from(allFilesMap.values()));
    }

    // Apply pagination
    const total = suppliers.length;
    const paginatedSuppliers = suppliers.slice(offset, offset + pageSize);

    res.json({ suppliers: paginatedSuppliers, page, pageSize, total });
  } catch (error) {
    console.error('Failed to fetch suppliers', error);
    res.status(500).json({ message: 'Failed to fetch suppliers' });
  }
});

// Get suppliers from purchase requests (for Super Admin accreditation)
router.get('/from-pr-requests', authenticate, async (req, res) => {
  try {
    // Fetch all unique suppliers from purchase requests
    const [prSuppliers] = await db.query(`
      SELECT DISTINCT
        pr.supplier_name,
        pr.supplier_address,
        COUNT(DISTINCT pr.id) as pr_count,
        MIN(pr.created_at) as first_used,
        MAX(pr.created_at) as last_used
      FROM purchase_requests pr
      WHERE pr.supplier_name IS NOT NULL
        AND pr.supplier_name != ''
      GROUP BY pr.supplier_name, pr.supplier_address
      ORDER BY pr.supplier_name
    `);

    // Fetch accredited status from suppliers table
    const [accreditedSuppliers] = await db.query(`
      SELECT supplier_name, accredited, accredited_by, accredited_at
      FROM suppliers
      WHERE supplier_name IN (?)
    `, [prSuppliers.map(s => s.supplier_name)]);

    // Create a map for quick lookup
    const accreditedMap = new Map();
    accreditedSuppliers.forEach(s => {
      accreditedMap.set(s.supplier_name, {
        accredited: s.accredited,
        accredited_by: s.accredited_by,
        accredited_at: s.accredited_at
      });
    });

    // Merge the data
    const mergedSuppliers = prSuppliers.map(s => ({
      ...s,
      accredited: accreditedMap.get(s.supplier_name)?.accredited || 0,
      accredited_by: accreditedMap.get(s.supplier_name)?.accredited_by || null,
      accredited_at: accreditedMap.get(s.supplier_name)?.accredited_at || null
    }));

    res.json({ suppliers: mergedSuppliers });
  } catch (error) {
    console.error('Failed to fetch suppliers from PR requests:', error);
    res.status(500).json({ message: 'Failed to fetch suppliers from PR requests' });
  }
});

// Get single supplier with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [suppliers] = await db.query(
      'SELECT * FROM suppliers WHERE id = ? AND status = \'Active\'',
      [req.params.id]
    );

    if (suppliers.length === 0) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const [items] = await db.query(`
      SELECT i.id, i.item_name as name, i.unit, si.price, si.lead_time_days
      FROM items i
      JOIN supplier_items si ON i.id = si.item_id
      WHERE si.supplier_id = ?
    `, [req.params.id]);

    res.json({ supplier: { ...suppliers[0], items } });
  } catch (error) {
    console.error('Failed to fetch supplier', error);
    res.status(500).json({ message: 'Failed to fetch supplier' });
  }
});

// Create supplier (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, tin } = req.body;
    
    // Generate supplier code
    const supplierCode = 'SUP' + Date.now().toString().slice(-6);
    
    const [result] = await db.query(
      'INSERT INTO suppliers (supplier_code, supplier_name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
      [supplierCode, name, contact_person, phone, email, address]
    );

    res.status(201).json({ 
      message: 'Supplier created successfully', 
      supplierId: result.insertId 
    });
  } catch (error) {
    console.error('Failed to create supplier', error);
    res.status(500).json({ message: 'Failed to create supplier' });
  }
});

// Update supplier (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    
    await db.query(
      'UPDATE suppliers SET supplier_name = ?, contact_person = ?, phone = ?, email = ?, address = ? WHERE id = ?',
      [name, contact_person, phone, email, address, req.params.id]
    );

    res.json({ message: 'Supplier updated successfully' });
  } catch (error) {
    console.error('Failed to update supplier', error);
    res.status(500).json({ message: 'Failed to update supplier' });
  }
});

// Delete supplier (admin only - soft delete)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query("UPDATE suppliers SET status = 'Inactive' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Failed to delete supplier', error);
    res.status(500).json({ message: 'Failed to delete supplier' });
  }
});

// Add item to supplier (admin only)
router.post('/:id/items', authenticate, requireAdmin, async (req, res) => {
  try {
    const { item_id, price, lead_time_days } = req.body;

    await db.query(
      'INSERT INTO supplier_items (supplier_id, item_id, price, lead_time_days) VALUES (?, ?, ?, ?)',
      [req.params.id, item_id, price, lead_time_days]
    );

    res.status(201).json({ message: 'Item added to supplier successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add item to supplier' });
  }
});

// Update supplier accreditation status (Super Admin only)
router.put('/:supplierName/accredit', authenticate, async (req, res) => {
  try {
    const { accredited, accreditation_notes } = req.body;
    const supplierName = req.params.supplierName;

    if (typeof accredited !== 'boolean') {
      return res.status(400).json({ message: 'accredited must be a boolean' });
    }

    // Check if supplier exists in suppliers table
    const [existingSupplier] = await db.query(
      'SELECT id FROM suppliers WHERE supplier_name = ?',
      [supplierName]
    );

    if (existingSupplier.length === 0) {
      // Create new supplier record if it doesn't exist
      const supplierCode = 'SUP' + Date.now().toString().slice(-6);
      try {
        const [result] = await db.query(
          'INSERT INTO suppliers (supplier_code, supplier_name, accredited, accredited_by, accredited_at, accreditation_notes) VALUES (?, ?, ?, ?, NOW(), ?)',
          [supplierCode, supplierName, accredited ? 1 : 0, req.user.id, accreditation_notes || null]
        );
      } catch (insertError) {
        // If columns don't exist, try without them
        if (insertError.code === 'ER_BAD_FIELD_ERROR') {
          const [result] = await db.query(
            'INSERT INTO suppliers (supplier_code, supplier_name) VALUES (?, ?)',
            [supplierCode, supplierName]
          );
        } else {
          throw insertError;
        }
      }
    } else {
      // Update existing supplier
      try {
        await db.query(
          'UPDATE suppliers SET accredited = ?, accredited_by = ?, accredited_at = NOW(), accreditation_notes = ? WHERE supplier_name = ?',
          [accredited ? 1 : 0, req.user.id, accreditation_notes || null, supplierName]
        );
      } catch (updateError) {
        // If columns don't exist, try without them
        if (updateError.code === 'ER_BAD_FIELD_ERROR') {
          console.log('Accreditation columns not found in database. Please run the migration.');
          res.status(400).json({ message: 'Database migration required. Please run the accreditation migration.' });
          return;
        } else {
          throw updateError;
        }
      }
    }

    // If supplier is now accredited, auto-update all pending accreditation review PRs
    if (accredited) {
      console.log(`🔍 Updating PRs for supplier: ${supplierName}`);
      
      const [pendingPRs] = await db.query(
        `SELECT pr.id, pr.status, pr.requested_by, e.role as requester_role
         FROM purchase_requests pr
         JOIN employees e ON pr.requested_by = e.id
         WHERE pr.supplier_name = ? AND pr.status = 'Pending Accreditation Review'`,
        [supplierName]
      );

      console.log(`✅ Found ${pendingPRs.length} pending accreditation review PRs for ${supplierName}`);

      // Update each PR to the next appropriate status based on requester role and create review records
      for (const pr of pendingPRs) {
        let newStatus;
        if (pr.requester_role === 'engineer') {
          newStatus = 'For Engineer Review';
        } else if (pr.requester_role === 'admin') {
          newStatus = 'For Admin Review';
        } else if (pr.requester_role === 'procurement') {
          newStatus = 'For Procurement Review';
        } else {
          newStatus = 'For Super Admin Final Approval';
        }

        // Update PR status
        await db.query(
          'UPDATE purchase_requests SET status = ?, updated_at = NOW() WHERE id = ?',
          [newStatus, pr.id]
        );

        // Create review records for required reviewers
        const reviewers = await getReviewersForPR(pr.requester_role);
        const filteredReviewers = reviewers.filter(reviewerId => reviewerId !== pr.requested_by);

        for (const reviewerId of filteredReviewers) {
          try {
            await db.query(
              'INSERT INTO purchase_request_reviews (purchase_request_id, reviewer_id, review_status) VALUES (?, ?, ?)',
              [pr.id, reviewerId, 'pending']
            );
          } catch (err) {
            // Ignore duplicate key errors (review record already exists)
            if (err.code !== 'ER_DUP_ENTRY') {
              throw err;
            }
          }
        }

        console.log(`✅ Updated PR ${pr.id} status to ${newStatus} with ${filteredReviewers.length} reviewers`);
      }
    }

    res.json({ message: 'Supplier accreditation status updated successfully' });
  } catch (error) {
    console.error('Failed to update supplier accreditation:', error);
    res.status(500).json({ message: 'Failed to update supplier accreditation' });
  }
});

// Upload accreditation files for supplier (Super Admin only)
router.post('/:supplierName/accreditation-files', authenticate, async (req, res, next) => {
  // Check if user is super admin
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Access denied. Super admin only.' });
  }
  next();
}, upload.array('files', 5), async (req, res) => {
  try {
    const supplierName = req.params.supplierName;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Check if supplier exists
    const [existingSupplier] = await db.query(
      'SELECT id, accreditation_files FROM suppliers WHERE supplier_name = ?',
      [supplierName]
    );

    if (existingSupplier.length === 0) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Get existing files
    let existingFiles = [];
    if (existingSupplier[0].accreditation_files) {
      try {
        existingFiles = JSON.parse(existingSupplier[0].accreditation_files);
      } catch (e) {
        existingFiles = [];
      }
    }

    // Add new files
    const newFiles = files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploaded_at: new Date().toISOString()
    }));

    const allFiles = [...existingFiles, ...newFiles];

    // Update supplier with new files
    try {
      await db.query(
        'UPDATE suppliers SET accreditation_files = ? WHERE supplier_name = ?',
        [JSON.stringify(allFiles), supplierName]
      );
    } catch (updateError) {
      // If column doesn't exist, return helpful error
      if (updateError.code === 'ER_BAD_FIELD_ERROR') {
        console.log('accreditation_files column not found in database. Please run the migration.');
        res.status(400).json({ message: 'Database migration required. Please run the accreditation files migration.' });
        return;
      } else {
        throw updateError;
      }
    }

    res.json({ message: 'Accreditation files uploaded successfully', files: newFiles });
  } catch (error) {
    console.error('Failed to upload accreditation files:', error);
    res.status(500).json({ message: 'Failed to upload accreditation files' });
  }
});

// Delete accreditation file (Super Admin only)
router.delete('/:supplierName/accreditation-files/:filename', authenticate, async (req, res) => {
  // Check if user is super admin
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Access denied. Super admin only.' });
  }
  try {
    const supplierName = req.params.supplierName;
    const filename = decodeURIComponent(req.params.filename);

    console.log('Delete file request:', { supplierName, filename });

    // Get supplier with files
    const [existingSupplier] = await db.query(
      'SELECT id, accreditation_files FROM suppliers WHERE supplier_name = ?',
      [supplierName]
    );

    if (existingSupplier.length === 0) {
      console.log('Supplier not found:', supplierName);
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Parse existing files
    let existingFiles = [];
    if (existingSupplier[0].accreditation_files) {
      try {
        existingFiles = JSON.parse(existingSupplier[0].accreditation_files);
      } catch (e) {
        existingFiles = [];
      }
    }

    console.log('Existing files:', existingFiles.map(f => f.filename));

    // Find and remove the file
    const fileIndex = existingFiles.findIndex(f => f.filename === filename);
    if (fileIndex === -1) {
      console.log('File not found in accreditation_files:', filename);
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete physical file
    const filePath = path.resolve(existingFiles[fileIndex].path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from array
    existingFiles.splice(fileIndex, 1);

    // Update supplier
    await db.query(
      'UPDATE suppliers SET accreditation_files = ? WHERE supplier_name = ?',
      [existingFiles.length > 0 ? JSON.stringify(existingFiles) : null, supplierName]
    );

    res.json({ message: 'Accreditation file deleted successfully' });
  } catch (error) {
    console.error('Failed to delete accreditation file:', error);
    res.status(500).json({ message: 'Failed to delete accreditation file' });
  }
});

// Serve accreditation file (Super Admin only)
router.get('/:supplierName/accreditation-files/:filename', authenticate, async (req, res, next) => {
  // Check if user is super admin
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Access denied. Super admin only.' });
  }
  next();
}, async (req, res) => {
  try {
    const supplierName = req.params.supplierName;
    const filename = decodeURIComponent(req.params.filename);

    console.log('Serve file request:', { supplierName, filename });

    // First, try to find the file in suppliers table
    const [existingSupplier] = await db.query(
      'SELECT accreditation_files FROM suppliers WHERE supplier_name = ?',
      [supplierName]
    );

    let file = null;

    // Check suppliers table
    if (existingSupplier.length > 0 && existingSupplier[0].accreditation_files) {
      try {
        const supplierFiles = JSON.parse(existingSupplier[0].accreditation_files);
        file = supplierFiles.find(f => f.filename === filename);
      } catch (e) {
        console.error('Failed to parse supplier accreditation_files:', e);
      }
    }

    // If not found in suppliers table, check purchase_requests table
    if (!file) {
      const [prFiles] = await db.query(
        'SELECT accreditation_files FROM purchase_requests WHERE supplier_name = ? AND accreditation_files IS NOT NULL AND accreditation_files != ""',
        [supplierName]
      );

      for (const pr of prFiles) {
        try {
          const prFileList = JSON.parse(pr.accreditation_files);
          const foundFile = prFileList.find(f => f.filename === filename);
          if (foundFile) {
            file = foundFile;
            break;
          }
        } catch (e) {
          console.error('Failed to parse PR accreditation_files:', e);
        }
      }
    }

    if (!file) {
      console.log('File not found in accreditation_files:', filename);
      return res.status(404).json({ message: 'File not found' });
    }

    // Convert relative path to absolute path
    const absolutePath = path.resolve(file.path);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    // Send file
    res.sendFile(absolutePath);
  } catch (error) {
    console.error('Failed to serve accreditation file:', error);
    res.status(500).json({ message: 'Failed to serve accreditation file' });
  }
});

export default router;
