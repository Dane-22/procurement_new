import React, { useState, useEffect } from 'react';
import { purchaseOrderService } from '../../services/purchaseOrders';
import { purchaseRequestService } from '../../services/purchaseRequests';
import { paymentRequestService } from '../../services/paymentRequests';
import { serviceRequestService } from '../../services/serviceRequests';
import { disbursementVoucherService } from '../../services/disbursementVouchers';
import { cashRequestService } from '../../services/cashRequests';
import { paymentOrderService } from '../../services/paymentOrders';
import { reimbursementService } from '../../services/reimbursements';
import api from '../../services/api';
import { socketService } from '../../services/socket';
import PRPreviewModal from '../purchase-requests/PRPreviewModal';
import POPreviewModal from '../purchase-orders/POPreviewModal';
import PaymentRequestPreviewModal from '../payment-requests/PaymentRequestPreviewModal';
import DVPreviewModal from '../disbursement-vouchers/DVPreviewModal';
import SRPreviewModal from '../service-requests/SRPreviewModal';
import CRPreviewModal from '../cash-requests/CRPreviewModal';
import POApprovalPreviewModal from '../payment-orders/POApprovalPreviewModal';
import { CheckCircle, XCircle, Clock, ChevronUp, ChevronDown, FileText, CreditCard, Eye, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const InfoRow = ({ label, value, className = '' }) => (
  <div className={`flex justify-between items-start py-1.5 border-b border-gray-100 last:border-0 ${className}`}>
    <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-gray-900 font-medium text-right">{value}</span>
  </div>
);

const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '' }) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 disabled:bg-yellow-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-50',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300',
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

// Calculate total from PR items
const calculatePRAmount = (pr, prAmountsCache = {}) => {
  console.log('Calculating amount for PR:', pr?.pr_number, 'Items:', pr?.items);
  // Check cache first
  if (prAmountsCache[pr?.id]) {
    console.log('Using cached amount:', prAmountsCache[pr.id]);
    return prAmountsCache[pr.id];
  }
  // Check various possible amount field names
  const amount = pr?.amount || pr?.total_amount || pr?.total || pr?.total_price;
  if (amount) {
    console.log('Using pr.amount/total_amount:', amount);
    return amount;
  }
  if (!pr?.items || pr.items.length === 0) {
    console.log('No items found, returning 0');
    return 0;
  }
  const total = pr.items.reduce((sum, item) => {
    const itemTotal = item.total_price || (item.quantity * (item.unit_price || item.unit_cost || 0));
    console.log('Item:', item.item_name, 'Total:', itemTotal);
    return sum + itemTotal;
  }, 0);
  console.log('Calculated total from items:', total);
  return total;
};

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'For Approval': 'bg-blue-100 text-blue-800',
      'Pending Approval': 'bg-blue-100 text-blue-800',
      'Approved': 'bg-green-100 text-green-800',
      'Ordered': 'bg-green-100 text-green-800',
      'PO Created': 'bg-purple-100 text-purple-800',
      'Paid': 'bg-blue-100 text-blue-800',
      'Received': 'bg-teal-100 text-teal-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-gray-100 text-gray-600',
      'On Hold': 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  );
};

const LockedBadge = () => (
  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
    Locked
  </span>
);

const REVIEW_STATUSES = new Set([
  'For Engineer Review',
  'For Admin Review',
  'For Procurement Review'
]);

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const canApproveByStatus = (status, userRole) => {
  const role = normalizeRole(userRole);
  if (status === 'For Engineer Review') return role === 'engineer';
  if (status === 'For Admin Review') return role === 'admin';
  if (status === 'For Procurement Review') return role === 'procurement';
  if (status === 'For Super Admin Final Approval') return role === 'super_admin';
  return true;
};

