const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Assuming empty root password for WAMP
    database: 'procurement_db'
  });

  try {
    // Add fcm_token to users if it doesn't exist
    try {
      await connection.query('ALTER TABLE users ADD COLUMN fcm_token VARCHAR(255)');
      console.log('Added fcm_token to users');
    } catch (e) {
      console.log('fcm_token might already exist or error:', e.message);
    }

    // Add image_url to purchase_request_items if it doesn't exist
    try {
      await connection.query('ALTER TABLE purchase_request_items ADD COLUMN image_url VARCHAR(255)');
      console.log('Added image_url to purchase_request_items');
    } catch (e) {
      console.log('image_url might already exist or error:', e.message);
    }

    // Add image_url to items if it doesn't exist
    try {
      await connection.query('ALTER TABLE items ADD COLUMN image_url VARCHAR(255)');
      console.log('Added image_url to items');
    } catch (e) {
      console.log('image_url might already exist or error:', e.message);
    }

    console.log('Database migration complete');
  } finally {
    await connection.end();
  }
}

run();
