const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'procurement_db' });
  await conn.query("UPDATE purchase_requests SET status = 'For Engineer Review' WHERE pr_number = '2026-09-039'");
  console.log('Fixed status for 2026-09-039');
  process.exit(0);
}
run();
