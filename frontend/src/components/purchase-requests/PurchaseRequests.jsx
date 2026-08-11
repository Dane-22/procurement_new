import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { purchaseRequestService } from '../../services/purchaseRequests'
import { supplierService } from '../../services/suppliers'
import { socketService } from '../../services/socket'
import { projectService } from '../../services/projects'
import PRPreviewModal from './PRPreviewModal'
import { ChevronUp, ChevronDown, Plus, FileSpreadsheet, Edit, Trash2, X, Eye, CheckCircle, XCircle, Pause, Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

// UI Components
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
)

const Button = ({ children, variant = 'primary', size = 'md', type = 'button', onClick, disabled = false, className = '' }) => {
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
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  multiline = false,
  rows = 4,
  readOnly = false,
  disabled = false
}) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {multiline ? (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-y"
        required={required}
        readOnly={readOnly}
        disabled={disabled}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
        required={required}
        readOnly={readOnly}
        disabled={disabled}
      />
    )}
  </div>
)

const Select = ({ label, value, onChange, options, required = false, placeholder = 'Select...', disabled = false }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
      required={required}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
)

// Format helpers
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
      'Pending Accreditation Review': 'bg-amber-100 text-amber-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  )
}

const STATUS_FILTER_OPTIONS = [
  'For Procurement Review',
  'For Super Admin Final Approval',
  'For Purchase',
  'Received',
  'Completed',
  'Rejected',
  'Draft',
  'Cancelled',
  'Pending',
  'For Approval',
  'Approved',
  'PO Created',
  'Paid'
]

const formatPaymentTerms = (code, note) => {
  const normalizedCode = String(code || '').trim().toUpperCase()
  const normalizedNote = String(note || '').trim()
  if (!normalizedCode && normalizedNote) return normalizedNote
  if (!normalizedCode) return '-'
  if (normalizedCode === 'CUSTOM') return normalizedNote || 'Custom (missing details)'
  if (normalizedCode === 'NET_7') return 'NET 7'
  if (normalizedCode === 'NET_15') return 'NET 15'
  if (normalizedCode === 'NET_30') return 'NET 30'
  return normalizedCode
}

const roundMoney = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.round((numeric + Number.EPSILON) * 100) / 100
}

const sumScheduleAmounts = (schedules = []) => {
  return roundMoney(
    schedules.reduce((sum, row) => {
      const amount = Number(row?.amount)
      return Number.isFinite(amount) ? sum + amount : sum
    }, 0)
  )
}

