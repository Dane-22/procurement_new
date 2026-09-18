import db from './config/database.js';
async function test() {
  try {
    const [rows] = await db.query('SHOW CREATE TABLE purchase_request_payment_schedules');
    console.log(rows[0]['Create Table']);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
