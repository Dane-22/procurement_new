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
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending Approval': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'On Hold': 'bg-orange-100 text-orange-800',
      'Cancelled': 'bg-gray-100 text-gray-600',
      'Completed': 'bg-green-100 text-green-800',
      'DV Created': 'bg-purple-100 text-purple-800',
      'For Super Admin Final Approval': 'bg-yellow-100 text-yellow-800'
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

const CRPreviewModal = ({ cr, loading, onClose, onApprove, onHold, processingId, readOnly }) => {
  if (!cr) return null;

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleApprove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onApprove) {
      onApprove(cr.id);
    }
  };

  const handleHold = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onHold) {
      onHold(cr.id);
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
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Cash Request Preview</h3>
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
              <p><span className="text-gray-500">CR Number:</span> {cr.cr_number || '-'}</p>
              <p><span className="text-gray-500">Date:</span> {formatDate(cr.created_at)}</p>
              <p><span className="text-gray-500">Status:</span> <span className="inline-block ml-1"><StatusBadge status={cr.status} /></span></p>
              <p><span className="text-gray-500">Project:</span> {cr.project || '-'}</p>
              <p><span className="text-gray-500">Purpose:</span> {cr.purpose || '-'}</p>
              <p><span className="text-gray-500">Amount:</span> {formatCurrency(cr.amount)}</p>
              <p><span className="text-gray-500">Supplier:</span> {cr.supplier_name || '-'}</p>
              <p><span className="text-gray-500">Payment Terms:</span> {formatPaymentTerms(cr)}</p>
              {(cr.payment_schedules || []).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-gray-500 mb-1">Payment Schedules:</p>
                  <div className="space-y-1">
                    {(cr.payment_schedules || []).map((schedule) => {
                      const status = getScheduleStatus(schedule.payment_date);
                      return (
                        <div key={schedule.id || `${schedule.payment_date}-${schedule.amount || ''}`} className="flex items-center gap-1.5 flex-wrap">
                          <span>{formatDate(schedule.payment_date)}</span>
                          <span className="text-gray-400">|</span>
                          <span>{formatScheduleAmount(schedule.amount)}</span>
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

          {/* Excel-style Form Layout */}
          <div className="hidden md:block border border-gray-300 rounded overflow-hidden">
            {/* Row 1: CR Number and Date */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                CR Number
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm font-mono text-gray-900">
                {cr.cr_number}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Date
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {formatDate(cr.created_at)}
              </div>
            </div>

            {/* Row 2: Status */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Status
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                <StatusBadge status={cr.status} />
              </div>
            </div>

            {/* Row 3: Project and Project Address */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Project
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {cr.project || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Project Address
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {cr.project_address || '-'}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payment Terms
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">
                {formatPaymentTerms(cr)}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payment Schedules
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                {(cr.payment_schedules || []).length === 0 ? (
                  <p>-</p>
                ) : (
                  <div className="space-y-2">
                    {(cr.payment_schedules || []).map((schedule) => {
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

            {/* Row 4: Purpose and Supplier */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Purpose
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {cr.purpose || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Supplier
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {cr.supplier_name || '-'}
              </div>
            </div>

            {/* Row 5: Quantity and Unit */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Quantity
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {cr.quantity ? `${cr.quantity} ${cr.unit || ''}` : '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Date Needed
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {formatDate(cr.date_needed)}
              </div>
            </div>

            {/* Row 6: Amount */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Amount
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900 font-medium">
                {formatCurrency(cr.amount)}
              </div>
            </div>

            {/* Row 7: Order Number */}
            {cr.order_number && (
              <div className="grid grid-cols-12 border-b border-gray-300">
                <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  Order Number
                </div>
                <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                  {cr.order_number}
                </div>
              </div>
            )}

            {/* Row 8: Prepared By and Approved By */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Prepared By
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {cr.prepared_by_first_name || cr.prepared_by_last_name ? 
                  `${cr.prepared_by_first_name || ''} ${cr.prepared_by_last_name || ''}`.trim() : '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Approved By
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {cr.approved_by_first_name || cr.approved_by_last_name ? 
                  `${cr.approved_by_first_name || ''} ${cr.approved_by_last_name || ''}`.trim() : '-'}
              </div>
            </div>

            {/* Row 9: Remarks (if present) */}
            {cr.remarks && (
              <div className="grid grid-cols-12">
                <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  Remarks
                </div>
                <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                  {cr.remarks}
                </div>
              </div>
            )}
          </div>

          {/* Rejection Reason (if rejected) */}
          {cr.rejection_reason && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-xs font-semibold text-red-600 uppercase mb-1">Rejection Reason</p>
              <p className="text-sm text-red-800">{cr.rejection_reason}</p>
            </div>
          )}

          {/* Super Admin Remarks (if present) */}
          {cr.super_admin_remarks && (
            <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs font-semibold text-yellow-600 uppercase mb-1">Super Admin Remarks</p>
              <p className="text-sm text-yellow-800">{cr.super_admin_remarks}</p>
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
          {(cr.status === 'For Super Admin Final Approval' || cr.status === 'On Hold' || cr.status === 'Draft') && !readOnly && (
            <>
              {onHold && (
                <Button 
                  variant="ghost" 
                  className="w-full sm:w-auto"
                  onClick={handleHold}
                  disabled={processingId === cr.id}
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
                  disabled={processingId === cr.id}
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

export default CRPreviewModal;