const Approvals = () => {
  const [activeTab, setActiveTab] = useState('purchase-orders');
  const [poSubTab, setPoSubTab] = useState('pending');
  const [prSubTab, setPrSubTab] = useState('pending');
  const [paymentSubTab, setPaymentSubTab] = useState('pending');
  const [dvSubTab, setDvSubTab] = useState('pending');
  const [srSubTab, setSrSubTab] = useState('pending');
  const [crSubTab, setCrSubTab] = useState('pending');
  const [paymentOrderSubTab, setPaymentOrderSubTab] = useState('pending');
  const [reimbursements, setReimbursements] = useState([]);
  const [rmbSubTab, setRmbSubTab] = useState('pending');
  const [isMobile, setIsMobile] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [paymentOrders, setPaymentOrders] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [cashRequests, setCashRequests] = useState([]);
  const [disbursementVouchers, setDisbursementVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [previewPR, setPreviewPR] = useState(null);
  const [previewPRDetails, setPreviewPRDetails] = useState(null);
  const [previewPO, setPreviewPO] = useState(null);
  const [previewPODetails, setPreviewPODetails] = useState(null);
  const [previewPayment, setPreviewPayment] = useState(null);
  const [previewPaymentDetails, setPreviewPaymentDetails] = useState(null);
  const [previewDV, setPreviewDV] = useState(null);
  const [previewDVDetails, setPreviewDVDetails] = useState(null);
  const [previewSR, setPreviewSR] = useState(null);
  const [previewSRDetails, setPreviewSRDetails] = useState(null);
  const [previewCR, setPreviewCR] = useState(null);
  const [previewCRDetails, setPreviewCRDetails] = useState(null);
  const [previewPaymentOrder, setPreviewPaymentOrder] = useState(null);
  const [previewPaymentOrderDetails, setPreviewPaymentOrderDetails] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectPR, setRejectPR] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [itemRemarks, setItemRemarks] = useState({});
  const [prAmounts, setPrAmounts] = useState({});
  const [lockedOrderNumbers, setLockedOrderNumbers] = useState(new Set());
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    console.log('Approvals: Setting up socket listeners');
    
    const handlePRUpdate = (data) => {
      console.log('Approvals: PR updated (real-time):', data);
      fetchData();
    };

    console.log('Approvals: Registering listeners for pr_status_changed and pr_updated');
    socketService.on('pr_status_changed', handlePRUpdate);
    socketService.on('pr_updated', handlePRUpdate);
    
    console.log('Approvals: Socket connected?', socketService.isConnected?.() || 'unknown');

    return () => {
      console.log('Approvals: Cleaning up socket listeners');
      socketService.off('pr_status_changed', handlePRUpdate);
      socketService.off('pr_updated', handlePRUpdate);
    };
  }, []);

  useEffect(() => {
    const handleReimbursementsChanged = () => {
      fetchData();
    };

    window.addEventListener('reimbursements:changed', handleReimbursementsChanged);
    return () => {
      window.removeEventListener('reimbursements:changed', handleReimbursementsChanged);
    };
  }, []);

  const fetchData = async () => {
    console.log('Approvals: fetchData called');
    try {
      setLoading(true);
      console.log('Approvals: Calling APIs...');
      const [pos, prs, paymentReqs, srs, crs, dvs, paymentOrdersData, reimbursementsData, orderNumbersResponse] = await Promise.all([
        purchaseOrderService.getAll(),
        purchaseRequestService.getAll('all'),
        paymentRequestService.getAll(),
        serviceRequestService.getAll(),
        cashRequestService.getAll(),
        disbursementVoucherService.getAll(),
        paymentOrderService.getAll(),
        reimbursementService.getAll(),
        api.get('/order-numbers', { cache: false })
      ]);
      console.log('Approvals: APIs returned, setting state...');
      setPurchaseOrders(pos);
      setPurchaseRequests(prs);
      setPaymentRequests(paymentReqs);
      setServiceRequests(srs);
      setCashRequests(crs);
      setDisbursementVouchers(dvs);
      setPaymentOrders(paymentOrdersData);
      setReimbursements(reimbursementsData);
      const locked = new Set(
        (orderNumbersResponse?.data || [])
          .filter((row) => row?.is_locked)
          .map((row) => String(row?.order_number || '').trim())
          .filter(Boolean)
      );
      setLockedOrderNumbers(locked);
      console.log('Approvals: State updated, PR count:', prs.length);
    } catch (err) {
      console.error('Approvals: Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const isLockedOrderNumber = (orderNumber) => {
    const normalized = String(orderNumber || '').trim();
    return normalized ? lockedOrderNumbers.has(normalized) : false;
  };

  const blockIfLockedOrder = (orderNumber) => {
    if (!isLockedOrderNumber(orderNumber)) return false;
    alert(`Order number "${orderNumber}" is locked. Approval actions are disabled.`);
    return true;
  };

  const getRecordOrderNumber = (record) => {
    if (!record) return '';
    return (
      record.order_number ||
      record.pr_order_number ||
      record.purchase_request_order_number ||
      record.request_order_number ||
      record.project_order_number ||
      ''
    );
  };

  const renderStatusWithLock = (record) => (
    <div className="flex items-center gap-2 flex-wrap">
      <StatusBadge status={record?.status} />
      {isLockedOrderNumber(getRecordOrderNumber(record)) && <LockedBadge />}
    </div>
  );

  // Filter POs by status
  const pendingPOs = purchaseOrders.filter(po => 
    po.status === 'Pending Approval' || po.status === 'Draft'
  );
  
  const onHoldPOs = purchaseOrders.filter(po => 
    po.status === 'On Hold'
  );
  
  const approvedPOs = purchaseOrders.filter(po => 
    po.status === 'Approved'
  );

  // Helper to get source reference number for DVs
  const getDVSourceRef = (dv) => {
    if (dv.po_number) return { num: dv.po_number, type: 'PO' };
    if (dv.pr_number) return { num: dv.pr_number, type: 'PR' };
    if (dv.sr_number) return { num: dv.sr_number, type: 'SR' };
    if (dv.cr_number) return { num: dv.cr_number, type: 'CR' };
    return { num: '-', type: '' };
  };

  // Helper to get supplier/payee name for DVs
  const getDVSupplierName = (dv) => {
    return dv.supplier_name || dv.payee_name || '-';
  };
  const pendingDVs = disbursementVouchers.filter(dv => 
    dv.status === 'Pending' || dv.status === 'Draft'
  );
  
  const approvedDVs = disbursementVouchers.filter(dv => 
    dv.status === 'Approved' || dv.status === 'Paid'
  );

  // Filter PRs by status
  const pendingPRs = purchaseRequests.filter(pr => 
    pr.status === 'Pending' || 
    pr.status === 'For Approval' || 
    pr.status === 'For Super Admin Final Approval' ||
    pr.status === 'For Engineer Review' ||
    pr.status === 'For Admin Review' ||
    pr.status === 'For Procurement Review'
  );

  const onHoldPRs = purchaseRequests.filter(pr => 
    pr.status === 'On Hold'
  );

  const approvedPRs = purchaseRequests.filter(pr => 
    pr.status === 'For Purchase' || pr.status === 'PO Created' || pr.status === 'Completed'
  );

  // Filter Payment Requests (non-debt) that need approval
  const pendingPaymentRequests = paymentRequests.filter(pr => 
    pr.status === 'Pending' || pr.status === 'For Approval'
  );

  const onHoldPaymentRequests = paymentRequests.filter(pr => 
    pr.status === 'On Hold'
  );

  const approvedPaymentRequests = paymentRequests.filter(pr => 
    pr.status === 'Approved' || pr.status === 'Paid'
  );

  // Filter Service Requests that need Super Admin approval
  const pendingServiceRequests = serviceRequests.filter(sr => 
    sr.status === 'For Super Admin Final Approval'
  );

  const onHoldServiceRequests = serviceRequests.filter(sr => 
    sr.status === 'On Hold'
  );

  const approvedServiceRequests = serviceRequests.filter(sr => 
    sr.status === 'Approved' || sr.status === 'PO Created' || sr.status === 'Paid' || sr.status === 'Received'
  );

  // Filter Cash Requests that need Procurement review
  const procurementReviewCashRequests = cashRequests.filter(cr => 
    cr.status === 'For Procurement Review'
  );

  // Filter Cash Requests that need Super Admin final approval
  const pendingCashRequests = cashRequests.filter(cr => 
    cr.status === 'For Super Admin Final Approval'
  );

  const onHoldCashRequests = cashRequests.filter(cr => 
    cr.status === 'On Hold'
  );

  const approvedCashRequests = cashRequests.filter(cr => 
    cr.status === 'Approved' || cr.status === 'DV Created' || cr.status === 'Received'
  );

  // Filter Payment Orders by status
  const pendingPaymentOrders = paymentOrders.filter(po => 
    po.status === 'Pending' || po.status === 'Draft'
  );
  
  const onHoldPaymentOrders = paymentOrders.filter(po => 
    po.status === 'On Hold'
  );
  
  const approvedPaymentOrders = paymentOrders.filter(po => 
    po.status === 'Approved'
  );

  // Filter Reimbursements that need approval
  const pendingReimbursements = reimbursements.filter(r => 
    r.status === 'For Procurement Review' || r.status === 'For Super Admin Final Approval'
  );
  
  const onHoldReimbursements = reimbursements.filter(r => 
    r.status === 'On Hold'
  );
  
  const approvedReimbursements = reimbursements.filter(r => 
    r.status === 'For Purchase' || r.status === 'Paid' || r.status === 'Received'
  );

  const handleApprovePO = async (id) => {
    const po = purchaseOrders.find((row) => row.id === id);
    if (blockIfLockedOrder(po?.order_number)) return;
    try {
      setProcessingId(id);
      await purchaseOrderService.superAdminApprove(id, 'approved');
      await fetchData();
    } catch (err) {
      alert('Failed to approve purchase order: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleHoldPO = async (id) => {
    const po = purchaseOrders.find((row) => row.id === id);
    if (blockIfLockedOrder(po?.order_number)) return;
    try {
      setProcessingId(id);
      await purchaseOrderService.superAdminApprove(id, 'hold');
      await fetchData();
    } catch (err) {
      alert('Failed to hold purchase order: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprovePR = async (id) => {
    const prRow = purchaseRequests.find((row) => row.id === id);
    if (blockIfLockedOrder(prRow?.order_number)) return;
    
    try {
      setProcessingId(id);
      if (REVIEW_STATUSES.has(prRow?.status)) {
        await purchaseRequestService.review(id, 'approved', null);
      } else {
        // Optimistic UI update - immediately move to approved
        setPurchaseRequests(prev => prev.map(pr =>
          pr.id === id ? { ...pr, status: 'For Purchase' } : pr
        ));
        await purchaseRequestService.approve(id, 'For Purchase');
      }
      await fetchData(); // Refresh to get accurate data
    } catch (err) {
      alert('Failed to approve purchase request: ' + (err.response?.data?.message || err.message));
      await fetchData(); // Revert on error
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPR = async (pr) => {
    if (blockIfLockedOrder(pr?.order_number)) return;
    setRejectPR(pr);
    setRejectRemarks('');
    setItemRemarks({});
    setShowRejectModal(true);
    
    // Fetch full PR details including items
    try {
      const details = await purchaseRequestService.getById(pr.id);
      setRejectPR(details);
      // Cache the calculated amount
      const calculatedTotal = calculatePRAmount(details);
      if (calculatedTotal > 0) {
        setPrAmounts(prev => ({ ...prev, [pr.id]: calculatedTotal }));
      }
    } catch (err) {
      console.error('Failed to fetch PR details for rejection:', err);
    }
  };

  const submitRejection = async () => {
    if (!rejectPR) return;
    if (blockIfLockedOrder(rejectPR?.order_number)) return;
    
    // Optimistic UI update - immediately remove from list
    setPurchaseRequests(prev => prev.filter(pr => pr.id !== rejectPR.id));
    setShowRejectModal(false);
    setRejectPR(null);
    
    try {
      setProcessingId(rejectPR.id);
      if (REVIEW_STATUSES.has(rejectPR?.status)) {
        await purchaseRequestService.review(rejectPR.id, 'rejected', rejectRemarks);
      } else {
        await purchaseRequestService.approve(rejectPR.id, 'rejected', rejectRemarks);
      }
      await fetchData(); // Refresh to get accurate data
    } catch (err) {
      alert('Failed to reject purchase request: ' + (err.response?.data?.message || err.message));
      await fetchData(); // Revert on error
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewPR = async (pr) => {
    setPreviewPR(pr);
    setLoadingPreview(true);
    try {
      const details = await purchaseRequestService.getById(pr.id);
      setPreviewPRDetails(details);
      // Cache the calculated amount
      const calculatedTotal = calculatePRAmount(details);
      if (calculatedTotal > 0) {
        setPrAmounts(prev => ({ ...prev, [pr.id]: calculatedTotal }));
      }
    } catch (err) {
      console.error('Failed to fetch PR details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleViewPO = async (po) => {
    setPreviewPO(po);
    setLoadingPreview(true);
    try {
      const details = await purchaseOrderService.getById(po.id);
      setPreviewPODetails(details);
    } catch (err) {
      console.error('Failed to fetch PO details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleViewPayment = async (payment) => {
    setPreviewPayment(payment);
    setLoadingPreview(true);
    try {
      const details = await paymentRequestService.getById(payment.id);
      setPreviewPaymentDetails(details);
    } catch (err) {
      console.error('Failed to fetch Payment Request details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleViewDV = async (dv) => {
    setPreviewDV(dv);
    setLoadingPreview(true);
    try {
      const details = await disbursementVoucherService.getById(dv.id);
      setPreviewDVDetails(details);
    } catch (err) {
      console.error('Failed to fetch DV details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleViewSR = async (sr) => {
    setPreviewSR(sr);
    setLoadingPreview(true);
    try {
      const details = await serviceRequestService.getById(sr.id);
      setPreviewSRDetails(details);
    } catch (err) {
      console.error('Failed to fetch SR details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleViewCR = async (cr) => {
    setPreviewCR(cr);
    setLoadingPreview(true);
    try {
      const details = await cashRequestService.getById(cr.id);
      setPreviewCRDetails(details);
    } catch (err) {
      console.error('Failed to fetch CR details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleHoldPR = async (id) => {
    const prRow = purchaseRequests.find((row) => row.id === id);
    if (blockIfLockedOrder(prRow?.order_number)) return;
    // Optimistic UI update - immediately move to on hold
    setPurchaseRequests(prev => prev.map(pr => 
      pr.id === id ? { ...pr, status: 'On Hold' } : pr
    ));
    
    try {
      setProcessingId(id);
      await purchaseRequestService.updateStatus(id, 'On Hold');
      await fetchData(); // Refresh to get accurate data
    } catch (err) {
      alert('Failed to hold purchase request: ' + err.message);
      await fetchData(); // Revert on error
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveDV = async (id) => {
    try {
      setProcessingId(id);
      console.log('Approving DV:', id);
      const result = await disbursementVoucherService.certifyByManager(id);
      console.log('Approve DV result:', result);
      await fetchData();
    } catch (err) {
      console.error('Failed to approve DV:', err);
      console.error('Error response:', err.response?.data);
      alert('Failed to approve disbursement voucher: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprovePaymentRequest = async (id) => {
    const row = paymentRequests.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await paymentRequestService.approve(id, 'approved');
      await fetchData();
    } catch (err) {
      alert('Failed to approve payment request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleHoldPaymentRequest = async (id) => {
    const row = paymentRequests.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await paymentRequestService.updateStatus(id, 'On Hold');
      await fetchData();
    } catch (err) {
      alert('Failed to hold payment request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveSR = async (id) => {
    const row = serviceRequests.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await serviceRequestService.superAdminApprove(id, 'approved');
      await fetchData();
    } catch (err) {
      alert('Failed to approve service request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSR = async (id) => {
    const row = serviceRequests.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await serviceRequestService.superAdminApprove(id, 'rejected');
      await fetchData();
    } catch (err) {
      alert('Failed to reject service request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleProcurementApproveCR = async (id, action) => {
    const row = cashRequests.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await cashRequestService.procurementApprove(id, action);
      await fetchData();
    } catch (err) {
      alert('Failed to process cash request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveCR = async (id) => {
    const row = cashRequests.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await cashRequestService.superAdminApprove(id, 'approved');
      await fetchData();
    } catch (err) {
      alert('Failed to approve cash request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectCR = async (id) => {
    const row = cashRequests.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await cashRequestService.superAdminApprove(id, 'rejected');
      await fetchData();
    } catch (err) {
      alert('Failed to reject cash request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleHoldCR = async (id) => {
    const row = cashRequests.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await cashRequestService.superAdminApprove(id, 'hold');
      await fetchData();
    } catch (err) {
      alert('Failed to hold cash request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprovePaymentOrder = async (id) => {
    const row = paymentOrders.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await paymentOrderService.superAdminApprove(id, 'approved');
      await fetchData();
    } catch (err) {
      alert('Failed to approve payment order: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleHoldPaymentOrder = async (id) => {
    const row = paymentOrders.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      await paymentOrderService.superAdminApprove(id, 'hold');
      await fetchData();
    } catch (err) {
      alert('Failed to hold payment order: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewPaymentOrder = async (po) => {
    setPreviewPaymentOrder(po);
    setLoadingPreview(true);
    try {
      const details = await paymentOrderService.getById(po.id);
      setPreviewPaymentOrderDetails(details);
    } catch (err) {
      console.error('Failed to fetch Payment Order details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApproveReimbursement = async (id, status) => {
    const row = reimbursements.find((item) => item.id === id);
    if (blockIfLockedOrder(row?.order_number)) return;
    try {
      setProcessingId(id);
      const rejectionReason = status === 'rejected' ? prompt('Enter rejection reason:') : null;
      if (status === 'rejected' && !rejectionReason) return;
      
      await reimbursementService.approve(id, status, rejectionReason);
      await fetchData();
    } catch (err) {
      alert('Failed to process reimbursement: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Approvals</h2>
        <p className="text-sm text-gray-500">Review and approve pending items</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch] pb-1 sm:overflow-visible sm:whitespace-normal">
          <button
            onClick={() => setActiveTab('purchase-orders')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'purchase-orders'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>Purchase Orders</span>
              {pendingPOs.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  {pendingPOs.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('purchase-requests')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'purchase-requests'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>Purchase Requests</span>
              {pendingPRs.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  {pendingPRs.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('payment-requests')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'payment-requests'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Payment Requests</span>
              {pendingPaymentRequests.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  {pendingPaymentRequests.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('disbursement-vouchers')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'disbursement-vouchers'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Disbursement Vouchers</span>
              {pendingDVs.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  {pendingDVs.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('service-requests')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'service-requests'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Service Requests</span>
              {pendingServiceRequests.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  {pendingServiceRequests.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('cash-requests')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'cash-requests'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Cash Requests</span>
              {pendingCashRequests.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  {pendingCashRequests.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('payment-orders')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'payment-orders'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Payment Orders</span>
              {pendingPaymentOrders.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  {pendingPaymentOrders.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('reimbursements')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeTab === 'reimbursements'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Reimbursements</span>
              {pendingReimbursements.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  {pendingReimbursements.length}
                </span>
              )}
            </div>
          </button>
        </nav>
      </div>

      {/* Purchase Orders Tab */}
      {activeTab === 'purchase-orders' && (
        <div className="space-y-4">
          {/* PO Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPoSubTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                poSubTab === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Pending</span>
                {pendingPOs.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    poSubTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pendingPOs.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setPoSubTab('on-hold')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                poSubTab === 'on-hold'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>On Hold</span>
                {onHoldPOs.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    poSubTab === 'on-hold' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {onHoldPOs.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setPoSubTab('approved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                poSubTab === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Approved</span>
                {approvedPOs.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    poSubTab === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                  }`}>
                    {approvedPOs.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <Card>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {poSubTab === 'pending' && 'Pending Purchase Orders'}
                {poSubTab === 'on-hold' && 'On Hold Purchase Orders'}
                {poSubTab === 'approved' && 'Approved Purchase Orders'}
              </h3>
              <span className="text-sm text-gray-500">
                {poSubTab === 'pending' && `${pendingPOs.length} pending`}
                {poSubTab === 'on-hold' && `${onHoldPOs.length} on hold`}
                {poSubTab === 'approved' && `${approvedPOs.length} approved`}
              </span>
            </div>
            
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">PO Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">PR Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pending POs */}
                  {poSubTab === 'pending' && pendingPOs.map(po => (
                    <React.Fragment key={po.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.pr_number || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.supplier_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(po.total_amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(po)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === po.id}
                              onClick={(e) => { e.stopPropagation(); handleApprovePO(po.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={processingId === po.id}
                              onClick={(e) => { e.stopPropagation(); handleHoldPO(po.id); }}
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPO(po); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === po.id ? null : po.id); }}
                            >
                              {expandedId === po.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === po.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Prepared By</p>
                                  <p className="text-sm text-gray-900">{po.prepared_by_first_name} {po.prepared_by_last_name}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Date Prepared</p>
                                  <p className="text-sm text-gray-900">{formatDate(po.created_at)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Delivery Term</p>
                                  <p className="text-sm text-gray-900">{po.delivery_term || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Payment Term</p>
                                  <p className="text-sm text-gray-900">{po.payment_term || '-'}</p>
                                </div>
                              </div>
                              {po.notes && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Notes</p>
                                  <p className="text-sm text-gray-900">{po.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* On Hold POs */}
                  {poSubTab === 'on-hold' && onHoldPOs.map(po => (
                    <React.Fragment key={po.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.pr_number || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.supplier_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(po.total_amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(po)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === po.id}
                              onClick={(e) => { e.stopPropagation(); handleApprovePO(po.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPO(po); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === po.id ? null : po.id); }}
                            >
                              {expandedId === po.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === po.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Prepared By</p>
                                  <p className="text-sm text-gray-900">{po.prepared_by_first_name} {po.prepared_by_last_name}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Date Prepared</p>
                                  <p className="text-sm text-gray-900">{formatDate(po.created_at)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Delivery Term</p>
                                  <p className="text-sm text-gray-900">{po.delivery_term || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Payment Term</p>
                                  <p className="text-sm text-gray-900">{po.payment_term || '-'}</p>
                                </div>
                              </div>
                              {po.notes && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Notes</p>
                                  <p className="text-sm text-gray-900">{po.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Approved POs */}
                  {poSubTab === 'approved' && approvedPOs.map(po => (
                    <React.Fragment key={po.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.pr_number || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.supplier_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(po.total_amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(po)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPO(po); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === po.id ? null : po.id); }}
                            >
                              {expandedId === po.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === po.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Prepared By</p>
                                  <p className="text-sm text-gray-900">{po.prepared_by_first_name} {po.prepared_by_last_name}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Date Prepared</p>
                                  <p className="text-sm text-gray-900">{formatDate(po.created_at)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Delivery Term</p>
                                  <p className="text-sm text-gray-900">{po.delivery_term || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Payment Term</p>
                                  <p className="text-sm text-gray-900">{po.payment_term || '-'}</p>
                                </div>
                              </div>
                              {po.notes && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Notes</p>
                                  <p className="text-sm text-gray-900">{po.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {((poSubTab === 'pending' && pendingPOs.length === 0) ||
                    (poSubTab === 'on-hold' && onHoldPOs.length === 0) ||
                    (poSubTab === 'approved' && approvedPOs.length === 0)) && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">
                        No {poSubTab === 'pending' ? 'pending' : poSubTab === 'on-hold' ? 'on hold' : 'approved'} purchase orders
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden p-4 space-y-3">
              {/* Pending POs */}
              {poSubTab === 'pending' && pendingPOs.map(po => (
                <div key={po.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{po.po_number}</span>
                    {renderStatusWithLock(po)}
                  </div>
                  <InfoRow label="PR Number" value={po.pr_number || '-'} />
                  <InfoRow label="Supplier" value={po.supplier_name || '-'} />
                  <InfoRow label="Amount" value={formatCurrency(po.total_amount)} />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={processingId === po.id}
                        onClick={() => handleApprovePO(po.id)}
                        className="px-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={processingId === po.id}
                        onClick={() => handleHoldPO(po.id)}
                        className="px-2"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPO(po)}
                        className="px-2"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === po.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                  {expandedId === po.id && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <InfoRow label="Prepared By" value={`${po.prepared_by_first_name || ''} ${po.prepared_by_last_name || ''}`} />
                      <InfoRow label="Date" value={formatDate(po.created_at)} />
                      <InfoRow label="Delivery" value={po.delivery_term || '-'} />
                      <InfoRow label="Payment" value={po.payment_term || '-'} />
                      {po.notes && <p className="text-xs text-gray-600 mt-2">{po.notes}</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* On Hold POs */}
              {poSubTab === 'on-hold' && onHoldPOs.map(po => (
                <div key={po.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{po.po_number}</span>
                    {renderStatusWithLock(po)}
                  </div>
                  <InfoRow label="PR Number" value={po.pr_number || '-'} />
                  <InfoRow label="Supplier" value={po.supplier_name || '-'} />
                  <InfoRow label="Amount" value={formatCurrency(po.total_amount)} />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={processingId === po.id}
                        onClick={() => handleApprovePO(po.id)}
                        className="px-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPO(po)}
                        className="px-2"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === po.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                  {expandedId === po.id && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <InfoRow label="Prepared By" value={`${po.prepared_by_first_name || ''} ${po.prepared_by_last_name || ''}`} />
                      <InfoRow label="Date" value={formatDate(po.created_at)} />
                      <InfoRow label="Delivery" value={po.delivery_term || '-'} />
                      <InfoRow label="Payment" value={po.payment_term || '-'} />
                      {po.notes && <p className="text-xs text-gray-600 mt-2">{po.notes}</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* Approved POs */}
              {poSubTab === 'approved' && approvedPOs.map(po => (
                <div key={po.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{po.po_number}</span>
                    {renderStatusWithLock(po)}
                  </div>
                  <InfoRow label="PR Number" value={po.pr_number || '-'} />
                  <InfoRow label="Supplier" value={po.supplier_name || '-'} />
                  <InfoRow label="Amount" value={formatCurrency(po.total_amount)} />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewPO(po)}
                      className="px-2"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <button
                      onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === po.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                  {expandedId === po.id && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <InfoRow label="Prepared By" value={`${po.prepared_by_first_name || ''} ${po.prepared_by_last_name || ''}`} />
                      <InfoRow label="Date" value={formatDate(po.created_at)} />
                      <InfoRow label="Delivery" value={po.delivery_term || '-'} />
                      <InfoRow label="Payment" value={po.payment_term || '-'} />
                      {po.notes && <p className="text-xs text-gray-600 mt-2">{po.notes}</p>}
                    </div>
                  )}
                </div>
              ))}

              {((poSubTab === 'pending' && pendingPOs.length === 0) ||
                (poSubTab === 'on-hold' && onHoldPOs.length === 0) ||
                (poSubTab === 'approved' && approvedPOs.length === 0)) && (
                <p className="text-center text-gray-500 py-4 text-sm">
                  No {poSubTab === 'pending' ? 'pending' : poSubTab === 'on-hold' ? 'on hold' : 'approved'} purchase orders
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Purchase Requests Tab */}
      {activeTab === 'purchase-requests' && (
        <div className="space-y-4">
          {/* PR Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPrSubTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                prSubTab === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Pending</span>
                {pendingPRs.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    prSubTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pendingPRs.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setPrSubTab('on-hold')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                prSubTab === 'on-hold'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>On Hold</span>
                {onHoldPRs.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    prSubTab === 'on-hold' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {onHoldPRs.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setPrSubTab('approved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                prSubTab === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Approved</span>
                {approvedPRs.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    prSubTab === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                  }`}>
                    {approvedPRs.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <Card>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {prSubTab === 'pending' && 'Pending Purchase Requests'}
                {prSubTab === 'on-hold' && 'On Hold Purchase Requests'}
                {prSubTab === 'approved' && 'Approved Purchase Requests'}
              </h3>
              <span className="text-sm text-gray-500">
                {prSubTab === 'pending' && `${pendingPRs.length} pending`}
                {prSubTab === 'on-hold' && `${onHoldPRs.length} on hold`}
                {prSubTab === 'approved' && `${approvedPRs.length} approved`}
              </span>
            </div>
            
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">PR Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Payee Name</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pending PRs */}
                  {prSubTab === 'pending' && pendingPRs.map(pr => (
                    <React.Fragment key={pr.id}>
                      <tr
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{pr.pr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{pr.payee_name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{pr.project}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(calculatePRAmount(pr, prAmounts))}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(pr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === pr.id || !canApproveByStatus(pr.status, user?.role)}
                              onClick={(e) => { e.stopPropagation(); handleApprovePR(pr.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={processingId === pr.id}
                              onClick={(e) => { e.stopPropagation(); handleHoldPR(pr.id); }}
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={processingId === pr.id}
                              onClick={(e) => { e.stopPropagation(); handleRejectPR(pr); }}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPR(pr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === pr.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                  <p className="text-sm text-gray-900">{pr.payee_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                  <p className="text-sm text-gray-900">{pr.purpose}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                  <p className="text-sm text-gray-900">{pr.project_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                  <p className="text-sm text-gray-900">{pr.order_number || '-'}</p>
                                </div>
                              </div>
                              {pr.remarks && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                  <p className="text-sm text-gray-900">{pr.remarks}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* On Hold PRs */}
                  {prSubTab === 'on-hold' && onHoldPRs.map(pr => (
                    <React.Fragment key={pr.id}>
                      <tr
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{pr.pr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{pr.payee_name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{pr.project}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(calculatePRAmount(pr))}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(pr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === pr.id || !canApproveByStatus(pr.status, user?.role)}
                              onClick={(e) => { e.stopPropagation(); handleApprovePR(pr.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPR(pr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === pr.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                  <p className="text-sm text-gray-900">{pr.payee_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                  <p className="text-sm text-gray-900">{pr.purpose}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                  <p className="text-sm text-gray-900">{pr.project_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                  <p className="text-sm text-gray-900">{pr.order_number || '-'}</p>
                                </div>
                              </div>
                              {pr.remarks && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                  <p className="text-sm text-gray-900">{pr.remarks}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Approved PRs */}
                  {prSubTab === 'approved' && approvedPRs.map(pr => (
                    <React.Fragment key={pr.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{pr.pr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{pr.payee_name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{pr.project}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(calculatePRAmount(pr, prAmounts))}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(pr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPR(pr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === pr.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                  <p className="text-sm text-gray-900">{pr.payee_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                  <p className="text-sm text-gray-900">{pr.purpose}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                  <p className="text-sm text-gray-900">{pr.project_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                  <p className="text-sm text-gray-900">{pr.order_number || '-'}</p>
                                </div>
                              </div>
                              {pr.remarks && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                  <p className="text-sm text-gray-900">{pr.remarks}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {((prSubTab === 'pending' && pendingPRs.length === 0) ||
                    (prSubTab === 'on-hold' && onHoldPRs.length === 0) ||
                    (prSubTab === 'approved' && approvedPRs.length === 0)) && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">
                        No {prSubTab === 'pending' ? 'pending' : prSubTab === 'on-hold' ? 'on hold' : 'approved'} purchase requests
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden p-4 space-y-3">
              {/* Pending PRs */}
              {prSubTab === 'pending' && pendingPRs.map(pr => (
                <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{pr.pr_number}</span>
                    {renderStatusWithLock(pr)}
                  </div>
                  <InfoRow label="Payee" value={pr.payee_name || '-'} />
                  <InfoRow label="Project" value={pr.project || '-'} />
                  <InfoRow label="Amount" value={formatCurrency(calculatePRAmount(pr, prAmounts))} />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={processingId === pr.id || !canApproveByStatus(pr.status, user?.role)}
                        onClick={() => handleApprovePR(pr.id)}
                        className="px-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={processingId === pr.id}
                        onClick={() => handleHoldPR(pr.id)}
                        className="px-2"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={processingId === pr.id}
                        onClick={() => handleRejectPR(pr)}
                        className="px-2"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPR(pr)}
                        className="px-2"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === pr.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                  {expandedId === pr.id && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <InfoRow label="Payee Address" value={pr.payee_address || '-'} />
                      <InfoRow label="Purpose" value={pr.purpose || '-'} />
                      <InfoRow label="Project Address" value={pr.project_address || '-'} />
                      <InfoRow label="Order Number" value={pr.order_number || '-'} />
                      {pr.remarks && <p className="text-xs text-gray-600 mt-2">{pr.remarks}</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* On Hold PRs */}
              {prSubTab === 'on-hold' && onHoldPRs.map(pr => (
                <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{pr.pr_number}</span>
                    {renderStatusWithLock(pr)}
                  </div>
                  <InfoRow label="Payee" value={pr.payee_name || '-'} />
                  <InfoRow label="Project" value={pr.project || '-'} />
                  <InfoRow label="Amount" value={formatCurrency(calculatePRAmount(pr))} />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={processingId === pr.id || !canApproveByStatus(pr.status, user?.role)}
                        onClick={() => handleApprovePR(pr.id)}
                        className="px-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPR(pr)}
                        className="px-2"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === pr.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                  {expandedId === pr.id && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <InfoRow label="Payee Address" value={pr.payee_address || '-'} />
                      <InfoRow label="Purpose" value={pr.purpose || '-'} />
                      <InfoRow label="Project Address" value={pr.project_address || '-'} />
                      <InfoRow label="Order Number" value={pr.order_number || '-'} />
                      {pr.remarks && <p className="text-xs text-gray-600 mt-2">{pr.remarks}</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* Approved PRs */}
              {prSubTab === 'approved' && approvedPRs.map(pr => (
                <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{pr.pr_number}</span>
                    {renderStatusWithLock(pr)}
                  </div>
                  <InfoRow label="Payee" value={pr.payee_name || '-'} />
                  <InfoRow label="Project" value={pr.project || '-'} />
                  <InfoRow label="Amount" value={formatCurrency(calculatePRAmount(pr, prAmounts))} />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewPR(pr)}
                      className="px-2"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <button
                      onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === pr.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                  {expandedId === pr.id && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <InfoRow label="Payee Address" value={pr.payee_address || '-'} />
                      <InfoRow label="Purpose" value={pr.purpose || '-'} />
                      <InfoRow label="Project Address" value={pr.project_address || '-'} />
                      <InfoRow label="Order Number" value={pr.order_number || '-'} />
                      {pr.remarks && <p className="text-xs text-gray-600 mt-2">{pr.remarks}</p>}
                    </div>
                  )}
                </div>
              ))}

              {((prSubTab === 'pending' && pendingPRs.length === 0) ||
                (prSubTab === 'on-hold' && onHoldPRs.length === 0) ||
                (prSubTab === 'approved' && approvedPRs.length === 0)) && (
                <p className="text-center text-gray-500 py-4 text-sm">
                  No {prSubTab === 'pending' ? 'pending' : prSubTab === 'on-hold' ? 'on hold' : 'approved'} purchase requests
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
      {/* Payment Requests Tab (Non-debt) */}
      {activeTab === 'payment-requests' && (
        <div className="space-y-4">
          {/* Payment Request Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPaymentSubTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                paymentSubTab === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Pending</span>
                {pendingPaymentRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    paymentSubTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pendingPaymentRequests.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setPaymentSubTab('on-hold')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                paymentSubTab === 'on-hold'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>On Hold</span>
                {onHoldPaymentRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    paymentSubTab === 'on-hold' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {onHoldPaymentRequests.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setPaymentSubTab('approved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                paymentSubTab === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Approved</span>
                {approvedPaymentRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    paymentSubTab === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                  }`}>
                    {approvedPaymentRequests.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <Card>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {paymentSubTab === 'pending' && 'Pending Payment Requests'}
              {paymentSubTab === 'on-hold' && 'On Hold Payment Requests'}
              {paymentSubTab === 'approved' && 'Approved Payment Requests'}
            </h3>
            <span className="text-sm text-gray-500">
              {paymentSubTab === 'pending' && `${pendingPaymentRequests.length} pending`}
              {paymentSubTab === 'on-hold' && `${onHoldPaymentRequests.length} on hold`}
              {paymentSubTab === 'approved' && `${approvedPaymentRequests.length} approved`}
            </span>
          </div>
          
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Source Ref</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Payee Name</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentSubTab === 'pending' && pendingPaymentRequests.map(pr => (
                  <React.Fragment key={pr.id}>
                    <tr 
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                    >
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {(() => {
                          if (pr.original_pr_number) return <span><span className="text-xs text-gray-400">PR</span> {pr.original_pr_number}</span>;
                          if (pr.original_sr_number) return <span><span className="text-xs text-gray-400">SR</span> {pr.original_sr_number}</span>;
                          if (pr.original_cr_number) return <span><span className="text-xs text-gray-400">CR</span> {pr.original_cr_number}</span>;
                          return '-';
                        })()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{pr.payee_name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{pr.project}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(pr.amount)}</td>
                      <td className="py-3 px-4">{renderStatusWithLock(pr)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            disabled={processingId === pr.id}
                            onClick={(e) => { e.stopPropagation(); handleApprovePaymentRequest(pr.id); }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={processingId === pr.id}
                            onClick={(e) => { e.stopPropagation(); handleHoldPaymentRequest(pr.id); }}
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === pr.id ? null : pr.id); }}
                          >
                            {expandedId === pr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === pr.id && (
                      <tr>
                        <td colSpan="6" className="bg-gray-50 p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                <p className="text-sm text-gray-900">{pr.payee_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                <p className="text-sm text-gray-900">{pr.purpose}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{pr.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{pr.order_number || '-'}</p>
                              </div>
                            </div>
                            {pr.remarks && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{pr.remarks}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {paymentSubTab === 'on-hold' && onHoldPaymentRequests.map(pr => (
                  <React.Fragment key={pr.id}>
                    <tr 
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                    >
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {(() => {
                          if (pr.original_pr_number) return <span><span className="text-xs text-gray-400">PR</span> {pr.original_pr_number}</span>;
                          if (pr.original_sr_number) return <span><span className="text-xs text-gray-400">SR</span> {pr.original_sr_number}</span>;
                          if (pr.original_cr_number) return <span><span className="text-xs text-gray-400">CR</span> {pr.original_cr_number}</span>;
                          return '-';
                        })()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{pr.payee_name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{pr.project}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(pr.amount)}</td>
                      <td className="py-3 px-4">{renderStatusWithLock(pr)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            disabled={processingId === pr.id}
                            onClick={(e) => { e.stopPropagation(); handleApprovePaymentRequest(pr.id); }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleViewPayment(pr); }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === pr.id ? null : pr.id); }}
                          >
                            {expandedId === pr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === pr.id && (
                      <tr>
                        <td colSpan="6" className="bg-gray-50 p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                <p className="text-sm text-gray-900">{pr.payee_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                <p className="text-sm text-gray-900">{pr.purpose}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{pr.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{pr.order_number || '-'}</p>
                              </div>
                            </div>
                            {pr.remarks && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{pr.remarks}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {paymentSubTab === 'approved' && approvedPaymentRequests.map(pr => (
                  <React.Fragment key={pr.id}>
                    <tr 
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                    >
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {(() => {
                          if (pr.original_pr_number) return <span><span className="text-xs text-gray-400">PR</span> {pr.original_pr_number}</span>;
                          if (pr.original_sr_number) return <span><span className="text-xs text-gray-400">SR</span> {pr.original_sr_number}</span>;
                          if (pr.original_cr_number) return <span><span className="text-xs text-gray-400">CR</span> {pr.original_cr_number}</span>;
                          return '-';
                        })()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{pr.payee_name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{pr.project}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(pr.amount)}</td>
                      <td className="py-3 px-4">{renderStatusWithLock(pr)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleViewPayment(pr); }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === pr.id ? null : pr.id); }}
                          >
                            {expandedId === pr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === pr.id && (
                      <tr>
                        <td colSpan="6" className="bg-gray-50 p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                <p className="text-sm text-gray-900">{pr.payee_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                <p className="text-sm text-gray-900">{pr.purpose}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{pr.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{pr.order_number || '-'}</p>
                              </div>
                            </div>
                            {pr.remarks && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{pr.remarks}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {((paymentSubTab === 'pending' && pendingPaymentRequests.length === 0) ||
                  (paymentSubTab === 'on-hold' && onHoldPaymentRequests.length === 0) ||
                  (paymentSubTab === 'approved' && approvedPaymentRequests.length === 0)) && (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-gray-500">
                      No {paymentSubTab === 'pending' ? 'pending' : paymentSubTab === 'on-hold' ? 'on hold' : 'approved'} payment requests
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="sm:hidden p-4 space-y-3">
            {/* Pending */}
            {paymentSubTab === 'pending' && pendingPaymentRequests.map(pr => (
              <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {(() => {
                      if (pr.original_pr_number) return `PR ${pr.original_pr_number}`;
                      if (pr.original_sr_number) return `SR ${pr.original_sr_number}`;
                      if (pr.original_cr_number) return `CR ${pr.original_cr_number}`;
                      return '-';
                    })()}
                  </span>
                  {renderStatusWithLock(pr)}
                </div>
                <InfoRow label="Payee" value={pr.payee_name || '-'} />
                <InfoRow label="Project" value={pr.project || '-'} />
                <InfoRow label="Amount" value={formatCurrency(pr.amount)} />
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Button variant="success" size="sm" disabled={processingId === pr.id} onClick={() => handleApprovePaymentRequest(pr.id)} className="px-2">
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button variant="secondary" size="sm" disabled={processingId === pr.id} onClick={() => handleHoldPaymentRequest(pr.id)} className="px-2">
                      <Clock className="w-4 h-4" />
                    </Button>
                  </div>
                  <button onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)} className="text-gray-400 hover:text-gray-600">
                    {expandedId === pr.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
                {expandedId === pr.id && (
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <InfoRow label="Payee Address" value={pr.payee_address || '-'} />
                    <InfoRow label="Purpose" value={pr.purpose || '-'} />
                    <InfoRow label="Project Address" value={pr.project_address || '-'} />
                    <InfoRow label="Order Number" value={pr.order_number || '-'} />
                    {pr.remarks && <p className="text-xs text-gray-600 mt-2">{pr.remarks}</p>}
                  </div>
                )}
              </div>
            ))}

            {/* On Hold */}
            {paymentSubTab === 'on-hold' && onHoldPaymentRequests.map(pr => (
              <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {(() => {
                      if (pr.original_pr_number) return `PR ${pr.original_pr_number}`;
                      if (pr.original_sr_number) return `SR ${pr.original_sr_number}`;
                      if (pr.original_cr_number) return `CR ${pr.original_cr_number}`;
                      return '-';
                    })()}
                  </span>
                  {renderStatusWithLock(pr)}
                </div>
                <InfoRow label="Payee" value={pr.payee_name || '-'} />
                <InfoRow label="Project" value={pr.project || '-'} />
                <InfoRow label="Amount" value={formatCurrency(pr.amount)} />
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <Button variant="success" size="sm" disabled={processingId === pr.id} onClick={() => handleApprovePaymentRequest(pr.id)} className="px-2">
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                  <button onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)} className="text-gray-400 hover:text-gray-600">
                    {expandedId === pr.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
                {expandedId === pr.id && (
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <InfoRow label="Payee Address" value={pr.payee_address || '-'} />
                    <InfoRow label="Purpose" value={pr.purpose || '-'} />
                    <InfoRow label="Project Address" value={pr.project_address || '-'} />
                    <InfoRow label="Order Number" value={pr.order_number || '-'} />
                    {pr.remarks && <p className="text-xs text-gray-600 mt-2">{pr.remarks}</p>}
                  </div>
                )}
              </div>
            ))}

            {/* Approved */}
            {paymentSubTab === 'approved' && approvedPaymentRequests.map(pr => (
              <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {(() => {
                      if (pr.original_pr_number) return `PR ${pr.original_pr_number}`;
                      if (pr.original_sr_number) return `SR ${pr.original_sr_number}`;
                      if (pr.original_cr_number) return `CR ${pr.original_cr_number}`;
                      return '-';
                    })()}
                  </span>
                  {renderStatusWithLock(pr)}
                </div>
                <InfoRow label="Payee" value={pr.payee_name || '-'} />
                <InfoRow label="Project" value={pr.project || '-'} />
                <InfoRow label="Amount" value={formatCurrency(pr.amount)} />
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <Button variant="ghost" size="sm" onClick={() => handleViewPayment(pr)} className="px-2">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <button onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)} className="text-gray-400 hover:text-gray-600">
                    {expandedId === pr.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
                {expandedId === pr.id && (
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <InfoRow label="Payee Address" value={pr.payee_address || '-'} />
                    <InfoRow label="Purpose" value={pr.purpose || '-'} />
                    <InfoRow label="Project Address" value={pr.project_address || '-'} />
                    <InfoRow label="Order Number" value={pr.order_number || '-'} />
                    {pr.remarks && <p className="text-xs text-gray-600 mt-2">{pr.remarks}</p>}
                  </div>
                )}
              </div>
            ))}

            {((paymentSubTab === 'pending' && pendingPaymentRequests.length === 0) ||
              (paymentSubTab === 'on-hold' && onHoldPaymentRequests.length === 0) ||
              (paymentSubTab === 'approved' && approvedPaymentRequests.length === 0)) && (
              <p className="text-center text-gray-500 py-4 text-sm">
                No {paymentSubTab === 'pending' ? 'pending' : paymentSubTab === 'on-hold' ? 'on hold' : 'approved'} payment requests
              </p>
            )}
          </div>
        </Card>
        </div>
      )}
      {/* Disbursement Vouchers Tab */}
      {activeTab === 'disbursement-vouchers' && (
        <div className="space-y-4">
          {/* DV Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDvSubTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                dvSubTab === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Pending</span>
                {pendingDVs.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    dvSubTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pendingDVs.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setDvSubTab('approved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                dvSubTab === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Approved</span>
                {approvedDVs.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    dvSubTab === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                  }`}>
                    {approvedDVs.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <Card>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {dvSubTab === 'pending' ? 'Pending Disbursement Vouchers' : 'Approved Disbursement Vouchers'}
              </h3>
              <span className="text-sm text-gray-500">
                {dvSubTab === 'pending' ? `${pendingDVs.length} pending` : `${approvedDVs.length} approved`}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">DV Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Source Ref</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Supplier/Payee</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pending DVs */}
                  {dvSubTab === 'pending' && pendingDVs.map(dv => (
                    <React.Fragment key={dv.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === dv.id ? null : dv.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{dv.dv_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {(() => {
                            const ref = getDVSourceRef(dv);
                            return ref.type ? <span><span className="text-xs text-gray-400">{ref.type}</span> {ref.num}</span> : ref.num;
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{getDVSupplierName(dv)}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(dv.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(dv)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === dv.id}
                              onClick={(e) => { e.stopPropagation(); handleApproveDV(dv.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewDV(dv); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === dv.id ? null : dv.id); }}
                            >
                              {expandedId === dv.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === dv.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Particulars</p>
                                <p className="text-sm text-gray-900">{dv.particulars || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project</p>
                                <p className="text-sm text-gray-900">{dv.project || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{dv.order_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Check Number</p>
                                <p className="text-sm text-gray-900">{dv.check_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Bank Name</p>
                                <p className="text-sm text-gray-900">{dv.bank_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Payment Date</p>
                                <p className="text-sm text-gray-900">{formatDate(dv.payment_date)}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Approved DVs */}
                  {dvSubTab === 'approved' && approvedDVs.map(dv => (
                    <React.Fragment key={dv.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === dv.id ? null : dv.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{dv.dv_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {(() => {
                            const ref = getDVSourceRef(dv);
                            return ref.type ? <span><span className="text-xs text-gray-400">{ref.type}</span> {ref.num}</span> : ref.num;
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{getDVSupplierName(dv)}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(dv.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(dv)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewDV(dv); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === dv.id ? null : dv.id); }}
                            >
                              {expandedId === dv.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === dv.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Particulars</p>
                                <p className="text-sm text-gray-900">{dv.particulars || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project</p>
                                <p className="text-sm text-gray-900">{dv.project || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{dv.order_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Check Number</p>
                                <p className="text-sm text-gray-900">{dv.check_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Bank Name</p>
                                <p className="text-sm text-gray-900">{dv.bank_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Payment Date</p>
                                <p className="text-sm text-gray-900">{formatDate(dv.payment_date)}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {((dvSubTab === 'pending' && pendingDVs.length === 0) ||
                    (dvSubTab === 'approved' && approvedDVs.length === 0)) && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">
                        No {dvSubTab === 'pending' ? 'pending' : 'approved'} disbursement vouchers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Service Requests Tab */}
      {activeTab === 'service-requests' && (
        <div className="space-y-4">
          {/* SR Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSrSubTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                srSubTab === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Pending</span>
                {pendingServiceRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    srSubTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pendingServiceRequests.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setSrSubTab('on-hold')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                srSubTab === 'on-hold'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>On Hold</span>
                {onHoldServiceRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    srSubTab === 'on-hold' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {onHoldServiceRequests.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setSrSubTab('approved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                srSubTab === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Approved</span>
                {approvedServiceRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    srSubTab === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                  }`}>
                    {approvedServiceRequests.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <Card>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {srSubTab === 'pending' && 'Pending Service Requests'}
                {srSubTab === 'on-hold' && 'On Hold Service Requests'}
                {srSubTab === 'approved' && 'Approved Service Requests'}
              </h3>
              <span className="text-sm text-gray-500">
                {srSubTab === 'pending' && `${pendingServiceRequests.length} pending`}
                {srSubTab === 'on-hold' && `${onHoldServiceRequests.length} on hold`}
                {srSubTab === 'approved' && `${approvedServiceRequests.length} approved`}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">SR Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Purpose</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pending SRs */}
                  {srSubTab === 'pending' && pendingServiceRequests.map(sr => (
                    <React.Fragment key={sr.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === sr.id ? null : sr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{sr.sr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{sr.purpose || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(sr.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(sr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === sr.id}
                              onClick={(e) => { e.stopPropagation(); handleApproveSR(sr.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={processingId === sr.id}
                              onClick={(e) => { e.stopPropagation(); handleRejectSR(sr.id); }}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewSR(sr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === sr.id ? null : sr.id); }}
                            >
                              {expandedId === sr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === sr.id && (
                        <tr>
                          <td colSpan="5" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Service Type</p>
                                <p className="text-sm text-gray-900">{sr.service_type || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">SR Type</p>
                                <p className="text-sm text-gray-900">{sr.sr_type || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project</p>
                                <p className="text-sm text-gray-900">{sr.project || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Supplier</p>
                                <p className="text-sm text-gray-900">{sr.supplier_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Quantity</p>
                                <p className="text-sm text-gray-900">{sr.quantity ? `${sr.quantity} ${sr.unit || ''}` : '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                <p className="text-sm text-gray-900">{formatDate(sr.date_needed)}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* On Hold SRs */}
                  {srSubTab === 'on-hold' && onHoldServiceRequests.map(sr => (
                    <React.Fragment key={sr.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === sr.id ? null : sr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{sr.sr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{sr.purpose || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(sr.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(sr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === sr.id}
                              onClick={(e) => { e.stopPropagation(); handleApproveSR(sr.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewSR(sr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === sr.id ? null : sr.id); }}
                            >
                              {expandedId === sr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === sr.id && (
                        <tr>
                          <td colSpan="5" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Service Type</p>
                                <p className="text-sm text-gray-900">{sr.service_type || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">SR Type</p>
                                <p className="text-sm text-gray-900">{sr.sr_type || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project</p>
                                <p className="text-sm text-gray-900">{sr.project || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Supplier</p>
                                <p className="text-sm text-gray-900">{sr.supplier_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Quantity</p>
                                <p className="text-sm text-gray-900">{sr.quantity ? `${sr.quantity} ${sr.unit || ''}` : '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                <p className="text-sm text-gray-900">{formatDate(sr.date_needed)}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Approved SRs */}
                  {srSubTab === 'approved' && approvedServiceRequests.map(sr => (
                    <React.Fragment key={sr.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === sr.id ? null : sr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{sr.sr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{sr.purpose || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(sr.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(sr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewSR(sr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === sr.id ? null : sr.id); }}
                            >
                              {expandedId === sr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === sr.id && (
                        <tr>
                          <td colSpan="5" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Service Type</p>
                                <p className="text-sm text-gray-900">{sr.service_type || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">SR Type</p>
                                <p className="text-sm text-gray-900">{sr.sr_type || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project</p>
                                <p className="text-sm text-gray-900">{sr.project || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Supplier</p>
                                <p className="text-sm text-gray-900">{sr.supplier_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Quantity</p>
                                <p className="text-sm text-gray-900">{sr.quantity ? `${sr.quantity} ${sr.unit || ''}` : '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                <p className="text-sm text-gray-900">{formatDate(sr.date_needed)}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {((srSubTab === 'pending' && pendingServiceRequests.length === 0) ||
                    (srSubTab === 'on-hold' && onHoldServiceRequests.length === 0) ||
                    (srSubTab === 'approved' && approvedServiceRequests.length === 0)) && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-500">
                        No {srSubTab === 'pending' ? 'pending' : srSubTab === 'on-hold' ? 'on hold' : 'approved'} service requests
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Cash Requests Tab */}
      {activeTab === 'cash-requests' && (
        <div className="space-y-4">
          {/* CR Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCrSubTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                crSubTab === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Pending</span>
                {pendingCashRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    crSubTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pendingCashRequests.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setCrSubTab('on-hold')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                crSubTab === 'on-hold'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>On Hold</span>
                {onHoldCashRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    crSubTab === 'on-hold' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {onHoldCashRequests.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setCrSubTab('approved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                crSubTab === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Approved</span>
                {approvedCashRequests.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    crSubTab === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                  }`}>
                    {approvedCashRequests.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <Card>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {crSubTab === 'pending' && 'Pending Cash Requests'}
                {crSubTab === 'on-hold' && 'On Hold Cash Requests'}
                {crSubTab === 'approved' && 'Approved Cash Requests'}
              </h3>
              <span className="text-sm text-gray-500">
                {crSubTab === 'pending' && `${pendingCashRequests.length} pending`}
                {crSubTab === 'on-hold' && `${onHoldCashRequests.length} on hold`}
                {crSubTab === 'approved' && `${approvedCashRequests.length} approved`}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">CR Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Purpose</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pending CRs */}
                  {crSubTab === 'pending' && pendingCashRequests.map(cr => (
                    <React.Fragment key={cr.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === cr.id ? null : cr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{cr.cr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{cr.purpose || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(cr.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(cr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === cr.id}
                              onClick={(e) => { e.stopPropagation(); handleApproveCR(cr.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={processingId === cr.id}
                              onClick={(e) => { e.stopPropagation(); handleHoldCR(cr.id); }}
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={processingId === cr.id}
                              onClick={(e) => { e.stopPropagation(); handleRejectCR(cr.id); }}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewCR(cr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === cr.id ? null : cr.id); }}
                            >
                              {expandedId === cr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === cr.id && (
                        <tr>
                          <td colSpan="5" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project</p>
                                <p className="text-sm text-gray-900">{cr.project || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{cr.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Supplier</p>
                                <p className="text-sm text-gray-900">{cr.supplier_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Quantity</p>
                                <p className="text-sm text-gray-900">{cr.quantity ? `${cr.quantity} ${cr.unit || ''}` : '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                <p className="text-sm text-gray-900">{formatDate(cr.date_needed)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{cr.order_number || '-'}</p>
                              </div>
                            </div>
                            {cr.remarks && (
                              <div className="mt-4">
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{cr.remarks}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* On Hold CRs */}
                  {crSubTab === 'on-hold' && onHoldCashRequests.map(cr => (
                    <React.Fragment key={cr.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === cr.id ? null : cr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{cr.cr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{cr.purpose || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(cr.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(cr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === cr.id}
                              onClick={(e) => { e.stopPropagation(); handleApproveCR(cr.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewCR(cr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === cr.id ? null : cr.id); }}
                            >
                              {expandedId === cr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === cr.id && (
                        <tr>
                          <td colSpan="5" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project</p>
                                <p className="text-sm text-gray-900">{cr.project || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{cr.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Supplier</p>
                                <p className="text-sm text-gray-900">{cr.supplier_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Quantity</p>
                                <p className="text-sm text-gray-900">{cr.quantity ? `${cr.quantity} ${cr.unit || ''}` : '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                <p className="text-sm text-gray-900">{formatDate(cr.date_needed)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{cr.order_number || '-'}</p>
                              </div>
                            </div>
                            {cr.remarks && (
                              <div className="mt-4">
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{cr.remarks}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Approved CRs */}
                  {crSubTab === 'approved' && approvedCashRequests.map(cr => (
                    <React.Fragment key={cr.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === cr.id ? null : cr.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{cr.cr_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{cr.purpose || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(cr.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(cr)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewCR(cr); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === cr.id ? null : cr.id); }}
                            >
                              {expandedId === cr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === cr.id && (
                        <tr>
                          <td colSpan="5" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project</p>
                                <p className="text-sm text-gray-900">{cr.project || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{cr.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Supplier</p>
                                <p className="text-sm text-gray-900">{cr.supplier_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Quantity</p>
                                <p className="text-sm text-gray-900">{cr.quantity ? `${cr.quantity} ${cr.unit || ''}` : '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                <p className="text-sm text-gray-900">{formatDate(cr.date_needed)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{cr.order_number || '-'}</p>
                              </div>
                            </div>
                            {cr.remarks && (
                              <div className="mt-4">
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{cr.remarks}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {((crSubTab === 'pending' && pendingCashRequests.length === 0) ||
                    (crSubTab === 'on-hold' && onHoldCashRequests.length === 0) ||
                    (crSubTab === 'approved' && approvedCashRequests.length === 0)) && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-500">
                        No {crSubTab === 'pending' ? 'pending' : crSubTab === 'on-hold' ? 'on hold' : 'approved'} cash requests
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Payment Orders Tab */}
      {activeTab === 'payment-orders' && (
        <div className="space-y-4">
          {/* Payment Order Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPaymentOrderSubTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                paymentOrderSubTab === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Pending</span>
                {pendingPaymentOrders.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    paymentOrderSubTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pendingPaymentOrders.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setPaymentOrderSubTab('on-hold')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                paymentOrderSubTab === 'on-hold'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>On Hold</span>
                {onHoldPaymentOrders.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    paymentOrderSubTab === 'on-hold' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {onHoldPaymentOrders.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setPaymentOrderSubTab('approved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                paymentOrderSubTab === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Approved</span>
                {approvedPaymentOrders.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    paymentOrderSubTab === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                  }`}>
                    {approvedPaymentOrders.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <Card>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {paymentOrderSubTab === 'pending' && 'Pending Payment Orders'}
                {paymentOrderSubTab === 'on-hold' && 'On Hold Payment Orders'}
                {paymentOrderSubTab === 'approved' && 'Approved Payment Orders'}
              </h3>
              <span className="text-sm text-gray-500">
                {paymentOrderSubTab === 'pending' && `${pendingPaymentOrders.length} pending`}
                {paymentOrderSubTab === 'on-hold' && `${onHoldPaymentOrders.length} on hold`}
                {paymentOrderSubTab === 'approved' && `${approvedPaymentOrders.length} approved`}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">PO Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Payee Name</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pending Payment Orders */}
                  {paymentOrderSubTab === 'pending' && pendingPaymentOrders.map(po => (
                    <React.Fragment key={po.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.payee_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.project || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(po.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(po)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === po.id}
                              onClick={(e) => { e.stopPropagation(); handleApprovePaymentOrder(po.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={processingId === po.id}
                              onClick={(e) => { e.stopPropagation(); handleHoldPaymentOrder(po.id); }}
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPaymentOrder(po); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === po.id ? null : po.id); }}
                            >
                              {expandedId === po.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === po.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                <p className="text-sm text-gray-900">{po.payee_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                <p className="text-sm text-gray-900">{po.purpose || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{po.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{po.order_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">SR Number</p>
                                <p className="text-sm text-gray-900">{po.sr_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Prepared By</p>
                                <p className="text-sm text-gray-900">{po.first_name} {po.last_name}</p>
                              </div>
                            </div>
                            {po.remarks && (
                              <div className="mt-4">
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{po.remarks}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* On Hold Payment Orders */}
                  {paymentOrderSubTab === 'on-hold' && onHoldPaymentOrders.map(po => (
                    <React.Fragment key={po.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.payee_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.project || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(po.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(po)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === po.id}
                              onClick={(e) => { e.stopPropagation(); handleApprovePaymentOrder(po.id); }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPaymentOrder(po); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === po.id ? null : po.id); }}
                            >
                              {expandedId === po.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === po.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                <p className="text-sm text-gray-900">{po.payee_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                <p className="text-sm text-gray-900">{po.purpose || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{po.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{po.order_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">SR Number</p>
                                <p className="text-sm text-gray-900">{po.sr_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Prepared By</p>
                                <p className="text-sm text-gray-900">{po.first_name} {po.last_name}</p>
                              </div>
                            </div>
                            {po.remarks && (
                              <div className="mt-4">
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{po.remarks}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Approved Payment Orders */}
                  {paymentOrderSubTab === 'approved' && approvedPaymentOrders.map(po => (
                    <React.Fragment key={po.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.payee_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{po.project || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(po.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(po)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewPaymentOrder(po); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === po.id ? null : po.id); }}
                            >
                              {expandedId === po.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === po.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Payee Address</p>
                                <p className="text-sm text-gray-900">{po.payee_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                <p className="text-sm text-gray-900">{po.purpose || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                <p className="text-sm text-gray-900">{po.project_address || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                <p className="text-sm text-gray-900">{po.order_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">SR Number</p>
                                <p className="text-sm text-gray-900">{po.sr_number || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">Prepared By</p>
                                <p className="text-sm text-gray-900">{po.first_name} {po.last_name}</p>
                              </div>
                            </div>
                            {po.remarks && (
                              <div className="mt-4">
                                <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                <p className="text-sm text-gray-900">{po.remarks}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {((paymentOrderSubTab === 'pending' && pendingPaymentOrders.length === 0) ||
                    (paymentOrderSubTab === 'on-hold' && onHoldPaymentOrders.length === 0) ||
                    (paymentOrderSubTab === 'approved' && approvedPaymentOrders.length === 0)) && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">
                        No {paymentOrderSubTab === 'pending' ? 'pending' : paymentOrderSubTab === 'on-hold' ? 'on hold' : 'approved'} payment orders
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Reimbursements Tab */}
      {activeTab === 'reimbursements' && (
        <div className="space-y-4">
          {/* RMB Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRmbSubTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                rmbSubTab === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Pending</span>
                {pendingReimbursements.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    rmbSubTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pendingReimbursements.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setRmbSubTab('on-hold')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                rmbSubTab === 'on-hold'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>On Hold</span>
                {onHoldReimbursements.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    rmbSubTab === 'on-hold' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {onHoldReimbursements.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setRmbSubTab('approved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                rmbSubTab === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>Approved</span>
                {approvedReimbursements.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    rmbSubTab === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                  }`}>
                    {approvedReimbursements.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <Card>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {rmbSubTab === 'pending' && 'Pending Reimbursements'}
                {rmbSubTab === 'on-hold' && 'On Hold Reimbursements'}
                {rmbSubTab === 'approved' && 'Approved Reimbursements'}
              </h3>
              <span className="text-sm text-gray-500">
                {rmbSubTab === 'pending' && `${pendingReimbursements.length} pending`}
                {rmbSubTab === 'on-hold' && `${onHoldReimbursements.length} on hold`}
                {rmbSubTab === 'approved' && `${approvedReimbursements.length} approved`}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">RMB Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Payee</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pending Reimbursements */}
                  {rmbSubTab === 'pending' && pendingReimbursements.map(r => (
                    <React.Fragment key={r.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{r.rmb_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{r.payee}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{r.project || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(r.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(r)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === r.id}
                              onClick={(e) => { e.stopPropagation(); handleApproveReimbursement(r.id, 'approved'); }}
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={processingId === r.id}
                              onClick={(e) => { e.stopPropagation(); handleApproveReimbursement(r.id, 'rejected'); }}
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === r.id ? null : r.id); }}
                            >
                              {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                  <p className="text-sm text-gray-900">{r.project_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                  <p className="text-sm text-gray-900">{r.order_number || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                  <p className="text-sm text-gray-900">{r.date_needed ? new Date(r.date_needed).toLocaleDateString() : '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                  <p className="text-sm text-gray-900">{r.purpose || '-'}</p>
                                </div>
                              </div>
                              {r.remarks && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                  <p className="text-sm text-gray-900">{r.remarks}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* On Hold Reimbursements */}
                  {rmbSubTab === 'on-hold' && onHoldReimbursements.map(r => (
                    <React.Fragment key={r.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{r.rmb_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{r.payee}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{r.project || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(r.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(r)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === r.id}
                              onClick={(e) => { e.stopPropagation(); handleApproveReimbursement(r.id, 'approved'); }}
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === r.id ? null : r.id); }}
                            >
                              {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                  <p className="text-sm text-gray-900">{r.project_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                  <p className="text-sm text-gray-900">{r.order_number || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                  <p className="text-sm text-gray-900">{r.date_needed ? new Date(r.date_needed).toLocaleDateString() : '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                  <p className="text-sm text-gray-900">{r.purpose || '-'}</p>
                                </div>
                              </div>
                              {r.remarks && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                  <p className="text-sm text-gray-900">{r.remarks}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Approved Reimbursements */}
                  {rmbSubTab === 'approved' && approvedReimbursements.map(r => (
                    <React.Fragment key={r.id}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{r.rmb_number}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{r.payee}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{r.project || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(r.amount)}</td>
                        <td className="py-3 px-4">{renderStatusWithLock(r)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === r.id ? null : r.id); }}
                            >
                              {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr>
                          <td colSpan="6" className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Project Address</p>
                                  <p className="text-sm text-gray-900">{r.project_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Order Number</p>
                                  <p className="text-sm text-gray-900">{r.order_number || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                                  <p className="text-sm text-gray-900">{r.date_needed ? new Date(r.date_needed).toLocaleDateString() : '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Purpose</p>
                                  <p className="text-sm text-gray-900">{r.purpose || '-'}</p>
                                </div>
                              </div>
                              {r.remarks && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Remarks</p>
                                  <p className="text-sm text-gray-900">{r.remarks}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {((rmbSubTab === 'pending' && pendingReimbursements.length === 0) ||
                    (rmbSubTab === 'on-hold' && onHoldReimbursements.length === 0) ||
                    (rmbSubTab === 'approved' && approvedReimbursements.length === 0)) && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">
                        No {rmbSubTab === 'pending' ? 'pending' : rmbSubTab === 'on-hold' ? 'on hold' : 'approved'} reimbursements
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* PR Preview Modal */}
      {previewPR && (
        <PRPreviewModal
          pr={previewPRDetails || previewPR}
          loading={loadingPreview}
          onClose={() => setPreviewPR(null)}
          onApprove={handleApprovePR}
          onReject={handleRejectPR}
          processingId={processingId}
        />
      )}

      {/* PO Preview Modal */}
      {previewPO && (
        <POPreviewModal
          po={previewPODetails || previewPO}
          loading={loadingPreview}
          onClose={() => setPreviewPO(null)}
          onApprove={handleApprovePO}
          onHold={handleHoldPO}
          processingId={processingId}
        />
      )}

      {/* Payment Request Preview Modal */}
      {previewPayment && (
        <PaymentRequestPreviewModal
          payment={previewPaymentDetails || previewPayment}
          loading={loadingPreview}
          onClose={() => setPreviewPayment(null)}
          onApprove={handleApprovePaymentRequest}
          onHold={handleHoldPaymentRequest}
          processingId={processingId}
        />
      )}

      {/* DV Preview Modal */}
      {previewDV && (
        <DVPreviewModal
          dv={previewDVDetails || previewDV}
          loading={loadingPreview}
          onClose={() => setPreviewDV(null)}
          onApprove={handleApproveDV}
          processingId={processingId}
        />
      )}

      {/* SR Preview Modal */}
      {previewSR && (
        <SRPreviewModal
          sr={previewSRDetails || previewSR}
          loading={loadingPreview}
          onClose={() => setPreviewSR(null)}
          onApprove={handleApproveSR}
          onHold={handleRejectSR}
          processingId={processingId}
        />
      )}

      {/* CR Preview Modal */}
      {previewCR && (
        <CRPreviewModal
          cr={previewCRDetails || previewCR}
          loading={loadingPreview}
          onClose={() => setPreviewCR(null)}
          onApprove={handleApproveCR}
          onHold={handleHoldCR}
          processingId={processingId}
        />
      )}

      {/* Payment Order Preview Modal */}
      {previewPaymentOrder && (
        <POApprovalPreviewModal
          po={previewPaymentOrderDetails || previewPaymentOrder}
          loading={loadingPreview}
          onClose={() => setPreviewPaymentOrder(null)}
          onApprove={handleApprovePaymentOrder}
          onHold={handleHoldPaymentOrder}
          processingId={processingId}
        />
      )}

      {/* PR Rejection Modal */}
      {showRejectModal && rejectPR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Reject Purchase Request</h3>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* PR Details */}
              <div className="mb-6 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">PR Number</p>
                    <p className="text-sm font-medium text-gray-900">{rejectPR.pr_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Project</p>
                    <p className="text-sm font-medium text-gray-900">{rejectPR.project || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Amount</p>
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(calculatePRAmount(rejectPR, prAmounts))}</p>
                </div>
              </div>

              {/* Remarks */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks
                </label>
                <textarea
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="Enter remarks (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  rows="3"
                />
              </div>

              {/* Item Rejection Remarks */}
              {rejectPR?.items && rejectPR.items.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Item Rejection Remarks (Optional)
                  </label>
                  <div className="space-y-3">
                    {rejectPR.items.map((item, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.item_name || item.description || item.item_code}</p>
                          <p className="text-xs text-gray-500">{item.quantity} {item.unit}</p>
                        </div>
                        <input
                          type="text"
                          value={itemRemarks[index] || ''}
                          onChange={(e) => setItemRemarks({...itemRemarks, [index]: e.target.value})}
                          placeholder="Reason for rejecting this item (optional)"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    You can reject specific items above or leave empty to reject the entire PR.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <Button
                variant="secondary"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={submitRejection}
                disabled={processingId === rejectPR.id}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
