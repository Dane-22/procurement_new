import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProtectedImage } from './ProtectedAttachment';
import api from '../../services/api';

vi.mock('../../services/api', () => ({default:{defaults:{baseURL:'https://procurement-api.example/api'},get:vi.fn()}}));
beforeEach(() => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:private-receipt');
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => {vi.unstubAllGlobals();vi.clearAllMocks();});

it('loads through the authenticated API client and revokes the preview URL on unmount', async () => {
  api.get.mockResolvedValueOnce({data:new Blob(['private receipt'])});
  const view=render(<ProtectedImage filePath="/uploads/reimbursements/receipt.png" alt="Private receipt" />);
  expect(await screen.findByRole('img',{name:'Private receipt'})).toHaveAttribute('src','blob:private-receipt');
  expect(api.get).toHaveBeenCalledWith('https://procurement-api.example/uploads/reimbursements/receipt.png',{responseType:'blob',cache:false});
  view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-receipt');
});

it('does not send credentials to an attachment URL on another origin', async () => {
  render(<ProtectedImage filePath="https://untrusted.example/uploads/reimbursements/receipt.png" alt="Private receipt" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load');
  expect(api.get).not.toHaveBeenCalled();
});

it('shows denied access and discards the prior preview when the selected file changes', async () => {
  api.get.mockResolvedValueOnce({data:new Blob(['private receipt'])});
  const view=render(<ProtectedImage filePath="/uploads/reimbursements/first.png" alt="Private receipt" />);
  await screen.findByRole('img');
  api.get.mockRejectedValueOnce(new Error('Forbidden'));
  view.rerender(<ProtectedImage filePath="/uploads/reimbursements/second.png" alt="Private receipt" />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Unable to load'));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-receipt');
});
