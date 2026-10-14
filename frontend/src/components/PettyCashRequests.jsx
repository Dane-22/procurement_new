import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FilterX, Eye, Pencil, Plus, Search, Send, CheckCircle, XCircle, Banknote, ReceiptText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { pettyCashRequestService } from '../services/pettyCashRequests';
import { projectService } from '../services/projects';
import { displayReviewStatus } from '../utils/reviewLabels';
import { Card } from './ui/Card';
import StatusBadge from './ui/StatusBadge';
import PettyCashPreviewModal from './petty-cash/PettyCashPreviewModal';

const emptyLine = () => ({ description: '', is_priced: false, quantity: '', unit: '', unit_cost: '' });
const emptyExpense = () => ({ expense_date: new Date().toISOString().slice(0, 10), vendor: '', description: '', amount: '', receipt: null });
const emptyForm = () => ({
  payee_name: '', payee_address: '', project: '', project_address: '', order_number: '',
  date_needed: '', purpose: 'PETTY CASH REQUEST', description: '',
  details: [{ description: 'PETTY CASH REQUEST', is_priced: true, quantity: 1, unit: '', unit_cost: '' }]
});
const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
const dateOnly = (value) => value ? String(value).slice(0, 10) : '';
const fieldClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none';
const buttonClass = 'rounded bg-yellow-500 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50';

