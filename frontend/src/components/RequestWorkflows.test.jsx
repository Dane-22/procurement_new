import React from 'react';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {render,screen,waitFor,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import RequestWorkflows from './RequestWorkflows';
const mocks=vi.hoisted(()=>({user:{id:8,role:'ceo'},list:vi.fn(),get:vi.fn(),action:vi.fn(),upload:vi.fn(),options:vi.fn().mockResolvedValue({}),inventory:vi.fn()}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:mocks.user})}));
vi.mock('../services/requestWorkflows',()=>({workflowService:mocks}));
vi.mock('../services/socket',()=>({socketService:{isConnected:()=>true,on:vi.fn(),off:vi.fn()}}));
const record=()=>({document:{id:2,cr_number:'CR-TEST',requested_by:1,purpose:'Project cash',status:'For Super Admin Final Approval'},round:{id:1,round_number:1,stage:'final',status:'review',total_amount:'100000.00'},history:[{id:1,round_number:1}],reviews:[],receipts:[],events:[],items:[],can_review:true,can_upload_receipt:false});
beforeEach(()=>{cleanup();vi.clearAllMocks();mocks.user={id:8,role:'ceo'};mocks.list.mockResolvedValue([{id:2,module:'cr',number:'CR-TEST',first_name:'Requester',status:'For Super Admin Final Approval',round_number:1,approval_status:'review',total_amount:'100000.00',can_review:1}]);mocks.get.mockResolvedValue(record());mocks.action.mockResolvedValue({message:'Review recorded'});mocks.upload.mockResolvedValue({receipt_id:1});});
const show=()=>render(<MemoryRouter initialEntries={['/dashboard/workflows?kind=cr&id=2']}><RequestWorkflows/></MemoryRouter>);
describe('Request Workflows UI',()=>{
  it('shows assigned review and sends one-role decision with fresh reload',async()=>{
    show();fireEvent.click(await screen.findByRole('button',{name:'Approve',exact:true}));
    await waitFor(()=>expect(mocks.action).toHaveBeenCalledWith('cr','2','review',{decision:'approved',comment:''}));
    await waitFor(()=>expect(mocks.get.mock.calls.length).toBeGreaterThan(1));
  });
  it('requires a reason before rejection',async()=>{
    show();const reject=await screen.findByRole('button',{name:'Reject',exact:true});expect(reject).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Review reason'),{target:{value:'Please correct pricing'}});fireEvent.click(reject);
    await waitFor(()=>expect(mocks.action).toHaveBeenCalledWith('cr','2','review',{decision:'rejected',comment:'Please correct pricing'}));
  });
  it('Admin cash release uploads signed receipt and actual amount',async()=>{
    mocks.user={id:3,role:'admin'};const data=record();data.round.status='approved';data.can_review=false;data.can_upload_receipt=true;data.document.status='Approved';mocks.get.mockResolvedValue(data);
    show();const fileInput=await screen.findByLabelText('Receipt file');const file=new File(['receipt'],'signed.jpg',{type:'image/jpeg'});
    fireEvent.change(fileInput,{target:{files:[file]}});fireEvent.change(screen.getByLabelText('Release amount'),{target:{value:'500.00'}});
    fireEvent.click(screen.getByRole('button',{name:'Record actual release'}));
    await waitFor(()=>expect(mocks.upload).toHaveBeenCalledWith('cr','2',expect.objectContaining({file,amount:'500.00',details:{signed_receipt:true}})));
  });
});
