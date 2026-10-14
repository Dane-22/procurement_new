import db from '../config/database.js';
import {prepareRequestWorkflowSchema} from '../services/requestWorkflowSchema.js';
import {inventory} from '../services/requestWorkflowMigration.js';
import {document,submit,transaction} from '../services/requestWorkflow.js';
import {recordMigrationReview} from '../services/requestWorkflowMigration.js';

try {
  if(process.argv.includes('--schema')) {
    await prepareRequestWorkflowSchema(db);
    console.log('Workflow schema and cash/petty-cash/payment prerequisites applied. Existing records and enum values preserved; no requests restarted.');
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
