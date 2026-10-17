import { beforeEach, expect, it, vi } from 'vitest';
import api from './api';
import { cashRequestService } from './cashRequests';
vi.mock('./api',()=>({default:{get:vi.fn(),post:vi.fn(),put:vi.fn()}}));
beforeEach(()=>vi.resetAllMocks());

it('withdraws a rejected CR before editing and submitting a fresh round',async()=>{
  api.get.mockResolvedValue({data:{cashRequest:{status:'Rejected'}}});
  api.post.mockResolvedValue({data:{status:'For Engineer Review'}});
  api.put.mockResolvedValue({data:{}});
  const data={purpose:'Corrected purpose'};
  await cashRequestService.resubmit(5,data);
  expect(api.post.mock.calls.map(args=>args[0])).toEqual(['/workflows/cr/5/withdraw','/workflows/cr/5/submit']);
  expect(api.put).toHaveBeenCalledWith('/cash-requests/5',data);
  expect(api.post.mock.invocationCallOrder[0]).toBeLessThan(api.put.mock.invocationCallOrder[0]);
  expect(api.put.mock.invocationCallOrder[0]).toBeLessThan(api.post.mock.invocationCallOrder[1]);
});

it('retries a Draft after an earlier correction or submit failure without withdrawing it again',async()=>{
  api.get.mockResolvedValue({data:{cashRequest:{status:'Draft'}}});
  api.post.mockResolvedValue({data:{status:'For Engineer Review'}});
  api.put.mockResolvedValue({data:{}});
  await cashRequestService.resubmit(5,{purpose:'Retry correction'});
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/workflows/cr/5/submit');
});
