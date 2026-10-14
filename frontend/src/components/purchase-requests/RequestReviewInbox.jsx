import React, { useMemo, useState } from 'react';
import { Search, ClipboardCheck } from 'lucide-react';
import { Card } from '../ui/Card';
import StatusBadge from '../ui/StatusBadge';
import { useNavigate } from 'react-router-dom';

const formatAmount = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP'
}).format(Number(value) || 0);

const displayName = (record) => `${record.requester_first_name || ''} ${record.requester_last_name || ''}`.trim() || record.requested_by_name || '—';

export default function RequestReviewInbox({ purchaseRequests = [], pettyCashRequests = [], workflowRequests = [], onReviewPurchaseRequest, onReviewPettyCash }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => [
    ...workflowRequests.map(request => ({
      key: `${request.module}-${request.id}`, type: ({po:'Purchase Order',sr:'Service Request',cr:'Cash Request'})[request.module],
      number:request.number,requester:`${request.first_name || ''} ${request.last_name || ''}`.trim(),project:request.project || '—',
      amount:request.total_amount,status:request.status,date:request.updated_at,record:request,
      review:row=>navigate(`/dashboard/workflows?kind=${row.module}&id=${row.id}`)
    })),
    ...purchaseRequests.map((request) => ({
      key: `purchase-${request.id}`,
      type: 'Purchase Request',
      number: request.pr_number || '—',
      requester: displayName(request),
      project: request.project || '—',
      amount: request.total_amount || request.amount,
      status: request.status,
      date: request.date_needed || request.created_at,
      record: request,
      review: onReviewPurchaseRequest
    })),
    ...pettyCashRequests.map((request) => ({
      key: `petty-cash-${request.id}`,
      type: 'Petty Cash Request',
      number: request.cr_number || '—',
      requester: displayName(request),
      project: request.project || '—',
      amount: request.amount,
      status: request.status,
      date: request.date_needed || request.created_at,
      record: request,
      review: onReviewPettyCash
    }))
  ], [purchaseRequests, pettyCashRequests, workflowRequests, onReviewPurchaseRequest, onReviewPettyCash, navigate]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter((row) =>
    `${row.type} ${row.number} ${row.requester} ${row.project} ${row.status}`.toLowerCase().includes(normalizedQuery)
  );
  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return <div className="space-y-4">
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-semibold text-gray-900">Requests awaiting your review</h3><p className="mt-1 text-sm text-gray-500">Assigned Purchase, Petty Cash, Purchase Order, Service and Cash reviews appear here.</p></div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search review requests" placeholder="Search request type, number, requester..." className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/20" />
        </div>
      </div>
    </Card>
    <Card>
      {filteredRows.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px]">
          <thead><tr className="border-b border-gray-200 text-left">
            {['Request Type', 'Request No.', 'Requester', 'Project', 'Amount', 'Status', 'Date needed', 'Action'].map((label) => <th key={label} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</th>)}
          </tr></thead>
          <tbody>{filteredRows.map((row) => <tr key={row.key} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
            <td className="px-4 py-3"><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{row.type}</span></td>
            <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.number}</td>
            <td className="px-4 py-3 text-sm text-gray-700">{row.requester}</td>
            <td className="px-4 py-3 text-sm text-gray-700">{row.project}</td>
            <td className="px-4 py-3 text-sm font-medium tabular-nums text-gray-900">{formatAmount(row.amount)}</td>
            <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            <td className="px-4 py-3 text-sm text-gray-600">{formatDate(row.date)}</td>
            <td className="px-4 py-3"><button type="button" onClick={() => row.review?.(row.record)} className="inline-flex items-center gap-1.5 rounded-md bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600"><ClipboardCheck className="h-3.5 w-3.5" />Review</button></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="px-6 py-14 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500"><ClipboardCheck className="h-5 w-5" /></div>
        <p className="font-medium text-gray-900">{rows.length ? 'No requests match your search' : 'No requests are awaiting your review'}</p>
        <p className="mt-1 text-sm text-gray-500">Requests assigned to you will appear here.</p>
      </div>}
    </Card>
  </div>;
}
