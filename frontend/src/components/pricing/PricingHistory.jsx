import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, TrendingUp, Package, Truck, Plus, Edit2, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import pricingHistoryService from '../../services/pricingHistory';
import { itemService } from '../../services/items';
import { supplierService } from '../../services/suppliers';

// UI Components
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
    ghost: 'text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, type = 'text', value, onChange, placeholder, className = '' }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
    />
  </div>
);

const Select = ({ label, value, onChange, options, placeholder, className = '' }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
    >
      <option value="">{placeholder || 'Select...'}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const InfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-xs text-gray-500 shrink-0">{label}</span>
    <span className="text-xs text-gray-700 text-right break-words">{value}</span>
  </div>
);

const PricingHistory = () => {
  const [records, setRecords] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    item_id: '',
    supplier_id: '',
    start_date: '',
    end_date: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    item_id: '',
    supplier_id: '',
    unit_price: '',
    quantity: '',
    date_recorded: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recordsRes, itemsRes, suppliersRes] = await Promise.all([
        pricingHistoryService.getAll({ page: pagination.page, limit: pagination.limit }),
        itemService.getAll(),
        supplierService.getAll()
      ]);
      setRecords(recordsRes.pricingHistory || []);
      setPagination(prev => ({
        ...prev,
        total: recordsRes.pagination?.total || 0,
        totalPages: recordsRes.pagination?.totalPages || 1
      }));
      setItems(itemsRes || []);
      setSuppliers(suppliersRes || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const filtersToApply = {
        page: 1, // Reset to first page on search
        limit: pagination.limit
      };
      if (filters.item_id) filtersToApply.item_id = filters.item_id;
      if (filters.supplier_id) filtersToApply.supplier_id = filters.supplier_id;
      if (filters.start_date) filtersToApply.start_date = filters.start_date;
      if (filters.end_date) filtersToApply.end_date = filters.end_date;
      if (searchQuery) filtersToApply.search = searchQuery;
      
      const response = await pricingHistoryService.getAll(filtersToApply);
      setRecords(response.pricingHistory || []);
      setPagination(prev => ({
        ...prev,
        page: 1,
        total: response.pagination?.total || 0,
        totalPages: response.pagination?.totalPages || 1
      }));
    } catch (err) {
      console.error('Failed to search:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await pricingHistoryService.create(formData);
      setShowModal(false);
      setFormData({
        item_id: '',
        supplier_id: '',
        unit_price: '',
        quantity: '',
        date_recorded: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
    } catch (err) {
      console.error('Failed to create record:', err);
      alert('Failed to create pricing history record');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await pricingHistoryService.update(editingRecord.id, formData);
      setShowModal(false);
      setEditingRecord(null);
      setFormData({
        item_id: '',
        supplier_id: '',
        unit_price: '',
        quantity: '',
        date_recorded: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
    } catch (err) {
      console.error('Failed to update record:', err);
      alert('Failed to update pricing history record');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await pricingHistoryService.delete(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete record:', err);
      alert('Failed to delete pricing history record');
    }
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setFormData({
      item_id: record.item_id,
      supplier_id: record.supplier_id,
      unit_price: record.unit_price,
      quantity: record.quantity || '',
      date_recorded: record.date_recorded,
      notes: record.notes || ''
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    setFormData({
      item_id: '',
      supplier_id: '',
      unit_price: '',
      quantity: '',
      date_recorded: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Fetch data when page changes
  useEffect(() => {
    fetchData();
  }, [pagination.page]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (records.length === 0) return null;
    
    const prices = records.map(r => parseFloat(r.unit_price)).filter(p => !isNaN(p));
    const totalAmount = records.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    
    return {
      totalRecords: records.length,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      totalAmount: totalAmount
    };
  }, [records]);

  const itemOptions = items.map(item => ({ value: item.id, label: `SKU: ${item.item_code} - ${item.item_name}` }));
  const supplierOptions = suppliers.map(sup => ({ value: sup.id, label: sup.supplier_name }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">Pricing History</h2>
          <p className="text-sm text-gray-500">Track and analyze historical pricing for items</p>
        </div>
        <div className="flex justify-start sm:justify-end">
          <Button onClick={openCreateModal} className="px-3 py-2">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Record</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Records</p>
                <p className="text-lg font-semibold text-gray-900">{stats.totalRecords}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Average Price</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(stats.avgPrice)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Lowest Price</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(stats.minPrice)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Highest Price</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(stats.maxPrice)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-end">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by item name, code, or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="secondary" onClick={() => setShowFilters(!showFilters)} className="flex-1 sm:flex-none">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button onClick={handleSearch} className="flex-1 sm:flex-none">Search</Button>
          </div>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
            <Select
              label="Item"
              value={filters.item_id}
              onChange={(e) => setFilters({ ...filters, item_id: e.target.value })}
              options={itemOptions}
              placeholder="All Items"
            />
            <Select
              label="Supplier"
              value={filters.supplier_id}
              onChange={(e) => setFilters({ ...filters, supplier_id: e.target.value })}
              options={supplierOptions}
              placeholder="All Suppliers"
            />
            <Input
              label="Start Date"
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            />
          </div>
        )}
      </Card>

      {/* Records Table */}
      <Card>

        {/* Mobile card list */}
        <div className="divide-y divide-gray-200 sm:hidden">
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No pricing history records found</div>
          ) : (
            records.map(record => {
              const isExpanded = expandedId === record.id
              return (
                <div key={record.id} className="p-4" onClick={() => setExpandedId(isExpanded ? null : record.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 break-words">
                        {record.item_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 break-words">
                        SKU: {record.item_code || '-'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(record.unit_price)}</p>
                      <p className="text-xs text-gray-500">{formatDate(record.date_recorded)}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <InfoRow label="Supplier" value={record.supplier_name || '-'} />
                    <InfoRow label="Qty" value={record.quantity || '-'} />
                    <InfoRow label="Total" value={formatCurrency(record.total_amount)} />
                    <InfoRow
                      label="Ref"
                      value={record.po_number ? `PO: ${record.po_number}` : record.pr_number ? `PR: ${record.pr_number}` : '-'}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); openEditModal(record); }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <button
                      className="text-gray-500"
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : record.id); }}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="space-y-2">
                        <InfoRow label="Notes" value={record.notes || '-'} />
                        <InfoRow label="Created By" value={`${record.created_by_first_name || ''} ${record.created_by_last_name || ''}`.trim() || '-'} />
                        <InfoRow label="Created At" value={formatDate(record.created_at)} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-gray-500">
                    No pricing history records found
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <React.Fragment key={record.id}>
                    <tr
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                    >
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(record.date_recorded)}</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {record.item_code && <span className="text-xs text-gray-400 mr-1">SKU: {record.item_code}</span>}
                        {record.item_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{record.supplier_name || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium">{formatCurrency(record.unit_price)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{record.quantity || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(record.total_amount)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {record.po_number && <span className="text-xs">PO: {record.po_number}</span>}
                        {record.pr_number && <span className="text-xs">PR: {record.pr_number}</span>}
                        {!record.po_number && !record.pr_number && '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openEditModal(record); }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === record.id ? null : record.id); }}
                          >
                            {expandedId === record.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === record.id && (
                      <tr>
                        <td colSpan="8" className="bg-gray-50 p-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Notes</p>
                              <p className="text-sm text-gray-900">{record.notes || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Created By</p>
                              <p className="text-sm text-gray-900">
                                {record.created_by_first_name} {record.created_by_last_name}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Created At</p>
                              <p className="text-sm text-gray-900">{formatDate(record.created_at)}</p>
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
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingRecord ? 'Edit Pricing Record' : 'Add Pricing Record'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingRecord ? handleUpdate : handleCreate} className="p-6 space-y-4">
              <Select
                label="Item *"
                value={formData.item_id}
                onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                options={itemOptions}
                placeholder="Select item"
              />
              
              <Select
                label="Supplier *"
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                options={supplierOptions}
                placeholder="Select supplier"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Unit Price *"
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  placeholder="0.00"
                />
                <Input
                  label="Quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              
              <Input
                label="Date Recorded *"
                type="date"
                value={formData.date_recorded}
                onChange={(e) => setFormData({ ...formData, date_recorded: e.target.value })}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRecord ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingHistory;