export default function PettyCashRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showLiquidationForm, setShowLiquidationForm] = useState(false);
  const [liquidationForm, setLiquidationForm] = useState({ expenses: [emptyExpense()], cash_returned: '0', return_reference: '', notes: '' });

  const refresh = async () => {
    const data = await pettyCashRequestService.list();
    setRows(Array.isArray(data) ? data : []);
    return data;
  };

  useEffect(() => {
    let active = true;
    Promise.all([pettyCashRequestService.list(), projectService.getActive()])
      .then(([requests, activeProjects]) => {
        if (!active) return;
        setRows(Array.isArray(requests) ? requests : []);
        setProjects(activeProjects);
      })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Failed to load petty cash requests'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = async (id) => {
    try {
      const cr = await pettyCashRequestService.getById(id);
      setForm({
        payee_name: cr.payee_name || '', payee_address: cr.payee_address || '',
        project: cr.project || '', project_address: cr.project_address || '',
        order_number: cr.order_number || '', date_needed: dateOnly(cr.date_needed),
        purpose: cr.purpose || '', description: cr.description || '',
        details: cr.details.map((line) => ({
          description: line.description, is_priced: Boolean(line.is_priced),
          quantity: line.quantity ?? '', unit: line.unit || '', unit_cost: line.unit_cost ?? ''
        }))
      });
      setEditingId(id);
      setShowForm(true);
      setError('');
    } catch (err) { setError(err.response?.data?.message || 'Failed to open request'); }
  };

  const openDetails = async (id) => {
    try { setSelected(await pettyCashRequestService.getById(id)); }
    catch (err) { setError(err.response?.data?.message || 'Failed to load details'); }
  };

  const updateLine = (index, patch) => setForm((current) => ({
    ...current, details: current.details.map((line, i) => i === index ? { ...line, ...patch } : line)
  }));

  const total = form.details.reduce((sum, line) =>
    sum + (line.is_priced ? (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0) : 0), 0);
  const visibleRows = rows.filter((cr) =>
    (statusFilter === 'all' || cr.status === statusFilter) &&
    `${cr.cr_number} ${cr.payee_name} ${cr.project} ${cr.purpose}`.toLowerCase().includes(query.toLowerCase().trim())
  );
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstVisible = visibleRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min(currentPage * pageSize, visibleRows.length);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editingId) await pettyCashRequestService.update(editingId, form);
      else await pettyCashRequestService.create(form);
      await refresh();
      setShowForm(false);
      setEditingId(null);
    } catch (err) { setError(err.response?.data?.message || 'Failed to save petty cash request'); }
    finally { setBusy(false); }
  };

  const act = async (action, id, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true);
    setError('');
    try {
      await action(id);
      await refresh();
      if (selected?.id === id) setSelected(await pettyCashRequestService.getById(id));
    } catch (err) { setError(err.response?.data?.message || 'Action failed'); }
    finally { setBusy(false); }
  };

  const review = (id, approved) => act(
    () => {
      const remarks = approved ? '' : window.prompt('Reason for rejection:');
      if (!approved && !remarks?.trim()) return Promise.resolve();
      return pettyCashRequestService.review(id, approved ? 'approved' : 'rejected', remarks);
    }, id, approved ? 'Approve this petty cash request?' : null
  );

  const startLiquidation = async (id) => {
    try {
      const request = await pettyCashRequestService.getById(id);
      const current = request.liquidation?.current_submission;
      setSelected(request);
      setLiquidationForm({
        expenses: request.liquidation?.expenses?.length
          ? request.liquidation.expenses.map((expense) => ({ expense_date: dateOnly(expense.expense_date), vendor: expense.vendor || '', description: expense.description, amount: expense.amount, receipt: null }))
          : [emptyExpense()],
        cash_returned: current?.cash_returned ?? '0',
        return_reference: current?.return_reference || '',
        notes: current?.notes || ''
      });
      setShowLiquidationForm(true);
      setError('');
    } catch (err) { setError(err.response?.data?.message || 'Failed to open liquidation form'); }
  };

  const submitLiquidation = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      data.append('expenses', JSON.stringify(liquidationForm.expenses.map(({ receipt: _receipt, ...expense }) => expense)));
      data.append('cash_returned', liquidationForm.cash_returned || '0');
      data.append('return_reference', liquidationForm.return_reference || '');
      data.append('notes', liquidationForm.notes || '');
      liquidationForm.expenses.forEach((expense, index) => {
        if (expense.receipt) data.append(`receipt_${index}`, expense.receipt);
      });
      await pettyCashRequestService.submitLiquidation(selected.id, data);
      await refresh();
      setSelected(await pettyCashRequestService.getById(selected.id));
      setShowLiquidationForm(false);
    } catch (err) { setError(err.response?.data?.message || 'Failed to submit liquidation'); }
    finally { setBusy(false); }
  };

  const reviewLiquidation = async (request, decision) => {
    let requestDetails = request;
    if (decision === 'closed') {
      try { requestDetails = await pettyCashRequestService.getById(request.id); }
      catch (err) { setError(err.response?.data?.message || 'Failed to load liquidation details'); return; }
    }
    let comment = '';
    let verifiedCashReturned = null;
    if (decision === 'returned') {
      comment = window.prompt('What needs to be corrected?') || '';
      if (!comment.trim()) return;
    } else {
      const declared = requestDetails.liquidation?.current_submission?.cash_returned ?? 0;
      const entered = window.prompt('Enter the cash return amount Finance physically verified:', String(declared));
      if (entered === null) return;
      verifiedCashReturned = entered;
      if (!window.confirm('Close this request after verifying all receipts and returned cash?')) return;
    }
    setBusy(true);
    setError('');
    try {
      await pettyCashRequestService.reviewLiquidation(request.id, { decision, comment, verified_cash_returned: verifiedCashReturned });
      await refresh();
      if (selected?.id === request.id) setSelected(await pettyCashRequestService.getById(request.id));
    } catch (err) { setError(err.response?.data?.message || 'Failed to review liquidation'); }
    finally { setBusy(false); }
  };

  const downloadReceipt = async (requestId, receiptId, name) => {
    try {
      const blob = await pettyCashRequestService.downloadLiquidationReceipt(requestId, receiptId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name || 'receipt';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.response?.data?.message || 'Failed to download receipt'); }
  };

  const exportFile = async (cr) => {
    try {
      const blob = await pettyCashRequestService.export(cr.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Petty_Cash_Request_${cr.cr_number}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.response?.data?.message || 'Failed to export request'); }
  };

  const actionButtons = (cr, { includeReview = true, showViewExport = true } = {}) => (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
      {showViewExport && <>
        <button aria-label="View request" title="View request" className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50" onClick={() => openDetails(cr.id)}><Eye className="h-3.5 w-3.5" />View</button>
        <button aria-label="Download Excel" title="Download Excel" className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50" onClick={() => exportFile(cr)}><FileSpreadsheet className="h-3.5 w-3.5" />Excel</button>
      </>}
      {Number(cr.requested_by) === Number(user?.id) && ['Draft', 'Rejected', 'Returned'].includes(cr.status) && <>
        <button aria-label="Edit request" title="Edit request" className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50" onClick={() => openEdit(cr.id)}><Pencil className="h-3.5 w-3.5" />Edit</button>
        <button title="Submit for approval" className="inline-flex items-center gap-1 rounded-md border border-yellow-300 bg-yellow-50 px-2 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-100 disabled:opacity-50" disabled={busy} onClick={() => act(pettyCashRequestService.submit, cr.id, 'Submit this request for approval?')}><Send className="h-3.5 w-3.5" />Submit</button>
      </>}
      {includeReview && Boolean(cr.can_review) && <>
        <button title="Approve request" className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50" disabled={busy} onClick={() => review(cr.id, true)}><CheckCircle className="h-3.5 w-3.5" />Approve</button>
        <button title="Reject request" className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50" disabled={busy} onClick={() => review(cr.id, false)}><XCircle className="h-3.5 w-3.5" />Reject</button>
      </>}
      {['admin', 'super_admin', 'ceo'].includes(user?.role) && cr.status === 'Approved' &&
        <button title="Record cash release" className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50" disabled={busy} onClick={() => act(pettyCashRequestService.release, cr.id, `Record the release of ${money(cr.amount)} to ${cr.payee_name}?`)}><Banknote className="h-3.5 w-3.5" />Record release</button>}
      {Number(cr.requested_by) === Number(user?.id) && cr.status === 'Released' &&
        <button className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => act(pettyCashRequestService.receive, cr.id, `Confirm that ${cr.payee_name} received ${money(cr.release_amount)}?`)}>Confirm receipt</button>}
      {Number(cr.requested_by) === Number(user?.id) && ['Received', 'Liquidation Returned'].includes(cr.status) &&
        <button className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => startLiquidation(cr.id)}>{cr.status === 'Received' ? 'Liquidate' : 'Correct liquidation'}</button>}
      {['admin', 'super_admin', 'ceo'].includes(user?.role) && cr.status === 'Liquidation Submitted' && <>
        <button className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => reviewLiquidation(cr, 'closed')}>Verify & close</button>
        <button className="rounded border px-2 py-1 text-xs text-red-600" disabled={busy} onClick={() => reviewLiquidation(cr, 'returned')}>Return for correction</button>
      </>}
    </div>
  );

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-xl font-semibold text-gray-900">Petty Cash Requests</h1><p className="mt-1 text-sm text-gray-500">Manage cash advances, approvals, releases, and liquidation.</p></div>
      {['engineer', 'admin', 'senior_project_manager', 'super_admin', 'ceo'].includes(user?.role) &&
        <button className={`${buttonClass} inline-flex items-center justify-center gap-2 rounded-lg px-4`} onClick={openNew}><Plus className="h-4 w-4" />Create request</button>}
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

    <Card className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/20" aria-label="Search petty cash requests" placeholder="Search request number, payee, project, purpose..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 sm:w-64" aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
            <option value="all">All statuses</option>
            {[...new Set(rows.map((cr) => cr.status))].map((status) => <option key={status} value={status}>{displayReviewStatus(status)}</option>)}
          </select>
          {(query || statusFilter !== 'all') && <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" onClick={() => { setQuery(''); setStatusFilter('all'); setPage(1); }}><FilterX className="h-4 w-4" />Clear filters</button>}
        </div>
      </div>
      <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">Showing <span className="font-medium text-gray-700">{firstVisible}–{lastVisible}</span> of <span className="font-medium text-gray-700">{visibleRows.length}</span> request{visibleRows.length === 1 ? '' : 's'}</div>
    </Card>

    {loading ? <Card className="p-12 text-center text-sm text-gray-500">Loading petty cash requests...</Card> :
      <Card>
        {visibleRows.length === 0 ? <div className="flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-4 rounded-full bg-yellow-50 p-4 text-yellow-600"><ReceiptText className="h-7 w-7" /></div>
          <h2 className="text-base font-semibold text-gray-900">No petty cash requests found</h2>
          <p className="mt-1 max-w-md text-sm text-gray-500">Try a different search or status filter. You can create a request when you need a project cash advance.</p>
          {(query || statusFilter !== 'all') && <button type="button" className="mt-4 text-sm font-medium text-yellow-700 hover:text-yellow-800" onClick={() => { setQuery(''); setStatusFilter('all'); setPage(1); }}>Clear filters</button>}
        </div> : <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr className="border-b border-gray-200 text-left">
                {['Request', 'Requester', 'Payee', 'Project', 'Amount', 'Status', 'Date needed', 'Actions'].map((label) => <th key={label} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</th>)}
              </tr></thead>
              <tbody>{pageRows.map((cr) => <tr key={cr.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
                <td className="px-4 py-3"><div className="font-medium text-gray-900">{cr.cr_number}</div><div className="mt-0.5 text-xs text-gray-500">Created {dateOnly(cr.created_at) || '—'}</div></td>
                <td className="px-4 py-3 text-sm text-gray-700">{`${cr.requester_first_name || ''} ${cr.requester_last_name || ''}`.trim() || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{cr.payee_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{cr.project || '—'}</td>
                <td className="px-4 py-3 text-sm font-medium tabular-nums text-gray-900">{money(cr.amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={cr.status} /></td>
                <td className="px-4 py-3 text-sm text-gray-600">{dateOnly(cr.date_needed) || '—'}</td>
                <td className="px-4 py-3">{actionButtons(cr)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {pageCount > 1 && <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">Showing {firstVisible}–{lastVisible} of {visibleRows.length} requests</p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 text-sm text-gray-600">Page <span className="font-medium text-gray-900">{currentPage}</span> of {pageCount}</span>
              <button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>}
        </>}
      </Card>}

    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5"><h2 className="text-lg font-semibold">{editingId ? 'Edit' : 'Create'} Petty Cash Request</h2><button onClick={() => setShowForm(false)}>Close</button></div>
        <form onSubmit={save} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Payee *<input className={fieldClass} required value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value })} /></label>
            <label className="text-sm">Payee address<input className={fieldClass} value={form.payee_address} onChange={(e) => setForm({ ...form, payee_address: e.target.value })} /></label>
            <label className="text-sm">Project *<select className={fieldClass} required value={form.project} onChange={(e) => {
              const project = projects.find((item) => (item.branch_name || item.name) === e.target.value);
              setForm({ ...form, project: e.target.value, project_address: project?.address || project?.branch_address || '', order_number: project?.order_number || project?.code || '' });
            }}><option value="">Select project</option>{projects.map((item) => <option key={item.id || item.branch_id} value={item.branch_name || item.name}>{item.branch_name || item.name}</option>)}</select></label>
            <label className="text-sm">Date needed *<input className={fieldClass} type="date" required value={form.date_needed} onChange={(e) => setForm({ ...form, date_needed: e.target.value })} /></label>
            <label className="text-sm">Project address<input className={fieldClass} value={form.project_address} onChange={(e) => setForm({ ...form, project_address: e.target.value })} /></label>
            <label className="text-sm">Order number<input className={fieldClass} value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} /></label>
          </div>
          <label className="block text-sm">Purpose *<input className={fieldClass} required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
          <label className="block text-sm">Additional notes<textarea className={fieldClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div><div className="mb-2 flex justify-between"><h3 className="font-medium">Request details</h3><button type="button" className="text-sm text-blue-700" onClick={() => setForm({ ...form, details: [...form.details, emptyLine()] })}>Add detail</button></div>
            {form.details.map((line, index) => <div key={index} className="mb-2 rounded border p-3">
              <div className="flex items-center justify-between gap-3"><label className="flex-1 text-sm">Description *<input className={fieldClass} required value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} /></label><button type="button" className="text-sm text-red-600" disabled={form.details.length === 1} onClick={() => setForm({ ...form, details: form.details.filter((_, i) => i !== index) })}>Remove</button></div>
              <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={line.is_priced} onChange={(e) => updateLine(index, { is_priced: e.target.checked })} />Priced line</label>
              {line.is_priced && <div className="mt-2 grid grid-cols-3 gap-2"><label className="text-sm">Quantity<input className={fieldClass} type="number" min="0.01" step="0.01" required value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} /></label><label className="text-sm">Unit<input className={fieldClass} value={line.unit} onChange={(e) => updateLine(index, { unit: e.target.value })} /></label><label className="text-sm">Unit cost<input className={fieldClass} type="number" min="0" step="0.01" required value={line.unit_cost} onChange={(e) => updateLine(index, { unit_cost: e.target.value })} /></label></div>}
              {line.is_priced && <p className="mt-1 text-right text-sm">Amount: {money((Number(line.quantity) || 0) * (Number(line.unit_cost) || 0))}</p>}
            </div>)}
            <p className="text-right font-semibold">Grand total: {money(total)}</p>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4"><button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>Cancel</button><button className={buttonClass} disabled={busy || total <= 0} type="submit">{busy ? 'Saving...' : 'Save draft'}</button></div>
        </form>
      </div>
    </div>}

    {selected && <PettyCashPreviewModal request={selected} onClose={() => { setSelected(null); setShowLiquidationForm(false); }} actions={selected.can_review && <>
      <button type="button" className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300" disabled={busy} onClick={() => review(selected.id, false)}><XCircle className="mr-2 h-4 w-4" />Reject</button>
      <button type="button" className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-300" disabled={busy} onClick={() => review(selected.id, true)}><CheckCircle className="mr-2 h-4 w-4" />Approve</button>
    </>}>
      <section className="space-y-3">
      {selected.released_at && <p className="mt-4 text-sm">Released {dateOnly(selected.released_at)}: {money(selected.release_amount)} by {selected.releaser_first_name} {selected.releaser_last_name}</p>}
      {selected.received_at && <p className="mt-1 text-sm">Receipt confirmed {dateOnly(selected.received_at)}</p>}
      {selected.liquidation && <section className="mt-5 rounded border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Expense liquidation</h3><span className="rounded bg-gray-100 px-2 py-1 text-xs">{selected.liquidation.status} · Round {selected.liquidation.current_round}</span></div>
        {selected.liquidation.current_submission && <p className="mt-2 text-sm">Submitted spend: {money(selected.liquidation.current_submission.actual_spent)} · Cash returned: {money(selected.liquidation.current_submission.cash_returned)}{selected.liquidation.current_submission.return_reference ? ` · Ref ${selected.liquidation.current_submission.return_reference}` : ''}</p>}
        {selected.liquidation.finance_comment && <p className="mt-1 text-sm text-red-700">Finance note: {selected.liquidation.finance_comment}</p>}
        <ul className="mt-3 divide-y border-y text-sm">{selected.liquidation.expenses?.map((expense) => <li key={expense.id} className="py-2">
          <div className="flex justify-between gap-3"><span>{dateOnly(expense.expense_date)} · {expense.description}{expense.vendor ? ` · ${expense.vendor}` : ''}</span><span>{money(expense.amount)}</span></div>
          <div className="mt-1 flex flex-wrap gap-2">{expense.receipt_ids?.map((receiptId, index) => <button key={receiptId} type="button" className="text-xs text-blue-700 underline" onClick={() => downloadReceipt(selected.id, receiptId, expense.receipt_names?.[index])}>Receipt: {expense.receipt_names?.[index] || 'Download'}</button>)}</div>
        </li>)}</ul>
        {selected.liquidation.reviews?.length > 0 && <ul className="mt-3 space-y-1 text-xs text-gray-600">{selected.liquidation.reviews.map((entry) => <li key={entry.id}>Finance {entry.decision} by {entry.first_name} {entry.last_name}{entry.comment ? `: ${entry.comment}` : ''}</li>)}</ul>}
        {selected.liquidation.submissions?.length > 1 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Earlier submission rounds</summary><div className="mt-2 space-y-3">{selected.liquidation.submissions.filter((submission) => Number(submission.round_number) !== Number(selected.liquidation.current_round)).map((submission) => <div key={submission.id} className="rounded bg-gray-50 p-3"><p className="font-medium">Round {submission.round_number} · Spend {money(submission.actual_spent)} · Return {money(submission.cash_returned)}</p><ul className="mt-1 space-y-1 text-xs">{submission.expenses.map((expense) => <li key={expense.id} className="flex flex-wrap justify-between gap-2">{dateOnly(expense.expense_date)} · {expense.description} — {money(expense.amount)}<span className="flex gap-2">{expense.receipt_ids?.map((receiptId, index) => <button key={receiptId} type="button" className="text-blue-700 underline" onClick={() => downloadReceipt(selected.id, receiptId, expense.receipt_names?.[index])}>Receipt</button>)}</span></li>)}</ul></div>)}</div></details>}
      </section>}
      {showLiquidationForm && <form onSubmit={submitLiquidation} className="mt-5 space-y-3 rounded border border-yellow-300 bg-yellow-50 p-4">
        <h3 className="font-medium">Submit actual expenses</h3>
        <p className="text-xs text-gray-600">Attach at least one receipt for each expense. Finance will verify the returned cash and close the request when the totals match the release.</p>
        {liquidationForm.expenses.map((expense, index) => <div key={index} className="space-y-2 rounded border bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs">Expense date<input className={fieldClass} type="date" required value={expense.expense_date} onChange={(e) => setLiquidationForm((current) => ({ ...current, expenses: current.expenses.map((row, i) => i === index ? { ...row, expense_date: e.target.value } : row) }))} /></label>
          <label className="text-xs">Amount<input className={fieldClass} type="number" min="0.01" step="0.01" required value={expense.amount} onChange={(e) => setLiquidationForm((current) => ({ ...current, expenses: current.expenses.map((row, i) => i === index ? { ...row, amount: e.target.value } : row) }))} /></label>
          <label className="text-xs">Vendor<input className={fieldClass} value={expense.vendor} onChange={(e) => setLiquidationForm((current) => ({ ...current, expenses: current.expenses.map((row, i) => i === index ? { ...row, vendor: e.target.value } : row) }))} /></label>
          <label className="text-xs">Description<input className={fieldClass} required value={expense.description} onChange={(e) => setLiquidationForm((current) => ({ ...current, expenses: current.expenses.map((row, i) => i === index ? { ...row, description: e.target.value } : row) }))} /></label>
          <label className="text-xs sm:col-span-2">Receipt (PDF or image) *<input className={fieldClass} type="file" accept="image/jpeg,image/png,image/gif,application/pdf" required={!expense.receipt} onChange={(e) => setLiquidationForm((current) => ({ ...current, expenses: current.expenses.map((row, i) => i === index ? { ...row, receipt: e.target.files?.[0] || null } : row) }))} />{expense.receipt && <span className="mt-1 block text-gray-500">{expense.receipt.name}</span>}</label></div>
          <button type="button" className="text-xs text-red-600" disabled={liquidationForm.expenses.length === 1} onClick={() => setLiquidationForm((current) => ({ ...current, expenses: current.expenses.filter((_row, i) => i !== index) }))}>Remove expense</button>
        </div>)}
        <button type="button" className="text-sm text-blue-700" disabled={liquidationForm.expenses.length >= 20} onClick={() => setLiquidationForm((current) => ({ ...current, expenses: [...current.expenses, emptyExpense()] }))}>Add expense</button>
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Cash returned<input className={fieldClass} type="number" min="0" step="0.01" value={liquidationForm.cash_returned} onChange={(e) => setLiquidationForm({ ...liquidationForm, cash_returned: e.target.value })} /></label><label className="text-sm">Return receipt/reference<input className={fieldClass} value={liquidationForm.return_reference} onChange={(e) => setLiquidationForm({ ...liquidationForm, return_reference: e.target.value })} /></label></div>
        <label className="block text-sm">Notes<textarea className={fieldClass} value={liquidationForm.notes} onChange={(e) => setLiquidationForm({ ...liquidationForm, notes: e.target.value })} /></label>
        <div className="flex justify-end gap-2"><button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setShowLiquidationForm(false)}>Cancel</button><button className={buttonClass} disabled={busy}>{busy ? 'Submitting...' : 'Submit to Finance'}</button></div>
      </form>}
      <div className="mt-5">{actionButtons(selected, { includeReview: false, showViewExport: false })}</div>
      </section>
    </PettyCashPreviewModal>}
  </div>;
}
