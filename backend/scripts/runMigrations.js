import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

async function runMigrations() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      database: DB_CONFIG.database
    });

    console.log('Connected to database');

    // Read and execute SQL files from migrations folder
    const migrationsPath = path.join(__dirname, '..', 'database', 'migrations');
    
    if (fs.existsSync(migrationsPath)) {
      const files = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Sort to ensure consistent order

      for (const file of files) {
        const filePath = path.join(migrationsPath, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        console.log(`Executing migration: ${file}`);
        
        // Split by semicolon to execute multiple statements
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await connection.query(statement);
            } catch (err) {
              // Ignore "already exists" errors
              if (err.message.includes('already exists') || err.message.includes('Duplicate')) {
                console.log(`⊘ Statement skipped (already exists): ${file}`);
              } else {
                console.error(`✗ Migration failed: ${file}`);
                console.error(`  Error: ${err.message}`);
                throw err;
              }
            }
          }
        }
        
        console.log(`✓ Migration completed: ${file}`);
      }
    } else {
      console.log('No migrations folder found');
    }

    console.log('\nAll migrations completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message || error);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigrations();
