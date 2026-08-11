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

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending Approval': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'On Hold': 'bg-orange-100 text-orange-800',
      'Cancelled': 'bg-gray-100 text-gray-600',
      'Completed': 'bg-green-100 text-green-800'
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

const POPreviewModal = ({ po, loading, onClose, onApprove, onHold, processingId }) => {
  if (!po) return null;

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleApprove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onApprove) {
      onApprove(po.id);
    }
  };

  const handleHold = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onHold) {
      onHold(po.id);
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
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Purchase Order Preview</h3>
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
              <p><span className="text-gray-500">PO Number:</span> {po.po_number || '-'}</p>
              <p><span className="text-gray-500">Date:</span> {formatDate(po.created_at)}</p>
              <p><span className="text-gray-500">Status:</span> <span className="inline-block ml-1"><StatusBadge status={po.status} /></span></p>
              <p><span className="text-gray-500">Supplier:</span> {po.supplier_name || '-'}</p>
              <p><span className="text-gray-500">PR Number:</span> {po.pr_number || '-'}</p>
              <p><span className="text-gray-500">Project:</span> {po.project || '-'}</p>
              <p><span className="text-gray-500">Amount:</span> {formatCurrency(po.total_amount)}</p>
              <p><span className="text-gray-500">Payment Term:</span> {po.payment_term || '-'}</p>
            </div>
          </div>

          {/* Excel-style Form Layout */}
          <div className="hidden md:block border border-gray-300 rounded overflow-hidden">
            {/* Row 1: PO Number and Date */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                PO Number
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm font-mono text-gray-900">
                {po.po_number}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Date
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {formatDate(po.created_at)}
              </div>
            </div>

            {/* Row 2: PR Number and Status */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                PR Number
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {po.pr_number || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Status
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                <StatusBadge status={po.status} />
              </div>
            </div>

            {/* Row 3: Supplier Name and Address */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Supplier
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {po.supplier_name || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Supplier Address
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {po.supplier_address || po.place_of_delivery || '-'}
              </div>
            </div>

            {/* Row 4: Project and Delivery Location */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Project
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {po.project || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Delivery Location
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {po.place_of_delivery || '-'}
              </div>
            </div>

            {/* Row 5: Delivery Term and Payment Term */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Delivery Term
              </div>
              <div className="col-span-4 px-3 py-2 border-r border-gray-300 text-sm text-gray-900">
                {po.delivery_term || '-'}
              </div>
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Payment Term
              </div>
              <div className="col-span-4 px-3 py-2 text-sm text-gray-900">
                {po.payment_term || '-'}
              </div>
            </div>

            {/* Row 6: Prepared By */}
            <div className="grid grid-cols-12 border-b border-gray-300">
              <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                Prepared By
              </div>
              <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                {po.prepared_by_first_name || po.prepared_by_last_name ? 
                  `${po.prepared_by_first_name || ''} ${po.prepared_by_last_name || ''}`.trim() : '-'}
              </div>
            </div>

            {/* Row 7: Notes (if present) */}
            {po.notes && (
              <div className="grid grid-cols-12">
                <div className="col-span-2 px-3 py-2 border-r border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  Notes
                </div>
                <div className="col-span-10 px-3 py-2 text-sm text-gray-900">
                  {po.notes}
                </div>
              </div>
            )}
          </div>

          {/* Items Table - Excel Style */}
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Items</p>
            {loading ? (
              <div className="flex items-center justify-center py-8 border border-gray-300 rounded">
                <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : po.items && po.items.length > 0 ? (
              <div className="border border-gray-300 rounded overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase border-r border-gray-300 w-16">QTY</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase border-r border-gray-300 w-20">UNIT</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase border-r border-gray-300">DESCRIPTION</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase border-r border-gray-300 w-28">UNIT COST</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase w-28">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((item, index) => {
                      const unitCost = item.unit_price || item.unit_cost || 0;
                      const amount = item.total_price || (item.quantity * unitCost) || item.amount || 0;
                      return (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="py-2 px-3 text-sm text-gray-900 border-r border-gray-200">{item.quantity}</td>
                          <td className="py-2 px-3 text-sm text-gray-900 border-r border-gray-200">{item.unit || '-'}</td>
                          <td className="py-2 px-3 text-sm text-gray-900 border-r border-gray-200">{item.item_name || item.description || item.item_code || '-'}</td>
                          <td className="py-2 px-3 text-sm text-gray-900 text-right border-r border-gray-200">{formatCurrency(unitCost)}</td>
                          <td className="py-2 px-3 text-sm text-gray-900 text-right">{formatCurrency(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-300">
                    <tr>
                      <td colSpan="4" className="py-2 px-3 text-sm font-semibold text-gray-900 text-right border-r border-gray-300">
                        TOTAL
                      </td>
                      <td className="py-2 px-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(po.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border border-gray-300 rounded p-4 text-center text-sm text-gray-500">
                No items
              </div>
            )}
          </div>
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
          {(po.status === 'Pending Approval' || po.status === 'On Hold' || po.status === 'Draft') && (
            <>
              {onHold && (
                <Button 
                  variant="ghost" 
                  className="w-full sm:w-auto"
                  onClick={handleHold}
                  disabled={processingId === po.id}
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
                  disabled={processingId === po.id}
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

export default POPreviewModal;
