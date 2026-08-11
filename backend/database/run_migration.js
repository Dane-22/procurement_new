import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
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
  queueLimit: 0,
  multipleStatements: true
});

async function runMigration() {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to database');
    
    const sqlPath = path.join(__dirname, 'migrations', 'phase2_debt_service_req.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running migration from:', sqlPath);
    await connection.query(sql);
    console.log('Migration completed successfully.');
    
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
