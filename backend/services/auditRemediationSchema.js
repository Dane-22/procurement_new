import { columns, mergeStatuses } from './requestWorkflowSchema.js';

// Explicit additive upgrade; never run DDL from an HTTP request.
export async function prepareAuditRemediationSchema(pool) {
  const conn = await pool.getConnection();
  let locked = false;
  try {
    const [locks] = await conn.query("SELECT GET_LOCK('procurement_audit_schema',30) AS acquired");
    if (!locks[0].acquired) throw new Error('Another audit migration is running');
    locked = true;
    for (const table of ['suppliers','reimbursements','purchase_requests','purchase_request_reviews']) await columns(conn,table);
    const supplierColumns = await columns(conn, 'suppliers');
    for (const [name, type] of Object.entries({
      rating_delivery: 'DECIMAL(3,2) NULL', rating_quality: 'DECIMAL(3,2) NULL',
      rating_pricing: 'DECIMAL(3,2) NULL', performance_notes: 'TEXT NULL'
    })) {
      if (!supplierColumns.some(column => column.Field === name)) {
        await conn.query(`ALTER TABLE suppliers ADD COLUMN ${name} ${type}`);
      }
    }
    await mergeStatuses(conn, 'reimbursements', ['For Admin Review', 'For Super Admin Final Approval', 'Payment Order Created']);
    await mergeStatuses(conn, 'purchase_requests', ['Pending Accreditation Review']);
    // Archive active PR reviews before a correction resets them. Keep existing
    // review-table uniqueness and every existing active-review caller intact.
    await conn.query(`CREATE TABLE IF NOT EXISTS purchase_request_review_history (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      purchase_request_id INT NOT NULL,
      archived_by INT NOT NULL,
      reviews LONGTEXT NOT NULL,
      archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pr_review_history (purchase_request_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    return { suppliers: 'ready', reimbursements: 'ready', prReviewHistory: 'ready' };
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK('procurement_audit_schema')").catch(() => {});
    conn.release();
  }
}
