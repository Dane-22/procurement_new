import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Upload,
  Eye,
  X,
  Download
} from 'lucide-react';
import { reimbursementService } from '../../services/reimbursements';
import { projectService } from '../../services/projects';
import { useAuth } from '../../contexts/AuthContext';
import ReimbursementPreviewModal from './ReimbursementPreviewModal';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>{children}</div>
);

const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '' }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 disabled:bg-yellow-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm'
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    Draft: 'bg-gray-100 text-gray-800',
    Pending: 'bg-yellow-100 text-yellow-800',
    'For Approval': 'bg-blue-100 text-blue-800',
    'For Purchase': 'bg-purple-100 text-purple-800',
    'Payment Order Created': 'bg-indigo-100 text-indigo-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Cancelled: 'bg-gray-100 text-gray-500',
    Paid: 'bg-green-100 text-green-800',
    Received: 'bg-teal-100 text-teal-800'
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

const ReimbursementsManagement = () => {
  const { user } = useAuth();

  const [reimbursements, setReimbursements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [expandedId, setExpandedId] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    payee: '',
    purpose: '',
    project: '',
    project_address: '',
    order_number: '',
    payment_terms_note: '',
    payment_schedules: [{ payment_date: '', amount: '', note: '' }],
    amount: '',
    date_needed: '',
    remarks: ''
  });

  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const openCreateModal = async () => {
    setShowCreateModal(true);
    setLoadingBranches(true);
    try {
      const branchList = await projectService.getActive();
      setBranches(branchList);
    } catch (err) {
      console.error('Failed to load branches', err);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleProjectChange = (e) => {
    const branchId = e.target.value;
    const branch = branches.find(b => b.id === parseInt(branchId) || b.branch_id === parseInt(branchId));
    if (branch) {
      setFormData({
        ...formData,
        project: branch.branch_name || branch.name || '',
        project_address: branch.address || branch.branch_address || '',
        order_number: branch.order_number || branch.code || ''
      });
    } else {
      setFormData({
        ...formData,
        project: '',
        project_address: '',
        order_number: ''
      });
    }
  };

  const canCreate = ['engineer', 'procurement', 'admin', 'super_admin'].includes(user?.role);

  const sanitizePaymentSchedules = (schedules = []) => {
    const seenDates = new Set();
    const normalized = [];
    for (const row of schedules) {
      const paymentDate = String(row?.payment_date || '').trim();
      const amountRaw = row?.amount;
      const note = String(row?.note || '').trim();
      const hasAnyValue = paymentDate || note || amountRaw !== '' && amountRaw != null;
      if (!hasAnyValue) continue;
      if (!paymentDate) throw new Error('Each payment schedule row must have a payment date');
      if (seenDates.has(paymentDate)) throw new Error(`Duplicate payment schedule date: ${paymentDate}`);
      seenDates.add(paymentDate);
      let amount = null;
      if (amountRaw !== '' && amountRaw != null) {
        const numericAmount = Number(amountRaw);
        if (!Number.isFinite(numericAmount) || numericAmount < 0) {
          throw new Error('Payment schedule amount must be a non-negative number');
        }
        amount = Number(numericAmount.toFixed(2));
      }
      normalized.push({ payment_date: paymentDate, amount, note: note || null });
    }
    normalized.sort((a, b) => a.payment_date.localeCompare(b.payment_date));
    return normalized;
  };

  const [uploadingForId, setUploadingForId] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const [previewReimbursement, setPreviewReimbursement] = useState(null);
  const [previewReimbursementDetails, setPreviewReimbursementDetails] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchReimbursements = async () => {
    try {
      setLoading(true);
      const data = await reimbursementService.getAll();
      setReimbursements(data);
      setError('');
    } catch (e) {
      console.error(e);
      setError('Failed to fetch reimbursements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReimbursements();
  }, []);

  useEffect(() => {
    const handleReimbursementsChanged = () => {
      fetchReimbursements();
    };

    window.addEventListener('reimbursements:changed', handleReimbursementsChanged);
    return () => {
      window.removeEventListener('reimbursements:changed', handleReimbursementsChanged);
    };
  }, []);

  const openPreview = async (r) => {
    setPreviewReimbursement(r);
    setLoadingPreview(true);
    try {
      const details = await reimbursementService.getById(r.id);
      setPreviewReimbursementDetails(details);
    } catch (err) {
      console.error('Failed to fetch reimbursement details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewReimbursement(null);
    setPreviewReimbursementDetails(null);
    setLoadingPreview(false);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return reimbursements;
    return reimbursements.filter(r =>
      String(r.rmb_number || '').toLowerCase().includes(q) ||
      String(r.payee || '').toLowerCase().includes(q) ||
      String(r.purpose || '').toLowerCase().includes(q)
    );
  }, [reimbursements, searchTerm]);

  const toggleExpand = async (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleCreate = async () => {
    if (!formData.payee.trim()) {
      alert('Payee is required');
      return;
    }
    const amt = parseFloat(formData.amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert('Valid amount is required');
      return;
    }
    let normalizedSchedules = [];
    try {
      normalizedSchedules = sanitizePaymentSchedules(formData.payment_schedules || []);
    } catch (err) {
      alert(err.message || 'Invalid payment schedules');
      return;
    }
    if (normalizedSchedules.length === 0) {
      alert('At least one payment schedule is required');
      return;
    }

    try {
      setSubmitting(true);
      await reimbursementService.create({
        ...formData,
        payment_terms_note: formData.payment_terms_note.trim() || null,
        payment_schedules: normalizedSchedules,
        amount: amt
      });
      setShowCreateModal(false);
      setFormData({
        payee: '',
        purpose: '',
        project: '',
        project_address: '',
        order_number: '',
        payment_terms_note: '',
        payment_schedules: [{ payment_date: '', amount: '', note: '' }],
        amount: '',
        date_needed: '',
        remarks: ''
      });
      await fetchReimbursements();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to create reimbursement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (r) => {
    if (!confirm('Submit this reimbursement request?')) return;
    try {
      await reimbursementService.submit(r.id);
      await fetchReimbursements();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to submit');
    }
  };

  const handleApprove = async (r, status) => {
    const rejectionReason = status === 'rejected' ? prompt('Enter rejection reason:') : null;
    if (status === 'rejected' && !rejectionReason) return;

    try {
      await reimbursementService.approve(r.id, status, rejectionReason);
      await fetchReimbursements();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to approve/reject');
    }
  };

  const handleDelete = async (r) => {
    if (!confirm('Delete this reimbursement request?')) return;
    try {
      await reimbursementService.delete(r.id);
      await fetchReimbursements();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete');
    }
  };

  const handleMarkAsReceived = async (r) => {
    if (!confirm('Mark this reimbursement as received?')) return;
    try {
      await reimbursementService.markAsReceived(r.id);
      await fetchReimbursements();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to mark reimbursement as received');
    }
  };

  const handleUpload = async (reimbursementId, files) => {
    if (!files || files.length === 0) return;

    try {
      setUploadingForId(reimbursementId);
      await reimbursementService.uploadAttachments(reimbursementId, files);
      await fetchReimbursements();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to upload');
    } finally {
      setUploadingForId(null);
    }
  };

  const handleDeleteAttachment = async (reimbursementId, attachmentId) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await reimbursementService.deleteAttachment(reimbursementId, attachmentId);
      await fetchReimbursements();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete attachment');
    }
  };

  const handleExport = async (id, rmbNumber) => {
    try {
      const blob = await reimbursementService.exportToExcel(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RMB-${rmbNumber}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to export reimbursement: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reimbursements</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Standalone reimbursement requests with liquidation attachments</p>
        </div>
        {canCreate && (
          <Button onClick={openCreateModal} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            New Reimbursement
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search reimbursements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <Card>
        <div className="hidden md:block divide-y divide-gray-200">
          {filtered.map((r) => (
            <div key={r.id} className="p-4 hover:bg-gray-50">
              <div
                className="flex items-start justify-between gap-3 cursor-pointer"
                onClick={(e) => {
                  if (e.target.closest('[data-no-row-toggle="true"]')) return;
                  toggleExpand(r.id);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{r.rmb_number}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-gray-900 mt-1 truncate">{r.purpose || r.payee}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                    <span>Payee: {r.payee}</span>
                    <span>Amount: ₱{parseFloat(r.amount || 0).toLocaleString()}</span>
                    {r.project && <span className="truncate max-w-[280px]">Project: {r.project}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1 ml-2 shrink-0" data-no-row-toggle="true">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openPreview(r)}
                    title="Preview"
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                  </Button>
                  {['engineer', 'procurement'].includes(user?.role) && r.status === 'Draft' && r.requested_by === user?.id && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleSubmit(r)}>
                        <Send className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}

                  {user?.role === 'engineer' &&
                    r.requested_by === user?.id &&
                    ['Payment Order Created', 'Paid'].includes(r.status) && (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkAsReceived(r)} title="Mark as Received">
                      <CheckCircle className="w-4 h-4 text-teal-600" />
                    </Button>
                  )}

                  {/* Procurement can approve when status is 'For Procurement Review' */}
                  {user?.role === 'procurement' && r.status === 'For Procurement Review' && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(r, 'approved')} title="Approve">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(r, 'rejected')} title="Reject">
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}

                  {/* Admin/Super Admin can approve when status is 'For Super Admin Final Approval' or other pending states */}
                  {['admin', 'super_admin'].includes(user?.role) && (r.status === 'For Procurement Review' || r.status === 'For Super Admin Final Approval' || r.status === 'Pending') && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(r, 'approved')} title="Approve">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(r, 'rejected')} title="Reject">
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(r.id)}>
                    {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {expandedId === r.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Project Address:</span>
                      <span className="ml-2 text-gray-900">{r.project_address || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Order Number:</span>
                      <span className="ml-2 text-gray-900">{r.order_number || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Date Needed:</span>
                      <span className="ml-2 text-gray-900">{r.date_needed ? new Date(r.date_needed).toLocaleDateString() : '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Remarks:</span>
                      <span className="ml-2 text-gray-900">{r.remarks || '-'}</span>
                    </div>
                    {r.rejection_reason && (
                      <div className="sm:col-span-2">
                        <span className="text-red-500">Rejection Reason:</span>
                        <span className="ml-2 text-red-700">{r.rejection_reason}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">Liquidation Attachments</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(r.id, r.rmb_number)}
                          title="Export to Excel"
                        >
                          <Download className="w-4 h-4 text-green-600" />
                        </Button>
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleUpload(r.id, Array.from(e.target.files || []))}
                            disabled={uploadingForId === r.id}
                          />
                          <span className="inline-flex items-center text-sm text-gray-700 hover:text-gray-900">
                            <Upload className="w-4 h-4 mr-1" />
                            {uploadingForId === r.id ? 'Uploading...' : 'Upload'}
                          </span>
                        </label>
                      </div>
                    </div>

                    {Array.isArray(r.attachments) && r.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {r.attachments.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded">
                            <span
                              className="text-sm text-blue-600 hover:underline truncate cursor-pointer min-w-0"
                              onClick={() => setPreviewAttachment(a)}
                              title={a.file_name}
                            >
                              {a.file_name}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewAttachment(a)}
                                title="Preview"
                              >
                                <Eye className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAttachment(r.id, a.id)}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No attachments yet</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500">No reimbursements found</div>
          )}
        </div>

        <div className="md:hidden p-3">
          <div className="space-y-3">
            {filtered.map((r) => (
              <div
                key={r.id}
                className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                  expandedId === r.id ? 'border-yellow-400 bg-yellow-50/50' : 'border-gray-200 bg-white'
                }`}
                onClick={(e) => {
                  if (e.target.closest('[data-no-row-toggle="true"]')) return;
                  toggleExpand(r.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">{r.rmb_number}</p>
                    <p className="text-sm font-semibold text-gray-900 break-words mt-0.5">{r.purpose || r.payee}</p>
                  </div>
                  <Button variant="ghost" size="sm" data-no-row-toggle="true" onClick={() => toggleExpand(r.id)}>
                    {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="mt-2">
                  <StatusBadge status={r.status} />
                </div>

                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p>Payee: <span className="text-gray-800">{r.payee || '-'}</span></p>
                  <p className="font-medium text-gray-700">Amount: ₱{parseFloat(r.amount || 0).toLocaleString()}</p>
                  {r.project && <p className="break-words">Project: {r.project}</p>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5" data-no-row-toggle="true">
                  <Button variant="ghost" size="sm" onClick={() => openPreview(r)} title="Preview">
                    <Eye className="w-4 h-4 text-blue-600" />
                  </Button>
                  {['engineer', 'procurement'].includes(user?.role) && r.status === 'Draft' && r.requested_by === user?.id && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleSubmit(r)} title="Submit">
                        <Send className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r)} title="Delete">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  {user?.role === 'engineer' &&
                    r.requested_by === user?.id &&
                    ['Payment Order Created', 'Paid'].includes(r.status) && (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkAsReceived(r)} title="Mark as Received">
                      <CheckCircle className="w-4 h-4 text-teal-600" />
                    </Button>
                  )}
                  {user?.role === 'procurement' && r.status === 'For Procurement Review' && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(r, 'approved')} title="Approve">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(r, 'rejected')} title="Reject">
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  {['admin', 'super_admin'].includes(user?.role) && (r.status === 'For Procurement Review' || r.status === 'For Super Admin Final Approval' || r.status === 'Pending') && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(r, 'approved')} title="Approve">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(r, 'rejected')} title="Reject">
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>

                {expandedId === r.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><span className="text-gray-500">Project Address:</span> <span className="text-gray-900">{r.project_address || '-'}</span></p>
                      <p><span className="text-gray-500">Order Number:</span> <span className="text-gray-900">{r.order_number || '-'}</span></p>
                      <p><span className="text-gray-500">Date Needed:</span> <span className="text-gray-900">{r.date_needed ? new Date(r.date_needed).toLocaleDateString() : '-'}</span></p>
                      <p><span className="text-gray-500">Remarks:</span> <span className="text-gray-900">{r.remarks || '-'}</span></p>
                      {r.rejection_reason && (
                        <p><span className="text-red-500">Rejection Reason:</span> <span className="text-red-700">{r.rejection_reason}</span></p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">Liquidation Attachments</p>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleExport(r.id, r.rmb_number)} title="Export to Excel">
                            <Download className="w-4 h-4 text-green-600" />
                          </Button>
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => handleUpload(r.id, Array.from(e.target.files || []))}
                              disabled={uploadingForId === r.id}
                            />
                            <span className="inline-flex items-center text-sm text-gray-700 hover:text-gray-900">
                              <Upload className="w-4 h-4 mr-1" />
                              {uploadingForId === r.id ? 'Uploading...' : 'Upload'}
                            </span>
                          </label>
                        </div>
                      </div>

                      {Array.isArray(r.attachments) && r.attachments.length > 0 ? (
                        <div className="space-y-2">
                          {r.attachments.map((a) => (
                            <div key={a.id} className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded">
                              <span
                                className="text-xs text-blue-600 hover:underline truncate cursor-pointer min-w-0"
                                onClick={() => setPreviewAttachment(a)}
                                title={a.file_name}
                              >
                                {a.file_name}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="sm" onClick={() => setPreviewAttachment(a)} title="Preview">
                                  <Eye className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteAttachment(r.id, a.id)} title="Delete">
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No attachments yet</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-8 text-center text-gray-500">No reimbursements found</div>
            )}
          </div>
        </div>
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[92vh] overflow-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create Reimbursement</h2>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payee *</label>
                <input
                  type="text"
                  value={formData.payee}
                  onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Needed</label>
                  <input
                    type="date"
                    value={formData.date_needed}
                    onChange={(e) => setFormData({ ...formData, date_needed: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                  <select
                    value={branches.find(b => b.branch_name === formData.project || b.name === formData.project)?.id || branches.find(b => b.branch_name === formData.project || b.name === formData.project)?.branch_id || ''}
                    onChange={handleProjectChange}
                    disabled={loadingBranches}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                  >
                    <option value="">{loadingBranches ? 'Loading...' : 'Select a project'}</option>
                    {branches.map(b => (
                      <option key={b.id || b.branch_id} value={b.id || b.branch_id}>
                        {b.branch_name || b.name || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
                  <input
                    type="text"
                    value={formData.order_number}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Address</label>
                <input
                  type="text"
                  value={formData.project_address}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <textarea
                  rows={3}
                  value={formData.payment_terms_note}
                  onChange={(e) => setFormData({ ...formData, payment_terms_note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Optional payment terms narrative"
                />
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">Payment Schedules *</label>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      payment_schedules: [...(prev.payment_schedules || []), { payment_date: '', amount: '', note: '' }]
                    }))}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Date
                  </Button>
                </div>
                {(formData.payment_schedules || []).map((schedule, index) => (
                  <div key={`rmb-schedule-${index}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-2 items-end border border-gray-200 rounded-md p-2 sm:p-0 sm:border-0">
                    <div className="sm:col-span-4">
                      <label className="block text-xs text-gray-500 mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={schedule.payment_date}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          payment_schedules: prev.payment_schedules.map((row, i) => i === index ? { ...row, payment_date: e.target.value } : row)
                        }))}
                        className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs text-gray-500 mb-1">Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={schedule.amount}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          payment_schedules: prev.payment_schedules.map((row, i) => i === index ? { ...row, amount: e.target.value } : row)
                        }))}
                        placeholder="Optional"
                        className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs text-gray-500 mb-1">Note</label>
                      <input
                        type="text"
                        value={schedule.note}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          payment_schedules: prev.payment_schedules.map((row, i) => i === index ? { ...row, note: e.target.value } : row)
                        }))}
                        placeholder="Optional"
                        className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setFormData((prev) => ({
                          ...prev,
                          payment_schedules: prev.payment_schedules.length === 1
                            ? [{ payment_date: '', amount: '', note: '' }]
                            : prev.payment_schedules.filter((_, i) => i !== index)
                        }))}
                        title="Remove schedule row"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setShowCreateModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button className="w-full sm:w-auto" onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </Card>
        </div>
      )}
      {/* Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewAttachment(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <p className="text-sm font-medium text-gray-900 truncate max-w-md">{previewAttachment.file_name}</p>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-gray-50">
              {previewAttachment.mime_type?.startsWith('image/') ? (
                <img
                  src={previewAttachment.file_path?.startsWith('http') ? previewAttachment.file_path : `${(import.meta.env.VITE_API_URL || 'http://localhost:5001').replace('/api', '')}${previewAttachment.file_path}`}
                  alt={previewAttachment.file_name}
                  className="max-w-full max-h-[70vh] object-contain"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Preview not available for this file type</p>
                  <a
                    href={previewAttachment.file_path?.startsWith('http') ? previewAttachment.file_path : `${(import.meta.env.VITE_API_URL || 'http://localhost:5001').replace('/api', '')}${previewAttachment.file_path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reimbursement Preview Modal */}
      {previewReimbursement && (
        <ReimbursementPreviewModal
          reimbursement={previewReimbursementDetails || previewReimbursement}
          loading={loadingPreview}
          onClose={closePreview}
        />
      )}
    </div>
  );
};

export default ReimbursementsManagement;
