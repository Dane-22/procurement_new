import db from '../config/database.js';
import { prepareAuditRemediationSchema } from '../services/auditRemediationSchema.js';

try {
  const [target] = await db.query('SELECT DATABASE() AS database_name,VERSION() AS database_version');
  const [schema] = await db.query("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='suppliers' AND COLUMN_NAME IN ('rating_delivery','rating_quality','rating_pricing','performance_notes')) OR (TABLE_NAME IN ('reimbursements','purchase_requests') AND COLUMN_NAME='status')) ORDER BY TABLE_NAME,COLUMN_NAME");
  console.log(JSON.stringify({target:{...target[0],host:db.pool.config.connectionConfig.host,port:db.pool.config.connectionConfig.port},before:schema}));
  if (!process.argv.includes('--check')) console.log(JSON.stringify(await prepareAuditRemediationSchema(db)));
} catch (error) {
  console.error('Audit remediation migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
