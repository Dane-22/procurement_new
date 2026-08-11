import React, { useState, useEffect } from 'react';
import { disbursementVoucherService } from '../../services/disbursementVouchers';
import { purchaseOrderService } from '../../services/purchaseOrders';
import { paymentRequestService } from '../../services/paymentRequests';
import { paymentOrderService } from '../../services/paymentOrders';
import { serviceRequestService } from '../../services/serviceRequests';
import { cashRequestService } from '../../services/cashRequests';
import { FileText, Plus, Download, Search, ChevronDown, ChevronUp, X, CheckCircle, Eye } from 'lucide-react';
import DVPreviewModal from './DVPreviewModal';
import { useAuth } from '../../contexts/AuthContext';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
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

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'For Approval': 'bg-blue-100 text-blue-800',
      'Approved': 'bg-green-100 text-green-800',
      'Paid': 'bg-purple-100 text-purple-800',
      'Cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  );
};

const DisbursementVouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentOrders, setPaymentOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [cashRequests, setCashRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sourceType, setSourceType] = useState('po'); // 'po', 'payment_request', or 'payment_order'
  const [selectedSource, setSelectedSource] = useState(null);
  const [scheduleOptions, setScheduleOptions] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedScheduleSourceType, setSelectedScheduleSourceType] = useState('');
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payingVoucherId, setPayingVoucherId] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewVoucher, setPreviewVoucher] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    particulars: '',
    project: '',
    order_number: '',
    check_number: '',
    bank_name: '',
    payment_date: '',
    received_by: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vouchersData, posData, prData, poData, srData, crData] = await Promise.all([
        disbursementVoucherService.getAll(),
        purchaseOrderService.getAll(),
        paymentRequestService.getAll(),
        paymentOrderService.getAll(),
        serviceRequestService.getAll(),
        cashRequestService.getAll()
      ]);
      setVouchers(vouchersData);
      
      // A single approved PO can now drive multiple DVs via payment schedules.
      const approvedPOs = posData.filter(po => po.status === 'Approved');
      setPurchaseOrders(approvedPOs);
      
      const approvedPRs = prData.filter(pr =>
        (pr.status === 'Approved' || pr.status === 'DV Created') &&
        (pr.payment_schedule_count || 0) > 0
      );
      setPaymentRequests(approvedPRs);

      // Filter approved Payment Orders that don't have a DV yet
      const approvedPOsData = poData.filter(po => po.status === 'Approved');
      const paymentOrderIdsWithDV = new Set(vouchersData.filter(v => v.payment_order_id).map(v => v.payment_order_id));
      const availablePaymentOrders = approvedPOsData.filter(po => !paymentOrderIdsWithDV.has(po.id));
      setPaymentOrders(availablePaymentOrders);

      // Store SR and CR data for reference
      setServiceRequests(srData);
      setCashRequests(crData);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDV = async (e, saveAsDraft = false) => {
    e.preventDefault();
    if (!selectedSource) {
      alert('Please select a source');
      return;
    }
    if (!selectedScheduleId) {
      alert('Please select a payment schedule.');
      return;
    }

    try {
      setSubmitting(true);
      
      const dvData = {
        particulars: formData.particulars || 'Payment for the procurement of materials',
        project: formData.project || selectedSource.project,
        order_number: formData.order_number || selectedSource.order_number,
        check_number: formData.check_number,
        bank_name: formData.bank_name,
        payment_date: formData.payment_date,
        received_by: formData.received_by,
        schedule_id: Number(selectedScheduleId) || null,
        schedule_source_type: selectedScheduleSourceType || null,
        save_as_draft: saveAsDraft
      };
      
      // Add the appropriate source ID
      if (sourceType === 'po') {
        dvData.purchase_order_id = selectedSource.id;
      } else if (sourceType === 'payment_request') {
        dvData.payment_request_id = selectedSource.id;
      } else if (sourceType === 'payment_order') {
        dvData.payment_order_id = selectedSource.id;
      }
      
      await disbursementVoucherService.create(dvData);
      await fetchData();
      closeCreateModal();
      alert(saveAsDraft ? 'Disbursement Voucher saved as draft!' : 'Disbursement Voucher created successfully!');
    } catch (err) {
      alert('Failed to create DV: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async (id) => {
    try {
      const blob = await disbursementVoucherService.exportToExcel(id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DV-${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export DV');
    }
  };

  const openPreview = (voucher) => {
    setPreviewVoucher(voucher);
    setShowPreviewModal(true);
  };

  const closePreview = () => {
    setShowPreviewModal(false);
    setPreviewVoucher(null);
  };

  const handleMarkPaid = async (voucher) => {
    if (!voucher?.id) return;

    const confirmed = window.confirm(`Mark DV "${voucher.dv_number}" as Paid?`);
    if (!confirmed) return;

    try {
      setPayingVoucherId(voucher.id);
      const today = new Date();
      const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      await disbursementVoucherService.markAsPaid(voucher.id, {
        check_number: voucher.check_number || '',
        bank_name: voucher.bank_name || '',
        payment_date: voucher.payment_date ? String(voucher.payment_date).slice(0, 10) : todayYmd,
        received_by: voucher.received_by || voucher.supplier_name || voucher.payee_name || '',
        received_date: todayYmd
      });

      await fetchData();
      alert(`Disbursement voucher "${voucher.dv_number}" marked as Paid.`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark disbursement voucher as paid');
    } finally {
      setPayingVoucherId(null);
    }
  };

  // Helper to get source reference number
  const getSourceRef = (voucher) => {
    console.log('DV Source Debug:', {
      dv_number: voucher.dv_number,
      dv_type: voucher.dv_type,
      po_number: voucher.po_number,
      pr_number: voucher.pr_number,
      payment_request_pr_number: voucher.payment_request_pr_number,
      payment_request_sr_number: voucher.payment_request_sr_number,
      sr_number: voucher.sr_number,
      cr_number: voucher.cr_number,
      service_request_id: voucher.service_request_id,
      purchase_request_id: voucher.purchase_request_id,
      payment_request_id: voucher.payment_request_id,
      purchase_order_id: voucher.purchase_order_id,
      cash_request_id: voucher.cash_request_id
    });
    if (voucher.po_number) return { num: voucher.po_number, type: 'PO' };
    if (voucher.pr_number) return { num: voucher.pr_number, type: 'PR' };
    if (voucher.payment_request_pr_number) return { num: voucher.payment_request_pr_number, type: 'PR' };
    if (voucher.sr_number) return { num: voucher.sr_number, type: 'SR' };
    if (voucher.payment_request_sr_number) return { num: voucher.payment_request_sr_number, type: 'SR' };
    if (voucher.cr_number) return { num: voucher.cr_number, type: 'CR' };
    return { num: '-', type: '' };
  };

  // Helper to get supplier name
  const getSupplierName = (voucher) => {
    return voucher.supplier_name || voucher.payee_name || '-';
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSourceType('po');
    setSelectedSource(null);
    setScheduleOptions([]);
    setSelectedScheduleId('');
    setSelectedScheduleSourceType('');
    setLoadingSchedules(false);
    setFormData({
      particulars: '',
      project: '',
      order_number: '',
      check_number: '',
      bank_name: '',
      payment_date: '',
      received_by: ''
    });
  };

  // Helper to get source type label
  const getSourceTypeLabel = (source) => {
    if (source.sr_type) return ` (${source.sr_type === 'payment_request' ? 'Payment Request' : 'Payment Order'})`;
    if (source.cr_type) return ` (${source.cr_type === 'payment_request' ? 'Payment Request' : 'Payment Order'})`;
    return '';
  };

  const getSourceApiType = (type) => {
    if (type === 'po') return 'purchase_order';
    if (type === 'payment_request') return 'payment_request';
    if (type === 'payment_order') return 'payment_order';
    return '';
  };

  const handleSelectSource = async (source) => {
    setSelectedSource(source);
    setSelectedScheduleId('');
    setScheduleOptions([]);
    setSelectedScheduleSourceType('');

    const sourceApiType = getSourceApiType(sourceType);
    if (!sourceApiType || !source?.id) return;

    try {
      setLoadingSchedules(true);
      const result = await disbursementVoucherService.getSchedules(sourceApiType, source.id);
      const schedules = Array.isArray(result?.schedules)
        ? result.schedules.filter((schedule) => !schedule?.is_consumed)
        : [];
      setScheduleOptions(schedules);
      setSelectedScheduleSourceType(result?.schedule_source_type || '');
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to load payment schedules';
      alert(message);
      setScheduleOptions([]);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const filteredVouchers = vouchers.filter(voucher => 
    voucher.dv_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    voucher.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    voucher.po_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Disbursement Vouchers</h2>
          <p className="text-sm text-gray-500">Create and manage disbursement vouchers from approved purchase orders</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New DV
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by DV number, supplier, or PO number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {/* Vouchers List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">DV Number</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Source Ref</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Supplier/Payee</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.map(voucher => (
                <React.Fragment key={voucher.id}>
                  <tr 
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === voucher.id ? null : voucher.id)}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{voucher.dv_number}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {(() => {
                        const ref = getSourceRef(voucher);
                        return ref.type ? <span><span className="text-xs text-gray-400">{ref.type}</span> {ref.num}</span> : ref.num;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{getSupplierName(voucher)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(voucher.amount)}</td>
                    <td className="py-3 px-4"><StatusBadge status={voucher.status} /></td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDate(voucher.dv_date)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {user?.role === 'admin' && voucher.status !== 'Paid' && (
                          <Button
                            variant="success"
                            size="sm"
                            disabled={payingVoucherId === voucher.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkPaid(voucher);
                            }}
                            className="px-2"
                          >
                            {payingVoucherId === voucher.id ? 'Paying...' : 'Mark Paid'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openPreview(voucher); }}
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleExport(voucher.id); }}
                          title="Export to Excel"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === voucher.id ? null : voucher.id); }}
                        >
                          {expandedId === voucher.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === voucher.id && (
                    <tr>
                      <td colSpan="7" className="bg-gray-50 p-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Particulars</p>
                            <p className="text-sm text-gray-900">{voucher.particulars || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Project</p>
                            <p className="text-sm text-gray-900">{voucher.project || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Order Number</p>
                            <p className="text-sm text-gray-900">{voucher.order_number || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Check Number</p>
                            <p className="text-sm text-gray-900">{voucher.check_number || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Bank Name</p>
                            <p className="text-sm text-gray-900">{voucher.bank_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Payment Date</p>
                            <p className="text-sm text-gray-900">{formatDate(voucher.payment_date)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Prepared By</p>
                            <p className="text-sm text-gray-900">{voucher.prepared_by_first_name} {voucher.prepared_by_last_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Accounting</p>
                            <p className="text-sm text-gray-900">
                              {voucher.certified_by_accounting ? `${voucher.accounting_first_name} ${voucher.accounting_last_name}` : 'Pending'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Manager</p>
                            <p className="text-sm text-gray-900">
                              {voucher.certified_by_manager ? `${voucher.manager_first_name} ${voucher.manager_last_name}` : 'Pending'}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredVouchers.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    No disbursement vouchers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Disbursement Voucher</h3>
              <button type="button" onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDV} className="p-6 space-y-6">
              {/* Source Type Toggle */}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setSourceType('po'); setSelectedSource(null); setScheduleOptions([]); setSelectedScheduleId(''); setSelectedScheduleSourceType(''); }}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    sourceType === 'po'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  Purchase Order ({purchaseOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceType('payment_request'); setSelectedSource(null); setScheduleOptions([]); setSelectedScheduleId(''); setSelectedScheduleSourceType(''); }}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    sourceType === 'payment_request'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  Payment Request ({paymentRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceType('payment_order'); setSelectedSource(null); setScheduleOptions([]); setSelectedScheduleId(''); setSelectedScheduleSourceType(''); }}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    sourceType === 'payment_order'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  Payment Order ({paymentOrders.length})
                </button>
              </div>

              {/* Source Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select {sourceType === 'po' ? 'Approved Purchase Order' : sourceType === 'payment_request' ? 'Approved Payment Request' : 'Approved Payment Order'} <span className="text-red-500">*</span>
                </label>
                {sourceType === 'po' ? (
                  purchaseOrders.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">No approved purchase orders available for DV creation.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto border border-gray-200 rounded-md p-2">
                      {purchaseOrders.map(po => (
                        <div
                          key={po.id}
                          onClick={() => handleSelectSource(po)}
                          className={`p-3 rounded-md cursor-pointer transition-colors ${
                            selectedSource?.id === po.id
                              ? 'bg-yellow-50 border border-yellow-300'
                              : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm text-gray-900">{po.po_number}</p>
                              <p className="text-xs text-gray-500">
                                {po.supplier_name}
                                {po.scheduled_payment_date ? ` • Due: ${formatDate(po.scheduled_payment_date)}` : ''}
                                {' • '}
                                {formatCurrency(po.scheduled_amount || po.total_amount)}
                              </p>
                            </div>
                            {selectedSource?.id === po.id && <CheckCircle className="w-5 h-5 text-yellow-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : sourceType === 'payment_request' ? (
                  paymentRequests.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">No approved payment requests available for DV creation.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto border border-gray-200 rounded-md p-2">
                      {paymentRequests.map(pr => (
                        <div
                          key={pr.id}
                          onClick={() => handleSelectSource(pr)}
                          className={`p-3 rounded-md cursor-pointer transition-colors ${
                            selectedSource?.id === pr.id
                              ? 'bg-yellow-50 border border-yellow-300'
                              : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm text-gray-900">{pr.pr_number}{getSourceTypeLabel(pr)}</p>
                              <p className="text-xs text-gray-500">{pr.payee_name} • {formatCurrency(pr.amount)}</p>
                            </div>
                            {selectedSource?.id === pr.id && <CheckCircle className="w-5 h-5 text-yellow-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  paymentOrders.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">No approved payment orders available for DV creation.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto border border-gray-200 rounded-md p-2">
                      {paymentOrders.map(po => {
                        // Find related SR or CR to get type info
                        const relatedSR = serviceRequests.find(sr => sr.id === po.service_request_id);
                        const relatedCR = cashRequests.find(cr => cr.id === po.cash_request_id);
                        const typeLabel = relatedSR?.sr_type === 'payment_request' || relatedCR?.cr_type === 'payment_request' 
                          ? ' (Payment Request)' 
                          : ' (Payment Order)';
                        
                        return (
                          <div
                            key={po.id}
                            onClick={() => handleSelectSource(po)}
                            className={`p-3 rounded-md cursor-pointer transition-colors ${
                              selectedSource?.id === po.id
                                ? 'bg-yellow-50 border border-yellow-300'
                                : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm text-gray-900">{po.po_number}{typeLabel}</p>
                                <p className="text-xs text-gray-500">{po.payee_name} • {formatCurrency(po.amount)}</p>
                              </div>
                              {selectedSource?.id === po.id && <CheckCircle className="w-5 h-5 text-yellow-500" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {selectedSource && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Payment Schedule <span className="text-red-500">*</span>
                    </label>
                    {loadingSchedules ? (
                      <div className="p-3 border border-gray-200 rounded-md text-sm text-gray-500">Loading schedules...</div>
                    ) : scheduleOptions.length === 0 ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                        No available payment schedules for this source.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-44 overflow-auto border border-gray-200 rounded-md p-2">
                        {scheduleOptions.map((schedule) => (
                          <label
                            key={schedule.id}
                            className={`flex items-center justify-between p-2 rounded-md border ${
                              Number(selectedScheduleId) === Number(schedule.id)
                                ? 'border-yellow-300 bg-yellow-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="min-w-0 pr-3">
                              <p className="text-sm font-medium text-gray-900">
                                {schedule.payment_date} • {formatCurrency(schedule.amount)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {schedule.due_label}
                                {schedule.note ? ` • ${schedule.note}` : ''}
                              </p>
                            </div>
                            <input
                              type="radio"
                              name="dv_schedule"
                              value={schedule.id}
                              checked={Number(selectedScheduleId) === Number(schedule.id)}
                              onChange={(e) => setSelectedScheduleId(e.target.value)}
                              className="h-4 w-4"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Particulars</label>
                      <textarea
                        value={formData.particulars}
                        onChange={(e) => setFormData({ ...formData, particulars: e.target.value })}
                        placeholder="Payment for the procurement of materials"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                      <input
                        type="text"
                        value={formData.project}
                        onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                        placeholder={selectedSource.project || 'Project name'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
                      <input
                        type="text"
                        value={formData.order_number}
                        onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                        placeholder={selectedSource.order_number || 'Order number'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check Number</label>
                      <input
                        type="text"
                        value={formData.check_number}
                        onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                        placeholder="Check number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder="Bank name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={formData.payment_date}
                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                    <input
                      type="text"
                      value={formData.received_by}
                      onChange={(e) => setFormData({ ...formData, received_by: e.target.value })}
                      placeholder="Name of recipient"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="secondary" onClick={closeCreateModal}>
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="secondary"
                  disabled={submitting || !selectedSource || !selectedScheduleId ||
                    (sourceType === 'po' ? purchaseOrders.length === 0 : 
                     sourceType === 'payment_request' ? paymentRequests.length === 0 :
                     paymentOrders.length === 0)}
                  onClick={(e) => handleCreateDV(e, true)}
                >
                  {submitting ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting || !selectedSource || !selectedScheduleId ||
                    (sourceType === 'po' ? purchaseOrders.length === 0 : 
                     sourceType === 'payment_request' ? paymentRequests.length === 0 :
                     paymentOrders.length === 0)}
                  onClick={(e) => handleCreateDV(e, false)}
                >
                  {submitting ? 'Creating...' : 'Create DV'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <DVPreviewModal
        dv={previewVoucher}
        loading={previewLoading}
        onClose={closePreview}
      />
    </div>
  );
};

export default DisbursementVouchers;
