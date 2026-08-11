import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cashRequestService } from '../services/cashRequests'
import { supplierService } from '../services/suppliers'
import { projectService } from '../services/projects'
import { ChevronUp, ChevronDown, Plus, X, Download, Edit, Trash2, Send, CheckCircle, Clock, Search, Eye } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import CRPreviewModal from './cash-requests/CRPreviewModal'

// Local Card component
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
)

// Local Button component
const Button = ({ children, onClick, type = 'button', variant = 'primary', size = 'md', className = '', disabled = false, title }) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variantClasses = {
    primary: 'bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-500',
    secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
    ghost: 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500'
  }
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classes}
    >
      {children}
    </button>
  )
}

const Input = ({ label, value, onChange, placeholder = '', required = false, type = 'text' }) => (
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

const TextArea = ({ label, value, onChange, placeholder = '', required = false, rows = 3 }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
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

const formatScheduleAmount = (amount) => {
  if (amount == null || amount === '') return '-';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

const getScheduleStatus = (paymentDate) => {
  if (!paymentDate) return { label: '-', color: 'bg-gray-100 text-gray-600' };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const scheduleDate = new Date(paymentDate);
  scheduleDate.setHours(0, 0, 0, 0);
  
  const diffTime = scheduleDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { label: 'Overdue', color: 'bg-red-100 text-red-700' };
  } else if (diffDays === 0) {
    return { label: 'Due Today', color: 'bg-orange-100 text-orange-700' };
  } else if (diffDays <= 7) {
    return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`, color: 'bg-yellow-100 text-yellow-700' };
  } else {
    return { label: 'Upcoming', color: 'bg-green-100 text-green-700' };
  }
};

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
      'For Procurement Review': 'bg-yellow-100 text-yellow-800',
      'For Super Admin Final Approval': 'bg-purple-100 text-purple-800',
      'Approved': 'bg-green-100 text-green-800',
      'Cash Request Created': 'bg-indigo-100 text-indigo-800',
      'Payment Request Created': 'bg-indigo-100 text-indigo-800',
      'Payment Order Created': 'bg-indigo-100 text-indigo-800',
      'Paid': 'bg-green-100 text-green-800',
      'Received': 'bg-teal-100 text-teal-800',
      'On Hold': 'bg-orange-100 text-orange-800',
      'Rejected': 'bg-red-100 text-red-800'
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
  'Draft',
  'For Procurement Review',
  'For Super Admin Final Approval',
  'Approved',
  'Cash Request Created',
  'On Hold',
  'Rejected',
  'Cancelled',
  'Payment Request Created',
  'Payment Order Created',
  'DV Created',
  'Paid',
  'Received'
]

const CashRequests = () => {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10) || 20, 1), 100)
  const urlStatus = searchParams.get('status') || 'ALL'
  const urlQ = searchParams.get('q') || ''
  const urlView = searchParams.get('view') || ''

  const [cashRequests, setCashRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const [statusFilter, setStatusFilter] = useState(urlStatus)
  const [searchQuery, setSearchQuery] = useState(urlQ)

  // Preview modal state
  const [previewCR, setPreviewCR] = useState(null)
  const [previewCRDetails, setPreviewCRDetails] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [loadingForm, setLoadingForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [purpose, setPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [unit, setUnit] = useState('pcs')
  const [project, setProject] = useState('')
  const [projectAddress, setProjectAddress] = useState('')
  const [dateNeeded, setDateNeeded] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierAddress, setSupplierAddress] = useState('')
  const [remarks, setRemarks] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [paymentTermsNote, setPaymentTermsNote] = useState('')
  const [paymentSchedules, setPaymentSchedules] = useState([{ payment_date: '', amount: '', note: '' }])
  const [scheduleAmountTouched, setScheduleAmountTouched] = useState(false)
  const [branches, setBranches] = useState([])
  const [crType, setCrType] = useState('payment_request')

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

  const fetchCashRequests = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const view = user?.role === 'engineer' && urlView === 'all' ? 'all' : null
      const payload = await cashRequestService.list({
        view,
        page,
        pageSize,
        status: urlStatus !== 'ALL' ? urlStatus : null,
        q: urlQ.trim() ? urlQ.trim() : null
      })

      const rows = Array.isArray(payload?.cashRequests) ? payload.cashRequests : []
      setCashRequests(rows)
      setTotal(Number.isFinite(payload?.total) ? payload.total : rows.length)
      setExpandedId(null)
    } catch {
      setError('Failed to fetch cash requests')
    } finally {
      setLoading(false)
    }
  }, [user?.role, urlView, page, pageSize, urlStatus, urlQ])

  const fetchRef = useRef(null)
  useEffect(() => {
    fetchRef.current = fetchCashRequests
  }, [fetchCashRequests])

  useEffect(() => {
    fetchCashRequests()
  }, [fetchCashRequests])

  // Auto-fill first payment schedule amount = amount * quantity (Create modal only; until user edits it)
  useEffect(() => {
    if (!showCreateModal) return
    if (crType !== 'payment_request') return
    if (scheduleAmountTouched) return

    const amountNum = Number(amount)
    const qtyNum = Number(quantity)
    if (!Number.isFinite(amountNum) || !Number.isFinite(qtyNum) || amountNum <= 0 || qtyNum <= 0) return

    const computed = (amountNum * qtyNum).toFixed(2)
    setPaymentSchedules((prev) => {
      const schedules = Array.isArray(prev) ? prev : []
      const row0 = schedules[0] || { payment_date: '', amount: '', note: '' }
      const next = [...schedules]
      next[0] = { ...row0, amount: String(computed) }
      return next
    })
  }, [showCreateModal, crType, scheduleAmountTouched, amount, quantity])

  const openPreviewCR = async (cr) => {
    setPreviewCR(cr)
    setLoadingPreview(true)
    try {
      const details = await cashRequestService.getById(cr.id)
      setPreviewCRDetails(details)
    } catch (err) {
      console.error('Failed to fetch CR details:', err)
    } finally {
      setLoadingPreview(false)
    }
  }

  const closePreviewCR = () => {
    setPreviewCR(null)
    setPreviewCRDetails(null)
    setLoadingPreview(false)
  }

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

  const openCreateModal = async () => {
    setScheduleAmountTouched(false)
    setShowCreateModal(true)
    setLoadingForm(true)
    try {
      const [suppliersData, branchesData] = await Promise.all([
        supplierService.getAll(),
        projectService.getActive()
      ])
      setSuppliers(suppliersData)
      setBranches(branchesData)
    } catch (err) {
      console.error('Failed to load data', err)
    } finally {
      setLoadingForm(false)
    }
  }

  const openEditModal = async (cr) => {
    setShowEditModal(true)
    setLoadingForm(true)
    try {
      const fullCr = await cashRequestService.getById(cr.id)
      setEditingId(cr.id)
      setPurpose(fullCr.purpose || '')
      setDescription(fullCr.description || '')
      setAmount(fullCr.amount || 0)
      setQuantity(fullCr.quantity || 1)
      setUnit(fullCr.unit || 'pcs')
      setProject(fullCr.project || '')
      setProjectAddress(fullCr.project_address || '')
      setDateNeeded(fullCr.date_needed ? String(fullCr.date_needed).split('T')[0] : '')
      setSelectedSupplier(fullCr.supplier_id ? fullCr.supplier_id.toString() : '')
      setSupplierName(fullCr.supplier_name || '')
      setSupplierAddress(fullCr.supplier_address || '')
      setRemarks(fullCr.remarks || '')
      setOrderNumber(fullCr.order_number || '')
      setPaymentTermsNote(fullCr.payment_terms_note || '')
      setCrType(fullCr.cr_type || 'payment_request')
      setPaymentSchedules((fullCr.payment_schedules || []).length > 0
        ? fullCr.payment_schedules.map((schedule) => ({
            payment_date: schedule.payment_date ? String(schedule.payment_date).slice(0, 10) : '',
            amount: schedule.amount ?? '',
            note: schedule.note || ''
          }))
        : [{ payment_date: '', amount: '', note: '' }])

      const [suppliersData, branchesData] = await Promise.all([
        supplierService.getAll(),
        projectService.getActive()
      ])
      setSuppliers(suppliersData)
      setBranches(branchesData)
    } catch (err) {
      console.error('Failed to load data', err)
    } finally {
      setLoadingForm(false)
    }
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setShowEditModal(false)
    setEditingId(null)
    resetForm()
  }

  const resetForm = () => {
    setPurpose('')
    setDescription('')
    setAmount(0)
    setQuantity(1)
    setUnit('pcs')
    setProject('')
    setProjectAddress('')
    setDateNeeded('')
    setSelectedSupplier('')
    setSupplierName('')
    setSupplierAddress('')
    setRemarks('')
    setOrderNumber('')
    setPaymentTermsNote('')
    setPaymentSchedules([{ payment_date: '', amount: '', note: '' }])
    setScheduleAmountTouched(false)
    setCrType('payment_request')
  }

  const sanitizePaymentSchedules = (schedules = []) => {
    const seenDates = new Set()
    const normalized = []
    for (const row of schedules) {
      const paymentDate = String(row?.payment_date || '').trim()
      const amountRaw = row?.amount
      const note = String(row?.note || '').trim()
      const hasAnyValue = paymentDate || note || amountRaw !== '' && amountRaw != null
      if (!hasAnyValue) continue
      if (!paymentDate) throw new Error('Each payment schedule row must have a payment date')
      if (seenDates.has(paymentDate)) throw new Error(`Duplicate payment schedule date: ${paymentDate}`)
      seenDates.add(paymentDate)
      let amount = null
      if (amountRaw !== '' && amountRaw != null) {
        const numericAmount = Number(amountRaw)
        if (!Number.isFinite(numericAmount) || numericAmount < 0) {
          throw new Error('Payment schedule amount must be a non-negative number')
        }
        amount = Number(numericAmount.toFixed(2))
      }
      normalized.push({ payment_date: paymentDate, amount, note: note || null })
    }
    normalized.sort((a, b) => a.payment_date.localeCompare(b.payment_date))
    return normalized
  }

  const handleSupplierChange = (e) => {
    const supplierId = e.target.value
    setSelectedSupplier(supplierId)
    const supplier = suppliers.find(s => s.id === parseInt(supplierId))
    if (supplier) {
      setSupplierName(supplier.supplier_name)
      setSupplierAddress(supplier.address || '')
    } else {
      setSupplierName('')
      setSupplierAddress('')
    }
  }

  const handleProjectChange = (e) => {
    const branchId = e.target.value
    const branch = branches.find(b => b.id === parseInt(branchId) || b.branch_id === parseInt(branchId))
    if (branch) {
      setProject(branch.branch_name || branch.name || '')
      setProjectAddress(branch.address || branch.branch_address || '')
      setOrderNumber(branch.order_number || branch.code || '')
    } else {
      setProject('')
      setProjectAddress('')
      setOrderNumber('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!purpose) { alert('Please enter purpose'); return }
    if (!amount || amount <= 0) { alert('Please enter a valid amount'); return }
    let normalizedSchedules = []
    try {
      normalizedSchedules = sanitizePaymentSchedules(paymentSchedules)
    } catch (err) {
      alert(err.message || 'Invalid payment schedules')
      return
    }
    if (normalizedSchedules.length === 0) {
      alert('At least one payment schedule is required')
      return
    }

    console.log('Submitting Cash Request - dateNeeded value:', dateNeeded, 'type:', typeof dateNeeded)

    try {
      setSubmitting(true)
      const crData = {
        purpose,
        description,
        amount,
        quantity,
        unit,
        project,
        project_address: projectAddress,
        date_needed: dateNeeded || null,
        supplier_id: selectedSupplier || null,
        supplier_name: supplierName || null,
        supplier_address: supplierAddress || null,
        remarks: remarks || null,
        order_number: orderNumber || null,
        cr_type: crType,
        payment_terms_note: paymentTermsNote.trim() || null,
        payment_schedules: normalizedSchedules
      }
      
      console.log('Full crData being sent:', crData)
      
      if (editingId) {
        await cashRequestService.update(editingId, crData)
        alert('Cash Request updated successfully!')
      } else {
        await cashRequestService.create(crData)
        alert('Cash Request created successfully!')
      }
      
      await fetchCashRequests()
      closeModal()
    } catch (err) {
      alert('Failed to save Cash Request: ' + (err.message || err.response?.data?.message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitForApproval = async (id) => {
    try {
      await cashRequestService.submit(id)
      alert('Cash Request submitted for approval!')
      await fetchCashRequests()
    } catch (err) {
      alert('Failed to submit: ' + (err.message || err.response?.data?.message))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this Cash Request?')) return
    try {
      await cashRequestService.delete(id)
      alert('Cash Request deleted successfully!')
      await fetchCashRequests()
    } catch (err) {
      alert('Failed to delete: ' + (err.message || err.response?.data?.message))
    }
  }

  const handleMarkAsReceived = async (id) => {
    if (!confirm('Mark this cash request as received?')) return
    try {
      await cashRequestService.markAsReceived(id)
      alert('Cash Request marked as received!')
      await fetchCashRequests()
    } catch (err) {
      alert('Failed to mark as received: ' + (err.message || err.response?.data?.message))
    }
  }

  const handleExport = async (id, crNumber) => {
    try {
      const blob = await cashRequestService.export(id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Cash_Request_${crNumber}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to export: ' + (err.message || 'Unknown error'))
    }
  }

  const handleProcurementApprove = async (id, status) => {
    try {
      await cashRequestService.procurementApprove(id, status)
      alert(`Cash Request ${status === 'approved' ? 'approved by Procurement' : 'put on hold'} successfully!`)
      await fetchCashRequests()
    } catch (err) {
      alert('Failed to process: ' + (err.message || err.response?.data?.message))
    }
  }

  const handleSuperAdminApprove = async (id, status) => {
    try {
      await cashRequestService.superAdminApprove(id, status)
      alert(`Cash Request ${status === 'approved' ? 'fully approved' : 'put on hold'} successfully!`)
      await fetchCashRequests()
    } catch (err) {
      alert('Failed to process: ' + (err.message || err.response?.data?.message))
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
        <h2 className="text-lg font-semibold text-gray-900">Cash Requests</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            {total === 0
              ? '0 Cash Requests'
              : `Showing ${startItem}-${endItem} of ${total} Cash Request${total !== 1 ? 's' : ''}`
            }
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            Create Cash Request
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search CR number, purpose, project, supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSearchToUrl({ replace: false })
                }}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="ALL">All statuses</option>
              {STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="w-full sm:w-28 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
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

            {(searchQuery.trim() || statusFilter !== 'ALL') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatusFilter('ALL')
                  setSearchQuery('')
                  updateQueryParams((p) => {
                    p.delete('status')
                    p.delete('q')
                    p.set('page', '1')
                  }, { replace: false })
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
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
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">CR Number</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Purpose</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cashRequests.map(cr => (
                <React.Fragment key={cr.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === cr.id ? null : cr.id)}>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{cr.cr_number}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{cr.purpose}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{cr.project}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(cr.amount)}</td>
                    <td className="py-3 px-4"><StatusBadge status={cr.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openPreviewCR(cr) }}
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleExport(cr.id, cr.cr_number); }} title="Export to Excel">
                          <Download className="w-4 h-4" />
                        </Button>
                        {cr.status === 'Draft' && cr.requested_by === user?.id && (
                          <>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditModal(cr); }} title="Edit">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSubmitForApproval(cr.id); }} title="Submit for Approval">
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(cr.id); }} title="Delete">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {cr.status === 'For Procurement Review' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleProcurementApprove(cr.id, 'approved'); }} title="Approve">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleProcurementApprove(cr.id, 'hold'); }} title="Hold">
                              <Clock className="w-4 h-4 text-orange-500" />
                            </Button>
                          </>
                        )}
                        {cr.status === 'For Super Admin Final Approval' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSuperAdminApprove(cr.id, 'approved'); }} title="Approve">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSuperAdminApprove(cr.id, 'hold'); }} title="Hold">
                              <Clock className="w-4 h-4 text-orange-500" />
                            </Button>
                          </>
                        )}
                        {user?.role === 'engineer' &&
                          cr.requested_by === user?.id &&
                          ['Payment Request Created', 'Payment Order Created', 'Paid'].includes(cr.status) && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleMarkAsReceived(cr.id); }} title="Mark as Received">
                            <CheckCircle className="w-4 h-4 text-teal-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === cr.id ? null : cr.id); }}>
                          {expandedId === cr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === cr.id && (
                    <tr>
                      <td colSpan="6" className="bg-gray-50 p-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Description</p>
                              <p className="text-sm text-gray-900">{cr.description || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Quantity</p>
                              <p className="text-sm text-gray-900">{cr.quantity} {cr.unit}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Project Address</p>
                              <p className="text-sm text-gray-900">{cr.project_address || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Date Needed</p>
                              <p className="text-sm text-gray-900">{formatDate(cr.date_needed)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Supplier</p>
                              <p className="text-sm text-gray-900">{cr.supplier_name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Created At</p>
                              <p className="text-sm text-gray-900">{formatDate(cr.created_at)}</p>
                            </div>
                          </div>
                          {cr.remarks && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Remarks</p>
                              <p className="text-sm text-gray-900">{cr.remarks}</p>
                            </div>
                          )}
                          {cr.approved_by && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Approved By</p>
                              <p className="text-sm text-gray-900">{cr.approver_name || cr.approved_by} on {formatDate(cr.approved_at)}</p>
                            </div>
                          )}
                          {(cr.payment_schedules || []).length > 0 && (
                            <div className="col-span-2">
                              <p className="text-xs text-gray-500 uppercase mb-2">Payment Schedules</p>
                              <div className="space-y-1.5">
                                {(cr.payment_schedules || []).map((schedule) => {
                                  const status = getScheduleStatus(schedule.payment_date);
                                  return (
                                    <div key={schedule.id || `${schedule.payment_date}-${schedule.amount || ''}`} className="flex items-center gap-2 text-sm">
                                      <span className="text-gray-700">{formatDate(schedule.payment_date)}</span>
                                      <span className="text-gray-400">|</span>
                                      <span className="font-medium text-gray-900">{formatScheduleAmount(schedule.amount)}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                        {status.label}
                                      </span>
                                      {schedule.note && (
                                        <>
                                          <span className="text-gray-400">|</span>
                                          <span className="text-gray-600">{schedule.note}</span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {cashRequests.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    No cash requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid View */}
        <div className="md:hidden p-4">
          <div className="space-y-3">
            {cashRequests.map(cr => (
              <div
                key={cr.id}
                onClick={() => setExpandedId(expandedId === cr.id ? null : cr.id)}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  expandedId === cr.id 
                    ? 'border-yellow-500 bg-yellow-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-gray-500 font-mono">{cr.cr_number}</p>
                    <p className="text-sm font-semibold text-gray-900">{cr.purpose}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openPreviewCR(cr) }}
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === cr.id ? null : cr.id); }}>
                      {expandedId === cr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {user?.role === 'engineer' &&
                  cr.requested_by === user?.id &&
                  ['Payment Request Created', 'Payment Order Created', 'Paid'].includes(cr.status) && (
                  <div className="mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleMarkAsReceived(cr.id) }}
                      title="Mark as Received"
                    >
                      <CheckCircle className="w-4 h-4 text-teal-600 mr-1" />
                      Mark as Received
                    </Button>
                  </div>
                )}
                <div className="mb-2">
                  <p className="text-sm text-gray-600">{cr.project}</p>
                  <p className="text-sm font-medium text-gray-700">{formatCurrency(cr.amount)}</p>
                </div>
                <StatusBadge status={cr.status} />
                {expandedId === cr.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <p className="text-xs text-gray-500">Description: {cr.description || '-'}</p>
                    <p className="text-xs text-gray-500">Quantity: {cr.quantity} {cr.unit}</p>
                    <p className="text-xs text-gray-500">Supplier: {cr.supplier_name || '-'}</p>
                    {cr.remarks && <p className="text-xs text-gray-500">Remarks: {cr.remarks}</p>}
                    {(cr.payment_schedules || []).length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-gray-500 mb-1.5">Payment Schedules:</p>
                        <div className="space-y-1">
                          {(cr.payment_schedules || []).map((schedule) => {
                            const status = getScheduleStatus(schedule.payment_date);
                            return (
                              <div key={schedule.id || `${schedule.payment_date}-${schedule.amount || ''}`} className="flex items-center gap-1.5 text-xs flex-wrap">
                                <span>{formatDate(schedule.payment_date)}</span>
                                <span className="text-gray-400">|</span>
                                <span className="font-medium">{formatScheduleAmount(schedule.amount)}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color}`}>
                                  {status.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {cashRequests.length === 0 && (
              <p className="text-center text-gray-500 py-8">No cash requests found</p>
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-500">
              {total === 0 ? '0 Cash Requests' : `Showing ${startItem}-${endItem} of ${total}`}
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

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Cash Request' : 'Create Cash Request'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
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
                <Select 
                  label="CR Type" 
                  value={crType} 
                  onChange={(e) => setCrType(e.target.value)} 
                  options={[
                    { value: 'payment_request', label: 'Payment Request' },
                    { value: 'payment_order', label: 'Payment Order' }
                  ]} 
                  required
                />
                
                <TextArea label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
                
                <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details about the cash request" />
                
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Amount" value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} required type="number" />
                  <Input label="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))} type="number" />
                  <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, hours, etc." />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <Select 
                    label="Project" 
                    value={branches.find(b => b.branch_name === project || b.name === project)?.id || branches.find(b => b.branch_name === project || b.name === project)?.branch_id || ''} 
                    onChange={handleProjectChange} 
                    options={branches.map(b => ({ 
                      value: b.id || b.branch_id, 
                      label: b.branch_name || b.name || 'Unknown' 
                    }))} 
                    placeholder="Select a project"
                  />
                  <Input label="Project Address" value={projectAddress} onChange={(e) => setProjectAddress(e.target.value)} />
                  <Input label="Order Number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Auto-populated from project" />
                </div>
                
                <Input label="Date Needed" value={dateNeeded} onChange={(e) => setDateNeeded(e.target.value)} type="date" />
                
                <Select 
                  label="Supplier" 
                  value={selectedSupplier} 
                  onChange={handleSupplierChange} 
                  options={suppliers.map(s => ({ value: s.id, label: s.supplier_name }))} 
                  placeholder="Select a supplier (optional)"
                />
                
                <Input label="Supplier Name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Or enter supplier name manually" />
                <Input label="Supplier Address" value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} />
                
                <TextArea label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remarks" rows={2} />
                <TextArea
                  label="Payment Terms"
                  value={paymentTermsNote}
                  onChange={(e) => setPaymentTermsNote(e.target.value)}
                  placeholder="Optional payment terms narrative"
                  rows={3}
                />

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Payment Schedules <span className="text-red-500">*</span>
                    </label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="!hidden"
                      onClick={() => setPaymentSchedules((prev) => [...prev, { payment_date: '', amount: '', note: '' }])}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Date
                    </Button>
                  </div>
                  {paymentSchedules.map((schedule, index) => (
                    <div key={`cr-schedule-${index}`} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={schedule.payment_date}
                          onChange={(e) => setPaymentSchedules((prev) => prev.map((row, i) => i === index ? { ...row, payment_date: e.target.value } : row))}
                          className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={schedule.amount}
                          onChange={(e) => {
                            if (index === 0) setScheduleAmountTouched(true)
                            setPaymentSchedules((prev) => prev.map((row, i) => i === index ? { ...row, amount: e.target.value } : row))
                          }}
                          className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Note</label>
                        <input
                          type="text"
                          value={schedule.note}
                          onChange={(e) => setPaymentSchedules((prev) => prev.map((row, i) => i === index ? { ...row, note: e.target.value } : row))}
                          className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaymentSchedules((prev) => prev.length === 1 ? [{ payment_date: '', amount: '', note: '' }] : prev.filter((_, i) => i !== index))}
                          title="Remove schedule row"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : (editingId ? 'Update' : 'Create Cash Request')}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewCR && (
        <CRPreviewModal
          cr={previewCRDetails || previewCR}
          loading={loadingPreview}
          onClose={closePreviewCR}
          readOnly
        />
      )}
    </div>
  )
}

export default CashRequests
