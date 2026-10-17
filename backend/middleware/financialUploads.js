import { authenticate } from './auth.js';
import db from '../config/database.js';
import { document, access } from '../services/requestWorkflow.js';

// Keep existing stored paths, while applying document access before static
// delivery. Catalog/profile images continue through the existing public path.
export function protectFinancialUploads(req, res, next) {
  let parts;
  try {
    const decoded = decodeURIComponent(req.path);
    if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(part => part === '.' || part === '..')) return res.sendStatus(400);
    parts = decoded.split('/').filter(Boolean);
  } catch { return res.sendStatus(400); }
  const [folder, filename] = parts;
  if (!['receipts','reimbursements'].includes(folder)) return next();
  res.set('Cache-Control','private, no-store');
  return authenticate(req,res,async () => {
    try {
      if (parts.length !== 2) return res.sendStatus(404);
      const filePath = `/uploads/${folder}/${filename}`;
      if (folder === 'reimbursements') {
        const [rows] = await db.query('SELECT r.requested_by FROM reimbursement_attachments a JOIN reimbursements r ON r.id=a.reimbursement_id WHERE a.file_path=?', [filePath]);
        if (!rows.length) return res.sendStatus(404);
        if (req.user.role === 'engineer' && Number(rows[0].requested_by) !== Number(req.user.id)) return res.sendStatus(403);
      } else {
        const [rows] = await db.query('SELECT purchase_order_id FROM po_attachments WHERE file_path=?', [filePath]);
        if (!rows.length) return res.sendStatus(404);
        await access(db,req.user,'po',await document(db,'po',rows[0].purchase_order_id));
      }
      next();
    } catch(error) { res.status(error.statusCode||500).json({message:error.statusCode?error.message:'Unable to read attachment'}); }
  });
}
