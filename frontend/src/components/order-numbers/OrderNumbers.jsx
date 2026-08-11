import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { 
  FileText, Search, ChevronDown, ChevronUp, Building2, 
  ShoppingCart, Wrench, Banknote, Receipt, ArrowLeft,
  Calendar, MapPin, User, DollarSign, Filter, AlertCircle,
  X, CheckCircle, FileSpreadsheet
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import PRPreviewModal from '../purchase-requests/PRPreviewModal';
import SRPreviewModal from '../service-requests/SRPreviewModal';
import CRPreviewModal from '../cash-requests/CRPreviewModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const COLORS = {
  'Purchase Requests': '#3B82F6', // blue-500
  'Service Requests': '#10B981', // emerald-500
  'Cash Requests': '#F59E0B', // amber-500
  'Reimbursements': '#EF4444', // red-500
  'Purchase Orders': '#6366F1', // indigo-500
  'Payment Requests': '#8B5CF6', // violet-500
  'Payment Orders': '#EC4899' // pink-500
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const variants = {
    primary: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
    ghost: 'hover:bg-gray-100 text-gray-600'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  return (
    <button 
      className={`rounded-lg font-medium transition-colors flex items-center gap-2 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'For Approval': 'bg-blue-100 text-blue-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-gray-100 text-gray-600',
      'For Procurement Review': 'bg-orange-100 text-orange-800',
      'For Super Admin Final Approval': 'bg-purple-100 text-purple-800',
      'PO Created': 'bg-indigo-100 text-indigo-800',
      'Paid': 'bg-green-100 text-green-800',
      'On Hold': 'bg-orange-100 text-orange-800',
      'Completed': 'bg-green-100 text-green-800',
      'Received': 'bg-blue-100 text-blue-800',
      'For Purchase': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  );
};

const OrderNumbers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orderNumbers, setOrderNumbers] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedProject, setSelectedProject] = useState('all');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    purchaseRequests: true,
    serviceRequests: false,
    cashRequests: false,
    reimbursements: false,
    purchaseOrders: false,
    paymentRequests: false,
    paymentOrders: false
  });
  // Preview state
  const [previewItem, setPreviewItem] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Planned cost state
  const [plannedCost, setPlannedCost] = useState(null);
  const [isEditingPlannedCost, setIsEditingPlannedCost] = useState(false);
  const [plannedCostInput, setPlannedCostInput] = useState('');
  const [savingPlannedCost, setSavingPlannedCost] = useState(false);
  const [lockingOrder, setLockingOrder] = useState(false);

  useEffect(() => {
    fetchOrderNumbers();
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      fetchDashboardData(selectedOrder.order_number, selectedProject);
    }
  }, [selectedOrder, selectedProject]);

  const fetchOrderNumbers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/order-numbers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrderNumbers(response.data);
    } catch (error) {
      console.error('Failed to fetch order numbers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async (orderNumber, project) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const params = project && project !== 'all' ? `?project=${encodeURIComponent(project)}` : '';
      const response = await axios.get(`${API_BASE_URL}/order-numbers/dashboard/${encodeURIComponent(orderNumber)}${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(response.data);
      // Set planned cost from API response
      setPlannedCost(response.data.plannedCost);
      setPlannedCostInput(response.data.plannedCost ? response.data.plannedCost.toString() : '');
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.response?.data?.message || error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const savePlannedCost = async () => {
    try {
      setSavingPlannedCost(true);
      const token = localStorage.getItem('token');
      const value = parseFloat(plannedCostInput);
      
      if (isNaN(value) || value < 0) {
        alert('Please enter a valid amount');
        return;
      }

      await axios.put(
        `${API_BASE_URL}/order-numbers/${encodeURIComponent(selectedOrder.order_number)}/budget`,
        {
          planned_cost: value,
          project: selectedProject === 'all' ? null : selectedProject
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPlannedCost(value);
      setIsEditingPlannedCost(false);
      // Refresh dashboard to get updated data
      fetchDashboardData(selectedOrder.order_number, selectedProject);
    } catch (error) {
      console.error('Failed to save planned cost:', error);
      alert('Failed to save planned cost');
    } finally {
      setSavingPlannedCost(false);
    }
  };

  const canLockOrderNumber = ['procurement', 'admin', 'super_admin'].includes(user?.role);
  const isSelectedOrderLocked = Boolean(dashboardData?.lock?.isLocked);

  const handleLockOrderNumber = async () => {
    if (!selectedOrder?.order_number || !canLockOrderNumber || isSelectedOrderLocked) return;
    const confirmed = window.confirm(
      `Lock order number "${selectedOrder.order_number}" permanently?\n\nThis will block new requests and resubmits tied to this order number.`
    );
    if (!confirmed) return;

    try {
      setLockingOrder(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/order-numbers/${encodeURIComponent(selectedOrder.order_number)}/lock`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await Promise.all([
        fetchOrderNumbers(),
        fetchDashboardData(selectedOrder.order_number, selectedProject)
      ]);
      alert(`Order number "${selectedOrder.order_number}" locked successfully.`);
    } catch (error) {
      console.error('Failed to lock order number:', error);
      alert(error.response?.data?.message || 'Failed to lock order number');
    } finally {
      setLockingOrder(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const exportAllPurchaseRequestItems = async () => {
    if (!selectedOrder?.order_number) return;
    try {
      const token = localStorage.getItem('token');
      const params = selectedProject && selectedProject !== 'all'
        ? `?project=${encodeURIComponent(selectedProject)}`
        : '';

      const response = await axios.get(
        `${API_BASE_URL}/order-numbers/dashboard/${encodeURIComponent(selectedOrder.order_number)}/purchase-requests/export-items${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeOrderNumber = String(selectedOrder.order_number).replace(/[^a-z0-9-_]/gi, '');
      const safeProject = selectedProject && selectedProject !== 'all'
        ? String(selectedProject).replace(/[^a-z0-9-_ ]/gi, '')
        : 'ALL';
      a.href = url;
      a.download = `ORDER-${safeOrderNumber}-PR-ITEMS-${safeProject}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export PR items:', error);
      alert(error.response?.data?.message || 'Failed to export purchase request items');
    }
  };

  // Fetch preview data for a specific request
  const fetchPreviewData = async (item, type) => {
    try {
      setPreviewLoading(true);
      setPreviewType(type);
      const token = localStorage.getItem('token');
      
      // Map type to endpoint
      const endpointMap = {
        purchaseRequests: `purchase-requests/${item.id}`,
        serviceRequests: `service-requests/${item.id}`,
        cashRequests: `cash-requests/${item.id}`,
        reimbursements: `reimbursements/${item.id}`
      };
      
      const response = await axios.get(`${API_BASE_URL}/${endpointMap[type]}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle nested response structure (purchaseRequest, serviceRequest, etc.)
      const dataKeyMap = {
        purchaseRequests: 'purchaseRequest',
        serviceRequests: 'serviceRequest',
        cashRequests: 'cashRequest',
        reimbursements: 'reimbursement'
      };
      
      const dataKey = dataKeyMap[type];
      const itemData = response.data[dataKey] || response.data;
      setPreviewItem(itemData);
    } catch (error) {
      console.error('Failed to fetch preview data:', error);
      // Fallback to using the item from the table if API fails
      setPreviewItem(item);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewItem(null);
    setPreviewType(null);
  };

  const filteredOrders = orderNumbers.filter(o => 
    o.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.project?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Summary Cards Component
  const SummaryCards = () => {
    if (!dashboardData) return null;
    const { summary } = dashboardData;
    const totalActual = summary.totalActualCost;
    const remaining = plannedCost ? plannedCost - totalActual : null;
    const percentUsed = plannedCost && plannedCost > 0 ? (totalActual / plannedCost) * 100 : 0;
    const isOverBudget = remaining !== null && remaining < 0;

    const cards = [
      { 
        title: 'Total Actual Cost', 
        value: summary.totalActualCost, 
        icon: DollarSign, 
        color: 'bg-yellow-500',
        textColor: 'text-yellow-600'
      },
      ...(plannedCost !== null ? [{
        title: 'Planned Cost',
        value: plannedCost,
        icon: () => <span className="text-white text-sm">₱</span>,
        color: 'bg-purple-500',
        textColor: 'text-purple-600'
      }] : []),
      ...(remaining !== null ? [{
        title: isOverBudget ? 'Over Budget' : 'Remaining Budget',
        value: Math.abs(remaining),
        icon: isOverBudget ? AlertCircle : () => <span className="text-white text-sm">₱</span>,
        color: isOverBudget ? 'bg-red-500' : 'bg-green-500',
        textColor: isOverBudget ? 'text-red-600' : 'text-green-600',
        subtitle: isOverBudget ? `(${percentUsed.toFixed(1)}% over)` : `(${percentUsed.toFixed(1)}% used)`
      }] : []),
      { 
        title: 'Purchase Requests', 
        value: summary.purchaseRequests.total, 
        count: summary.purchaseRequests.count,
        icon: ShoppingCart, 
        color: 'bg-blue-500',
        textColor: 'text-blue-600'
      },
      { 
        title: 'Service Requests', 
        value: summary.serviceRequests.total, 
        count: summary.serviceRequests.count,
        icon: Wrench, 
        color: 'bg-emerald-500',
        textColor: 'text-emerald-600'
      },
      { 
        title: 'Cash Requests', 
        value: summary.cashRequests.total, 
        count: summary.cashRequests.count,
        icon: Banknote, 
        color: 'bg-amber-500',
        textColor: 'text-amber-600'
      },
      { 
        title: 'Reimbursements', 
        value: summary.reimbursements.total, 
        count: summary.reimbursements.count,
        icon: Receipt, 
        color: 'bg-red-500',
        textColor: 'text-red-600'
      },
      {
        title: 'Purchase Orders',
        value: dashboardData?.additionalSummary?.purchaseOrders?.total || 0,
        count: dashboardData?.additionalSummary?.purchaseOrders?.count || 0,
        icon: FileText,
        color: 'bg-indigo-500',
        textColor: 'text-indigo-600'
      },
      {
        title: 'Payment Requests',
        value: dashboardData?.additionalSummary?.paymentRequests?.total || 0,
        count: dashboardData?.additionalSummary?.paymentRequests?.count || 0,
        icon: Banknote,
        color: 'bg-violet-500',
        textColor: 'text-violet-600'
      },
      {
        title: 'Payment Orders',
        value: dashboardData?.additionalSummary?.paymentOrders?.total || 0,
        count: dashboardData?.additionalSummary?.paymentOrders?.count || 0,
        icon: CheckCircle,
        color: 'bg-pink-500',
        textColor: 'text-pink-600'
      }
    ];

    return (
      <>
        {/* Budget Progress Bar */}
        {plannedCost !== null && (
          <Card className="mb-4 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Budget Utilization</span>
              <span className={`text-sm font-bold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                {percentUsed.toFixed(1)}% {isOverBudget ? 'Over Budget' : 'Used'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Planned: {formatCurrency(plannedCost)}</span>
              <span>Actual: {formatCurrency(totalActual)}</span>
            </div>
          </Card>
        )}

        {/* Summary Cards Grid - Row 1 (5 cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {cards.slice(0, 5).map((card, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                  <p className={`text-xl font-bold ${card.textColor}`}>
                    {formatCurrency(card.value)}
                  </p>
                  {card.count !== undefined && (
                    <p className="text-xs text-gray-400 mt-1">{card.count} request(s)</p>
                  )}
                  {card.subtitle && (
                    <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
                  )}
                </div>
                <div className={`${card.color} p-2 rounded-lg`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Summary Cards Grid - Row 2 (5 cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {cards.slice(5).map((card, index) => (
            <Card key={index + 5} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                  <p className={`text-xl font-bold ${card.textColor}`}>
                    {formatCurrency(card.value)}
                  </p>
                  {card.count !== undefined && (
                    <p className="text-xs text-gray-400 mt-1">{card.count} request(s)</p>
                  )}
                  {card.subtitle && (
                    <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
                  )}
                </div>
                <div className={`${card.color} p-2 rounded-lg`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  };

  // Additional Cost Chart Component (for Purchase Orders, Payment Requests, Payment Orders)
  const AdditionalCostChart = () => {
    if (!dashboardData?.additionalSummary) return null;

    const data = [
      { name: 'Purchase Orders', value: dashboardData.additionalSummary.purchaseOrders?.total || 0, count: dashboardData.additionalSummary.purchaseOrders?.count || 0 },
      { name: 'Payment Requests', value: dashboardData.additionalSummary.paymentRequests?.total || 0, count: dashboardData.additionalSummary.paymentRequests?.count || 0 },
      { name: 'Payment Orders', value: dashboardData.additionalSummary.paymentOrders?.total || 0, count: dashboardData.additionalSummary.paymentOrders?.count || 0 }
    ].filter(item => item.value > 0);

    if (data.length === 0) {
      return (
        <Card className="p-6 mt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">PO & Payment Distribution</h3>
          <div className="flex items-center justify-center h-48 text-gray-400">
            No PO or payment data available
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-6 mt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">PO & Payment Distribution</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 gap-1 mt-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[item.name] }}
              />
              <span className="text-gray-600">{item.name}:</span>
              <span className="font-medium">{formatCurrency(item.value)}</span>
              <span className="text-xs text-gray-400">({item.count})</span>
            </div>
          ))}
        </div>
      </Card>
    );
  };
  const CostDistributionChart = () => {
    if (!dashboardData?.pieChartData?.length) return null;

    const data = dashboardData.pieChartData.filter(item => item.value > 0);
    if (data.length === 0) {
      return (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Distribution</h3>
          <div className="flex items-center justify-center h-64 text-gray-400">
            No cost data available
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[item.name] }}
              />
              <span className="text-gray-600">{item.name}:</span>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  // Request Table Component
  const RequestTable = ({ data, type, columns, onRowClick }) => {
    if (!data?.length) return null;

    const icons = {
      purchaseRequests: ShoppingCart,
      serviceRequests: Wrench,
      cashRequests: Banknote,
      reimbursements: Receipt,
      purchaseOrders: FileText,
      paymentRequests: Banknote,
      paymentOrders: CheckCircle
    };
    const Icon = icons[type];
    const isExpanded = expandedSections[type];
    const typeLabel = type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();

    // Helper to render cell content with StatusBadge for status column
    const renderCell = (col, item) => {
      const value = item[col.key];
      
      // Use StatusBadge for status column
      if (col.key === 'status') {
        return <StatusBadge status={value} />;
      }
      
      // Use format function if provided
      if (col.format) {
        return col.format(value, item);
      }
      
      return value;
    };

    return (
      <Card className="mb-4">
        <button 
          onClick={() => toggleSection(type)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: COLORS[typeLabel] }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">{typeLabel}</h3>
              <p className="text-sm text-gray-500">{data.length} item(s)</p>
            </div>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {isExpanded && (
          <div className="border-t border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    onClick={() => onRowClick(item, type)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(item, type);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Preview ${typeLabel} item`}
                  >
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className="px-4 py-3 text-sm">
                        {renderCell(col, item)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  };

  // Dashboard View
  if (selectedOrder) {
    return (
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => setSelectedOrder(null)}>
            <ArrowLeft className="w-5 h-5" />
            Back to Order Numbers
          </Button>
        </div>

        {/* Order Info Header */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedOrder.order_number}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {selectedOrder.project || 'No Project'}
                </span>
                {selectedOrder.project_address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {selectedOrder.project_address}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {isSelectedOrderLocked ? (
                <span className="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-red-100 text-red-700">
                  Locked
                </span>
              ) : null}

              {canLockOrderNumber && (
                <Button
                  variant="outline"
                  onClick={handleLockOrderNumber}
                  disabled={lockingOrder || isSelectedOrderLocked}
                  className={isSelectedOrderLocked ? 'opacity-60 cursor-not-allowed' : ''}
                >
                  {lockingOrder ? 'Locking...' : (isSelectedOrderLocked ? 'Order Locked' : 'Lock Order Number')}
                </Button>
              )}

              {/* Planned Cost Input */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Planned Cost:</span>
                {isEditingPlannedCost ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={plannedCostInput}
                      onChange={(e) => setPlannedCostInput(e.target.value)}
                      placeholder="Enter amount"
                      className="border border-gray-300 rounded-lg px-3 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      autoFocus
                    />
                    <button
                      onClick={savePlannedCost}
                      disabled={savingPlannedCost}
                      className="text-green-600 hover:text-green-700 transition-colors"
                    >
                      {savingPlannedCost ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingPlannedCost(false);
                        setPlannedCostInput(plannedCost ? plannedCost.toString() : '');
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingPlannedCost(true)}
                    className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    {plannedCost !== null ? formatCurrency(plannedCost) : 'Set Budget'}
                    <span className="text-xs text-gray-400">(click to edit)</span>
                  </button>
                )}
              </div>

              {/* Project Filter */}
              {dashboardData?.projects?.length > 1 && (
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="all">All Projects</option>
                    {dashboardData.projects.map((proj, idx) => (
                      <option key={idx} value={proj.project}>
                        {proj.project}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
          </div>
        ) : dashboardData ? (
          <>
            {/* Summary Cards */}
            <SummaryCards />

            {/* Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-1 flex flex-col">
                <CostDistributionChart />
                <AdditionalCostChart />
              </div>
              <div className="lg:col-span-2">
                <Card className="p-6 h-full flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual</h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Planned Cost', value: dashboardData.plannedCost || 0, color: '#8B5CF6' },
                        { name: 'Actual Cost', value: dashboardData.summary.totalActualCost || 0, color: '#10B981' }
                      ].filter(d => d.value > 0 || d.name === 'Actual Cost')}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(val) => `₱${(val/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          <Cell fill="#8B5CF6" />
                          <Cell fill="#F0B100" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            {/* Detailed Tables */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Detailed Breakdown</h2>
                <Button variant="outline" onClick={exportAllPurchaseRequestItems}>
                  <FileSpreadsheet className="w-4 h-4" />
                  Export PR Items
                </Button>
              </div>
              
              <RequestTable 
                type="purchaseRequests"
                data={dashboardData.details.purchaseRequests}
                onRowClick={fetchPreviewData}
                columns={[
                  { header: 'PR Number', key: 'pr_number' },
                  { header: 'Purpose', key: 'purpose' },
                  { header: 'Project', key: 'project' },
                  { header: 'Amount', key: 'total_amount', format: (v) => formatCurrency(v) },
                  { header: 'Status', key: 'status' },
                  { header: 'Created', key: 'created_at', format: (v) => formatDate(v) }
                ]}
              />

              <RequestTable 
                type="serviceRequests"
                data={dashboardData.details.serviceRequests}
                onRowClick={fetchPreviewData}
                columns={[
                  { header: 'SR Number', key: 'sr_number' },
                  { header: 'Purpose', key: 'purpose' },
                  { header: 'Service Type', key: 'service_type' },
                  { header: 'Project', key: 'project' },
                  { header: 'Amount', key: 'amount', format: (v) => formatCurrency(v) },
                  { header: 'Status', key: 'status' },
                  { header: 'Created', key: 'created_at', format: (v) => formatDate(v) }
                ]}
              />

              <RequestTable 
                type="cashRequests"
                data={dashboardData.details.cashRequests}
                onRowClick={fetchPreviewData}
                columns={[
                  { header: 'CR Number', key: 'cr_number' },
                  { header: 'Purpose', key: 'purpose' },
                  { header: 'Type', key: 'cr_type' },
                  { header: 'Project', key: 'project' },
                  { header: 'Amount', key: 'amount', format: (v) => formatCurrency(v) },
                  { header: 'Status', key: 'status' },
                  { header: 'Created', key: 'created_at', format: (v) => formatDate(v) }
                ]}
              />

              <RequestTable 
                type="reimbursements"
                data={dashboardData.details.reimbursements}
                onRowClick={fetchPreviewData}
                columns={[
                  { header: 'RMB Number', key: 'rmb_number' },
                  { header: 'Purpose', key: 'purpose' },
                  { header: 'Payee', key: 'payee' },
                  { header: 'Project', key: 'project' },
                  { header: 'Amount', key: 'amount', format: (v) => formatCurrency(v) },
                  { header: 'Status', key: 'status' },
                  { header: 'Created', key: 'created_at', format: (v) => formatDate(v) }
                ]}
              />

              <RequestTable 
                type="purchaseOrders"
                data={dashboardData.additionalDetails?.purchaseOrders}
                onRowClick={fetchPreviewData}
                columns={[
                  { header: 'PO Number', key: 'po_number' },
                  { header: 'Purpose', key: 'purpose' },
                  { header: 'Project', key: 'project' },
                  { header: 'Amount', key: 'amount', format: (v) => formatCurrency(v) },
                  { header: 'Status', key: 'status' },
                  { header: 'Created', key: 'created_at', format: (v) => formatDate(v) }
                ]}
              />

              <RequestTable 
                type="paymentRequests"
                data={dashboardData.additionalDetails?.paymentRequests}
                onRowClick={fetchPreviewData}
                columns={[
                  { header: 'PR Number', key: 'pr_number' },
                  { header: 'Purpose', key: 'purpose' },
                  { header: 'Payee', key: 'payee' },
                  { header: 'Project', key: 'project' },
                  { header: 'Amount', key: 'amount', format: (v) => formatCurrency(v) },
                  { header: 'Status', key: 'status' },
                  { header: 'Created', key: 'created_at', format: (v) => formatDate(v) }
                ]}
              />

              <RequestTable 
                type="paymentOrders"
                data={dashboardData.additionalDetails?.paymentOrders}
                onRowClick={fetchPreviewData}
                columns={[
                  { header: 'PO Number', key: 'po_number' },
                  { header: 'Purpose', key: 'purpose' },
                  { header: 'Payee', key: 'payee' },
                  { header: 'Project', key: 'project' },
                  { header: 'Amount', key: 'amount', format: (v) => formatCurrency(v) },
                  { header: 'Status', key: 'status' },
                  { header: 'Created', key: 'created_at', format: (v) => formatDate(v) }
                ]}
              />
            </div>

            {/* External Preview Modals */}
            <PRPreviewModal 
              pr={previewType === 'purchaseRequests' ? previewItem : null}
              loading={previewLoading}
              onClose={closePreview}
              readOnly
            />
            <SRPreviewModal 
              sr={previewType === 'serviceRequests' ? previewItem : null}
              loading={previewLoading}
              onClose={closePreview}
              readOnly
            />
            <CRPreviewModal 
              cr={previewType === 'cashRequests' ? previewItem : null}
              loading={previewLoading}
              onClose={closePreview}
              readOnly
            />

            {/* Inline Reimbursement Preview Modal (no external modal available) */}
            {previewItem && previewType === 'reimbursements' && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{previewItem.rmb_number}</h3>
                      <p className="text-sm text-gray-500">Reimbursement Preview</p>
                    </div>
                    <button
                      onClick={closePreview}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {previewLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-600">Status:</span>
                          <StatusBadge status={previewItem.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                          <div>
                            <span className="text-xs text-gray-500 uppercase">Purpose</span>
                            <p className="text-sm font-medium text-gray-900">{previewItem.purpose || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 uppercase">Amount</span>
                            <p className="text-sm font-medium text-gray-900">{formatCurrency(previewItem.amount || 0)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 uppercase">Project</span>
                            <p className="text-sm font-medium text-gray-900">{previewItem.project || '-'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 uppercase">Created</span>
                            <p className="text-sm font-medium text-gray-900">{formatDate(previewItem.created_at)}</p>
                          </div>
                          {previewItem.payee && (
                            <div>
                              <span className="text-xs text-gray-500 uppercase">Payee</span>
                              <p className="text-sm font-medium text-gray-900">{previewItem.payee}</p>
                            </div>
                          )}
                          {previewItem.requested_by && (
                            <div>
                              <span className="text-xs text-gray-500 uppercase">Requested By</span>
                              <p className="text-sm font-medium text-gray-900">{previewItem.requested_by}</p>
                            </div>
                          )}
                          {previewItem.approved_by && (
                            <div>
                              <span className="text-xs text-gray-500 uppercase">Approved By</span>
                              <p className="text-sm font-medium text-gray-900">{previewItem.approved_by}</p>
                            </div>
                          )}
                          {previewItem.approved_at && (
                            <div>
                              <span className="text-xs text-gray-500 uppercase">Approved Date</span>
                              <p className="text-sm font-medium text-gray-900">{formatDate(previewItem.approved_at)}</p>
                            </div>
                          )}
                        </div>
                        {previewItem.description && (
                          <div>
                            <span className="text-xs text-gray-500 uppercase">Description</span>
                            <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-3 rounded-lg">{previewItem.description}</p>
                          </div>
                        )}
                        {previewItem.remarks && (
                          <div>
                            <span className="text-xs text-gray-500 uppercase">Remarks</span>
                            <p className="text-sm text-gray-700 mt-1 bg-yellow-50 p-3 rounded-lg border border-yellow-100">{previewItem.remarks}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <Button variant="secondary" onClick={closePreview}>Close</Button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : error ? (
          <Card className="p-8 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button variant="secondary" onClick={() => fetchDashboardData(selectedOrder.order_number, selectedProject)}>
              Retry
            </Button>
          </Card>
        ) : null}
      </div>
    );
  }

  // Order Numbers List View
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order Numbers Dashboard</h1>
        <p className="text-gray-500">View cost breakdown and analysis by order number</p>
      </div>

      {/* Search */}
      <Card className="mb-6 p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search order numbers or projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        </div>
      </Card>

      {/* Order Numbers Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order, index) => (
            <div key={index} onClick={() => {
              console.log('Card clicked:', order);
              setSelectedOrder(order);
            }} className="cursor-pointer">
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <FileText className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    {order.is_locked && (
                      <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded">
                        Locked
                      </span>
                    )}
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      View Dashboard
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{order.order_number}</h3>
                <div className="space-y-1">
                  {order.project && (
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {order.project}
                    </p>
                  )}
                  {order.project_address && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {order.project_address}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {filteredOrders.length === 0 && !loading && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No order numbers found</p>
        </div>
      )}
    </div>
  );
};

export default OrderNumbers;
