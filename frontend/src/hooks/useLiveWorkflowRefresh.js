import {useEffect,useRef} from 'react';
import {socketService} from '../services/socket';
export function useLiveWorkflowRefresh(refresh,module=null) {
  const callback=useRef(refresh);
  useEffect(()=>{callback.current=refresh;},[refresh]);
  useEffect(()=>{
    let running=false,pending=false,cancelled=false;
    const run=async()=>{
      if(cancelled||document.visibilityState==='hidden')return;
      if(running){pending=true;return;}running=true;
      try{await callback.current?.();}finally{running=false;if(pending&&!cancelled){pending=false;run();}}
    };
    const changed=event=>{if(!module||event?.module===module)run();};
    socketService.on('workflow_changed',changed);socketService.on('workflow_refresh',changed);socketService.on('connect',run);
    window.addEventListener('focus',run);document.addEventListener('visibilitychange',run);
    const timer=setInterval(run,10000);
    return()=>{cancelled=true;clearInterval(timer);socketService.off('workflow_changed',changed);socketService.off('workflow_refresh',changed);socketService.off('connect',run);window.removeEventListener('focus',run);document.removeEventListener('visibilitychange',run);};
  },[module]);
}
