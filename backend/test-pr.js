import db from './config/database.js';
async function test() {
  try {
    const [rows] = await db.query('SELECT * FROM purchase_request_items WHERE purchase_request_id = 73');
    console.log(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
