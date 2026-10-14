import fs from 'node:fs/promises';
import db from '../config/database.js';
import {inventory} from '../services/requestWorkflowMigration.js';
import {document,submit,transaction} from '../services/requestWorkflow.js';
import {recordMigrationReview} from '../services/requestWorkflowMigration.js';

const additions=['Draft','For Engineer Review','For Admin Review','For Senior Project Manager Review','For Super Admin Final Approval','Approved','Rejected','Returned','On Hold','Partial Received','Completed','Received'];
try {
  if(process.argv.includes('--schema')) {
    // Unlike the legacy runner, never execute SQL dumps or unrelated migrations.
    const sql=await fs.readFile(new URL('../database/migrations/20261014_request_workflows.sql',import.meta.url),'utf8');
    for(const statement of sql.replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.query(statement);
    const [receiptColumns]=await db.query('SHOW COLUMNS FROM request_workflow_receipts');
    if(!receiptColumns.some(c=>c.Field==='status'))await db.query("ALTER TABLE request_workflow_receipts ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending', ADD COLUMN review_comment TEXT NULL");
    for(const table of ['purchase_orders','service_requests','cash_requests','purchase_order_items']) {
      const [columns]=await db.query(`SHOW COLUMNS FROM ${table}`);
      const status=columns.find(c=>c.Field==='status');
      if(table==='purchase_order_items'&&!status)await db.query("ALTER TABLE purchase_order_items ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'Pending'");
      if(status?.Type.startsWith('enum(')) {
        const existing=[...status.Type.matchAll(/'((?:''|[^'])*)'/g)].map(m=>m[1].replace(/''/g,"'"));
        const values=[...new Set([...existing,...additions])].map(v=>db.escape(v)).join(',');
        await db.query(`ALTER TABLE ${table} MODIFY COLUMN status ENUM(${values}) ${status.Null==='YES'?'NULL':'NOT NULL'} ${status.Default===null?'':`DEFAULT ${db.escape(status.Default)}`}`);
      }
      if(table==='purchase_order_items'&&!columns.some(c=>c.Field==='received_quantity'))await db.query('ALTER TABLE purchase_order_items ADD COLUMN received_quantity DECIMAL(15,2) NOT NULL DEFAULT 0');
      if(table==='purchase_order_items'&&!columns.find(c=>c.Field==='quantity')?.Type.startsWith('decimal'))await db.query('ALTER TABLE purchase_order_items MODIFY COLUMN quantity DECIMAL(15,2) NOT NULL');
    }
    console.log('Additive workflow schema applied. Schema preparation alone does not restart existing requests.');
  }
  if(process.argv.includes('--inventory'))console.log(JSON.stringify(await inventory(db),null,2));
  const restart=process.argv.find(arg=>arg.startsWith('--restart='))?.split('=')[1];
  const actor=Number(process.argv.find(arg=>arg.startsWith('--actor='))?.split('=')[1]);
  if(restart){
    const match=restart.match(/^(po|sr|cr):(\d+)$/);
    if(!match||!Number.isInteger(actor)||actor<=0)throw new Error('Restart needs --restart=po:ID (or sr/cr) and --actor=ADMIN_ID');
    const [users]=await db.query("SELECT id,role FROM employees WHERE id=? AND role='admin' AND is_active=1",[actor]);
    if(!users.length)throw new Error('Migration actor must be an active Admin');
    await transaction(async conn=>{
      const row=await document(conn,match[1],match[2],true);
      const report=(await inventory(conn)).find(r=>r.module===match[1]&&Number(r.id)===Number(match[2]));
      if(report.links.length)throw new Error('Linked documents exist: review them individually through the Admin workflow screen');
      await recordMigrationReview(conn,users[0],match[1],row,{note:'Unpaid/unfulfilled local migration: inspected all direct and indirect source/payment links; none exist. Preserve prior decisions; restart under new rules.',links:[]});
      console.log(await submit(conn,users[0],match[1],row.id,{migration:true}));
    });
  }
  if(!process.argv.includes('--schema')&&!process.argv.includes('--inventory')&&!restart)console.log('Usage: node scripts/requestWorkflowMigration.js --schema and/or --inventory. Restart linked records through Admin review; unlinked records support --restart=po:ID --actor=ADMIN_ID.');
} catch(error) {console.error('Workflow migration:',error.message || error.code);process.exitCode=1;}
finally {await db.end();}
