import React, { useMemo, useState } from 'react';
import { Eye, X, Download, FileText } from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatPaymentTerms = (record) => {
  const note = String(record?.payment_terms_note || '').trim();
  if (note) return note;
  const term = String(record?.payment_term || '').trim();
  if (term) return term;
  const code = String(record?.payment_terms_code || '').trim().toUpperCase();
  if (!code) return '-';
  return code.replace(/_/g, ' ');
};

const formatScheduleAmount = (amount) => {
  if (amount == null || amount === '') return '-';
  return formatCurrency(amount);
};

const getScheduleStatus = (paymentDate) => {
  if (!paymentDate) return { label: '-', color: 'bg-gray-100 text-gray-600' };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const scheduleDate = new Date(paymentDate);
  scheduleDate.setHours(0, 0, 0, 0);
  
  const diffTime = scheduleDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { label: 'Overdue', color: 'bg-red-100 text-red-700' };
  } else if (diffDays === 0) {
    return { label: 'Due Today', color: 'bg-orange-100 text-orange-700' };
  } else if (diffDays <= 7) {
    return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`, color: 'bg-yellow-100 text-yellow-700' };
  } else {
    return { label: 'Upcoming', color: 'bg-green-100 text-green-700' };
  }
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
    Received: 'bg-teal-100 text-teal-800',
    'For Procurement Review': 'bg-orange-100 text-orange-800',
    'For Super Admin Final Approval': 'bg-purple-100 text-purple-800'
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status || '-'}
    </span>
  );
};

const Button = ({ children, variant = 'secondary', size = 'md', onClick, disabled = false, className = '' }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 disabled:bg-yellow-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500 disabled:text-gray-400'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm'
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const getFileUrl = (filePath) => {
  if (!filePath) return null;
  if (String(filePath).startsWith('http')) return filePath;

  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5001');
  const base = String(apiUrl).replace('/api', '');
  return `${base}${filePath}`;
};

const ReimbursementPreviewModal = ({ reimbursement, loading, onClose }) => {
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const attachments = Array.isArray(reimbursement?.attachments) ? reimbursement.attachments : [];

  const summary = useMemo(() => {
    const requesterName = reimbursement?.requester_first_name || reimbursement?.requester_last_name
      ? `${reimbursement.requester_first_name || ''} ${reimbursement.requester_last_name || ''}`.trim()
      : null;
    const approverName = reimbursement?.approver_first_name || reimbursement?.approver_last_name
      ? `${reimbursement.approver_first_name || ''} ${reimbursement.approver_last_name || ''}`.trim()
      : null;

    return { requesterName, approverName };
  }, [reimbursement]);

  if (!reimbursement) return null;

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-yellow-600" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Reimbursement Preview</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Summary banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-gray-900">{reimbursement.rmb_number || 'Reimbursement'}</p>
              <StatusBadge status={reimbursement.status} />
            </div>
            <div className="text-sm text-gray-500">
              Created: {formatDate(reimbursement.created_at)}
            </div>
          </div>

          <div className="md:hidden space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs space-y-1">
              <p><span className="text-gray-500">RMB Number:</span> {reimbursement.rmb_number || '-'}</p>
              <p><span className="text-gray-500">Payee:</span> {reimbursement.payee || '-'}</p>
              <p><span className="text-gray-500">Amount:</span> {formatCurrency(reimbursement.amount)}</p>
              <p><span className="text-gray-500">Project:</span> {reimbursement.project || '-'}</p>
              <p><span className="text-gray-500">Date Needed:</span> {formatDate(reimbursement.date_needed)}</p>
              <p><span className="text-gray-500">Order Number:</span> {reimbursement.order_number || '-'}</p>
              <p><span className="text-gray-500">Payment Terms:</span> {formatPaymentTerms(reimbursement)}</p>
              <p><span className="text-gray-500">Requested By:</span> {summary.requesterName || reimbursement.requested_by || '-'}</p>
              {reimbursement.project_address && <p><span className="text-gray-500">Project Address:</span> {reimbursement.project_address}</p>}
              {reimbursement.purpose && <p><span className="text-gray-500">Purpose:</span> {reimbursement.purpose}</p>}
              {(reimbursement.payment_schedules || []).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-gray-500 mb-1">Payment Schedules:</p>
                  <div className="space-y-1">
                    {(reimbursement.payment_schedules || []).map((schedule) => {
                      const status = getScheduleStatus(schedule.payment_date);
                      return (
                        <div key={schedule.id || `${schedule.payment_date}-${schedule.amount || ''}`} className="flex items-center gap-1.5 text-xs flex-wrap">
                          <span>{formatDate(schedule.payment_date)}</span>
                          <span className="text-gray-400">|</span>
                          <span className="font-medium">{formatScheduleAmount(schedule.amount)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="hidden md:block border border-gray-300 rounded overflow-hidden">
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">RMB Number</div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm font-mono text-gray-900">{reimbursement.rmb_number || '-'}</div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Date</div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">{formatDate(reimbursement.created_at)}</div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Status</div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                <StatusBadge status={reimbursement.status} />
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Amount</div>
              <div className="col-span-4 px-3 py-2 text-sm font-medium text-gray-900">{formatCurrency(reimbursement.amount)}</div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Payee</div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">{reimbursement.payee || '-'}</div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Order Number</div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">{reimbursement.order_number || '-'}</div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Project</div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">{reimbursement.project || '-'}</div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Date Needed</div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">{formatDate(reimbursement.date_needed)}</div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Payment Terms</div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">{formatPaymentTerms(reimbursement)}</div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Payment Schedules</div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                {(reimbursement.payment_schedules || []).length === 0 ? (
                  <p>-</p>
                ) : (
                  <div className="space-y-2">
                    {(reimbursement.payment_schedules || []).map((schedule) => {
                      const status = getScheduleStatus(schedule.payment_date);
                      return (
                        <div key={schedule.id || `${schedule.payment_date}-${schedule.amount || ''}`} className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{formatDate(schedule.payment_date)}</span>
                          <span className="text-gray-400">|</span>
                          <span className="font-medium">{formatScheduleAmount(schedule.amount)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                          {schedule.note && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span className="text-gray-600">{schedule.note}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Project Address</div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">{reimbursement.project_address || '-'}</div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Approved By</div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {summary.approverName || reimbursement.approved_by || '-'}
                {reimbursement.approved_at ? ` on ${formatDate(reimbursement.approved_at)}` : ''}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Purpose</div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">{reimbursement.purpose || '-'}</div>
            </div>

            <div className="grid grid-cols-12">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">Requested By</div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">{summary.requesterName || reimbursement.requested_by || '-'}</div>
            </div>
          </div>

          {reimbursement.remarks && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-yellow-700 uppercase mb-1">Remarks</p>
              <p className="text-sm text-yellow-800">{reimbursement.remarks}</p>
            </div>
          )}

          {reimbursement.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-red-700 uppercase mb-1">Rejection Reason</p>
              <p className="text-sm text-red-800">{reimbursement.rejection_reason}</p>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600 uppercase">Liquidation Attachments</p>
              {loading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              )}
            </div>

            {attachments.length === 0 ? (
              <div className="border border-gray-300 rounded-lg p-4 text-sm text-gray-500">
                No attachments yet
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="divide-y divide-gray-300">
                  {attachments.map((a) => {
                    const fileUrl = getFileUrl(a?.file_path);
                    return (
                      <div key={a.id || a.file_name} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 truncate" title={a.file_name}>
                            {a.file_name || 'Attachment'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {a.uploaded_at ? `Uploaded ${formatDate(a.uploaded_at)}` : '—'}
                            {a.uploaded_by_first_name || a.uploaded_by_last_name
                              ? ` by ${(a.uploaded_by_first_name || '')} ${(a.uploaded_by_last_name || '')}`.trim()
                              : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => setPreviewAttachment(a)} title="Preview">
                            <Eye className="w-4 h-4 text-blue-600" />
                          </Button>
                          {fileUrl && (
                            <a
                              className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 bg-gray-50">
          <Button className="w-full sm:w-auto" variant="secondary" onClick={handleClose}>Close</Button>
        </div>
      </div>

      {/* Attachment preview overlay */}
      {previewAttachment && (
        <div
          className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[60] p-4"
          onClick={() => setPreviewAttachment(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <p className="text-sm font-medium text-gray-900 truncate max-w-md">{previewAttachment.file_name}</p>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-1 hover:bg-gray-100 rounded"
                aria-label="Close attachment preview"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-gray-50">
              {previewAttachment.mime_type?.startsWith('image/') ? (
                <img
                  src={getFileUrl(previewAttachment.file_path)}
                  alt={previewAttachment.file_name}
                  className="max-w-full max-h-[70vh] object-contain"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Preview not available for this file type</p>
                  {getFileUrl(previewAttachment.file_path) && (
                    <a
                      href={getFileUrl(previewAttachment.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Download file
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReimbursementPreviewModal;
