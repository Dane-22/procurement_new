import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {spawn} from 'node:child_process';
dotenv.config();
const connection=await mysql.createConnection({host:process.env.DB_HOST||'localhost',port:process.env.DB_PORT||3306,user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''});
const source=process.env.DB_NAME||'procurement_db';
const testName=`procurement_workflow_test_${Date.now()}`;
const quote=name=>connection.escapeId(name);
try{
  await connection.query(`CREATE DATABASE ${quote(testName)}`);
  const [tables]=await connection.query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE=\'BASE TABLE\'',[source]);
  for(const table of tables)await connection.query(`CREATE TABLE ${quote(testName)}.${quote(table.TABLE_NAME)} LIKE ${quote(source)}.${quote(table.TABLE_NAME)}`);
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--test','tests/workflows.integration.node.mjs'],{stdio:'inherit',env:{...process.env,DB_NAME:testName,NODE_ENV:'test',REDIS_URL:''}});
    child.on('error',reject);child.on('exit',resolve);
  });
  process.exitCode=code||0;
}finally{
  if(!/^procurement_workflow_test_\d+$/.test(testName))throw new Error('Refusing to remove an unverified test database');
  await connection.query(`DROP DATABASE ${quote(testName)}`);
  await connection.end();
}
