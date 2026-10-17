import React from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import ServiceRequests from '../src/components/service-requests/ServiceRequestsManagement';
vi.mock('../src/contexts/AuthContext',()=>({useAuth:()=>({user:{id:21,role:'engineer'}})}));
vi.mock('../src/services/socket',()=>({socketService:{on:vi.fn(),off:vi.fn(),isConnected:()=>true}}));
vi.mock('../src/services/serviceRequests',()=>({serviceRequestService:{list:vi.fn().mockResolvedValue({serviceRequests:[],total:0})}}));
vi.mock('../src/services/suppliers',()=>({supplierService:{getAll:vi.fn().mockResolvedValue({suppliers:[{id:1,supplier_name:'Synthetic supplier'}],total:1,page:1,pageSize:20}),getAllForSelect:vi.fn().mockResolvedValue([{id:1,supplier_name:'Synthetic supplier'}])}}));
vi.mock('../src/services/projects',()=>({projectService:{getActive:vi.fn().mockResolvedValue([{branch_name:'Synthetic project',order_number:'FLOW01'}])}}));
class CaptureError extends React.Component{
 state={error:null};
 static getDerivedStateFromError(error){return {error};}
 render(){return this.state.error?<div role="alert">Form crashed: {this.state.error.message}</div>:this.props.children;}
}
it('engineer can open New Service Request with the real paginated supplier response shape',async()=>{
 render(<MemoryRouter><CaptureError><ServiceRequests/></CaptureError></MemoryRouter>);
 const create=await screen.findByRole('button',{name:'New Service Request',exact:true});
 fireEvent.click(create);
 expect(await screen.findByRole('heading',{name:'Create Service Request',exact:true})).toBeVisible();
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
