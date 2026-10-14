import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {workflowService} from '../services/requestWorkflows';
import {socketService} from '../services/socket';
import {displayReviewStatus,displayReviewerRole} from '../utils/reviewLabels';

const defaultLabels={po:'Purchase Order',sr:'Service Request',cr:'Cash Request'};
const currency=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(value)||0);
const button='rounded bg-yellow-500 px-3 py-2 text-sm font-medium text-gray-900 disabled:opacity-50';
const field='rounded border border-gray-300 px-3 py-2';
export default function RequestWorkflows(){
  const {user}=useAuth();const [params,setParams]=useSearchParams();
  const kind=params.get('kind'),id=params.get('id');
  const [rows,setRows]=useState([]),[detail,setDetail]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[connected,setConnected]=useState(socketService.isConnected()),[lastUpdated,setLastUpdated]=useState(null);
  const [comment,setComment]=useState(''),[file,setFile]=useState(null),[quantity,setQuantity]=useState({}),[amount,setAmount]=useState(''),[receiver,setReceiver]=useState(''),[links,setLinks]=useState(null),[linkNotes,setLinkNotes]=useState({}),[migrationNote,setMigrationNote]=useState('');
  const [filter,setFilter]=useState('all');const generation=useRef(0);const inFlight=useRef(false);
  const [labels,setLabels]=useState(defaultLabels),[inventory,setInventory]=useState(null);
  const [draft,setDraft]=useState(null);const draftKey=useRef(null);
  useEffect(()=>{
    const key=`${kind}:${id}:${detail?.document.status}:${detail?.round?.round_number}`;
    if(!detail||detail.document.status!=='Draft'||kind==='po'||draftKey.current===key)return;
    draftKey.current=key;
    setDraft({purpose:detail.document.purpose || '',description:detail.document.description || '',amount:String(detail.document.amount || ''),quantity:String(detail.document.quantity ?? 1),supplier_id:detail.document.supplier_id || '',payment_schedules:(detail.schedules || []).map(s=>({...s,payment_date:String(s.payment_date).slice(0,10)}))});
  },[detail,kind,id]);
  useEffect(()=>{let cancelled=false;workflowService.options().then(options=>{if(!cancelled)setLabels(options.module_labels || defaultLabels);}).catch(()=>{});return()=>{cancelled=true;};},[]);
  const fetchData=useCallback(async()=>{
    const current=++generation.current;
    try{
      const [requests,record]=await Promise.all([workflowService.list(),kind&&id?workflowService.get(kind,id):Promise.resolve(null)]);
      if(current!==generation.current)return;
      setRows(requests);setDetail(record);setError('');setLastUpdated(new Date());
    }catch(e){if(current===generation.current)setError(e.response?.data?.message || 'Cannot refresh current records');}
  },[kind,id]);
  useEffect(()=>{
    setLinks(null);setQuantity({});setFile(null);setAmount('');setComment('');setNotice('');
    fetchData();
    const refresh=()=>document.visibilityState==='visible' ? fetchData() : Promise.resolve();
    const changed=()=>refresh();
    const connect=()=>{setConnected(true);refresh();};const disconnect=()=>setConnected(false);
    socketService.on('workflow_changed',changed);socketService.on('connect',connect);socketService.on('disconnect',disconnect);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    // Reconcile missed events with bounded polling; every read still goes to SQL.
    const timer=setInterval(()=>{if(!inFlight.current){inFlight.current=true;Promise.resolve(refresh()).finally(()=>{inFlight.current=false;});}},10000);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);socketService.off('workflow_changed',changed);socketService.off('connect',connect);socketService.off('disconnect',disconnect);};
  },[fetchData]);
  const perform=async(action,body={})=>{
    if(busy)return;setBusy(true);setError('');
    try{const result=await workflowService.action(kind,id,action,body);setNotice(result.message || 'Request updated');await fetchData();}
    catch(e){setError(e.response?.data?.message || 'Action failed');}finally{setBusy(false);}
  };
  const upload=async()=>{
    if(!file){setError('Select a receipt first');return;}
    const items=Object.entries(quantity).filter(([,q])=>Number(q)>0).map(([line_id,q])=>({line_id:Number(line_id),quantity:q}));
    setBusy(true);
    try{await workflowService.upload(kind,id,{file,amount,details:kind==='po'?{items}:kind==='sr'?{service_completed:true}:{signed_receipt:true},eventKey:crypto.randomUUID()});setFile(null);setQuantity({});setAmount('');setNotice('Receipt recorded');await fetchData();}
    catch(e){setError(e.response?.data?.message || 'Receipt upload failed');}finally{setBusy(false);}
  };
  const loadMigration=async()=>{try{const data=await workflowService.migration(kind,id);setLinks(data.links);setLinkNotes({});}catch(e){setError(e.response?.data?.message || 'Cannot load linked documents');}};
  const owner=detail&&Number(detail.document[kind==='po'?'prepared_by':'requested_by'])===Number(user.id);
  const displayed=rows.filter(r=>filter==='all'||filter==='reviews'&&r.can_review||r.module===filter);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Request Workflows</h1><p className="text-sm text-gray-600">Purchase Orders, Service Requests and Cash Requests</p></div><button className={button} onClick={fetchData}>Refresh</button></div>
    <p role="status" className={`text-sm ${connected?'text-green-700':'text-amber-700'}`}>{connected?'Live updates connected':'Live updates disconnected — refresh before acting; reconnecting'}{lastUpdated?` · Last fetched ${lastUpdated.toLocaleTimeString()}`:''}</p>
    <div className="flex flex-wrap gap-4 text-sm"><Link to="/dashboard/purchase-orders">Prepare Purchase Order</Link><Link to="/dashboard/service-requests">Create Service Request</Link><Link to="/dashboard/cash-requests">Create Cash Request</Link><Link to="/dashboard/purchase-requests?tab=reviews">Shared Reviews</Link></div>
    {user.role==='admin'&&<button className={button} onClick={()=>workflowService.inventory().then(setInventory).catch(()=>setError('Cannot load migration inventory'))}>Inspect migration inventory and exceptions</button>}
    {inventory&&<div className="rounded border bg-white p-4"><h2 className="font-semibold">Existing request inventory</h2>{inventory.map(row=><div key={`${row.module}-${row.id}`} className="border-t py-2 text-sm">{labels[row.module]} {row.number} · {row.status} · {row.classification.replaceAll('_',' ')}{row.issues?.length>0&&<p className="text-red-700">{row.issues.join('; ')}</p>}{!row.issues?.length&&<button className="ml-3 text-blue-700 underline" onClick={()=>setParams({kind:row.module,id:String(row.id)})}>Review linked documents</button>}</div>)}</div>}
    {error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}{notice&&<p role="status" className="rounded bg-green-50 p-3 text-green-700">{notice}</p>}
    <div className="rounded-lg border bg-white p-4"><label>Show <select className={`${field} ml-2`} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All accessible requests</option><option value="reviews">Awaiting my review</option>{Object.entries(labels).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Type','Number','Requester','Status','Approval','Total','Action'].map(t=><th key={t} className="px-3 py-2">{t}</th>)}</tr></thead><tbody>{displayed.map(r=><tr key={`${r.module}-${r.id}`} className="border-t"><td className="px-3 py-3">{labels[r.module]}</td><td>{r.number}</td><td>{r.first_name} {r.last_name}</td><td>{displayReviewStatus(r.status)}</td><td>{r.round_number?`Round ${r.round_number} · ${r.approval_status}`:'Needs submission / migration review'}</td><td>{r.total_amount?currency(r.total_amount):'Not submitted'}</td><td><button className={button} onClick={()=>setParams({kind:r.module,id:String(r.id)})}>{r.can_review?'Review':'Open'}</button></td></tr>)}</tbody></table>{!displayed.length&&<p className="py-8 text-gray-500">No matching requests.</p>}</div>
      <p className="mt-3 text-xs text-gray-500">Latest 200 records per module. Use the original module pages for older records.</p>
    </div>
    {detail&&<section className="space-y-4 rounded-lg border bg-white p-5">
      <div className="flex justify-between"><h2 className="text-xl font-semibold">{labels[kind]} {detail.document[kind==='po'?'po_number':kind==='sr'?'sr_number':'cr_number']}</h2><button onClick={()=>setParams({})}>Close</button></div>
      <p>{detail.document.purpose || detail.document.notes || ''}</p><p>Status: {displayReviewStatus(detail.document.status)} · Stage: {displayReviewerRole(detail.round?.stage || 'draft')}</p>
      {detail.round&&<p>Approved/submitted total: {currency(detail.round.total_amount)} · Round {detail.round.round_number}</p>}
      <div className="flex flex-wrap gap-2">
        {owner&&['Draft','Rejected','Returned'].includes(detail.document.status)&&<button disabled={busy} className={button} onClick={()=>perform('submit')}>Submit fresh review round</button>}
        {owner&&['review','hold','rejected'].includes(detail.round?.status)&&<button disabled={busy} className={button} onClick={()=>perform('withdraw')}>Withdraw for correction</button>}
        {owner&&detail.document.status==='Draft'&&<Link className={button} to={`/dashboard/${kind==='po'?'purchase-orders':kind==='sr'?'service-requests':'cash-requests'}`}>Edit in request page</Link>}
      </div>
      {owner&&kind!=='po'&&detail.document.status==='Draft'&&draft&&<div className="space-y-3 rounded border p-4">
        <h3 className="font-semibold">Correct draft</h3>
        <label className="block">Purpose <input className={`${field} w-full`} value={draft.purpose} onChange={e=>setDraft({...draft,purpose:e.target.value})}/></label>
        <label className="block">Description <textarea className={`${field} w-full`} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
        <div className="flex flex-wrap gap-3"><label>Unit price <input className={field} type="number" min="0.01" step="0.01" value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})}/></label><label>Quantity <input className={field} type="number" min="0.01" step="0.01" value={draft.quantity} onChange={e=>setDraft({...draft,quantity:e.target.value})}/></label></div>
        <label className="block">Quoted supplier <select className={`${field} ml-2`} value={draft.supplier_id} onChange={e=>setDraft({...draft,supplier_id:e.target.value})}><option value="">Select supplier</option>{(detail.suppliers || []).map(s=><option key={s.id} value={s.id}>{s.supplier_name}</option>)}</select></label>
        <p>Full total: {currency(Number(draft.amount)*Number(draft.quantity))}</p>
        <h4 className="font-medium">Payment schedules</h4>
        {draft.payment_schedules.map((schedule,index)=><div className="flex flex-wrap gap-2" key={index}><input aria-label={`Payment date ${index+1}`} className={field} type="date" value={schedule.payment_date} onChange={e=>setDraft({...draft,payment_schedules:draft.payment_schedules.map((s,i)=>i===index?{...s,payment_date:e.target.value}:s)})}/><input aria-label={`Payment amount ${index+1}`} className={field} type="number" min="0" step="0.01" value={schedule.amount} onChange={e=>setDraft({...draft,payment_schedules:draft.payment_schedules.map((s,i)=>i===index?{...s,amount:e.target.value}:s)})}/><button onClick={()=>setDraft({...draft,payment_schedules:draft.payment_schedules.filter((_,i)=>i!==index)})}>Remove</button></div>)}
        <div className="flex gap-2"><button className={button} onClick={()=>setDraft({...draft,payment_schedules:[...draft.payment_schedules,{payment_date:'',amount:'',note:''}]})}>Add schedule</button><button className={button} disabled={busy} onClick={()=>perform('draft',draft)}>Save corrections</button></div>
        <p className="text-sm text-gray-600">Save corrections before submitting a fresh review round. Schedules must match the full total.</p>
      </div>}
      {(detail.can_review||detail.round?.status==='hold')&&<div className="flex flex-wrap gap-2"><input aria-label="Review reason" className={field} placeholder="Reason / comment" value={comment} onChange={e=>setComment(e.target.value)}/>{detail.can_review&&<><button disabled={busy} className={button} onClick={()=>perform('review',{decision:'approved',comment})}>Approve</button><button disabled={busy||!comment.trim()} className={button} onClick={()=>perform('review',{decision:'rejected',comment})}>Reject</button><button disabled={busy||!comment.trim()} className={button} onClick={()=>perform('hold',{comment})}>Hold</button></>}{detail.round?.status==='hold'&&<button disabled={busy} className={button} onClick={()=>perform('resume')}>Resolve hold</button>}</div>}
      <h3 className="font-semibold">Review history</h3><ul className="space-y-1 text-sm">{detail.reviews.map(v=><li key={v.id}>Round {detail.history.find(h=>h.id===v.round_id)?.round_number}: {displayReviewerRole(v.stage)} · {v.first_name} {v.last_name} ({displayReviewerRole(v.role)}) · {v.decision}{v.comment?` — ${v.comment}`:''}{!v.is_active?' — inactive; replacement required':''}</li>)}</ul>
      {kind==='cr'&&detail.round?.status==='approved'&&!detail.payment_ready&&<p className="rounded bg-amber-50 p-3 text-sm">Create and approve the linked Payment Request or Payment Order before Admin releases cash.</p>}
      {detail.round?.status==='approved'&&detail.can_upload_receipt&&<div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Receiving / release evidence</h3>
        {kind==='po'&&<div>{detail.items.map(line=><label key={line.id} className="mb-2 flex items-center gap-3">#{line.id} {line.item_name} · received {line.received_quantity||0}/{line.quantity}<input aria-label={`Delivered quantity line ${line.id}`} className={field} type="number" min="0" step="0.01" value={quantity[line.id]||''} onChange={e=>setQuantity({...quantity,[line.id]:e.target.value})}/></label>)}{user.role==='admin'&&<div className="flex gap-2"><input className={field} placeholder="Receiving Engineer employee ID" value={receiver} onChange={e=>setReceiver(e.target.value)}/><button className={button} disabled={busy} onClick={()=>perform('receiver',{receiver_id:Number(receiver)})}>Assign receiver</button></div>}</div>}
        {kind==='cr'&&user.role==='admin'&&<input aria-label="Release amount" className={field} type="number" min="0.01" step="0.01" placeholder="Actual cash release amount" value={amount} onChange={e=>setAmount(e.target.value)}/>}
        <p className="text-sm text-gray-600">{kind==='po'?'Original requester or assigned receiving Engineer uploads delivery receipt; Admin verifies it.':kind==='sr'?'Upload the receipt to confirm that the service has actually been completed. Admin verifies acceptance.':'Admin uploads a signed receipt for the actual release. Original requester confirms cash received.'}</p>
        <input aria-label="Receipt file" type="file" accept="image/png,image/jpeg,application/pdf" onChange={e=>setFile(e.target.files[0]||null)}/><button className={button} disabled={busy||!file} onClick={upload}>{kind==='sr'?'Confirm service complete and upload receipt':kind==='cr'?'Record actual release':'Record delivery receipt'}</button>
      </div>}
      <ul className="space-y-2">{detail.receipts.map(r=><li key={r.id} className="flex flex-wrap items-center gap-3 border-t pt-2">
        <button className="text-blue-700 underline" onClick={()=>workflowService.download(kind,id,r).catch(()=>setError('Receipt download failed'))}>{r.original_name}</button>
        {r.amount&&<span>{currency(r.amount)}</span>}
        <span>{r.status==='returned'?`Returned: ${r.review_comment}`:r.verified_at?'Verified':r.confirmed_at?'Cash confirmed':'Awaiting verification/confirmation'}</span>
        {kind!=='cr'&&user.role==='admin'&&!r.verified_at&&r.status!=='returned'&&<>
          <button className={button} disabled={busy} onClick={()=>perform(`receipts/${r.id}/verify`)}>Verify receipt</button>
          <button className={button} disabled={busy} onClick={()=>{const reason=window.prompt('Receipt correction reason:');if(reason?.trim())perform(`receipts/${r.id}/return`,{comment:reason});}}>Return for correction</button>
        </>}
        {kind==='cr'&&owner&&!r.confirmed_at&&<button className={button} disabled={busy} onClick={()=>perform(`receipts/${r.id}/confirm`)}>Confirm cash received</button>}
      </li>)}</ul>
      {user.role==='admin'&&<div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Existing request migration</h3><p className="text-sm">Review linked documents individually before restarting unpaid/unfulfilled requests. Preserve completed payments and deliveries.</p><button className={button} onClick={loadMigration}>Inspect linked documents</button>{links&&<><ul>{links.map(l=><li className="my-2 flex flex-wrap gap-2" key={`${l.table}-${l.id}`}><span>{l.table} #{l.id} · {l.status}</span><input aria-label={`Disposition ${l.table} ${l.id}`} className={field} placeholder="Disposition / existing payments to preserve" value={linkNotes[`${l.table}-${l.id}`]||''} onChange={e=>setLinkNotes({...linkNotes,[`${l.table}-${l.id}`]:e.target.value})}/></li>)}</ul><textarea className={`${field} w-full`} placeholder="Overall handling decision; explain unpaid/unfulfilled balance and linked documents" value={migrationNote} onChange={e=>setMigrationNote(e.target.value)}/><button className={button} disabled={busy||!migrationNote.trim()} onClick={()=>{if(window.confirm('Restart this request under the new approval flow, preserving prior history?'))perform('migration-restart',{note:migrationNote,links:links.map(l=>({...l,note:linkNotes[`${l.table}-${l.id}`]}))});}}>Record review and restart approval</button></>}</div>}
    </section>}
  </div>;
}
