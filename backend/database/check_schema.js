import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'procurement_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function checkSchema() {
  try {
    const connection = await pool.getConnection();
    
    const [prCols] = await connection.query("SHOW COLUMNS FROM purchase_requests");
    console.log('purchase_requests columns:', prCols.map(c => c.Field).join(', '));
    
    const [poCols] = await connection.query("SHOW COLUMNS FROM purchase_orders");
    console.log('purchase_orders columns:', poCols.map(c => c.Field).join(', '));
    
    const [tables] = await connection.query("SHOW TABLES LIKE 'service_requests'");
    console.log('service_requests table exists:', tables.length > 0);
    
    const [dvCols] = await connection.query("SHOW COLUMNS FROM disbursement_vouchers");
    console.log('disbursement_vouchers columns:', dvCols.map(c => c.Field).join(', '));
    
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error.message);
    process.exit(1);
  }
}

checkSchema();
