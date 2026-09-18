import db from './config/database.js';
async function test() {
  try {
    const [result] = await db.query(
      'INSERT INTO suppliers (supplier_code, supplier_name, contact_person) VALUES (?, ?, ?)',
      ['TEST-SUP', 'Test Supplier', undefined]
    );
    console.log(result);
    process.exit(0);
  } catch (e) {
    console.error("CAUGHT ERROR:", e.message);
    process.exit(1);
  }
}
test();
