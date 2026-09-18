import mysql from 'mysql2/promise';

async function fixPR() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'procurement_db'
  });

  try {
    // 1. Get the PR ID
    const [prs] = await conn.query("SELECT id FROM purchase_requests WHERE pr_number = '2026-09-039'");
    if (prs.length === 0) {
      console.log('PR not found');
      process.exit(1);
    }
    const prId = prs[0].id;

    // 2. Auto-approve the admin reviews
    await conn.query(
      "UPDATE purchase_request_reviews SET review_status = 'approved', review_comment = 'Auto-approved (retroactive fix)', reviewed_at = NOW() WHERE purchase_request_id = ? AND reviewer_id IN (SELECT id FROM employees WHERE role = 'admin')",
      [prId]
    );

    // 3. Move the status to For Super Admin Rep Review
    await conn.query(
      "UPDATE purchase_requests SET status = 'For Super Admin Rep Review' WHERE id = ?",
      [prId]
    );

    console.log('Successfully fixed PR 2026-09-039');
  } catch (error) {
    console.error('Error fixing PR:', error);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

fixPR();
