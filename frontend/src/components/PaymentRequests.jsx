import React, { useState, useEffect } from 'react'
import { paymentRequestService } from '../services/paymentRequests'
import { purchaseRequestService } from '../services/purchaseRequests'
import { serviceRequestService } from '../services/serviceRequests'
import { cashRequestService } from '../services/cashRequests'
import { supplierService } from '../services/suppliers'
import { ChevronUp, ChevronDown, Plus, X, Download, Eye } from 'lucide-react'
import PaymentRequestPreviewModal from './payment-requests/PaymentRequestPreviewModal'

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

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatPaymentTerms = (record) => {
  const note = String(record?.payment_terms_note || '').trim()
  if (note) return note
  const term = String(record?.payment_term || '').trim()
  if (term) return term
  const code = String(record?.payment_terms_code || '').trim().toUpperCase()
  if (!code) return '-'
  return code.replace(/_/g, ' ')
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
      'DV Created': 'bg-purple-100 text-purple-800',
      'Paid': 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  )
}

const PaymentRequests = () => {
  const [paymentRequests, setPaymentRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewPR, setPreviewPR] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [prs, setPrs] = useState([])
  const [serviceRequests, setServiceRequests] = useState([])
  const [cashRequests, setCashRequests] = useState([])
  const [sourceType, setSourceType] = useState('pr') // 'pr', 'sr', or 'cr'
  const [suppliers, setSuppliers] = useState([])
  const [loadingForm, setLoadingForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [selectedPR, setSelectedPR] = useState('')
  const [selectedSR, setSelectedSR] = useState('')
  const [selectedCR, setSelectedCR] = useState('')
  const [prSearchQuery, setPrSearchQuery] = useState('')
  const [srSearchQuery, setSrSearchQuery] = useState('')
  const [crSearchQuery, setCrSearchQuery] = useState('')
  const [prSearchResults, setPrSearchResults] = useState([])
  const [srSearchResults, setSrSearchResults] = useState([])
  const [crSearchResults, setCrSearchResults] = useState([])
  const [showPrResults, setShowPrResults] = useState(false)
  const [showSrResults, setShowSrResults] = useState(false)
  const [showCrResults, setShowCrResults] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [payeeName, setPayeeName] = useState('')
  const [payeeAddress, setPayeeAddress] = useState('')
  const [purpose, setPurpose] = useState('')
  const [project, setProject] = useState('')
  const [projectAddress, setProjectAddress] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [amount, setAmount] = useState(0)
  const [items, setItems] = useState([])

  useEffect(() => {
    fetchPaymentRequests()
  }, [])

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true)
      const data = await paymentRequestService.getAll()
      setPaymentRequests(data)
    } catch (err) {
      setError('Failed to fetch payment requests')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = async () => {
    setShowCreateModal(true)
    setLoadingForm(true)
    try {
      const [prsData, suppliersData, srsData, crsData] = await Promise.all([
        purchaseRequestService.getAll('all'),
        supplierService.getAll(),
        serviceRequestService.getAll(),
        cashRequestService.getAll()
      ])
      // Show non-debt PRs with 'For Purchase' status
      setPrs(prsData.filter(pr => pr.status === 'For Purchase' && pr.payment_basis === 'non_debt'))
      // Show approved Service Requests with service_type = 'Service' (payment request type)
      setServiceRequests(srsData.filter(sr => sr.status === 'Approved' && sr.service_type === 'Service'))
      // Show approved Cash Requests with cr_type = 'payment_request'
      setCashRequests(crsData.filter(cr => cr.status === 'Approved' && cr.cr_type === 'payment_request'))
      setSuppliers(suppliersData)
    } catch (err) {
      console.error('Failed to load data', err)
    } finally {
      setLoadingForm(false)
    }
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    resetForm()
  }

  const resetForm = () => {
    setSelectedPR('')
    setSelectedSR('')
    setSelectedCR('')
    setSourceType('pr')
    setPrSearchQuery('')
    setSrSearchQuery('')
    setCrSearchQuery('')
    setPrSearchResults([])
    setSrSearchResults([])
    setCrSearchResults([])
    setShowPrResults(false)
    setShowSrResults(false)
    setShowCrResults(false)
    setSelectedSupplier('')
    setPayeeName('')
    setPayeeAddress('')
    setPurpose('')
    setProject('')
    setProjectAddress('')
    setOrderNumber('')
    setAmount(0)
    setItems([])
  }

  const loadPRData = async (prId) => {
    try {
      const pr = await purchaseRequestService.getById(prId)
      setPurpose(pr.purpose || '')
      setProject(pr.project || '')
      setProjectAddress(pr.project_address || '')
      setOrderNumber(pr.order_number || '')
      if (pr.items && pr.items.length > 0) {
        setItems(pr.items.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price || 0
        })))
        const total = pr.items.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0)
        setAmount(total)
      }
    } catch (err) {
      console.error('Failed to load PR data', err)
    }
  }

  const loadSRData = async (srId) => {
    try {
      const sr = await serviceRequestService.getById(srId)
      setPurpose(sr.purpose || '')
      setProject(sr.project || '')
      setProjectAddress(sr.project_address || '')
      setOrderNumber(sr.order_number || '')
      setAmount(sr.amount || 0)
      // Set payee name from supplier if available
      if (sr.supplier_name) {
        setPayeeName(sr.supplier_name)
        setPayeeAddress(sr.supplier_address || '')
      }
      // Find and set supplier if exists
      if (sr.supplier_id) {
        setSelectedSupplier(sr.supplier_id.toString())
      }
      // Service Requests don't have items like PRs, so clear items
      setItems([])
    } catch (err) {
      console.error('Failed to load SR data', err)
    }
  }

  const loadCRData = async (crId) => {
    try {
      const cr = await cashRequestService.getById(crId)
      setPurpose(cr.purpose || '')
      setProject(cr.project || '')
      setProjectAddress(cr.project_address || '')
      setOrderNumber(cr.order_number || '')
      setAmount(cr.amount || 0)
      // Set payee name from supplier if available
      if (cr.supplier_name) {
        setPayeeName(cr.supplier_name)
        setPayeeAddress(cr.supplier_address || '')
      }
      // Find and set supplier if exists
      if (cr.supplier_id) {
        setSelectedSupplier(cr.supplier_id.toString())
      }
      // Cash Requests don't have items like PRs, so clear items
      setItems([])
    } catch (err) {
      console.error('Failed to load CR data', err)
    }
  }

  const openPreview = async (pr) => {
    try {
      setPreviewLoading(true)
      setShowPreviewModal(true)
      // Fetch full payment request details
      const fullPR = await paymentRequestService.getById(pr.id)
      setPreviewPR(fullPR)
    } catch (err) {
      alert('Failed to load payment request details')
      setShowPreviewModal(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setShowPreviewModal(false)
    setPreviewPR(null)
  }

  const handleExport = async (id, prNumber) => {
    try {
      const blob = await paymentRequestService.exportToExcel(id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Payment_Request_${prNumber}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to export: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleSubmitDraft = async (id) => {
    try {
      setSubmitting(true)
      await paymentRequestService.updateStatus(id, 'Pending')
      await fetchPaymentRequests()
      alert('Payment Request submitted successfully!')
    } catch (err) {
      alert('Failed to submit Payment Request: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault()
    if (sourceType === 'pr' && !selectedPR) { alert('Please select a Purchase Request'); return }
    if (sourceType === 'sr' && !selectedSR) { alert('Please select a Service Request'); return }
    if (sourceType === 'cr' && !selectedCR) { alert('Please select a Cash Request'); return }
    if (!payeeName) { alert('Please enter payee name'); return }

    try {
      setSubmitting(true)
      const prData = {
        payee_name: payeeName,
        payee_address: payeeAddress || null,
        purpose: purpose || null,
        project: project || null,
        project_address: projectAddress || null,
        order_number: orderNumber || null,
        amount: amount,
        status: isDraft ? 'Draft' : 'Pending',
        source_type: sourceType,
        purchase_request_id: sourceType === 'pr' ? selectedPR : null,
        service_request_id: sourceType === 'sr' ? selectedSR : null,
        cash_request_id: sourceType === 'cr' ? selectedCR : null,
        items: items.map(item => ({
          item_id: parseInt(item.item_id),
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price)
        }))
      }
      await paymentRequestService.create(prData)
      await fetchPaymentRequests()
      closeCreateModal()
      alert(isDraft ? 'Payment Request saved as draft!' : 'Payment Request created successfully!')
    } catch (err) {
      alert('Failed to create Payment Request: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
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
        <h2 className="text-lg font-semibold text-gray-900">Payment Requests</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            {paymentRequests.length} Payment Request{paymentRequests.length !== 1 ? 's' : ''} total
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            Create Payment Request
          </Button>
        </div>
      </div>

      <Card>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Source Ref</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Payee Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Payment Terms</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentRequests.map(pr => (
                <React.Fragment key={pr.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}>
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
                    <td className="py-3 px-4 text-sm text-gray-600">{formatPaymentTerms(pr)}</td>
                    <td className="py-3 px-4"><StatusBadge status={pr.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { 
                            e.stopPropagation()
                            openPreview(pr)
                          }}
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {pr.status === 'Draft' && (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleSubmitDraft(pr.id); 
                            }}
                            disabled={submitting}
                          >
                            {submitting ? 'Submitting...' : 'Submit'}
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleExport(pr.id, pr.pr_number || `PRQ-${pr.id}`); 
                          }}
                          title="Export to Excel"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === pr.id ? null : pr.id); }}>
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
                              <p className="text-xs text-gray-500 uppercase">Source Ref</p>
                              <p className="text-sm text-gray-900">
                                {(() => {
                                  if (pr.original_pr_number) return <span>PR {pr.original_pr_number}</span>;
                                  if (pr.original_sr_number) return <span>SR {pr.original_sr_number}</span>;
                                  if (pr.original_cr_number) return <span>CR {pr.original_cr_number}</span>;
                                  return '-';
                                })()}
                              </p>
                            </div>
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
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Payment Terms</p>
                              <p className="text-sm text-gray-900">{formatPaymentTerms(pr)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Payment Schedules</p>
                              <p className="text-sm text-gray-900">
                                {pr.payment_schedule_count || 0}
                                {pr.next_payment_date ? ` • next ${formatDate(pr.next_payment_date)}` : ''}
                              </p>
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
              {paymentRequests.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    No payment requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid View */}
        <div className="md:hidden p-4">
          <div className="space-y-3">
            {paymentRequests.map(pr => (
              <div
                key={pr.id}
                onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  expandedId === pr.id 
                    ? 'border-yellow-500 bg-yellow-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-gray-500 font-mono">
                      {(() => {
                        if (pr.original_pr_number) return `PR ${pr.original_pr_number}`;
                        if (pr.original_sr_number) return `SR ${pr.original_sr_number}`;
                        if (pr.original_cr_number) return `CR ${pr.original_cr_number}`;
                        return '-';
                      })()}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{pr.payee_name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { 
                        e.stopPropagation()
                        openPreview(pr)
                      }}
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === pr.id ? null : pr.id); }}>
                      {expandedId === pr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-sm text-gray-600">{pr.project}</p>
                  <p className="text-sm font-medium text-gray-700">{formatCurrency(pr.amount)}</p>
                  <p className="mt-1 text-xs text-gray-500">Terms: {formatPaymentTerms(pr)}</p>
                </div>
                <StatusBadge status={pr.status} />
                {expandedId === pr.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <p className="text-xs text-gray-500">Purpose: {pr.purpose}</p>
                    {pr.payee_address && <p className="text-xs text-gray-500">Address: {pr.payee_address}</p>}
                    <p className="text-xs text-gray-500">
                      Payment schedules: {pr.payment_schedule_count || 0}
                      {pr.next_payment_date ? ` • next ${formatDate(pr.next_payment_date)}` : ''}
                    </p>
                    {pr.remarks && <p className="text-xs text-gray-500">Remarks: {pr.remarks}</p>}
                  </div>
                )}
              </div>
            ))}
            {paymentRequests.length === 0 && (
              <p className="text-center text-gray-500 py-8">No payment requests found</p>
            )}
          </div>
        </div>
      </Card>

      {/* Preview Modal */}
      <PaymentRequestPreviewModal
        payment={previewPR}
        loading={previewLoading}
        onClose={closePreview}
      />

      {/* Create Payment Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Payment Request</h3>
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
                {/* Source Type Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="pr"
                        checked={sourceType === 'pr'}
                        onChange={(e) => {
                          setSourceType(e.target.value)
                          setSelectedPR('')
                          setSelectedSR('')
                          setPrSearchQuery('')
                          setSrSearchQuery('')
                          setPrSearchResults([])
                          setSrSearchResults([])
                          setShowPrResults(false)
                          setShowSrResults(false)
                          setItems([])
                          setAmount(0)
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
                          setSelectedCR('')
                          setPrSearchQuery('')
                          setSrSearchQuery('')
                          setCrSearchQuery('')
                          setPrSearchResults([])
                          setSrSearchResults([])
                          setCrSearchResults([])
                          setShowPrResults(false)
                          setShowSrResults(false)
                          setShowCrResults(false)
                          setItems([])
                          setAmount(0)
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Service Request</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="cr"
                        checked={sourceType === 'cr'}
                        onChange={(e) => {
                          setSourceType(e.target.value)
                          setSelectedPR('')
                          setSelectedSR('')
                          setSelectedCR('')
                          setPrSearchQuery('')
                          setSrSearchQuery('')
                          setCrSearchQuery('')
                          setPrSearchResults([])
                          setSrSearchResults([])
                          setCrSearchResults([])
                          setShowPrResults(false)
                          setShowSrResults(false)
                          setShowCrResults(false)
                          setItems([])
                          setAmount(0)
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Cash Request</span>
                    </label>
                  </div>
                </div>

                {/* PR Search Input */}
                {sourceType === 'pr' && (
                  <div className="mb-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Request (non-debt/cash) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={prSearchQuery}
                      onChange={(e) => {
                        const query = e.target.value
                        setPrSearchQuery(query)
                        if (query.trim() === '') {
                          setPrSearchResults([])
                          setShowPrResults(false)
                        } else {
                          const filtered = prs.filter(pr =>
                            pr.pr_number?.toLowerCase().includes(query.toLowerCase()) ||
                            pr.project?.toLowerCase().includes(query.toLowerCase()) ||
                            pr.payee_name?.toLowerCase().includes(query.toLowerCase())
                          )
                          setPrSearchResults(filtered)
                          setShowPrResults(true)
                        }
                      }}
                      onFocus={() => {
                        if (prSearchQuery.trim() !== '') {
                          setShowPrResults(true)
                        }
                      }}
                      placeholder="Search by PR number, project, or payee..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required={!selectedPR}
                    />
                    {showPrResults && prSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                        {prSearchResults.map(pr => (
                          <div
                            key={pr.id}
                            onClick={() => {
                              console.log('Selected PR data:', pr)
                              setSelectedPR(pr.id)
                              setPrSearchQuery(`${pr.pr_number} - ${pr.project} (${formatCurrency(pr.total_amount || pr.amount)})`)
                              setShowPrResults(false)
                              setProject(pr.project || '')
                              setProjectAddress(pr.project_address || '')
                              setOrderNumber(pr.order_number || '')
                              setSelectedSupplier(pr.supplier_id || '')
                              const payee = pr.payee_name || pr.supplier_name || ''
                              console.log('Setting payeeName to:', payee)
                              setPayeeName(payee)
                              setPayeeAddress(pr.supplier_address || '')
                              loadPRData(pr.id)
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm font-medium">{pr.pr_number} - {pr.project}</div>
                            <div className="text-xs text-gray-500">{pr.payee_name} • {formatCurrency(pr.total_amount || pr.amount)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showPrResults && prSearchQuery.trim() !== '' && prSearchResults.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500">
                        No matching purchase requests found
                      </div>
                    )}
                    <input type="hidden" value={selectedPR} required />
                  </div>
                )}

                {/* SR Search Input */}
                {sourceType === 'sr' && (
                  <div className="mb-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Request (Approved for Payment) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={srSearchQuery}
                      onChange={(e) => {
                        const query = e.target.value
                        setSrSearchQuery(query)
                        if (query.trim() === '') {
                          setSrSearchResults([])
                          setShowSrResults(false)
                        } else {
                          const filtered = serviceRequests.filter(sr =>
                            sr.sr_number?.toLowerCase().includes(query.toLowerCase()) ||
                            sr.project?.toLowerCase().includes(query.toLowerCase()) ||
                            sr.purpose?.toLowerCase().includes(query.toLowerCase())
                          )
                          setSrSearchResults(filtered)
                          setShowSrResults(true)
                        }
                      }}
                      onFocus={() => {
                        if (srSearchQuery.trim() !== '') {
                          setShowSrResults(true)
                        }
                      }}
                      placeholder="Search by SR number, project, or purpose..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required={!selectedSR}
                    />
                    {showSrResults && srSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                        {srSearchResults.map(sr => (
                          <div
                            key={sr.id}
                            onClick={() => {
                              console.log('Selected SR data:', sr)
                              setSelectedSR(sr.id)
                              setSrSearchQuery(`${sr.sr_number} - ${sr.purpose || sr.project} (${formatCurrency(sr.amount)})`)
                              setShowSrResults(false)
                              loadSRData(sr.id)
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm font-medium">{sr.sr_number} - {sr.purpose || sr.project}</div>
                            <div className="text-xs text-gray-500">{sr.supplier_name || 'No supplier'} • {formatCurrency(sr.amount)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showSrResults && srSearchQuery.trim() !== '' && srSearchResults.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500">
                        No matching service requests found
                      </div>
                    )}
                    <input type="hidden" value={selectedSR} required />
                  </div>
                )}

                {/* CR Search Input */}
                {sourceType === 'cr' && (
                  <div className="mb-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cash Request (Approved for Payment) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={crSearchQuery}
                      onChange={(e) => {
                        const query = e.target.value
                        setCrSearchQuery(query)
                        if (query.trim() === '') {
                          setCrSearchResults([])
                          setShowCrResults(false)
                        } else {
                          const filtered = cashRequests.filter(cr =>
                            cr.cr_number?.toLowerCase().includes(query.toLowerCase()) ||
                            cr.project?.toLowerCase().includes(query.toLowerCase()) ||
                            cr.purpose?.toLowerCase().includes(query.toLowerCase())
                          )
                          setCrSearchResults(filtered)
                          setShowCrResults(true)
                        }
                      }}
                      onFocus={() => {
                        if (crSearchQuery.trim() !== '') {
                          setShowCrResults(true)
                        }
                      }}
                      placeholder="Search by CR number, project, or purpose..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required={!selectedCR}
                    />
                    {showCrResults && crSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                        {crSearchResults.map(cr => (
                          <div
                            key={cr.id}
                            onClick={() => {
                              console.log('Selected CR data:', cr)
                              setSelectedCR(cr.id)
                              setCrSearchQuery(`${cr.cr_number} - ${cr.purpose || cr.project} (${formatCurrency(cr.amount)})`)
                              setShowCrResults(false)
                              loadCRData(cr.id)
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm font-medium">{cr.cr_number} - {cr.purpose || cr.project}</div>
                            <div className="text-xs text-gray-500">{cr.supplier_name || 'No supplier'} • {formatCurrency(cr.amount)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showCrResults && crSearchQuery.trim() !== '' && crSearchResults.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500">
                        No matching cash requests found
                      </div>
                    )}
                    <input type="hidden" value={selectedCR} required />
                  </div>
                )}

                <Select label="Payee (Supplier)" value={selectedSupplier} onChange={(e) => { const supplierId = e.target.value; setSelectedSupplier(supplierId); const supplier = suppliers.find(s => s.id === parseInt(supplierId)); if (supplier) { setPayeeName(supplier.supplier_name); setPayeeAddress(supplier.address || ''); } }} options={suppliers.map(s => ({ value: s.id, label: s.supplier_name }))} required />

                <Input label="Payee Address" value={payeeAddress} onChange={(e) => setPayeeAddress(e.target.value)} />

                <Input label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Project" value={project} onChange={(e) => setProject(e.target.value)} />
                  <Input label="Project Address" value={projectAddress} onChange={(e) => setProjectAddress(e.target.value)} />
                </div>

                <Input label="Order Number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Optional" />

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                {/* Items from PR */}
                {items.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Items from PR</label>
                    <div className="bg-gray-50 rounded-md p-3 space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{item.item_name || `Item ${item.item_id}`} (x{item.quantity})</span>
                          <span>{formatCurrency(item.quantity * item.unit_price)}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 font-semibold text-right">
                        Total: {formatCurrency(amount)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="secondary" onClick={closeCreateModal}>Cancel</Button>
                  <Button type="button" variant="secondary" disabled={submitting} onClick={(e) => handleSubmit(e, true)}>{submitting ? 'Saving...' : 'Save as Draft'}</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Payment Request'}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentRequests
