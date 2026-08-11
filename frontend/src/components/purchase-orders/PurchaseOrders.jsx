import React, { useState, useEffect } from 'react'
import { purchaseOrderService } from '../../services/purchaseOrders'
import { purchaseRequestService } from '../../services/purchaseRequests'
import { serviceRequestService } from '../../services/serviceRequests'
import { supplierService } from '../../services/suppliers'
import { ChevronUp, ChevronDown, FileSpreadsheet, Plus, X, Eye } from 'lucide-react'
import POPreviewModal from './POPreviewModal'

// UI Components
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
)

const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '' }) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variants = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 disabled:bg-yellow-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

const Input = ({ label, type = 'text', value, onChange, placeholder, required = false }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
      required={required}
    />
  </div>
)

const Select = ({ label, value, onChange, options, required = false, placeholder = 'Select...' }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
      required={required}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
)
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount || 0)
}

const resolvePaymentTermFromPR = (code, note) => {
  const normalizedCode = String(code || '').trim().toUpperCase()
  if (!normalizedCode) return null
  if (normalizedCode === 'CUSTOM') {
    const normalizedNote = String(note || '').trim()
    return normalizedNote || null
  }
  if (normalizedCode === 'NET_7') return 'NET 7'
  if (normalizedCode === 'NET_15') return 'NET 15'
  if (normalizedCode === 'NET_30') return 'NET 30'
  return normalizedCode
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const isEligibleDebtPRForPO = (pr) =>
  pr?.status === 'For Purchase' && pr?.payment_basis !== 'non_debt'

const buildPRSearchHaystack = (pr) =>
  [
    pr?.pr_number,
    pr?.project,
    pr?.purpose,
    pr?.order_number,
    pr?.payee_name,
    pr?.supplier_name,
    pr?.requester_first_name,
    pr?.requester_last_name
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

const filterPRsByQuery = (sourcePrs, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) return sourcePrs
  return sourcePrs.filter((pr) => buildPRSearchHaystack(pr).includes(normalizedQuery))
}

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'For Approval': 'bg-blue-100 text-blue-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-gray-100 text-gray-600',
      'For Super Admin Approval': 'bg-purple-100 text-purple-800',
      'Fully Approved': 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  )
}

const PurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewPO, setPreviewPO] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [prs, setPrs] = useState([])
  const [srs, setSrs] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loadingForm, setLoadingForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [sourceType, setSourceType] = useState('pr')
  const [selectedPR, setSelectedPR] = useState('')
  const [selectedSR, setSelectedSR] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [placeOfDelivery, setPlaceOfDelivery] = useState('')
  const [project, setProject] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [deliveryTerm, setDeliveryTerm] = useState('COD')
  const [paymentTerm, setPaymentTerm] = useState('CASH')
  const [inheritedPaymentTerm, setInheritedPaymentTerm] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ item_id: '', quantity: 1, unit_price: 0 }])
  
  // PR search state
  const [prSearchQuery, setPrSearchQuery] = useState('')
  const [prSearchResults, setPrSearchResults] = useState([])
  const [showPrResults, setShowPrResults] = useState(false)

  useEffect(() => {
    fetchPurchaseOrders()
  }, [])

  useEffect(() => {
    if (!showCreateModal || sourceType !== 'pr') return
    if (prSearchQuery.trim() === '') {
      setPrSearchResults([])
      return
    }
    setPrSearchResults(filterPRsByQuery(prs, prSearchQuery))
  }, [prs, prSearchQuery, showCreateModal, sourceType])

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true)
      const data = await purchaseOrderService.getAll()
      setPurchaseOrders(data)
    } catch (err) {
      setError('Failed to fetch purchase orders')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = async () => {
    setShowCreateModal(true)
    setLoadingForm(true)
    try {
      const [prsData, srsData, suppliersData] = await Promise.all([
        purchaseRequestService.getAll('all', { status: 'For Purchase' }),
        serviceRequestService.getAll(),
        supplierService.getAll()
      ])
      // Debt-based PRs only (cash/non-debt PRs use Payment Requests)
      const eligiblePrs = (prsData || []).filter(isEligibleDebtPRForPO)
      setPrs(eligiblePrs)
      if (prSearchQuery.trim() !== '') {
        setPrSearchResults(filterPRsByQuery(eligiblePrs, prSearchQuery))
        setShowPrResults(true)
      }
      setSrs(srsData.filter(sr => sr.status === 'Approved' || sr.status === 'For Super Admin Final Approval'))
      setSuppliers(suppliersData)
    } catch (err) {
      console.error('Failed to load form data', err)
    } finally {
      setLoadingForm(false)
    }
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    resetForm()
  }

  const loadPRItems = async (prId) => {
    try {
      const pr = await purchaseRequestService.getById(prId)
      const resolvedTerm = resolvePaymentTermFromPR(pr.payment_terms_code, pr.payment_terms_note)
      setInheritedPaymentTerm(resolvedTerm || '')
      if (resolvedTerm) {
        setPaymentTerm(resolvedTerm)
      }
      if (pr.items && pr.items.length > 0) {
        setItems(pr.items.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name, // Capture item name
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          purchase_request_item_id: item.id
        })))
      }
    } catch (err) {
      console.error('Failed to load PR items', err)
    }
  }

  const resetForm = () => {
    setSourceType('pr')
    setSelectedPR('')
    setSelectedSR('')
    setSelectedSupplier('')
    setExpectedDeliveryDate('')
    setPlaceOfDelivery('')
    setProject('')
    setOrderNumber('')
    setDeliveryTerm('COD')
    setPaymentTerm('CASH')
    setInheritedPaymentTerm('')
    setNotes('')
    setItems([{ item_id: '', quantity: 1, unit_price: 0 }])
    // Reset PR search
    setPrSearchQuery('')
    setPrSearchResults([])
    setShowPrResults(false)
  }

  const addItem = () => {
    setItems([...items, { item_id: '', quantity: 1, unit_price: 0, purchase_request_item_id: null }])
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const handleSubmit = async (e, saveAsDraft = false) => {
    e.preventDefault()
    if (!selectedSupplier) { alert('Please select a supplier'); return }
    if (sourceType === 'pr' && !selectedPR) { alert('Please select a Purchase Request'); return }
    if (sourceType === 'sr' && !selectedSR) { alert('Please select a Service Request'); return }
    if (!orderNumber || !String(orderNumber).trim()) { alert('Order Number is required from the selected source document'); return }

    let normalizedItems = []
    if (sourceType === 'pr') {
      normalizedItems = items.map((item) => ({
        item_id: Number(item.item_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        purchase_request_item_id: item.purchase_request_item_id ? Number(item.purchase_request_item_id) : null
      }))

      const invalidItemIndex = normalizedItems.findIndex(
        (item) =>
          !Number.isInteger(item.item_id) || item.item_id <= 0 ||
          !Number.isFinite(item.quantity) || item.quantity <= 0 ||
          !Number.isFinite(item.unit_price) || item.unit_price < 0
      )
      if (invalidItemIndex !== -1) {
        alert(`Item row ${invalidItemIndex + 1} is invalid. Item ID, quantity (> 0), and unit price (>= 0) are required.`)
        return
      }
    }

    try {
      setSubmitting(true)
      const poData = {
        ...(sourceType === 'pr' ? { purchase_request_id: selectedPR } : { service_request_id: selectedSR }),
        supplier_id: selectedSupplier,
        expected_delivery_date: expectedDeliveryDate || null,
        place_of_delivery: placeOfDelivery || null,
        project: project || null,
        order_number: orderNumber || null,
        delivery_term: deliveryTerm,
        payment_term: paymentTerm,
        notes: notes || null,
        items: normalizedItems,
        save_as_draft: saveAsDraft
      }
      await purchaseOrderService.create(poData)
      await fetchPurchaseOrders()
      closeCreateModal()
      alert(saveAsDraft ? 'Saved as draft!' : 'Purchase Order created successfully and is pending approval!')
    } catch (err) {
      alert('Failed to create PO: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const openPreview = async (po) => {
    try {
      setPreviewLoading(true)
      setShowPreviewModal(true)
      // Fetch full PO details with items
      const fullPO = await purchaseOrderService.getById(po.id)
      setPreviewPO(fullPO)
    } catch (err) {
      alert('Failed to load purchase order details')
      setShowPreviewModal(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setShowPreviewModal(false)
    setPreviewPO(null)
  }

  const handleExport = async (id, poNumber) => {
    try {
      const blob = await purchaseOrderService.exportToExcel(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PO-${poNumber}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to export purchase order')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">{error}</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Purchase Orders</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            {purchaseOrders.length} Purchase Order{purchaseOrders.length !== 1 ? 's' : ''} total
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            Create PO
          </Button>
        </div>
      </div>

      <Card>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">PO Number</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Source Number</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map(po => (
                <React.Fragment key={po.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{po.source_number || po.pr_number || po.sr_number || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{po.supplier_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(po.total_amount)}</td>
                    <td className="py-3 px-4"><StatusBadge status={po.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { 
                            e.stopPropagation()
                            openPreview(po)
                          }}
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { 
                            e.stopPropagation()
                            handleExport(po.id, po.po_number)
                          }}
                          title="Export to Excel"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === po.id ? null : po.id); }}>
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
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Expected Delivery</p>
                              <p className="text-sm text-gray-900">{formatDate(po.expected_delivery_date)}</p>
                            </div>
                          </div>
                          {po.remarks && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Remarks</p>
                              <p className="text-sm text-gray-900">{po.remarks}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {purchaseOrders.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    No purchase orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid View */}
        <div className="md:hidden p-4">
          <div className="space-y-3">
            {purchaseOrders.map(po => (
              <div
                key={po.id}
                onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  expandedId === po.id 
                    ? 'border-yellow-500 bg-yellow-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-gray-500 font-mono">{po.po_number}</p>
                    <p className="text-sm font-semibold text-gray-900">{po.supplier_name || 'No Supplier'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { 
                        e.stopPropagation()
                        openPreview(po)
                      }}
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { 
                        e.stopPropagation()
                        handleExport(po.id, po.po_number)
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === po.id ? null : po.id); }}>
                      {expandedId === po.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-sm text-gray-600">Source: {po.source_number || po.pr_number || po.sr_number || '-'}</p>
                  <p className="text-sm font-medium text-gray-700">{formatCurrency(po.total_amount)}</p>
                </div>
                <StatusBadge status={po.status} />
                {expandedId === po.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <p className="text-xs text-gray-500">Prepared by: {po.prepared_by_first_name} {po.prepared_by_last_name}</p>
                    <p className="text-xs text-gray-500">Date: {formatDate(po.created_at)}</p>
                    <p className="text-xs text-gray-500">Delivery Term: {po.delivery_term || '-'}</p>
                    <p className="text-xs text-gray-500">Payment Term: {po.payment_term || '-'}</p>
                    <p className="text-xs text-gray-500">Expected Delivery: {formatDate(po.expected_delivery_date)}</p>
                  </div>
                )}
              </div>
            ))}
            {purchaseOrders.length === 0 && (
              <p className="text-center text-gray-500 py-8">No purchase orders found</p>
            )}
          </div>
        </div>
      </Card>

      {/* Preview Modal */}
      <POPreviewModal
        po={previewPO}
        loading={previewLoading}
        onClose={closePreview}
      />

      {/* Create PO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Purchase Order</h3>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingForm ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6">
                {/* Source Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source Document</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="pr"
                        checked={sourceType === 'pr'}
                        onChange={(e) => {
                          setSourceType(e.target.value)
                          setSelectedSR('')
                          setSelectedPR('')
                          setPrSearchQuery('')
                          setPrSearchResults([])
                          setShowPrResults(false)
                          setProject('')
                          setOrderNumber('')
                          setInheritedPaymentTerm('')
                          setItems([{ item_id: '', quantity: 1, unit_price: 0 }])
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Purchase Request</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="sr"
                        checked={sourceType === 'sr'}
                        onChange={(e) => {
                          setSourceType(e.target.value)
                          setSelectedPR('')
                          setSelectedSR('')
                          setPrSearchQuery('')
                          setPrSearchResults([])
                          setShowPrResults(false)
                          setProject('')
                          setOrderNumber('')
                          setInheritedPaymentTerm('')
                          setItems([])
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Service Request</span>
                    </label>
                  </div>
                </div>

                {/* PR Search Input */}
                {sourceType === 'pr' ? (
                  <div className="mb-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Request <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={prSearchQuery}
                      onChange={(e) => {
                        const query = e.target.value
                        setPrSearchQuery(query)
                        setShowPrResults(true)
                        if (query.trim() === '') {
                          setPrSearchResults([])
                          setShowPrResults(false)
                        }
                      }}
                      onFocus={() => {
                        if (loadingForm) return
                        setShowPrResults(true)
                        setPrSearchResults(
                          prSearchQuery.trim() === ''
                            ? prs
                            : filterPRsByQuery(prs, prSearchQuery)
                        )
                      }}
                      disabled={loadingForm}
                      placeholder={loadingForm ? 'Loading purchase requests...' : 'Search by PR number, project, purpose, or payee...'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:bg-gray-50"
                      required={!selectedPR}
                    />
                    {showPrResults && prSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                        {prSearchResults.map(pr => (
                          <div
                            key={pr.id}
                            onClick={() => {
                              setSelectedPR(pr.id)
                              setPrSearchQuery(`${pr.pr_number} - ${pr.project} (${formatCurrency(pr.total_amount || pr.amount)})`)
                              setShowPrResults(false)
                              setProject(pr.project || '')
                              setSelectedSupplier(pr.supplier_id || '')
                              setOrderNumber(pr.order_number || '')
                              loadPRItems(pr.id)
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm font-medium">{pr.pr_number} - {pr.project}</div>
                            <div className="text-xs text-gray-500">{pr.payee_name} • {formatCurrency(pr.total_amount || pr.amount)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showPrResults && !loadingForm && prSearchQuery.trim() !== '' && prSearchResults.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500">
                        {prs.length === 0
                          ? 'No debt-based purchase requests are ready for PO (status must be For Purchase). Cash PRs belong under Payment Requests.'
                          : 'No matching purchase requests found'}
                      </div>
                    )}
                    <input type="hidden" value={selectedPR} required />
                  </div>
                ) : (
                  <Select
                    label="Service Request"
                    value={selectedSR}
                    onChange={(e) => {
                      setSelectedSR(e.target.value)
                      const sr = srs.find(s => s.id === parseInt(e.target.value))
                      if (sr) {
                        setProject(sr.purpose || '')
                        setSelectedSupplier(sr.supplier_id || '')
                        setOrderNumber(sr.order_number || '')
                      } else {
                        setOrderNumber('')
                      }
                    }}
                    options={srs.map(sr => ({ value: sr.id, label: `${sr.sr_number} - ${sr.purpose} (${formatCurrency(sr.amount)})` }))}
                    required
                  />
                )}

                <Select label="Supplier" value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} options={suppliers.map(s => ({ value: s.id, label: s.supplier_name }))} required />

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Project" value={project} onChange={(e) => setProject(e.target.value)} />
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={orderNumber}
                      readOnly
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
                      placeholder="Auto-filled from selected source"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select label="Delivery Term" value={deliveryTerm} onChange={(e) => setDeliveryTerm(e.target.value)} options={[{value:'COD',label:'COD'},{value:'7 days',label:'7 days'},{value:'15 days',label:'15 days'},{value:'30 days',label:'30 days'}]} />
                  {sourceType === 'pr' ? (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Inherited Payment Terms</label>
                      <input
                        type="text"
                        value={inheritedPaymentTerm || '-'}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Payment terms are inherited from selected PR and used as payment reference.
                      </p>
                    </div>
                  ) : (
                    <Select
                      label="Payment Term"
                      value={paymentTerm}
                      onChange={(e) => setPaymentTerm(e.target.value)}
                      options={[{value:'CASH',label:'CASH'},{value:'CHECK',label:'CHECK'},{value:'BANK TRANSFER',label:'BANK TRANSFER'}]}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Expected Delivery Date" type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
                  <Input label="Place of Delivery" value={placeOfDelivery} onChange={(e) => setPlaceOfDelivery(e.target.value)} />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                </div>

                {sourceType === 'pr' ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Items</label>
                      <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                        <Plus className="w-4 h-4 mr-1" /> Add Item
                      </Button>
                    </div>
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-2 mb-2 items-end">
                        <div className="flex-1">
                          {item.item_name ? (
                            <div className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50">
                              <span className="text-gray-500">ID: {item.item_id}</span> - <span className="font-medium">{item.item_name}</span>
                            </div>
                          ) : (
                            <input type="text" placeholder="Item ID" value={item.item_id} onChange={(e) => updateItem(index, 'item_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" required />
                          )}
                          <input type="hidden" value={item.item_id} />
                        </div>
                        <div className="w-24">
                          <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" min="1" required />
                        </div>
                        <div className="w-32">
                          <input type="number" placeholder="Unit Price" value={item.unit_price} onChange={(e) => updateItem(index, 'unit_price', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" min="0" step="0.01" required />
                        </div>
                        <div className="w-24 text-right text-sm font-medium">{formatCurrency(item.quantity * item.unit_price)}</div>
                        {items.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}><X className="w-4 h-4 text-red-500" /></Button>}
                      </div>
                    ))}
                    <div className="text-right font-semibold text-lg mt-2">Total: {formatCurrency(calculateTotal())}</div>
                  </div>
                ) : (
                  <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    Line items are not required for Service Request source. Amount will be taken from the selected service request.
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="secondary" onClick={closeCreateModal}>Cancel</Button>
                  <Button type="button" variant="secondary" disabled={submitting} onClick={(e) => handleSubmit(e, true)}>{submitting ? 'Saving...' : 'Save as Draft'}</Button>
                  <Button type="button" disabled={submitting} onClick={(e) => handleSubmit(e, false)}>{submitting ? 'Creating...' : 'Create Purchase Order'}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PurchaseOrders