const PurchaseRequests = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10) || 20, 1), 100)
  const urlStatus = searchParams.get('status') || 'ALL'
  const urlQ = searchParams.get('q') || ''
  const urlView = searchParams.get('view') || ''
  const urlTab = searchParams.get('tab') || 'my-prs'

  const [purchaseRequests, setPurchaseRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [expandedPRDetails, setExpandedPRDetails] = useState({})
  const [loadingExpanded, setLoadingExpanded] = useState(null)
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState(urlStatus)
  const [searchQuery, setSearchQuery] = useState(urlQ)

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPR, setPreviewPR] = useState(null)

  const [showProcurementApprovalModal, setShowProcurementApprovalModal] = useState(false)
  const [showProcurementRejectModal, setShowProcurementRejectModal] = useState(false)
  const [procurementSubmitting, setProcurementSubmitting] = useState(false)
  const [procurementLoading, setProcurementLoading] = useState(false)
  const [selectedPRForApproval, setSelectedPRForApproval] = useState(null)
  const [selectedPRForReject, setSelectedPRForReject] = useState(null)
  const [approvalSupplierId, setApprovalSupplierId] = useState('')
  const [approvalSupplierAddress, setApprovalSupplierAddress] = useState('')
  const [approvalItems, setApprovalItems] = useState([])
  const [procurementRejectRemarks, setProcurementRejectRemarks] = useState('')
  const [procurementRejectItemRemarks, setProcurementRejectItemRemarks] = useState({})

  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false)
  const [superAdminSubmitting, setSuperAdminSubmitting] = useState(false)
  const [selectedPRForSuperAdmin, setSelectedPRForSuperAdmin] = useState(null)
  const [superAdminAction, setSuperAdminAction] = useState('')
  const [superAdminRemarks, setSuperAdminRemarks] = useState('')
  const [superAdminItemRemarks, setSuperAdminItemRemarks] = useState({})

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedPRForReview, setSelectedPRForReview] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // Modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPR, setEditingPR] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [purpose, setPurpose] = useState('')
  const [project, setProject] = useState('')
  const [projectAddress, setProjectAddress] = useState('')
  const [dateNeeded, setDateNeeded] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [paymentBasis, setPaymentBasis] = useState('debt')
  const [paymentTermsNote, setPaymentTermsNote] = useState('')
  const [paymentSchedules, setPaymentSchedules] = useState([{ payment_date: '', amount: '', note: '' }])
  const [remarks, setRemarks] = useState('')
  const [items, setItems] = useState([{ item_id: '', quantity: 1, unit_price: 0 }])

  const updateQueryParams = useCallback((updater, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    updater(next)
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  // Keep inputs in sync with URL state (back/forward + manual edits)
  useEffect(() => {
    setStatusFilter(urlStatus)
    setSearchQuery(urlQ)
  }, [urlStatus, urlQ])

  // Only engineers can use view=all; clean up URL for other roles.
  useEffect(() => {
    if (user?.role && user.role !== 'engineer' && urlView) {
      updateQueryParams((p) => {
        p.delete('view')
      }, { replace: true })
    }
  }, [user?.role, urlView, updateQueryParams])

  // Listen for real-time updates
  useEffect(() => {
    console.log('Setting up PR status change listener');
    
    const handleStatusChange = (data) => {
      console.log('PR status changed (real-time):', data)
      fetchRef.current?.()
    }

    socketService.on('pr_status_changed', handleStatusChange)
    
    // Also listen to general pr_updated event
    const handlePRUpdate = (data) => {
      console.log('PR updated (real-time):', data)
      fetchRef.current?.()
    }
    socketService.on('pr_updated', handlePRUpdate)

    return () => {
      socketService.off('pr_status_changed', handleStatusChange)
      socketService.off('pr_updated', handlePRUpdate)
    }
  }, [])

  const fetchPurchaseRequests = useCallback(async () => {
    try {
      console.log('Fetching purchase requests...');
      setLoading(true)
      setError('')
      const view = user?.role === 'engineer' && urlView === 'all' ? 'all' : null
      console.log('Fetching with view:', view, 'user role:', user?.role, 'tab:', urlTab)
      const payload = await purchaseRequestService.list({
        view,
        page,
        pageSize,
        status: urlStatus !== 'ALL' ? urlStatus : null,
        q: urlQ.trim() ? urlQ.trim() : null,
        pending_review: urlTab === 'reviews' ? 'true' : null
      })
      const rows = Array.isArray(payload?.purchaseRequests) ? payload.purchaseRequests : []
      setPurchaseRequests(rows)
      setTotal(Number.isFinite(payload?.total) ? payload.total : rows.length)
      setExpandedId(null)
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError('Failed to fetch purchase requests')
    } finally {
      setLoading(false)
    }
  }, [user?.role, urlView, page, pageSize, urlStatus, urlQ])

  const fetchRef = useRef(null)
  useEffect(() => {
    fetchRef.current = fetchPurchaseRequests
  }, [fetchPurchaseRequests])

  // Fetch whenever URL state changes
  useEffect(() => {
    fetchPurchaseRequests()
  }, [fetchPurchaseRequests])

  // Debounced URL update for search input
  useEffect(() => {
    if (searchQuery === urlQ) return
    const timer = setTimeout(() => {
      const trimmed = searchQuery.trim()
      updateQueryParams((p) => {
        if (trimmed) p.set('q', trimmed)
        else p.delete('q')
        p.set('page', '1')
      }, { replace: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, urlQ, updateQueryParams])

  const openProcurementApproval = async (prRow) => {
    try {
      setShowProcurementApprovalModal(true)
      setProcurementLoading(true)

      const [suppliersData, fullPr] = await Promise.all([
        suppliers.length ? Promise.resolve(suppliers) : supplierService.getAll(),
        purchaseRequestService.getById(prRow.id)
      ])

      if (!suppliers.length) setSuppliers(suppliersData)

      setSelectedPRForApproval(fullPr)
      setApprovalSupplierId(String(fullPr.supplier_id || ''))
      setApprovalSupplierAddress(fullPr.supplier_address || '')
      setApprovalItems(
        (fullPr.items || []).map(it => ({
          id: it.id,
          item_id: it.item_id,
          item_name: it.item_name,
          item_code: it.item_code,
          unit: it.unit,
          quantity: it.quantity,
          unit_price: it.unit_price || 0
        }))
      )
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load PR for approval')
      setShowProcurementApprovalModal(false)
    } finally {
      setProcurementLoading(false)
    }
  }

  const closeProcurementApproval = () => {
    setShowProcurementApprovalModal(false)
    setSelectedPRForApproval(null)
    setApprovalSupplierId('')
    setApprovalSupplierAddress('')
    setApprovalItems([])
    setProcurementSubmitting(false)
    setProcurementLoading(false)
  }

  const openProcurementReject = async (prRow) => {
    try {
      setShowProcurementRejectModal(true)
      setProcurementLoading(true)
      const fullPr = await purchaseRequestService.getById(prRow.id)
      setSelectedPRForReject(fullPr)
      setProcurementRejectRemarks('')
      setProcurementRejectItemRemarks({})
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load PR for rejection')
      setShowProcurementRejectModal(false)
    } finally {
      setProcurementLoading(false)
    }
  }

  const totalPages = Math.max(Math.ceil((total || 0) / pageSize) || 1, 1)
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = total === 0 ? 0 : Math.min(page * pageSize, total)

  useEffect(() => {
    if (total > 0 && page > totalPages) {
      updateQueryParams((p) => {
        p.set('page', String(totalPages))
      }, { replace: true })
    }
  }, [total, page, totalPages, updateQueryParams])

  const commitSearchToUrl = ({ replace } = {}) => {
    const trimmed = searchQuery.trim()
    updateQueryParams((p) => {
      if (trimmed) p.set('q', trimmed)
      else p.delete('q')
      p.set('page', '1')
    }, { replace: replace ?? false })
  }

  const handleStatusFilterChange = (nextStatus) => {
    setStatusFilter(nextStatus)
    updateQueryParams((p) => {
      if (nextStatus && nextStatus !== 'ALL') p.set('status', nextStatus)
      else p.delete('status')
      p.set('page', '1')
    }, { replace: false })
  }

  const handlePageSizeChange = (nextPageSize) => {
    updateQueryParams((p) => {
      if (nextPageSize === 20) p.delete('pageSize')
      else p.set('pageSize', String(nextPageSize))
      p.set('page', '1')
    }, { replace: false })
  }

  const handleViewAllChange = (checked) => {
    updateQueryParams((p) => {
      if (checked) p.set('view', 'all')
      else p.delete('view')
      p.set('page', '1')
    }, { replace: false })
  }

  const goToPage = (nextPage) => {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages)
    updateQueryParams((p) => {
      p.set('page', String(clamped))
    }, { replace: false })
  }

  const clearFilters = () => {
    setStatusFilter('ALL')
    setSearchQuery('')
    updateQueryParams((p) => {
      p.delete('status')
      p.delete('q')
      p.set('page', '1')
    }, { replace: false })
  }

  const closeProcurementReject = () => {
    setShowProcurementRejectModal(false)
    setSelectedPRForReject(null)
    setProcurementRejectRemarks('')
    setProcurementRejectItemRemarks({})
    setProcurementSubmitting(false)
    setProcurementLoading(false)
  }

  const submitProcurementReject = async () => {
    if (!selectedPRForReject) return

    try {
      setProcurementSubmitting(true)
      await purchaseRequestService.procurementApprove(
        selectedPRForReject.id,
        'rejected',
        procurementRejectRemarks || null,
        [],
        null,
        null,
        Object.entries(procurementRejectItemRemarks)
          .filter(([_, remarks]) => remarks.trim())
          .map(([itemId, remarks]) => ({
            item_id: Number(itemId),
            remark: remarks
          }))
      )
      closeProcurementReject()
      await fetchPurchaseRequests()
      alert('Purchase Request rejected')
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject purchase request')
    } finally {
      setProcurementSubmitting(false)
    }
  }

  const updateApprovalItem = (index, field, value) => {
    const next = [...approvalItems]
    next[index] = { ...next[index], [field]: value }
    setApprovalItems(next)
  }

  const handleProcurementApprove = async () => {
    if (!selectedPRForApproval) return
    if (!approvalSupplierId) {
      alert('Supplier is required for approval')
      return
    }
    try {
      setProcurementSubmitting(true)
      await purchaseRequestService.procurementApprove(
        selectedPRForApproval.id,
        'approved',
        null,
        approvalItems.map(it => ({
          id: it.id,
          item_id: it.item_id,
          item_name: it.item_name,
          item_code: it.item_code,
          quantity: Number(it.quantity),
          unit: it.unit,
          unit_price: Number(it.unit_price)
        })),
        approvalSupplierId,
        approvalSupplierAddress,
        []
      )
      closeProcurementApproval()
      await fetchPurchaseRequests()
      alert('Purchase Request approved and forwarded for final approval')
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve purchase request')
    } finally {
      setProcurementSubmitting(false)
    }
  }

  const openSuperAdminModal = async (pr, action) => {
    try {
      setSuperAdminAction(action)
      setSuperAdminRemarks('')
      setSuperAdminItemRemarks({})
      setShowSuperAdminModal(true)
      
      // Load full PR details with items
      const fullPr = await purchaseRequestService.getById(pr.id)
      setSelectedPRForSuperAdmin(fullPr)
    } catch (err) {
      alert('Failed to load PR details')
      setShowSuperAdminModal(false)
    }
  }

  const closeSuperAdminModal = () => {
    setShowSuperAdminModal(false)
    setSelectedPRForSuperAdmin(null)
    setSuperAdminAction('')
    setSuperAdminRemarks('')
    setSuperAdminItemRemarks({})
    setSuperAdminSubmitting(false)
  }

  const handleSuperAdminAction = async () => {
    if (!selectedPRForSuperAdmin) return

    try {
      setSuperAdminSubmitting(true)
      
      // Convert item remarks object to array format expected by backend
      const itemRemarksArray = Object.entries(superAdminItemRemarks)
        .filter(([_, remark]) => remark.trim())
        .map(([itemId, remark]) => ({ item_id: parseInt(itemId), remark }))

      await purchaseRequestService.superAdminFirstApprove(
        selectedPRForSuperAdmin.id,
        superAdminAction, // 'approved', 'hold', or 'rejected'
        superAdminRemarks || null,
        itemRemarksArray
      )
      
      closeSuperAdminModal()
      await fetchPurchaseRequests()
      
      const actionText = superAdminAction === 'approved' ? 'approved' : 
                        superAdminAction === 'hold' ? 'put on hold' : 'rejected'
      alert(`Purchase Request ${actionText} successfully`)
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${superAdminAction} purchase request`)
    } finally {
      setSuperAdminSubmitting(false)
    }
  }

  const openPreview = async (id) => {
    try {
      setShowPreviewModal(true)
      setPreviewLoading(true)
      const pr = await purchaseRequestService.getById(id)
      setPreviewPR(pr)
    } catch (err) {
      alert('Failed to load purchase request details')
      setShowPreviewModal(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setShowPreviewModal(false)
    setPreviewPR(null)
  }

  const openEditModal = async (pr) => {
    setEditingPR(pr)
    setShowEditModal(true)
    setLoadingForm(true)
    setLoadingBranches(true)
    try {
      const [suppliersData, branchList] = await Promise.all([
        supplierService.getAll(),
        projectService.getActive()
      ])
      setSuppliers(suppliersData)
      setBranches(branchList)
      
      // Load PR details
      const fullPr = await purchaseRequestService.getById(pr.id)
      
      // Populate form with PR data
      setPurpose(fullPr.purpose || '')
      setProject(fullPr.project || '')
      setProjectAddress(fullPr.project_address || '')
      setDateNeeded(fullPr.date_needed ? fullPr.date_needed.split('T')[0] : '')
      setOrderNumber(fullPr.order_number || '')
      setSelectedSupplier(String(fullPr.supplier_id || ''))
      setPaymentBasis(fullPr.payment_basis || 'debt')
      setPaymentTermsNote(fullPr.payment_terms_note || '')
      setPaymentSchedules((fullPr.payment_schedules || []).length > 0
        ? fullPr.payment_schedules.map((schedule) => ({
            payment_date: schedule.payment_date ? String(schedule.payment_date).slice(0, 10) : '',
            amount: schedule.amount ?? '',
            note: schedule.note || ''
          }))
        : [{ payment_date: '', amount: '', note: '' }]
      )
      setRemarks(fullPr.remarks || '')
      setItems((fullPr.items || []).map(item => ({
        item_id: String(item.item_id || item.id || ''),
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0
      })))
    } catch (err) {
      alert('Failed to load PR for editing')
      closeEditModal()
    } finally {
      setLoadingForm(false)
      setLoadingBranches(false)
    }
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingPR(null)
    resetForm()
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!purpose) { alert('Purpose is required'); return }
    if (items.length === 0) { alert('At least one item is required'); return }

    try {
      const normalizedSchedules = sanitizePaymentSchedules(paymentSchedules)
      if (paymentBasis === 'debt' && normalizedSchedules.length === 0) {
        alert('At least one payment schedule is required for debt/with account PR')
        return
      }
      validateScheduleTotals(normalizedSchedules)
      setSubmitting(true)
      const prData = {
        purpose,
        project: project || null,
        project_address: projectAddress || null,
        date_needed: dateNeeded || null,
        order_number: orderNumber || null,
        supplier_id: selectedSupplier || null,
        payment_basis: paymentBasis,
        payment_terms_note: paymentTermsNote.trim() || null,
        payment_schedules: normalizedSchedules,
        remarks: remarks || null,
        items: items.map(item => ({
          item_id: parseInt(item.item_id),
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price)
        }))
      }
      // Use resubmit for rejected PRs, updateDraft for draft PRs
      if (editingPR.status === 'Rejected') {
        await purchaseRequestService.resubmit(editingPR.id, prData)
      } else {
        await purchaseRequestService.updateDraft(editingPR.id, prData)
      }
      await fetchPurchaseRequests()
      closeEditModal()
      alert('Purchase Request updated successfully!')
    } catch (err) {
      alert('Failed to update PR: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setPurpose('')
    setProject('')
    setProjectAddress('')
    setDateNeeded('')
    setOrderNumber('')
    setSelectedSupplier('')
    setPaymentBasis('debt')
    setPaymentTermsNote('')
    setPaymentSchedules([{ payment_date: '', amount: '', note: '' }])
    setRemarks('')
    setItems([{ item_id: '', quantity: 1, unit_price: 0 }])
  }

  const addItem = () => {
    setItems([...items, { item_id: '', quantity: 1, unit_price: 0 }])
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const addPaymentSchedule = () => {
    setPaymentSchedules((prev) => [...prev, { payment_date: '', amount: '', note: '' }])
  }

  const removePaymentSchedule = (index) => {
    setPaymentSchedules((prev) => prev.filter((_, i) => i !== index))
  }

  const updatePaymentSchedule = (index, field, value) => {
    setPaymentSchedules((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const sanitizePaymentSchedules = (rows) => {
    const cleaned = (rows || [])
      .map((row) => ({
        payment_date: String(row?.payment_date || '').trim(),
        amount: row?.amount === '' || row?.amount == null ? null : Number(row.amount),
        note: String(row?.note || '').trim() || null
      }))
      .filter((row) => row.payment_date || row.amount != null || row.note)

    const seen = new Set()
    for (const row of cleaned) {
      if (!row.payment_date) {
        throw new Error('Each payment schedule row must have a payment date')
      }
      if (seen.has(row.payment_date)) {
        throw new Error(`Duplicate payment schedule date: ${row.payment_date}`)
      }
      seen.add(row.payment_date)
      if (row.amount != null && (Number.isNaN(row.amount) || row.amount < 0)) {
        throw new Error('Payment schedule amount must be a non-negative number')
      }
    }

    return cleaned
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const validateScheduleTotals = (normalizedSchedules) => {
    if (paymentBasis !== 'debt') return true
    const scheduleTotal = sumScheduleAmounts(normalizedSchedules)
    const itemsTotal = roundMoney(calculateTotal())
    if (scheduleTotal !== itemsTotal) {
      throw new Error(`Payment schedule total (${formatCurrency(scheduleTotal)}) must match PR total (${formatCurrency(itemsTotal)}).`)
    }
    return true
  }

  const preventNumberScroll = (e) => {
    e.currentTarget.blur()
  }

  const paymentScheduleTotal = sumScheduleAmounts(paymentSchedules)
  const itemsTotal = roundMoney(calculateTotal())
  const paymentScheduleDifference = roundMoney(paymentScheduleTotal - itemsTotal)
  const paymentScheduleDifferenceLabel = paymentScheduleDifference > 0
    ? `+${formatCurrency(paymentScheduleDifference)}`
    : formatCurrency(paymentScheduleDifference)

  const handleProjectChange = (projectName) => {
    setProject(projectName)
    const selectedBranch = branches.find((branch) => (branch?.branch_name || '') === projectName)
    if (!selectedBranch) {
      setProjectAddress('')
      setOrderNumber('')
      return
    }
    setProjectAddress(selectedBranch.branch_address || selectedBranch.address || '')
    setOrderNumber(selectedBranch.order_number || selectedBranch.code || '')
  }

  const handleMarkAsReceived = async (pr) => {
    if (!confirm('Mark this purchase request as received?')) return
    
    try {
      await purchaseRequestService.markAsReceived(pr.id)
      await fetchPurchaseRequests()
      alert('Purchase request marked as received!')
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark as received')
    }
  }

  const handleExport = async (id, prNumber) => {
    try {
      const blob = await purchaseRequestService.exportToExcel(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PR-${prNumber}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to export purchase request')
    }
  }

  const openReviewModal = (pr) => {
    setSelectedPRForReview(pr)
    setReviewComment('')
    setShowReviewModal(true)
  }

  const closeReviewModal = () => {
    setShowReviewModal(false)
    setSelectedPRForReview(null)
    setReviewComment('')
  }

  const handleReview = async (reviewStatus) => {
    if (!selectedPRForReview) return

    try {
      setReviewSubmitting(true)
      await purchaseRequestService.review(selectedPRForReview.id, reviewStatus, reviewComment)
      closeReviewModal()
      await fetchPurchaseRequests()
      alert(`Purchase request ${reviewStatus} successfully`)
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${reviewStatus} purchase request`)
    } finally {
      setReviewSubmitting(false)
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
        <h2 className="text-lg font-semibold text-gray-900">Purchase Requests</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            {total === 0
              ? '0 Requests'
              : `Showing ${startItem}-${endItem} of ${total} Request${total !== 1 ? 's' : ''}`
            }
          </div>
        </div>
      </div>

      <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search PR number, project, requester, supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitSearchToUrl({ replace: false })
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2
  focus:ring-yellow-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none
  focus:ring-2 focus:ring-yellow-500"
              >
                <option value="ALL">All statuses</option>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {(searchQuery.trim() || statusFilter !== 'ALL') && (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}

              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="w-full sm:w-28 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none
  focus:ring-2 focus:ring-yellow-500"
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
          </div>
        </Card>

      <Card>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">PR Number</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Requester</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRequests.map(pr => (
                <React.Fragment key={pr.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={async () => {
                    const isExpanding = expandedId !== pr.id
                    setExpandedId(isExpanding ? pr.id : null)
                    
                    // Load full details once when expanding so schedules/remarks are complete.
                    if (isExpanding && !expandedPRDetails[pr.id]) {
                      setLoadingExpanded(pr.id)
                      try {
                        const fullPr = await purchaseRequestService.getById(pr.id)
                        setExpandedPRDetails(prev => ({ ...prev, [pr.id]: fullPr }))
                      } catch (err) {
                        console.error('Failed to load PR details', err)
                      } finally {
                        setLoadingExpanded(null)
                      }
                    }
                  }}>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{pr.pr_number}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{pr.project}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{pr.requester_first_name} {pr.requester_last_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(pr.total_amount || pr.amount)}</td>
                    <td className="py-3 px-4"><StatusBadge status={pr.status} /></td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDate(pr.created_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {user?.role === 'procurement' && pr.status === 'For Procurement Review' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openProcurementApproval(pr)
                              }}
                              title="Approve"
                              disabled={procurementSubmitting}
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openProcurementReject(pr)
                              }}
                              title="Reject"
                              disabled={procurementSubmitting}
                            >
                              <XCircle className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openPreview(pr.id)
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
                            handleExport(pr.id, pr.pr_number)
                          }}
                          title="Export to Excel"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </Button>
                        {pr.status === 'Completed' && user?.role === 'engineer' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsReceived(pr)
                            }}
                            title="Mark as Received"
                          >
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        {(pr.status === 'Draft' || pr.status === 'Rejected') && user?.role === 'engineer' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditModal(pr)
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Delete">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {urlTab === 'reviews' && (pr.status === 'For Engineer Review' || pr.status === 'For Admin Review' || pr.status === 'For Procurement Review') && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openReviewModal(pr)
                              }}
                              title="Review"
                              disabled={reviewSubmitting}
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === pr.id ? null : pr.id); }}>
                          {expandedId === pr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === pr.id && (
                    <tr>
                      <td colSpan="7" className="bg-gray-50 p-4">
                        {(() => {
                          const fullPr = expandedPRDetails[pr.id] || pr
                          const paymentScheduleRows = fullPr.payment_schedules || []
                          return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Category</p>
                              <p className="text-sm text-gray-900">{fullPr.category || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Purpose</p>
                              <p className="text-sm text-gray-900">{fullPr.purpose || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Payment Type</p>
                              <p className="text-sm text-gray-900">
                                {fullPr.payment_basis === 'debt' ? 'w/ account (Debt)' : 
                                 fullPr.payment_basis === 'non_debt' ? 'w/o account (Non-debt)' : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Payment Terms</p>
                              <p className="text-sm text-gray-900">{formatPaymentTerms(fullPr.payment_terms_code, fullPr.payment_terms_note)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Payment Schedule</p>
                              <p className="text-sm text-gray-900">
                                {Number(fullPr.payment_schedule_count || paymentScheduleRows.length || 0) > 0
                                  ? `${fullPr.payment_schedule_count || paymentScheduleRows.length} date(s), next: ${formatDate(fullPr.next_payment_date || paymentScheduleRows[0]?.payment_date)}`
                                  : '-'}
                              </p>
                            </div>
                          </div>
                          {paymentScheduleRows.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Payment Date Details</p>
                              <div className="mt-1 space-y-1">
                                {paymentScheduleRows.map((schedule) => (
                                  <p key={schedule.id || `${schedule.payment_date}-${schedule.amount || ''}`} className="text-sm text-gray-900">
                                    {formatDate(schedule.payment_date)} | {schedule.amount == null ? '-' : formatCurrency(schedule.amount)}{schedule.note ? ` | ${schedule.note}` : ''}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {fullPr.remarks && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Remarks</p>
                              <p className="text-sm text-gray-900">{fullPr.remarks}</p>
                            </div>
                          )}
                          {fullPr.rejection_reason && (
                            <div>
                              <p className="text-xs text-red-500 uppercase">Rejection Reason</p>
                              <p className="text-sm text-red-700">{fullPr.rejection_reason}</p>
                            </div>
                          )}
                          {/* Per-item rejection remarks */}
                          {(fullPr.items)?.some(item => item.rejection_remarks?.length > 0) && (
                            <div className="col-span-2">
                              <p className="text-xs text-red-500 uppercase mb-2">Item Rejection Remarks</p>
                              <div className="space-y-1">
                                {(fullPr.items || []).filter(item => item.rejection_remarks?.length > 0).map(item => (
                                  <div key={item.id} className="bg-red-50 p-2 rounded border border-red-100">
                                    <p className="text-sm font-medium text-red-800">{item.item_name || item.item_code}</p>
                                    {item.rejection_remarks.map((remark, idx) => (
                                      <p key={idx} className="text-sm text-red-600">• {remark.remark}</p>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {loadingExpanded === pr.id && (
                            <div className="col-span-2 text-center py-2">
                              <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin inline-block"></div>
                              <span className="text-xs text-gray-500 ml-2">Loading details...</span>
                            </div>
                          )}
                        </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {purchaseRequests.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    No purchase requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid View */}
        <div className="md:hidden p-4">
          <div className="space-y-3">
            {purchaseRequests.map(pr => (
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
                    <p className="text-xs text-gray-500 font-mono">{pr.pr_number}</p>
                    <p className="text-sm font-semibold text-gray-900">{pr.project}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {user?.role === 'procurement' && pr.status === 'For Procurement Review' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openProcurementApproval(pr)
                          }}
                          disabled={procurementSubmitting}
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openProcurementReject(pr)
                          }}
                          disabled={procurementSubmitting}
                        >
                          <XCircle className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation()
                        openPreview(pr.id)
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExport(pr.id, pr.pr_number)
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </Button>
                    {urlTab === 'reviews' && (pr.status === 'For Engineer Review' || pr.status === 'For Admin Review' || pr.status === 'For Procurement Review') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openReviewModal(pr)
                        }}
                        disabled={reviewSubmitting}
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === pr.id ? null : pr.id); }}>
                      {expandedId === pr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-sm text-gray-600">{pr.requester_first_name} {pr.requester_last_name}</p>
                  <p className="text-sm font-medium text-gray-700">{formatCurrency(pr.total_amount || pr.amount)}</p>
                </div>
                <StatusBadge status={pr.status} />
                {expandedId === pr.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <p className="text-xs text-gray-500">Category: {pr.category || '-'}</p>
                    <p className="text-xs text-gray-500">Purpose: {pr.purpose || '-'}</p>
                    <p className="text-xs text-gray-500">
                      Payment Type: {pr.payment_basis === 'debt' ? 'w/ account (Debt)' : 
                                    pr.payment_basis === 'non_debt' ? 'w/o account (Non-debt)' : '-'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Payment Terms: {formatPaymentTerms(pr.payment_terms_code, pr.payment_terms_note)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Payment Schedule: {Number(pr.payment_schedule_count || 0) > 0
                        ? `${pr.payment_schedule_count} date(s), next: ${formatDate(pr.next_payment_date)}`
                        : '-'}
                    </p>
                    {pr.remarks && <p className="text-xs text-gray-500">Remarks: {pr.remarks}</p>}
                  </div>
                )}
              </div>
            ))}
            {purchaseRequests.length === 0 && (
              <p className="text-center text-gray-500 py-8">No purchase requests found</p>
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
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
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
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </Button>
                    ))}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </Button>

                <span className="text-sm text-gray-500 ml-2">
                  Page {page} of {totalPages}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Edit PR Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Purchase Request</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingForm ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading...</p>
              </div>
            ) : (
              <form onSubmit={handleUpdate} className="p-6">
                <Input label="Purpose *" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
                
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Project *"
                    value={project}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    options={branches.map((branch) => ({ value: branch.branch_name, label: branch.branch_name }))}
                    placeholder={loadingBranches ? 'Loading projects...' : (branches.length ? 'Select project...' : 'No projects available')}
                    required
                    disabled={loadingBranches || branches.length === 0}
                  />
                  <Input label="Project Address" value={projectAddress} onChange={() => {}} readOnly />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Date Needed" type="date" value={dateNeeded} onChange={(e) => setDateNeeded(e.target.value)} />
                  <Input label="Order Number" value={orderNumber} onChange={() => {}} readOnly />
                </div>

                <Select 
                  label="Supplier (Optional)" 
                  value={selectedSupplier} 
                  onChange={(e) => setSelectedSupplier(e.target.value)} 
                  options={suppliers.map(s => ({ value: s.id, label: s.supplier_name }))} 
                />

                <Select 
                  label="Payment Basis *" 
                  value={paymentBasis} 
                  onChange={(e) => setPaymentBasis(e.target.value)} 
                  options={[
                    { value: 'debt', label: 'Debt (with supplier account)' },
                    { value: 'non_debt', label: 'Cash/Non-debt (immediate payment)' }
                  ]} 
                  required 
                />
                <Input
                  label={paymentBasis === 'debt' ? 'Payment Terms and Conditions *' : 'Payment Terms and Conditions'}
                  value={paymentTermsNote}
                  onChange={(e) => setPaymentTermsNote(e.target.value)}
                  placeholder="Ex: Net 30 after invoice receipt"
                  multiline
                  rows={4}
                  required={false}
                />

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Payment Dates {paymentBasis === 'debt' && <span className="text-red-500">*</span>}
                    </label>
                    <Button type="button" variant="secondary" size="sm" onClick={addPaymentSchedule}>
                      <Plus className="w-4 h-4 mr-1" /> Add Date
                    </Button>
                  </div>
                  {paymentSchedules.map((schedule, index) => (
                    <div key={`edit-schedule-${index}`} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-4">
                        <input
                          type="date"
                          value={schedule.payment_date}
                          onChange={(e) => updatePaymentSchedule(index, 'payment_date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="Amount (optional)"
                          value={schedule.amount}
                          onChange={(e) => updatePaymentSchedule(index, 'amount', e.target.value)}
                          onWheel={preventNumberScroll}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          value={schedule.note}
                          onChange={(e) => updatePaymentSchedule(index, 'note', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        {paymentSchedules.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removePaymentSchedule(index)}>
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {paymentBasis === 'debt' && (
                    <div className={`mt-2 rounded-md border px-3 py-2 text-sm ${paymentScheduleDifference === 0 ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                      <p>Scheduled Total: {formatCurrency(paymentScheduleTotal)}</p>
                      <p>PR Total: {formatCurrency(itemsTotal)}</p>
                      <p>Difference: {paymentScheduleDifferenceLabel}</p>
                    </div>
                  )}
                </div>

                <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />

                {/* Items */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Items *</label>
                    <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                      <Plus className="w-4 h-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-end">
                      <div className="flex-1">
                        <input type="text" placeholder="Item ID" value={item.item_id} onChange={(e) => updateItem(index, 'item_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" required />
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

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="secondary" onClick={closeEditModal}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PR Preview Modal */}
      <PRPreviewModal
        pr={previewPR}
        loading={previewLoading}
        onClose={closePreview}
        onApprove={user?.role === 'procurement' && previewPR?.status === 'For Procurement Review' ? (_, pr) => {
          closePreview()
          openProcurementApproval(pr)
        } : undefined}
        onReject={user?.role === 'procurement' && previewPR?.status === 'For Procurement Review' ? (pr) => {
          closePreview()
          openProcurementReject(pr)
        } : undefined}
        processingId={procurementSubmitting ? previewPR?.id : null}
      />

      {showProcurementApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Procurement Review</h3>
              <button onClick={closeProcurementApproval} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {procurementLoading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading...</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Supplier *"
                    value={approvalSupplierId}
                    onChange={(e) => {
                      const supplierId = e.target.value
                      setApprovalSupplierId(supplierId)
                      const supplier = suppliers.find(s => String(s.id) === String(supplierId))
                      if (supplier) setApprovalSupplierAddress(supplier.address || supplier.supplier_address || '')
                    }}
                    options={suppliers.map(s => ({ value: s.id, label: s.supplier_name }))}
                    required
                  />
                  <Input
                    label="Supplier Address"
                    value={approvalSupplierAddress}
                    onChange={(e) => setApprovalSupplierAddress(e.target.value)}
                    placeholder="Enter supplier address"
                  />
                </div>

                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase border-b border-gray-300">Item</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase border-b border-gray-300">Unit</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-gray-600 uppercase border-b border-gray-300">Qty</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase border-b border-gray-300">Unit Cost</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase border-b border-gray-300">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalItems.map((item, index) => (
                        <tr key={item.id} className="border-b border-gray-200">
                          <td className="py-2 px-3">
                            <div className="text-sm font-medium text-gray-900">{item.item_name || item.item_code}</div>
                          </td>
                          <td className="py-2 px-3 text-sm text-gray-700">{item.unit || '-'}</td>
                          <td className="py-2 px-3 text-center text-sm text-gray-900">{item.quantity}</td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateApprovalItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-right">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="secondary" onClick={closeProcurementApproval} disabled={procurementSubmitting}>Cancel</Button>
                  <Button onClick={handleProcurementApprove} disabled={procurementSubmitting}>
                    {procurementSubmitting ? 'Approving...' : 'Approve'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Procurement Reject Modal */}
      {showProcurementRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Reject Purchase Request</h3>
              <button onClick={closeProcurementReject} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {procurementLoading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading...</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {selectedPRForReject && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">PR Number: <span className="font-semibold text-gray-900">{selectedPRForReject.pr_number}</span></p>
                    <p className="text-sm text-gray-600">Project: <span className="font-semibold text-gray-900">{selectedPRForReject.project}</span></p>
                    <p className="text-sm text-gray-600">Amount: <span className="font-semibold text-gray-900">{formatCurrency(selectedPRForReject.total_amount)}</span></p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remarks
                  </label>
                  <textarea
                    value={procurementRejectRemarks}
                    onChange={(e) => setProcurementRejectRemarks(e.target.value)}
                    placeholder="Enter remarks (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    rows="3"
                  />
                </div>

                {selectedPRForReject?.items?.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item Rejection Remarks (Optional)
                    </label>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {selectedPRForReject.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                          <span className="text-sm text-gray-600 w-1/2 truncate font-medium">{item.item_name || item.item_code}</span>
                          <input
                            type="text"
                            value={procurementRejectItemRemarks[item.id] || ''}
                            onChange={(e) => setProcurementRejectItemRemarks({...procurementRejectItemRemarks, [item.id]: e.target.value})}
                            placeholder="Reason for rejecting this item (optional)"
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      You can reject specific items above or leave empty to reject the entire PR
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="secondary" onClick={closeProcurementReject} disabled={procurementSubmitting}>Cancel</Button>
                  <Button 
                    onClick={submitProcurementReject} 
                    disabled={procurementSubmitting}
                    variant="danger"
                  >
                    {procurementSubmitting ? 'Processing...' : 'Reject'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showSuperAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {superAdminAction === 'approved' ? 'Final Approval' : 
                 superAdminAction === 'hold' ? 'Put on Hold' : 'Reject Purchase Request'}
              </h3>
              <button onClick={closeSuperAdminModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selectedPRForSuperAdmin && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">PR Number: <span className="font-semibold text-gray-900">{selectedPRForSuperAdmin.pr_number}</span></p>
                  <p className="text-sm text-gray-600">Project: <span className="font-semibold text-gray-900">{selectedPRForSuperAdmin.project}</span></p>
                  <p className="text-sm text-gray-600">Amount: <span className="font-semibold text-gray-900">{formatCurrency(selectedPRForSuperAdmin.total_amount)}</span></p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={superAdminRemarks}
                  onChange={(e) => setSuperAdminRemarks(e.target.value)}
                  placeholder="Enter remarks (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  rows="3"
                />
              </div>

              {selectedPRForSuperAdmin?.items?.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {superAdminAction === 'rejected' ? 'Item Rejection Remarks (Optional)' : 'Item Remarks (Optional)'}
                  </label>
                  <div className="space-y-2 max-h-40 overflow-auto">
                    {selectedPRForSuperAdmin.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                        <span className="text-sm text-gray-600 w-1/2 truncate font-medium">{item.item_name || item.item_code}</span>
                        <input
                          type="text"
                          value={superAdminItemRemarks[item.id] || ''}
                          onChange={(e) => setSuperAdminItemRemarks({...superAdminItemRemarks, [item.id]: e.target.value})}
                          placeholder={superAdminAction === 'rejected' ? 'Reason for rejecting this item (optional)' : 'Remark for this item'}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                    ))}
                  </div>
                  {superAdminAction === 'rejected' && (
                    <p className="text-xs text-gray-500 mt-2">
                      You can reject specific items above or leave empty to reject the entire PR
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={closeSuperAdminModal} disabled={superAdminSubmitting}>Cancel</Button>
                <Button 
                  onClick={handleSuperAdminAction} 
                  disabled={superAdminSubmitting}
                  variant={superAdminAction === 'rejected' ? 'danger' : 'primary'}
                >
                  {superAdminSubmitting ? 'Processing...' : 
                   superAdminAction === 'approved' ? 'Approve' : 
                   superAdminAction === 'hold' ? 'Put on Hold' : 'Reject'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Review Purchase Request</h3>
              <button onClick={closeReviewModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selectedPRForReview && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">PR Number: <span className="font-semibold text-gray-900">{selectedPRForReview.pr_number}</span></p>
                  <p className="text-sm text-gray-600">Project: <span className="font-semibold text-gray-900">{selectedPRForReview.project}</span></p>
                  <p className="text-sm text-gray-600">Amount: <span className="font-semibold text-gray-900">{formatCurrency(selectedPRForReview.total_amount)}</span></p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Comment (optional)
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Enter your review comment (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  rows="3"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="danger" onClick={() => handleReview('rejected')} disabled={reviewSubmitting}>
                  {reviewSubmitting ? 'Processing...' : 'Reject'}
                </Button>
                <Button variant="primary" onClick={() => handleReview('approved')} disabled={reviewSubmitting}>
                  {reviewSubmitting ? 'Processing...' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PurchaseRequests
