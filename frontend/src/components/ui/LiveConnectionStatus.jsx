import React,{useEffect,useState} from 'react';
import {socketService} from '../../services/socket';
export default function LiveConnectionStatus(){
  const [connected,setConnected]=useState(socketService.isConnected());
  useEffect(()=>{
    const connect=()=>setConnected(true),disconnect=()=>setConnected(false);
    socketService.on('connect',connect);socketService.on('disconnect',disconnect);socketService.on('connect_error',disconnect);
    return()=>{socketService.off('connect',connect);socketService.off('disconnect',disconnect);socketService.off('connect_error',disconnect);};
  },[]);
  return <div role="status" className={`px-4 py-1 text-xs ${connected?'bg-green-50 text-green-800':'bg-amber-50 text-amber-800'}`}>{connected?'Live updates connected':'Live updates disconnected — views refresh on reconnect; reload before acting'}</div>;
}
