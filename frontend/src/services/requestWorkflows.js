import api from './api';
export const workflowService = {
  list: async()=> (await api.get('/workflows',{cache:false})).data.requests,
  get: async(kind,id)=> (await api.get(`/workflows/${kind}/${id}`,{cache:false})).data,
  action: async(kind,id,action,body={})=>(await api.post(`/workflows/${kind}/${id}/${action}`,body)).data,
  upload: async(kind,id,{file,details,amount,eventKey})=>{
    const form=new FormData();form.append('receipt',file);form.append('details',JSON.stringify(details));form.append('event_key',eventKey);if(amount)form.append('amount',amount);
    return (await api.post(`/workflows/${kind}/${id}/receipts`,form,{headers:{'Content-Type':'multipart/form-data'}})).data;
  },
  download: async(kind,id,receipt)=>{
    const response=await api.get(`/workflows/${kind}/${id}/receipts/${receipt.id}/download`,{responseType:'blob',cache:false});
    const url=URL.createObjectURL(response.data),link=document.createElement('a');link.href=url;link.download=receipt.original_name;link.click();URL.revokeObjectURL(url);
  },
  migration: async(kind,id)=>(await api.get(`/workflows/${kind}/${id}/migration`,{cache:false})).data,
  inventory: async()=>(await api.get('/workflows/migration/inventory',{cache:false})).data.requests,
  options: async()=>(await api.get('/workflows/reference/options',{cache:true})).data,
};
