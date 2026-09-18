import db from './config/database.js';
async function test() {
  try {
    const [result] = await db.query(
      'UPDATE purchase_request_items SET unit_price = ?, total_price = ? WHERE purchase_request_id = ? AND item_id = ?',
      [NaN, NaN, 73, 25]
    );
    console.log(result);
    process.exit(0);
  } catch (e) {
    console.error("CAUGHT ERROR:", e.message);
    process.exit(1);
  }
}
test();
