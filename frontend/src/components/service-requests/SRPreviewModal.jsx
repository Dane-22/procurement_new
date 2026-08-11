import React from 'react';
import { X, CheckCircle, Clock, FileText } from 'lucide-react';

// Format helpers
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
  if (!paymentDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(paymentDate);
  date.setHours(0, 0, 0, 0);
  
  if (date < today) return { label: 'OVERDUE', color: 'text-red-600 font-semibold' };
  if (date.getTime() === today.getTime()) return { label: 'DUE TODAY', color: 'text-orange-600 font-semibold' };
  return { label: 'UPCOMING', color: 'text-blue-600' };
};

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending Approval': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'On Hold': 'bg-orange-100 text-orange-800',
      'Cancelled': 'bg-gray-100 text-gray-600',
      'Completed': 'bg-green-100 text-green-800',
      'Paid': 'bg-blue-100 text-blue-800',
      'PO Created': 'bg-purple-100 text-purple-800',
      'Payment Request Created': 'bg-indigo-100 text-indigo-800',
      'Payment Order Created': 'bg-indigo-100 text-indigo-800',
      'Received': 'bg-teal-100 text-teal-800',
      'In Progress': 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  );
};

const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '' }) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 disabled:bg-yellow-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const SRPreviewModal = ({ sr, loading, onClose, onApprove, onHold, processingId, readOnly }) => {
  if (!sr) return null;

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleApprove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onApprove) {
      onApprove(sr.id);
    }
  };

  const handleHold = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onHold) {
      onHold(sr.id);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-yellow-600" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Service Request Preview</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="md:hidden space-y-3 mb-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500">SR Number</p>
              <p className="text-sm font-semibold text-gray-900 break-words">{sr.sr_number || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <p className="text-gray-500">Date</p>
                <p className="text-gray-900">{formatDate(sr.created_at)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <p className="text-gray-500">Status</p>
                <div className="mt-1"><StatusBadge status={sr.status} /></div>
              </div>
            </div>
            <div className="space-y-1 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
              <p><span className="text-gray-500">Payee:</span> {sr.supplier_name || '-'}</p>
              <p><span className="text-gray-500">Project:</span> {sr.project || '-'}</p>
              <p><span className="text-gray-500">Purpose:</span> {sr.purpose || '-'}</p>
              <p><span className="text-gray-500">Amount:</span> {formatCurrency(sr.amount)}</p>
              <p><span className="text-gray-500">Order Number:</span> {sr.order_number || '-'}</p>
              <p><span className="text-gray-500">Payment Terms:</span> {formatPaymentTerms(sr)}</p>
              {sr.remarks && <p><span className="text-gray-500">Remarks:</span> {sr.remarks}</p>}
            </div>
          </div>

          {/* Excel-style Form Layout */}
          <div className="hidden md:block border border-gray-300 rounded overflow-hidden">
            {/* Row 1: SR Number and Date */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                SR Number
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm font-mono text-gray-900">
                {sr.sr_number}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Date
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {formatDate(sr.created_at)}
              </div>
            </div>

            {/* Row 2: Status */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Status
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                <StatusBadge status={sr.status} />
              </div>
            </div>

            {/* Row 3: Supplier Name and Address */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payee Name
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {sr.supplier_name || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payee Address
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {sr.supplier_address || '-'}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payment Terms
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">
                {formatPaymentTerms(sr)}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payment Schedules
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                {(sr.payment_schedules || []).length === 0 ? (
                  <p>-</p>
                ) : (
                  <div className="space-y-1">
                    {(sr.payment_schedules || []).map((schedule) => {
                      const status = getScheduleStatus(schedule.payment_date);
                      return (
                        <p key={schedule.id || `${schedule.payment_date}-${schedule.amount || ''}`}>
                          {formatDate(schedule.payment_date)} | {formatScheduleAmount(schedule.amount)}{schedule.note ? ` | ${schedule.note}` : ''}
                          {status && <span className={`ml-2 text-xs ${status.color}`}>({status.label})</span>}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Row 4: Project and Purpose */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Project
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {sr.project || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Purpose
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {sr.purpose || '-'}
              </div>
            </div>

            {/* Row 5: Project Address and Order Number */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Project Address
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {sr.project_address || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Order Number
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {sr.order_number || '-'}
              </div>
            </div>

            {/* Row 6: Amount */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Amount
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900 font-medium">
                {formatCurrency(sr.amount)}
              </div>
            </div>

            {/* Row 7: Prepared By */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Prepared By
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                {sr.requester_first_name || sr.requester_last_name ? 
                  `${sr.requester_first_name || ''} ${sr.requester_last_name || ''}`.trim() : '-'}
              </div>
            </div>

            {/* Row 8: Remarks (if present) */}
            {sr.remarks && (
              <div className="grid grid-cols-12">
                <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  Remarks
                </div>
                <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                  {sr.remarks}
                </div>
              </div>
            )}
          </div>

          {/* Rejection Reason (if rejected) */}
          {sr.rejection_reason && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-xs font-semibold text-red-600 uppercase mb-1">Rejection Reason</p>
              <p className="text-sm text-red-800">{sr.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 bg-gray-50">
          <Button 
            variant="secondary" 
            className="w-full sm:w-auto"
            onClick={handleClose}
          >
            Close
          </Button>
          {(sr.status === 'Pending Approval' || sr.status === 'On Hold' || sr.status === 'Draft') && !readOnly && (
            <>
              {onHold && (
                <Button 
                  variant="ghost" 
                  className="w-full sm:w-auto"
                  onClick={handleHold}
                  disabled={processingId === sr.id}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Hold
                </Button>
              )}
              {onApprove && (
                <Button 
                  variant="success" 
                  className="w-full sm:w-auto"
                  onClick={handleApprove}
                  disabled={processingId === sr.id}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SRPreviewModal;
