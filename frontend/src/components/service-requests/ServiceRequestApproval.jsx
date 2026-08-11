import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { serviceRequestService } from '../../services/serviceRequests';
import { supplierService } from '../../services/suppliers';
import { useAuth } from '../../contexts/AuthContext';
import { socketService } from '../../services/socket';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  disabled = false,
  className = '' 
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 disabled:bg-yellow-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    'Draft': 'bg-gray-100 text-gray-800',
    'For Procurement Review': 'bg-yellow-100 text-yellow-800',
    'For Super Admin Final Approval': 'bg-blue-100 text-blue-800',
    'Approved': 'bg-green-100 text-green-800',
    'Rejected': 'bg-red-100 text-red-800',
    'Cancelled': 'bg-gray-100 text-gray-500',
    'PO Created': 'bg-purple-100 text-purple-800',
    'Payment Request Created': 'bg-indigo-100 text-indigo-800',
    'Payment Order Created': 'bg-indigo-100 text-indigo-800',
    'Paid': 'bg-green-100 text-green-800',
    'Received': 'bg-teal-100 text-teal-800'
  };
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

const ServiceRequestApproval = () => {
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [expandedSRId, setExpandedSRId] = useState(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedSRForApproval, setSelectedSRForApproval] = useState(null);
  const [approvalSupplierId, setApprovalSupplierId] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchServiceRequestsForReview();
    fetchSuppliers();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    console.log('ServiceRequestApproval: Setting up socket listeners');
    
    const handleSRUpdate = (data) => {
      console.log('ServiceRequestApproval: SR updated (real-time):', data);
      fetchServiceRequestsForReview();
    };

    const handleSRStatusChange = (data) => {
      console.log('ServiceRequestApproval: SR status changed (real-time):', data);
      fetchServiceRequestsForReview();
    };

    socketService.on('sr_updated', handleSRUpdate);
    socketService.on('sr_status_changed', handleSRStatusChange);
    
    return () => {
      socketService.off('sr_updated', handleSRUpdate);
      socketService.off('sr_status_changed', handleSRStatusChange);
    };
  }, []);

  const fetchServiceRequestsForReview = async () => {
    try {
      setLoading(true);
      const pageSize = 100;
      const all = [];
      let page = 1;
      let total = Infinity;

      while (all.length < total) {
        const payload = await serviceRequestService.list({
          page,
          pageSize,
          status: 'For Procurement Review'
        });

        const rows = Array.isArray(payload?.serviceRequests) ? payload.serviceRequests : [];
        total = Number.isFinite(payload?.total) ? payload.total : rows.length;
        all.push(...rows);

        if (rows.length < pageSize) break;
        page += 1;
        if (page > 1000) break;
      }

      // De-dupe by id (in case data changes mid-pagination)
      const unique = new Map();
      for (const sr of all) unique.set(sr.id, sr);

      setServiceRequests(Array.from(unique.values()));
    } catch (err) {
      setError('Failed to fetch service requests');
      console.error('Failed to fetch service requests', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const data = await supplierService.getAll();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to fetch suppliers', err);
    }
  };

  const handleApproveClick = (sr) => {
    setSelectedSRForApproval(sr);
    setApprovalSupplierId(sr.supplier_id || '');
    setShowSupplierModal(true);
  };

  const handleApprove = async () => {
    try {
      await serviceRequestService.procurementApprove(
        selectedSRForApproval.id,
        'approved',
        approvalSupplierId
      );
      setShowSupplierModal(false);
      setSelectedSRForApproval(null);
      setApprovalSupplierId('');
      fetchServiceRequestsForReview();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve service request');
    }
  };

  const handleReject = async (sr) => {
    const rejectionReason = prompt('Enter rejection reason:');
    if (!rejectionReason) return;

    try {
      await serviceRequestService.procurementApprove(
        sr.id,
        'rejected',
        null,
        rejectionReason
      );
      fetchServiceRequestsForReview();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject service request');
    }
  };

  const toggleExpand = (srId) => {
    setExpandedSRId(expandedSRId === srId ? null : srId);
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service Request Approval</h1>
        <p className="text-gray-500 mt-1">Review SRs and forward to Super Admin for final approval</p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Service Requests Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SR Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {serviceRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No service requests awaiting your approval
                  </td>
                </tr>
              ) : (
                serviceRequests.map((sr) => (
                  <React.Fragment key={sr.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{sr.sr_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {sr.requester_first_name} {sr.requester_last_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{sr.purpose}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={sr.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        ₱{parseFloat(sr.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleApproveClick(sr)}
                            title="Approve to Super Admin"
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleReject(sr)}
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4 text-red-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleExpand(sr.id)}>
                            {expandedSRId === sr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedSRId === sr.id && (
                      <tr className="bg-gray-50">
                        <td colSpan="6" className="px-4 py-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Project:</span>
                              <span className="ml-2 text-gray-900">{sr.project || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Project Address:</span>
                              <span className="ml-2 text-gray-900">{sr.project_address || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Service Type:</span>
                              <span className="ml-2 text-gray-900">{sr.service_type}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Date Needed:</span>
                              <span className="ml-2 text-gray-900">
                                {sr.date_needed ? new Date(sr.date_needed).toLocaleDateString() : '-'}
                              </span>
                            </div>
                            {sr.quantity && (
                              <div>
                                <span className="text-gray-500">Quantity:</span>
                                <span className="ml-2 text-gray-900">{sr.quantity} {sr.unit}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Description:</span>
                              <span className="ml-2 text-gray-900">{sr.description || '-'}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Supplier Selection Modal */}
      {showSupplierModal && selectedSRForApproval && (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Approve Service Request - {selectedSRForApproval.sr_number}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Select supplier and confirm approval to Super Admin</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                <select
                  value={approvalSupplierId}
                  onChange={(e) => setApprovalSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_name || supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowSupplierModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleApprove} 
                disabled={!approvalSupplierId}
              >
                Approve to Super Admin
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ServiceRequestApproval;
