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
  if (!record) return '-';
  if (record.payment_terms_note) return record.payment_terms_note;
  if (record.payment_term) return record.payment_term;
  if (record.payment_terms_code) return record.payment_terms_code.replace(/_/g, ' ');
  return '-';
};

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Paid': 'bg-blue-100 text-blue-800'
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

const POPreviewModal = ({ po, loading, onClose }) => {
  if (!po) return null;

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Payment Order Preview
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Status:</span>
                  <StatusBadge status={po.status} />
                </div>
                <div className="text-sm text-gray-500">
                  Created: {formatDate(po.created_at)}
                </div>
              </div>

              {/* Main Details Grid */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600 w-1/4">PO NUMBER</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{po.po_number}</td>
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600 w-1/4">DATE</td>
                      <td className="px-4 py-3">{formatDate(po.created_at)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">PAYEE NAME</td>
                      <td className="px-4 py-3">{po.payee_name}</td>
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">PAYEE ADDRESS</td>
                      <td className="px-4 py-3">{po.payee_address || '-'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">PROJECT</td>
                      <td className="px-4 py-3">{po.project || '-'}</td>
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">PURPOSE</td>
                      <td className="px-4 py-3">{po.purpose || '-'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">PROJECT ADDRESS</td>
                      <td className="px-4 py-3">{po.project_address || '-'}</td>
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">ORDER NUMBER</td>
                      <td className="px-4 py-3">{po.order_number || '-'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">AMOUNT</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(po.amount)}</td>
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">SR NUMBER</td>
                      <td className="px-4 py-3">{po.sr_number || '-'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">PAYMENT TERMS</td>
                      <td className="px-4 py-3" colSpan="3">{formatPaymentTerms(po)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-600">PREPARED BY</td>
                      <td className="px-4 py-3" colSpan="3">
                        {po.first_name} {po.last_name}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Remarks Section */}
              {po.remarks && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">Remarks</h4>
                  <p className="text-sm text-yellow-700">{po.remarks}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:justify-end gap-2">
          <Button className="w-full sm:w-auto" variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default POPreviewModal;
