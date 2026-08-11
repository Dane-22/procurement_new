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
  return formatCurrency(Number(amount) || 0);
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
      'DV Created': 'bg-purple-100 text-purple-800'
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

const PaymentRequestPreviewModal = ({ payment, loading, onClose, onApprove, onHold, processingId }) => {
  if (!payment) return null;

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleApprove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onApprove) {
      onApprove(payment.id);
    }
  };

  const handleHold = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onHold) {
      onHold(payment.id);
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
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Payment Request Preview</h3>
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
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs space-y-1">
              <p><span className="text-gray-500">PR Number:</span> {payment.pr_number || '-'}</p>
              <p><span className="text-gray-500">Date:</span> {formatDate(payment.created_at)}</p>
              <p><span className="text-gray-500">Status:</span> <span className="inline-block ml-1"><StatusBadge status={payment.status} /></span></p>
              <p><span className="text-gray-500">Payee:</span> {payment.payee_name || '-'}</p>
              <p><span className="text-gray-500">Amount:</span> {formatCurrency(payment.amount)}</p>
              <p><span className="text-gray-500">Project:</span> {payment.project || '-'}</p>
              <p><span className="text-gray-500">Order Number:</span> {payment.order_number || '-'}</p>
              <p><span className="text-gray-500">Payment Terms:</span> {formatPaymentTerms(payment)}</p>
              <p><span className="text-gray-500">Schedules:</span> {(payment.payment_schedules || []).length}</p>
              {payment.remarks && <p><span className="text-gray-500">Remarks:</span> {payment.remarks}</p>}
            </div>
          </div>

          {/* Excel-style Form Layout */}
          <div className="hidden md:block border border-gray-300 rounded overflow-hidden">
            {/* Row 1: PR Number and Date */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                PR Number
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm font-mono text-gray-900">
                {payment.pr_number || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Date
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {formatDate(payment.created_at)}
              </div>
            </div>

            {/* Row 2: Status and Payee Address */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Status
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                <StatusBadge status={payment.status} />
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payee Address
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {payment.payee_address || '-'}
              </div>
            </div>

            {/* Row 3: Payee Name and Address */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payee Name
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {payment.payee_name || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payee Address
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {payment.payee_address || '-'}
              </div>
            </div>

            {/* Row 4: Project and Purpose */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Project
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {payment.project || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Purpose
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {payment.purpose || '-'}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payment Terms
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                {formatPaymentTerms(payment)}
              </div>
            </div>

            {/* Row 5: Amount and Order Number */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Amount
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900 font-medium">
                {formatCurrency(payment.amount)}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Order Number
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {payment.order_number || '-'}
              </div>
            </div>

            {/* Row 6: Prepared By and Approved By */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Prepared By
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {payment.requested_by_first_name || payment.requested_by_last_name ? 
                  `${payment.requested_by_first_name || ''} ${payment.requested_by_last_name || ''}`.trim() : '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Approved By
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {payment.approved_by_first_name || payment.approved_by_last_name ? 
                  `${payment.approved_by_first_name || ''} ${payment.approved_by_last_name || ''}`.trim() : '-'}
              </div>
            </div>

            {/* Row 7: Remarks (if present) */}
            {payment.remarks && (
              <div className="grid grid-cols-12">
                <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  Remarks
                </div>
                <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                  {payment.remarks}
                </div>
              </div>
            )}
          </div>

          {Array.isArray(payment.payment_schedules) && payment.payment_schedules.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold text-gray-600 uppercase">Inherited Payment Schedules</p>
              <div className="border border-gray-300 rounded overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Payment Date</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Amount</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.payment_schedules.map((schedule) => (
                      <tr key={schedule.id || `${schedule.payment_date}-${schedule.amount}`} className="border-b border-gray-200 last:border-0">
                        <td className="py-2 px-3 text-sm text-gray-900">{formatDate(schedule.payment_date)}</td>
                        <td className="py-2 px-3 text-sm text-gray-900">{formatScheduleAmount(schedule.amount)}</td>
                        <td className="py-2 px-3 text-sm text-gray-900">{schedule.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Supporting Documents Section */}
          {payment.documents && payment.documents.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Supporting Documents</p>
              <div className="border border-gray-300 rounded overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Document Type</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Reference</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.documents.map((doc, index) => (
                      <tr key={index} className="border-b border-gray-200 last:border-0">
                        <td className="py-2 px-3 text-sm text-gray-900">{doc.type || '-'}</td>
                        <td className="py-2 px-3 text-sm text-gray-900">{doc.reference || '-'}</td>
                        <td className="py-2 px-3 text-sm text-gray-900">{formatDate(doc.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rejection Reason (if rejected) */}
          {payment.rejection_reason && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-xs font-semibold text-red-600 uppercase mb-1">Rejection Reason</p>
              <p className="text-sm text-red-800">{payment.rejection_reason}</p>
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
          {(payment.status === 'Pending Approval' || payment.status === 'On Hold' || payment.status === 'Draft') && (
            <>
              {onHold && (
                <Button 
                  variant="ghost" 
                  className="w-full sm:w-auto"
                  onClick={handleHold}
                  disabled={processingId === payment.id}
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
                  disabled={processingId === payment.id}
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

export default PaymentRequestPreviewModal;
