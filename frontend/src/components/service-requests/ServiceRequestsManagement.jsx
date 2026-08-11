import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  CheckCircle, 
  XCircle, 
  ChevronDown,
  ChevronUp,
  Trash2,
  Send,
  Eye,
  Download
} from 'lucide-react';
import SRPreviewModal from './SRPreviewModal';
import { serviceRequestService } from '../../services/serviceRequests';
import { supplierService } from '../../services/suppliers';
import { projectService } from '../../services/projects';
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

const SRTypeBadge = ({ type }) => {
  const styles = {
    'payment_request': 'bg-purple-100 text-purple-800',
    'payment_order': 'bg-green-100 text-green-800'
  };
  const labels = {
    'payment_request': 'Payment Request',
    'payment_order': 'Payment Order'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type] || 'bg-gray-100 text-gray-800'}`}>
      {labels[type] || type}
    </span>
  );
};

const ServiceTypeBadge = ({ type }) => {
  const styles = {
    'Rent': 'bg-blue-100 text-blue-800',
    'Job Order': 'bg-orange-100 text-orange-800',
    'Contractor': 'bg-purple-100 text-purple-800',
    'Service': 'bg-teal-100 text-teal-800',
    'Others': 'bg-gray-100 text-gray-800'
  };
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || 'bg-gray-100 text-gray-800'}`}>
      {type}
    </span>
  );
};

const STATUS_FILTER_OPTIONS = [
  'Draft',
  'For Procurement Review',
  'For Super Admin Final Approval',
  'Approved',
  'Rejected',
  'Cancelled',
  'PO Created',
  'Payment Request Created',
  'Payment Order Created',
  'Paid',
  'Received'
];

const ServiceRequestsManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10) || 20, 1), 100);
  const urlStatus = searchParams.get('status') || 'ALL';
  const urlQ = searchParams.get('q') || '';
  const urlView = searchParams.get('view') || '';

  const [serviceRequests, setServiceRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const hasLoadedListOnce = useRef(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(urlQ);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSR, setSelectedSR] = useState(null);
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSR, setPreviewSR] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const [suppliers, setSuppliers] = useState([]);
  const [expandedSRId, setExpandedSRId] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  // Add supplier selection state for procurement approval
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedSRForApproval, setSelectedSRForApproval] = useState(null);
  const [approvalSupplierId, setApprovalSupplierId] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    purpose: '',
    description: '',
    service_type: 'Service',
    sr_type: 'payment_request',
    quantity: '',
    unit: '',
    project: '',
    project_address: '',
    supplier_id: '',
    amount: '',
    date_needed: '',
    remarks: '',
    order_number: '',
    payment_terms_note: '',
    payment_schedules: [{ payment_date: '', amount: '', note: '' }]
  });
  const [scheduleAmountTouched, setScheduleAmountTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateQueryParams = useCallback((updater, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSearchTerm(urlQ);
    setStatusFilter(urlStatus);
  }, [urlQ, urlStatus]);

  // Only engineers can use view=all; clean up URL for other roles.
  useEffect(() => {
    if (user?.role && user.role !== 'engineer' && urlView) {
      updateQueryParams((p) => {
        p.delete('view');
      }, { replace: true });
    }
  }, [user?.role, urlView, updateQueryParams]);

  useEffect(() => {
    fetchRef.current?.();
    fetchSuppliers();
    fetchBranches();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    console.log('Setting up SR socket listeners');
    
    const handleSRUpdate = (data) => {
      console.log('SR updated (real-time):', data);
      fetchRef.current?.();
    };

    const handleSRStatusChange = (data) => {
      console.log('SR status changed (real-time):', data);
      fetchRef.current?.();
    };

    socketService.on('sr_updated', handleSRUpdate);
    socketService.on('sr_status_changed', handleSRStatusChange);
    
    return () => {
      socketService.off('sr_updated', handleSRUpdate);
      socketService.off('sr_status_changed', handleSRStatusChange);
    };
  }, []);

  useEffect(() => {
    if (formData.sr_type !== 'payment_request') return;
    if (scheduleAmountTouched) return;

    const amountNum = Number(formData.amount);
    const qtyNum = Number(formData.quantity);
    if (!Number.isFinite(amountNum) || !Number.isFinite(qtyNum) || amountNum <= 0 || qtyNum <= 0) return;
    const computed = (amountNum * qtyNum).toFixed(2);

    setFormData((prev) => {
      const schedules = Array.isArray(prev.payment_schedules) ? prev.payment_schedules : [];
      const row0 = schedules[0] || { payment_date: '', amount: '', note: '' };

      const nextSchedules = [...schedules];
      nextSchedules[0] = { ...row0, amount: String(computed) };
      return { ...prev, payment_schedules: nextSchedules };
    });
  }, [formData.sr_type, formData.amount, formData.quantity, scheduleAmountTouched]);

  const fetchBranches = async () => {
    try {
      setLoadingBranches(true)
      const branchList = await projectService.getActive()
      setBranches(branchList)
    } catch (err) {
      console.error('Failed to fetch branches:', err)
      setBranches([])
    } finally {
      setLoadingBranches(false)
    }
  }

  const handleProjectChange = (projectName) => {
    const selectedBranch = branches.find(b => b?.branch_name === projectName)

    setFormData(prev => ({
      ...prev,
      project: projectName,
      project_address: selectedBranch?.address || selectedBranch?.branch_address || '',
      order_number: selectedBranch?.order_number || ''
    }))
  }

  const fetchServiceRequests = useCallback(async () => {
    const isInitialLoad = !hasLoadedListOnce.current;
    try {
      if (isInitialLoad) {
        setInitialLoading(true);
      } else {
        setListLoading(true);
      }
      setError('');

      const view = user?.role === 'engineer' && urlView === 'all' ? 'all' : null;
      const payload = await serviceRequestService.list({
        view,
        page,
        pageSize,
        status: urlStatus !== 'ALL' ? urlStatus : null,
        q: urlQ.trim() ? urlQ.trim() : null
      });

      const rows = Array.isArray(payload?.serviceRequests) ? payload.serviceRequests : [];
      setServiceRequests(rows);
      setTotal(Number.isFinite(payload?.total) ? payload.total : rows.length);
      setExpandedSRId(null);
      hasLoadedListOnce.current = true;
    } catch (err) {
      setError('Failed to fetch service requests');
      console.error('Failed to fetch service requests', err);
    } finally {
      setInitialLoading(false);
      setListLoading(false);
    }
  }, [user?.role, urlView, page, pageSize, urlStatus, urlQ]);

  const fetchRef = useRef(null);
  useEffect(() => {
    fetchRef.current = fetchServiceRequests;
  }, [fetchServiceRequests]);

  useEffect(() => {
    fetchServiceRequests();
  }, [fetchServiceRequests]);

  // Debounced URL update for search input
  useEffect(() => {
    if (searchTerm === urlQ) return;
    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      updateQueryParams((p) => {
        if (trimmed) p.set('q', trimmed);
        else p.delete('q');
        p.set('page', '1');
      }, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, urlQ, updateQueryParams]);

  const totalPages = Math.max(Math.ceil((total || 0) / pageSize) || 1, 1);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = total === 0 ? 0 : Math.min(page * pageSize, total);

  useEffect(() => {
    if (total > 0 && page > totalPages) {
      updateQueryParams((p) => {
        p.set('page', String(totalPages));
      }, { replace: true });
    }
  }, [total, page, totalPages, updateQueryParams]);

  const commitSearchToUrl = ({ replace } = {}) => {
    const trimmed = searchTerm.trim();
    updateQueryParams((p) => {
      if (trimmed) p.set('q', trimmed);
      else p.delete('q');
      p.set('page', '1');
    }, { replace: replace ?? false });
  };

  const handleStatusFilterChange = (nextStatus) => {
    setStatusFilter(nextStatus);
    updateQueryParams((p) => {
      if (nextStatus && nextStatus !== 'ALL') p.set('status', nextStatus);
      else p.delete('status');
      p.set('page', '1');
    }, { replace: false });
  };

  const handlePageSizeChange = (nextPageSize) => {
    updateQueryParams((p) => {
      if (nextPageSize === 20) p.delete('pageSize');
      else p.set('pageSize', String(nextPageSize));
      p.set('page', '1');
    }, { replace: false });
  };

  const handleViewAllChange = (checked) => {
    updateQueryParams((p) => {
      if (checked) p.set('view', 'all');
      else p.delete('view');
      p.set('page', '1');
    }, { replace: false });
  };

  const goToPage = (nextPage) => {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    updateQueryParams((p) => {
      p.set('page', String(clamped));
    }, { replace: false });
  };

  const fetchSuppliers = async () => {
    try {
      const data = await supplierService.getAll();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to fetch suppliers', err);
    }
  };

  const openCreateModal = () => {
    setScheduleAmountTouched(false);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setScheduleAmountTouched(false);
  };

  const sanitizePaymentSchedules = (schedules = []) => {
    const seenDates = new Set();
    const normalized = [];
    for (const row of schedules) {
      const paymentDate = String(row?.payment_date || '').trim();
      const amountRaw = row?.amount;
      const note = String(row?.note || '').trim();
      const hasAnyValue = paymentDate || note || amountRaw !== '' && amountRaw != null;
      if (!hasAnyValue) continue;
      if (!paymentDate) {
        throw new Error('Each payment schedule row must have a payment date');
      }
      if (seenDates.has(paymentDate)) {
        throw new Error(`Duplicate payment schedule date: ${paymentDate}`);
      }
      seenDates.add(paymentDate);
      let amount = null;
      if (amountRaw !== '' && amountRaw != null) {
        const numericAmount = Number(amountRaw);
        if (!Number.isFinite(numericAmount) || numericAmount < 0) {
          throw new Error('Payment schedule amount must be a non-negative number');
        }
        amount = Number(numericAmount.toFixed(2));
      }
      normalized.push({
        payment_date: paymentDate,
        amount,
        note: note || null
      });
    }
    normalized.sort((a, b) => a.payment_date.localeCompare(b.payment_date));
    return normalized;
  };

  const handleCreate = async () => {
    if (!formData.purpose.trim()) {
      alert('Purpose is required');
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
    if (!formData.amount || isNaN(formData.amount) || formData.amount <= 0) {
      alert('Valid amount is required');
      return;
    }

    setSubmitting(true);
    try {
      await serviceRequestService.create({
        ...formData,
        amount: parseFloat(formData.amount),
        quantity: formData.sr_type === 'payment_request' && formData.quantity ? parseFloat(formData.quantity) : null,
        payment_terms_note: formData.payment_terms_note.trim() || null,
        payment_schedules: normalizedSchedules
      });
      closeCreateModal();
      setFormData({
        purpose: '',
        description: '',
        service_type: 'Service',
        sr_type: 'payment_request',
        quantity: '',
        unit: '',
        project: '',
        project_address: '',
        supplier_id: '',
        amount: '',
        date_needed: '',
        remarks: '',
        order_number: '',
        payment_terms_note: '',
        payment_schedules: [{ payment_date: '', amount: '', note: '' }]
      });
      fetchServiceRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create service request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (sr) => {
    if (!confirm('Are you sure you want to submit this service request?')) return;
    
    try {
      await serviceRequestService.submit(sr.id);
      fetchServiceRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit service request');
    }
  };

  const handleMarkAsReceived = async (sr) => {
    if (!confirm('Mark this service request as received?')) return;

    try {
      await serviceRequestService.markAsReceived(sr.id);
      fetchServiceRequests();
      alert('Service request marked as received!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark service request as received');
    }
  };

  // Procurement approval handler
  const handleProcurementApproveClick = (sr) => {
    setSelectedSRForApproval(sr);
    setApprovalSupplierId(sr.supplier_id || '');
    setApprovalRemarks('');
    setShowSupplierModal(true);
  };

  const handleProcurementApprove = async (status, rejectionReason = null) => {
    try {
      await serviceRequestService.procurementApprove(
        selectedSRForApproval.id,
        status,
        approvalSupplierId,
        rejectionReason
      );
      setShowSupplierModal(false);
      setSelectedSRForApproval(null);
      setApprovalSupplierId('');
      setApprovalRemarks('');
      fetchServiceRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve service request');
    }
  };

  // Super Admin approval handler
  const handleSuperAdminApprove = async (sr, status) => {
    const rejectionReason = status === 'rejected' 
      ? prompt('Enter rejection reason:') 
      : null;
    
    if (status === 'rejected' && !rejectionReason) return;

    try {
      await serviceRequestService.superAdminApprove(sr.id, status, rejectionReason);
      fetchServiceRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve service request');
    }
  };

  const handleDelete = async (sr) => {
    if (!confirm('Are you sure you want to delete this service request?')) return;
    
    try {
      await serviceRequestService.delete(sr.id);
      fetchServiceRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete service request');
    }
  };

  const toggleExpand = (srId) => {
    setExpandedSRId(expandedSRId === srId ? null : srId);
  };

  const openPreview = async (sr) => {
    try {
      setPreviewLoading(true);
      setShowPreviewModal(true);
      // Fetch full service request details
      const fullSR = await serviceRequestService.getById(sr.id);
      setPreviewSR(fullSR);
    } catch (err) {
      alert('Failed to load service request details');
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setShowPreviewModal(false);
    setPreviewSR(null);
  };

  const handleExport = async (id, srNumber) => {
    try {
      const blob = await serviceRequestService.exportToExcel(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Service_Request_${srNumber || id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export service request');
    }
  };

  const canCreate = ['engineer', 'admin'].includes(user?.role);
  const canProcurementApprove = ['procurement', 'admin', 'super_admin'].includes(user?.role);
  const canSuperAdminApprove = ['super_admin'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Manage rent, job orders, and contractor services</p>
        </div>
        {canCreate && (
          <Button onClick={openCreateModal} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            New Service Request
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search service requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSearchToUrl({ replace: false });
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:gap-3 sm:items-center">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full sm:min-w-64 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="ALL">All statuses</option>
              {STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="w-full sm:w-28 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              title="Page size"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            {user?.role === 'engineer' && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 select-none">
                <input
                  type="checkbox"
                  checked={urlView === 'all'}
                  onChange={(e) => handleViewAllChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                />
                View all
              </label>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {total === 0 ? '0 Requests' : `Showing ${startItem}-${endItem} of ${total}`}
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Service Requests List */}
      <Card className="relative">
        {initialLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {listLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" />
              </div>
            )}
        <div className="hidden md:block divide-y divide-gray-200">
          {serviceRequests.map((sr) => (
            <div
              key={sr.id}
              className="p-4 hover:bg-gray-50 cursor-pointer"
              onClick={(e) => {
                if (e.target.closest('[data-no-row-toggle="true"]')) return;
                toggleExpand(sr.id);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{sr.sr_number}</p>
                    <StatusBadge status={sr.status} />
                    <SRTypeBadge type={sr.sr_type || 'payment_request'} />
                    <ServiceTypeBadge type={sr.service_type} />
                  </div>
                  <p className="text-sm text-gray-900 mt-1 truncate">{sr.purpose}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                    <span>Amount: ₱{parseFloat(sr.amount).toLocaleString()}</span>
                    {sr.quantity && <span>Qty: {sr.quantity} {sr.unit}</span>}
                    {sr.supplier_name && <span className="truncate max-w-[280px]">Supplier: {sr.supplier_name}</span>}
                    {sr.date_needed && (
                      <span>Needed: {new Date(sr.date_needed).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 ml-2 shrink-0" data-no-row-toggle="true">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview(sr);
                    }}
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(sr.id, sr.sr_number);
                    }}
                    title="Export to Excel"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {(user?.role === 'engineer' || user?.role === 'admin') && sr.status === 'Draft' && sr.requested_by === user?.id && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleSubmit(sr)}>
                        <Send className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(sr)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  {user?.role === 'engineer' &&
                    sr.requested_by === user?.id &&
                    ['PO Created', 'Payment Request Created', 'Payment Order Created', 'Paid'].includes(sr.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsReceived(sr)}
                      title="Mark as Received"
                    >
                      <CheckCircle className="w-4 h-4 text-teal-600" />
                    </Button>
                  )}
                  {canProcurementApprove && sr.status === 'For Procurement Review' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProcurementApproveClick(sr)}
                        title="Review and Approve"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const reason = prompt('Enter rejection reason:');
                          if (reason) {
                            setSelectedSRForApproval(sr);
                            setApprovalSupplierId(sr.supplier_id || '');
                            handleProcurementApprove('rejected', reason);
                          }
                        }}
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  {canSuperAdminApprove && sr.status === 'For Super Admin Final Approval' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuperAdminApprove(sr, 'approved')}
                        title="Final Approve"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuperAdminApprove(sr, 'rejected')}
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(sr.id)}>
                    {expandedSRId === sr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {expandedSRId === sr.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Project:</span>
                      <span className="ml-2 text-gray-900">{sr.project || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Project Address:</span>
                      <span className="ml-2 text-gray-900">{sr.project_address || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Description:</span>
                      <span className="ml-2 text-gray-900">{sr.purpose || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Remarks:</span>
                      <span className="ml-2 text-gray-900">{sr.remarks || '-'}</span>
                    </div>
                    {sr.rejection_reason && (
                      <div className="sm:col-span-2">
                        <span className="text-red-500">Rejection Reason:</span>
                        <span className="ml-2 text-red-700">{sr.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {serviceRequests.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No service requests found
            </div>
          )}
        </div>

        <div className="md:hidden p-3">
          <div className="space-y-3">
            {serviceRequests.map((sr) => (
              <div
                key={sr.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  expandedSRId === sr.id ? 'border-yellow-400 bg-yellow-50/50' : 'border-gray-200 bg-white'
                }`}
                onClick={(e) => {
                  if (e.target.closest('[data-no-row-toggle="true"]')) return;
                  toggleExpand(sr.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">{sr.sr_number}</p>
                    <p className="text-sm font-semibold text-gray-900 break-words mt-0.5">{sr.purpose}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(sr.id);
                    }}
                    data-no-row-toggle="true"
                  >
                    {expandedSRId === sr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <StatusBadge status={sr.status} />
                  <SRTypeBadge type={sr.sr_type || 'payment_request'} />
                  <ServiceTypeBadge type={sr.service_type} />
                </div>

                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p className="font-medium text-gray-700">Amount: ₱{parseFloat(sr.amount).toLocaleString()}</p>
                  {sr.quantity && <p>Qty: {sr.quantity} {sr.unit}</p>}
                  {sr.supplier_name && <p className="break-words">Supplier: {sr.supplier_name}</p>}
                  {sr.date_needed && <p>Needed: {new Date(sr.date_needed).toLocaleDateString()}</p>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5" data-no-row-toggle="true">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview(sr);
                    }}
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(sr.id, sr.sr_number);
                    }}
                    title="Export to Excel"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {(user?.role === 'engineer' || user?.role === 'admin') && sr.status === 'Draft' && sr.requested_by === user?.id && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleSubmit(sr)} title="Submit">
                        <Send className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(sr)} title="Delete">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  {user?.role === 'engineer' &&
                    sr.requested_by === user?.id &&
                    ['PO Created', 'Payment Request Created', 'Payment Order Created', 'Paid'].includes(sr.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsReceived(sr)}
                      title="Mark as Received"
                    >
                      <CheckCircle className="w-4 h-4 text-teal-600" />
                    </Button>
                  )}
                  {canProcurementApprove && sr.status === 'For Procurement Review' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProcurementApproveClick(sr)}
                        title="Review and Approve"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const reason = prompt('Enter rejection reason:');
                          if (reason) {
                            setSelectedSRForApproval(sr);
                            setApprovalSupplierId(sr.supplier_id || '');
                            handleProcurementApprove('rejected', reason);
                          }
                        }}
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  {canSuperAdminApprove && sr.status === 'For Super Admin Final Approval' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuperAdminApprove(sr, 'approved')}
                        title="Final Approve"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuperAdminApprove(sr, 'rejected')}
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>

                {expandedSRId === sr.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-xs text-gray-600">
                    <p><span className="text-gray-500">Project:</span> <span className="text-gray-900">{sr.project || '-'}</span></p>
                    <p><span className="text-gray-500">Project Address:</span> <span className="text-gray-900">{sr.project_address || '-'}</span></p>
                    <p><span className="text-gray-500">Description:</span> <span className="text-gray-900">{sr.purpose || '-'}</span></p>
                    <p><span className="text-gray-500">Remarks:</span> <span className="text-gray-900">{sr.remarks || '-'}</span></p>
                    {sr.rejection_reason && (
                      <p><span className="text-red-500">Rejection Reason:</span> <span className="text-red-700">{sr.rejection_reason}</span></p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {serviceRequests.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No service requests found
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-500">
              {total === 0 ? '0 Requests' : `Showing ${startItem}-${endItem} of ${total}`}
            </div>

            {totalPages > 1 && (
              <>
                <div className="sm:hidden">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1 || listLoading}
                      onClick={() => goToPage(page - 1)}
                    >
                      Prev
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 3 }, (_, i) => page - 1 + i)
                        .filter((p) => p >= 1 && p <= totalPages)
                        .map((p) => (
                          <Button
                            key={`mobile-page-${p}`}
                            variant={p === page ? 'primary' : 'secondary'}
                            size="sm"
                            disabled={listLoading}
                            onClick={() => goToPage(p)}
                          >
                            {p}
                          </Button>
                        ))}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= totalPages || listLoading}
                      onClick={() => goToPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Page {page} of {totalPages}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || listLoading}
                    onClick={() => goToPage(page - 1)}
                  >
                    Prev
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => page - 2 + i)
                      .filter((p) => p >= 1 && p <= totalPages)
                      .map((p) => (
                        <Button
                          key={p}
                          variant={p === page ? 'primary' : 'secondary'}
                          size="sm"
                          disabled={listLoading}
                          onClick={() => goToPage(p)}
                        >
                          {p}
                        </Button>
                      ))}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages || listLoading}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next
                  </Button>

                  <span className="text-sm text-gray-500 ml-2">
                    Page {page} of {totalPages}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
          </>
        )}
      </Card>

      {/* Preview Modal */}
      <SRPreviewModal
        sr={previewSR}
        loading={previewLoading}
        onClose={closePreview}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[92vh] overflow-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create Service Request</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Enter purpose of this service request"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Type *</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                >
                  <option value="Rent">Rent</option>
                  <option value="Job Order">Job Order</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Service">Service</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SR Type *</label>
                <select
                  value={formData.sr_type}
                  onChange={(e) => setFormData({ ...formData, sr_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                >
                  <option value="payment_request">Payment Request (Amount + Quantity)</option>
                  <option value="payment_order">Payment Order (Amount Only)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.sr_type === 'payment_request' 
                    ? 'Requires quantity and unit (e.g., 10 hours, 5 days)' 
                    : 'Amount only - no quantity tracking'}
                </p>
              </div>

              {/* Quantity/Unit fields - only for Payment Request */}
              {formData.sr_type === 'payment_request' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="e.g., 10"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="e.g., hours, days, pcs"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Detailed description of the service needed"
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
                    placeholder="0.00"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                  <select
                    value={formData.project}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    disabled={loadingBranches || branches.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                  >
                    <option value="">
                      {loadingBranches ? 'Loading...' : branches.length === 0 ? 'No projects available' : 'Select project'}
                    </option>
                    {branches.map((branch, index) => (
                      <option key={branch?.id ?? index} value={branch?.branch_name || ''}>{branch?.branch_name || ''}</option>
                    ))}
                  </select>
                  {branches.length === 0 && !loadingBranches && (
                    <p className="text-xs text-red-500 mt-1">Failed to load projects. Please refresh the page.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Supplier</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                  >
                    <option value="">Select supplier (optional)</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.supplier_name || supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Address</label>
                <input
                  type="text"
                  value={formData.project_address}
                  onChange={(e) => setFormData({ ...formData, project_address: e.target.value })}
                  placeholder="Enter project address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
                <input
                  type="text"
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  placeholder="Order number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <textarea
                  value={formData.payment_terms_note}
                  onChange={(e) => setFormData({ ...formData, payment_terms_note: e.target.value })}
                  rows="3"
                  placeholder="Optional payment terms narrative"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">Payment Schedules *</label>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto !hidden"
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
                  <div key={`sr-schedule-${index}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-2 items-end border border-gray-200 rounded-md p-2 sm:p-0 sm:border-0">
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
                        onChange={(e) => {
                          if (index === 0) setScheduleAmountTouched(true);
                          setFormData((prev) => ({
                            ...prev,
                            payment_schedules: prev.payment_schedules.map((row, i) => i === index ? { ...row, amount: e.target.value } : row)
                          }));
                        }}
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
              <Button className="w-full sm:w-auto" variant="secondary" onClick={closeCreateModal} disabled={submitting}>
                Cancel
              </Button>
              <Button className="w-full sm:w-auto" onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Procurement Approval Modal - Supplier Selection */}
      {showSupplierModal && selectedSRForApproval && (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Procurement Review - {selectedSRForApproval.sr_number}</h2>
              <p className="text-sm text-gray-500 mt-1">Select supplier and confirm approval</p>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
                <textarea
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Any remarks for final approval..."
                />
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setShowSupplierModal(false)}>
                Cancel
              </Button>
              <Button 
                className="w-full sm:w-auto"
                onClick={() => handleProcurementApprove('approved')} 
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

export default ServiceRequestsManagement;
