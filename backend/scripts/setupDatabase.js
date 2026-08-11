import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'procurement_db'
};

async function setupDatabase() {
  let connection;
  
  try {
    // Connect without database first to create it
    connection = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password
    });

    console.log('Connected to MySQL server');

    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database '${DB_CONFIG.database}' created or already exists`);

    // Use the database
    await connection.query(`USE ${DB_CONFIG.database}`);

    // Disable foreign key checks to allow tables to be created in any order
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Read and execute SQL files from dbschema folder
    const dbschemaPath = path.join(__dirname, '..', '..', 'dbschema');
    
    if (fs.existsSync(dbschemaPath)) {
      const files = fs.readdirSync(dbschemaPath)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Sort to ensure consistent order

      for (const file of files) {
        const filePath = path.join(dbschemaPath, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        // Split by semicolon to execute multiple statements
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await connection.query(statement);
            } catch (err) {
              // Ignore "table already exists" errors
              if (!err.message.includes('already exists')) {
                console.warn(`Warning in ${file}: ${err.message}`);
              }
            }
          }
        }
        
        console.log(`Executed: ${file}`);
      }
    }

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // Insert sample data if tables are empty
    await insertSampleData(connection);

    console.log('\nDatabase setup completed successfully!');
    console.log(`Database: ${DB_CONFIG.database}`);
    console.log('You can now start the server with: npm run dev');

  } catch (error) {
    console.error('Database setup failed:', error.message || error);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

async function insertSampleData(connection) {
  // Check if employees table has data
  const [employees] = await connection.query('SELECT COUNT(*) as count FROM employees');
  
  if (employees[0].count === 0) {
    console.log('Inserting sample data...');
    
    // Sample employees (4 roles)
    const hashedPassword = await bcrypt.hash('jajrconstruction', 10);
    
    await connection.query(`
      INSERT INTO employees (employee_no, first_name, last_name, role, department, password, is_active) VALUES
      ('ENG-2026-0001', 'Michelle', 'Norial', 'engineer', 'Engineering', ?, 1),
      ('PRO-2026-0001', 'Junnel', 'Tadina', 'procurement', 'Procurement', ?, 1),
      ('ADMIN-2026-0001', 'Elain', 'Torres', 'admin', 'Procurement', ?, 1),
      ('SA-2026-004', 'Marc', 'Arzadon', 'super_admin', 'Management', ?, 1)
    `, [hashedPassword, hashedPassword, hashedPassword, hashedPassword]);
    console.log('Sample employees inserted');

    // Sample categories
    await connection.query(`
      INSERT INTO categories (category_name, description) VALUES
      ('Electronics', 'Electronic components and devices'),
      ('Office Supplies', 'General office supplies and stationery'),
      ('Safety Equipment', 'Personal protective equipment and safety gear'),
      ('Tools', 'Hand tools and power tools'),
      ('Raw Materials', 'Raw materials for production')
    `);
    console.log('Sample categories inserted');

    // Sample items
    await connection.query(`
      INSERT INTO items (item_code, item_name, description, category_id, unit) VALUES
      ('ITM001', 'Laptop Dell Latitude', 'Business laptop 15.6 inch', 1, 'pcs'),
      ('ITM002', 'A4 Paper (Ream)', 'Premium quality A4 paper', 2, 'reams'),
      ('ITM003', 'Safety Helmet', 'Hard hat for construction', 3, 'pcs'),
      ('ITM004', 'Cordless Drill', '18V cordless drill driver', 4, 'pcs'),
      ('ITM005', 'Steel Rod 10mm', 'Mild steel reinforcement rod', 5, 'meters')
    `);
    console.log('Sample items inserted');

    // Sample suppliers
    await connection.query(`
      INSERT INTO suppliers (supplier_code, supplier_name, contact_person, phone, email, address) VALUES
      ('SUP001', 'Tech Supplies Inc', 'Robert Wilson', '09123456789', 'robert@techsupplies.com', '123 Main St, Manila'),
      ('SUP002', 'Office Depot PH', 'Maria Garcia', '09234567890', 'maria@officedepot.ph', '456 Business Ave, Quezon City'),
      ('SUP003', 'Safety First Co', 'David Lee', '09345678901', 'david@safetyfirst.com', '789 Industrial Rd, Makati')
    `);
    console.log('Sample suppliers inserted');

    // Sample supplier_items
    await connection.query(`
      INSERT INTO supplier_items (supplier_id, item_id, price, lead_time_days) VALUES
      (1, 1, 45000.00, 7),
      (1, 4, 8500.00, 3),
      (2, 2, 280.00, 1),
      (3, 3, 450.00, 2)
    `);
    console.log('Sample supplier-items inserted');

  } else {
    console.log('Sample data already exists, skipping...');
  }
}

setupDatabase();
