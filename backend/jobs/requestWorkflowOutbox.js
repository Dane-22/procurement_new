import db from '../config/database.js';
import { getIO } from '../utils/socket.js';
let running=false;
export function startRequestWorkflowOutbox() {
  const tick=async()=>{
    if(running)return;running=true;
    const conn=await db.getConnection().catch(()=>null);
    if(!conn){running=false;return;}
    let locked=false;
    try{
      const [lease]=await conn.query("SELECT GET_LOCK('request_workflow_outbox',0) AS acquired");
      if(!lease[0].acquired)return;
      locked=true;
      const [events]=await conn.query('SELECT * FROM request_workflow_events WHERE delivered_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at<=NOW()) ORDER BY id LIMIT 50');
      for(const event of events){
        try{
          const recipients=typeof event.recipients==='string'?JSON.parse(event.recipients):event.recipients;
          const io=getIO();
          for(const recipient of recipients){
            let notification;
            await conn.beginTransaction();
            try{
              const [existing]=await conn.query('SELECT notification_id FROM request_workflow_event_notifications WHERE event_id=? AND recipient_id=?',[event.id,recipient]);
              if(!existing.length){
                const payload=typeof event.payload==='string'?JSON.parse(event.payload):event.payload;
                const [insert]=await conn.query("INSERT INTO notifications(recipient_id,title,message,type,related_id,related_type,is_read,created_at) VALUES(?,'Request workflow updated',?,'System',?,?,0,NOW())",[recipient,`${payload.number || 'Request'}: ${event.action.replaceAll('_',' ')}`,event.document_id,({po:'purchase_order',sr:'service_request',cr:'cash_request'})[event.module]]);
                await conn.query('INSERT INTO request_workflow_event_notifications(event_id,recipient_id,notification_id) VALUES(?,?,?)',[event.id,recipient,insert.insertId]);
              }
              await conn.commit();
              const [notifications]=await conn.query('SELECT n.* FROM notifications n JOIN request_workflow_event_notifications delivered ON delivered.notification_id=n.id WHERE delivered.event_id=? AND delivered.recipient_id=?',[event.id,recipient]);
              notification=notifications[0];
            }catch(error){await conn.rollback();throw error;}
            io.to(`user_${recipient}`).emit('workflow_changed',{event_id:event.id,module:event.module,id:event.document_id});
            if(notification)io.to(`user_${recipient}`).emit('notification',notification);
          }
          await conn.query('UPDATE request_workflow_events SET delivered_at=NOW(),attempts=attempts+1,last_error=NULL WHERE id=?',[event.id]);
        }catch(error){
          await conn.query('UPDATE request_workflow_events SET attempts=attempts+1,next_attempt_at=DATE_ADD(NOW(),INTERVAL ? SECOND),last_error=? WHERE id=?',[Math.min(300,2**Math.min(event.attempts+1,8)),error.message.slice(0,500),event.id]);
        }
      }
    }catch(error){if(error.code!=='ER_NO_SUCH_TABLE')console.error('Workflow outbox:',error.message);}
    finally{if(locked)await conn.query("SELECT RELEASE_LOCK('request_workflow_outbox')").catch(()=>{});conn.release();running=false;}
  };
  const interval=setInterval(tick,1000);interval.unref();return ()=>clearInterval(interval);
}
