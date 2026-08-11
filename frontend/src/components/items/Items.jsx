import React, { useState, useEffect, useRef } from 'react'
import { itemService } from '../../services/items'
import { categoryService } from '../../services/categories'
import { purchaseRequestService } from '../../services/purchaseRequests'
import { projectService } from '../../services/projects'
import { useAuth } from '../../contexts/AuthContext'
import { Search, Package, ShoppingCart, Plus, X, Trash2, Tag, Pencil } from 'lucide-react'

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
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
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
  disabled = false,
  className = ''
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
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:bg-gray-100 disabled:text-gray-500 read-only:bg-gray-100 ${className}`}
        required={required}
      />
    )}
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
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '-'
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

const formatScheduleAmount = (amount) => {
  if (amount == null || amount === '') return '-'
  return formatCurrency(Number(amount) || 0)
}

const DEFAULT_ITEM_FORM = {
  item_code: '',
  item_name: '',
  description: '',
  category_id: '',
  unit: 'pcs',
  brand: '',
  product_type: '',
  material: '',
  color: '',
  size: ''
}

const PAYMENT_DETAILS_ENABLED = false

const Items = () => {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  const hasLoadedItemsOnce = useRef(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  
  // Categories from database
  const [dbCategories, setDbCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  
  // Cart state
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [itemQuantities, setItemQuantities] = useState({})
  
  // PR Modal state
  const [showPRModal, setShowPRModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewDraftPR, setPreviewDraftPR] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  
  // PR Form state
  const [purpose, setPurpose] = useState('')
  const [project, setProject] = useState('')
  const [projectAddress, setProjectAddress] = useState('')
  const [dateNeeded, setDateNeeded] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
const [supplierInput, setSupplierInput] = useState('')
const [supplierAddress, setSupplierAddress] = useState('') // New state for supplier address
const [accreditationFiles, setAccreditationFiles] = useState([]) // Accreditation files for supplier
const [supplierAccreditationStatus, setSupplierAccreditationStatus] = useState(null) // Accreditation status check result
const [suggestedSupplierName, setSuggestedSupplierName] = useState('') // Auto-detected supplier name
const [paymentBasis, setPaymentBasis] = useState('debt')
  const [paymentTermsNote, setPaymentTermsNote] = useState('')
  const [paymentSchedules, setPaymentSchedules] = useState([{ payment_date: '', amount: '', note: '' }])
  const [remarks, setRemarks] = useState('')
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showEditItemModal, setShowEditItemModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newItemForm, setNewItemForm] = useState(DEFAULT_ITEM_FORM)
  const [editItemForm, setEditItemForm] = useState(DEFAULT_ITEM_FORM)
  const [editingItem, setEditingItem] = useState(null)
  const [addingItem, setAddingItem] = useState(false)
  const [loadingNextSku, setLoadingNextSku] = useState(false)
  const [generatingSkuFromName, setGeneratingSkuFromName] = useState(false)
  const [updatingItem, setUpdatingItem] = useState(false)
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  })
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryForm, setEditingCategoryForm] = useState({
    name: '',
    description: ''
  })
  const [submittingCategory, setSubmittingCategory] = useState(false)

  useEffect(() => {
    fetchBranches()
    fetchCategories()
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery, selectedCategory])

  // Auto-generate SKU from item name
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (newItemForm.item_name && newItemForm.item_name.trim().length > 0 && showAddItemModal) {
        try {
          setGeneratingSkuFromName(true)
          const generatedSku = await itemService.generateSkuFromName(newItemForm.item_name.trim())
          setNewItemForm(prev => ({ ...prev, item_code: generatedSku || '' }))
        } catch (error) {
          console.error('Failed to generate SKU from name:', error)
        } finally {
          setGeneratingSkuFromName(false)
        }
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [newItemForm.item_name, showAddItemModal])

  // Debounced supplier accreditation check
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (supplierInput.trim().length > 2) {
        try {
          const result = await purchaseRequestService.checkSupplierAccreditation(supplierInput.trim())
          setSupplierAccreditationStatus(result)
          if (result.suggestedName && result.suggestedName !== supplierInput.trim()) {
            setSuggestedSupplierName(result.suggestedName)
          } else {
            setSuggestedSupplierName('')
          }
        } catch (error) {
          console.error('Failed to check supplier accreditation:', error)
          setSupplierAccreditationStatus(null)
          setSuggestedSupplierName('')
        }
      } else {
        setSupplierAccreditationStatus(null)
        setSuggestedSupplierName('')
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [supplierInput])

  useEffect(() => {
    fetchItems()
  }, [currentPage, debouncedSearchQuery, selectedCategory])

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

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true)
      const data = await categoryService.getAll()
      setDbCategories(data || [])
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    } finally {
      setLoadingCategories(false)
    }
  }

  const handleProjectChange = (projectName) => {
    const selectedBranch = branches.find(b => b?.branch_name === projectName)

    setProject(projectName)
    setProjectAddress(selectedBranch?.address || selectedBranch?.branch_address || '')
    setOrderNumber(selectedBranch?.order_number || '')
  }

  const fetchItems = async () => {
    const isInitialLoad = !hasLoadedItemsOnce.current
    try {
      if (isInitialLoad) {
        setInitialLoading(true)
      } else {
        setItemsLoading(true)
      }
      setError('')
      const data = await itemService.getPage({
        page: currentPage,
        pageSize,
        search: debouncedSearchQuery || undefined,
        category: selectedCategory === 'all' ? undefined : selectedCategory
      })
      setItems(data.items || [])
      setTotalItems(data.total || 0)
      setTotalPages(data.totalPages || 1)
      setCurrentPage(data.page || 1)

      setItemQuantities((prev) => {
        const next = { ...prev }
        ;(data.items || []).forEach((item) => {
          if (next[item.id] == null || next[item.id] === '') {
            next[item.id] = 1
          }
        })
        return next
      })
      hasLoadedItemsOnce.current = true
    } catch (err) {
      setError('Failed to fetch items')
    } finally {
      setInitialLoading(false)
      setItemsLoading(false)
    }
  }

  const openAddItemModal = async () => {
    setNewItemForm(DEFAULT_ITEM_FORM)
    setGeneratingSkuFromName(false)
    setShowAddItemModal(true)
  }

  const handleCategoryChange = (categoryId) => {
    setNewItemForm({ ...newItemForm, category_id: categoryId })
  }

  const closeAddItemModal = () => {
    setShowAddItemModal(false)
    setNewItemForm(DEFAULT_ITEM_FORM)
    setLoadingNextSku(false)
  }

  const openEditItemModal = (item) => {
    setEditingItem(item)
    setEditItemForm({
      item_code: item?.item_code || '',
      item_name: item?.item_name || '',
      description: item?.description || '',
      category_id: item?.category_id ? String(item.category_id) : '',
      unit: item?.unit || 'pcs'
    })
    setShowEditItemModal(true)
  }

  const closeEditItemModal = () => {
    setShowEditItemModal(false)
    setEditingItem(null)
    setEditItemForm(DEFAULT_ITEM_FORM)
  }

  const openPreview = () => {
    const paymentDetails = getPaymentDetailsForRequest()

    // Build preview object from form data
    const draftPR = {
      pr_number: 'PREVIEW',
      purpose,
      project,
      project_address: projectAddress,
      date_needed: dateNeeded,
      order_number: orderNumber,
supplier_id: null,
supplier_name: supplierInput.trim() || '-',
supplier_address: supplierAddress.trim() || '', // Add supplier address to preview
      payment_basis: paymentDetails.payment_basis,
      payment_terms_note: paymentDetails.payment_terms_note,
      payment_schedules: paymentDetails.payment_schedules,
      remarks,
      status: 'Draft',
      created_at: new Date().toISOString(),
      items: cart.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        item_code: item.item_code,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      })),
      total_amount: calculateCartTotal()
    }
    setPreviewDraftPR(draftPR)
    setShowPreviewModal(true)
  }

  const closePreview = () => {
    setShowPreviewModal(false)
    setPreviewDraftPR(null)
  }

  const handleSaveDraft = async () => {
    if (!purpose) { alert('Purpose is required'); return }
    if (cart.length === 0) { alert('At least one item is required'); return }

    try {
      const paymentDetails = getPaymentDetailsForRequest()
      setSubmitting(true)
      const prData = {
        purpose,
        project: project || null,
        project_address: projectAddress || null,
        date_needed: dateNeeded || null,
        order_number: orderNumber || null,
supplier_id: null,
supplier_name: supplierInput.trim() || null,
supplier_address: supplierAddress.trim() || null, // Add supplier address to data
...paymentDetails,
        remarks: remarks || null,
        items: cart.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      }
      await purchaseRequestService.saveDraft(prData)
      setCart([])
      closePRModal()
      alert('Draft saved successfully!')
    } catch (err) {
      alert('Failed to save draft: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    setAccreditationFiles(prev => [...prev, ...files])
  }

  const handleRemoveFile = (index) => {
    setAccreditationFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAcceptSuggestedName = () => {
    if (suggestedSupplierName) {
      setSupplierInput(suggestedSupplierName)
      setSuggestedSupplierName('')
    }
  }
  const openPRModal = async () => {
    setShowPRModal(true)
    try {
      if (branches.length === 0 && !loadingBranches) {
        await fetchBranches()
      }
    } catch (err) {
      console.error('Failed to load purchase request form data', err)
    }
  }

  const closePRModal = () => {
    setShowPRModal(false)
    resetPRForm()
  }

  const handleAddItemSubmit = async (e) => {
    e.preventDefault()
    if (!newItemForm.item_name) {
      alert('Item Name is required')
      return
    }

    if (!newItemForm.description || !newItemForm.description.trim()) {
      alert('Description is required')
      return
    }

    if (!newItemForm.category_id) {
      alert('Category is required')
      return
    }

    try {
      setAddingItem(true)
      const dataToSubmit = {
        item_name: newItemForm.item_name,
        description: newItemForm.description,
        category_id: parseInt(newItemForm.category_id, 10),
        unit: newItemForm.unit,
        brand: newItemForm.brand || null,
        product_type: newItemForm.product_type || null,
        material: newItemForm.material || null,
        color: newItemForm.color || null,
        size: newItemForm.size || null
      }
      await itemService.create(dataToSubmit)
      closeAddItemModal()
      fetchItems()
    } catch (err) {
      console.error('Failed to create item:', err)
      alert('Failed to create item: ' + (err.response?.data?.message || err.message))
    } finally {
      setAddingItem(false)
    }
  }

  const handleEditItemSubmit = async (e) => {
    e.preventDefault()
    if (!editingItem?.id) {
      alert('No item selected for editing')
      return
    }

    if (!editItemForm.item_code || !editItemForm.item_name) {
      alert('SKU and Item Name are required')
      return
    }

    if (!editItemForm.category_id) {
      alert('Category is required')
      return
    }

    try {
      setUpdatingItem(true)
      await itemService.update(editingItem.id, {
        ...editItemForm,
        category_id: parseInt(editItemForm.category_id, 10)
      })
      closeEditItemModal()
      fetchItems()
    } catch (err) {
      console.error('Failed to update item:', err)
      alert('Failed to update item: ' + (err.response?.data?.message || err.message))
    } finally {
      setUpdatingItem(false)
    }
  }

  const closeCategoryModal = () => {
    setShowCategoryModal(false)
    setCategoryForm({ name: '', description: '' })
    setEditingCategoryId(null)
    setEditingCategoryForm({ name: '', description: '' })
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    if (!categoryForm.name.trim()) {
      alert('Category name is required')
      return
    }

    try {
      setSubmittingCategory(true)
      const response = await categoryService.create({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim()
      })
      await fetchCategories()
      setCategoryForm({ name: '', description: '' })
      alert(response?.message || 'Category created successfully')
    } catch (err) {
      alert('Failed to create category: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmittingCategory(false)
    }
  }

  const startEditingCategory = (category) => {
    setEditingCategoryId(category.id)
    setEditingCategoryForm({
      name: category.category_name || '',
      description: category.description || ''
    })
  }

  const cancelEditingCategory = () => {
    setEditingCategoryId(null)
    setEditingCategoryForm({ name: '', description: '' })
  }

  const handleUpdateCategory = async (categoryId) => {
    if (!editingCategoryForm.name.trim()) {
      alert('Category name is required')
      return
    }

    try {
      setSubmittingCategory(true)
      const response = await categoryService.update(categoryId, {
        name: editingCategoryForm.name.trim(),
        description: editingCategoryForm.description.trim()
      })
      await fetchCategories()
      setEditingCategoryId(null)
      setEditingCategoryForm({ name: '', description: '' })
      alert(response?.message || 'Category updated successfully')
    } catch (err) {
      alert('Failed to update category: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmittingCategory(false)
    }
  }

  const handleDeleteCategory = async (category) => {
    if (!confirm(`Delete category "${category.category_name}"?`)) return

    try {
      setSubmittingCategory(true)
      const response = await categoryService.delete(category.id)
      await fetchCategories()

      if (selectedCategory === category.category_name) {
        setSelectedCategory('all')
      }

      if (String(newItemForm.category_id || '') === String(category.id)) {
        setNewItemForm((prev) => ({ ...prev, category_id: '' }))
      }

      alert(response?.message || 'Category deleted successfully')
    } catch (err) {
      alert('Failed to delete category: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmittingCategory(false)
    }
  }

  const resetPRForm = () => {
    setPurpose('')
    setProject('')
    setProjectAddress('')
    setDateNeeded('')
    setOrderNumber('')
setSupplierInput('')
setSupplierAddress('') // Reset supplier address
setPaymentBasis('debt')
    setPaymentTermsNote('')
    setPaymentSchedules([{ payment_date: '', amount: '', note: '' }])
    setRemarks('')
  }

  // Parked with the commented payment dates UI for future implementation.
  // eslint-disable-next-line no-unused-vars
  const addPaymentSchedule = () => {
    setPaymentSchedules((prev) => [...prev, { payment_date: '', amount: '', note: '' }])
  }

  // eslint-disable-next-line no-unused-vars
  const removePaymentSchedule = (index) => {
    setPaymentSchedules((prev) => prev.filter((_, i) => i !== index))
  }

  // eslint-disable-next-line no-unused-vars
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

  const getPaymentDetailsForRequest = () => {
    if (!PAYMENT_DETAILS_ENABLED) {
      return {
        payment_basis: 'non_debt',
        payment_terms_note: null,
        payment_schedules: []
      }
    }

    return {
      payment_basis: paymentBasis,
      payment_terms_note: paymentTermsNote.trim() || null,
      payment_schedules: sanitizePaymentSchedules(paymentSchedules)
    }
  }

  const addToCart = (item) => {
    const rawQuantity = itemQuantities[item.id]
    // Default to 1 if empty, undefined, or less than 1
    const quantity = (rawQuantity === '' || rawQuantity === undefined || rawQuantity < 1) ? 1 : rawQuantity
    const existingIndex = cart.findIndex(c => c.item_id === item.id)
    if (existingIndex >= 0) {
      const newCart = [...cart]
      newCart[existingIndex].quantity += quantity
      setCart(newCart)
    } else {
      setCart([...cart, {
        item_id: item.id,
        item_name: item.item_name,
        item_code: item.item_code,
        unit: item.unit || 'pcs',
        quantity: quantity,
        unit_price: item.last_unit_price || 0
      }])
    }
    setShowCart(true)
  }

  const removeFromCart = (itemId) => {
    setCart(cart.filter(c => c.item_id !== itemId))
  }

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity < 1) return
    setCart(cart.map(c => c.item_id === itemId ? { ...c, quantity } : c))
  }

  const updateItemQuantity = (itemId, value) => {
    // Allow empty string temporarily for UX (user can clear field to type new value)
    if (value === '' || value === undefined) {
      setItemQuantities({ ...itemQuantities, [itemId]: '' })
    } else {
      const quantity = parseInt(value)
      setItemQuantities({ ...itemQuantities, [itemId]: quantity })
    }
  }

  const calculateCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const getItemCategoryName = (item) => item?.category_name || item?.category || ''

  const handleSubmitPR = async (e) => {
    e.preventDefault()
    if (!purpose) { alert('Purpose is required'); return }
    if (cart.length === 0) { alert('At least one item is required'); return }

    try {
      const paymentDetails = getPaymentDetailsForRequest()
      if (PAYMENT_DETAILS_ENABLED && paymentBasis === 'debt' && paymentDetails.payment_schedules.length === 0) {
        alert('At least one payment schedule is required for debt/with account PR')
        return
      }
      setSubmitting(true)

      const prData = {
        purpose,
        project: project || null,
        project_address: projectAddress || null,
        date_needed: dateNeeded || null,
        order_number: orderNumber || null,
        supplier_id: null,
        supplier_name: supplierInput.trim() || null,
        supplier_address: supplierAddress.trim() || null,
        ...paymentDetails,
        remarks: remarks || null,
        items: cart.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      }

      await purchaseRequestService.create(prData, accreditationFiles)
      setCart([])
      closePRModal()
      alert('Purchase Request created successfully!')
    } catch (err) {
      console.error('PR creation error:', err)
      alert('Failed to create PR: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const canManageCatalog = ['procurement', 'admin', 'super_admin', 'engineer'].includes(user?.role)

  // Get categories from database + add 'all' option
  const filterCategories = [
    'all',
    ...new Set(dbCategories.map((category) => category.category_name).filter(Boolean))
  ]
  
  // Category options from database for the add item modal
  const categoryOptions = dbCategories.map(cat => ({ value: cat.id, label: cat.category_name }))

  const unitOptions = [
    'pcs', 'box', 'set', 'unit', 'meter', 'roll', 'kg', 'liter', 'gallon', 'sheet', 'pack', 'bundle'
  ]

  const cartContent = (
    <>
      <div className="flex items-center justify-between border-b border-yellow-200 px-4 py-4">
        <div>
          <h3 className="font-semibold text-gray-900">Selected Items</h3>
          <p className="text-sm text-gray-500">
            {cart.length === 0 ? 'Your cart is empty' : `${cart.length} item${cart.length === 1 ? '' : 's'} selected`}
          </p>
        </div>
        <button onClick={() => setShowCart(false)} className="rounded-md p-2 text-gray-400 hover:bg-white hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="px-4 py-10 text-center text-gray-500">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-yellow-300" />
          <p>No items selected yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 px-4 py-4">
            {cart.map(item => (
              <div
                key={item.item_id}
                className="rounded-xl border border-yellow-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 break-words">{item.item_name}</p>
                    <p className="mt-1 text-xs text-gray-500 break-words">ITEM CODE: {item.item_code} • {item.unit}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.item_id)}
                    className="rounded-md p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                    aria-label="Remove from cart"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartQuantity(item.item_id, item.quantity - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-base font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.item_id, item.quantity + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-base font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-yellow-200 bg-white px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-lg font-semibold text-gray-900">{formatCurrency(calculateCartTotal())}</span>
            </div>
            {user?.role !== 'super_admin' && (
              <Button onClick={openPRModal} className="w-full">
                Create Purchase Request
              </Button>
            )}
          </div>
        </>
      )}
    </>
  )

  return (
    <div className="space-y-6">
      {/* Header with Cart */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">Items Catalog</h2>
          <p className="text-sm text-gray-500">Select items and quantities for your purchase request</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {canManageCatalog && (
            <Button variant="secondary" onClick={() => setShowCategoryModal(true)} className="px-3 py-2">
              <Tag className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Manage Categories</span>
              <span className="sm:hidden">Categories</span>
            </Button>
          )}
          {canManageCatalog && (
            <Button onClick={openAddItemModal} className="px-3 py-2">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Add New Item</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative flex min-w-[7rem] items-center justify-center gap-2 rounded-md bg-yellow-100 px-3 py-2 text-yellow-700 transition-colors hover:bg-yellow-200 sm:min-w-0"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="font-medium hidden sm:inline">Cart ({cart.length})</span>
            <span className="font-medium sm:hidden">({cart.length})</span>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Cart Sheet */}
      {showCart && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-hidden rounded-t-2xl bg-yellow-50 shadow-2xl">
            <div className="max-h-[82vh] overflow-y-auto">
              {cartContent}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Cart Panel */}
      {showCart && (
        <Card className="hidden border-yellow-200 bg-yellow-50 sm:block">
          {cartContent}
        </Card>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search items by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 sm:w-56"
        >
          {filterCategories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Items List View */}
      <Card className="relative">
        {initialLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No items found</p>
            {(debouncedSearchQuery || selectedCategory !== 'all') && <p className="text-sm">Try adjusting your search or category</p>}
          </div>
        ) : (
          <>
            {itemsLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" />
              </div>
            )}
            {/* Mobile list */}
            <div className="space-y-3 p-3 sm:hidden">
              {items.map(item => {
                const inCart = cart.find(c => c.item_id === item.id)
                return (
                  <div key={item.id} className="rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-snug text-gray-900 break-words">
                              {item.item_name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 break-words">
                              ITEM CODE: {item.item_code} • {item.unit || 'pcs'}
                            </p>
                          </div>
                          {canManageCatalog && (
                            <button
                              onClick={() => openEditItemModal(item)}
                              className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                              aria-label="Edit item"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {getItemCategoryName(item) && (
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                              {getItemCategoryName(item)}
                            </span>
                          )}
                          {item.last_unit_price ? (
                            <span className="text-xs font-semibold text-green-700">
                              {formatCurrency(item.last_unit_price)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">No recent price</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-3">
                      {inCart ? (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-green-700">In cart: {inCart.quantity}</p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(inCart.quantity * inCart.unit_price)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                            aria-label="Remove from cart"
                          >
                            <X className="h-4 w-4" />
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <label className="flex min-w-[5.5rem] items-center rounded-md border border-gray-300 bg-white px-2 py-2">
                            <span className="sr-only">Quantity</span>
                            <input
                              type="number"
                              min="1"
                              value={itemQuantities[item.id] ?? 1}
                              onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                              className="w-full border-0 bg-transparent text-center text-sm font-medium focus:outline-none focus:ring-0"
                            />
                          </label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addToCart(item)}
                            className="flex-1"
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Add to Cart
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop/tablet list */}
            <div className="hidden sm:block divide-y divide-gray-200">
              {items.map(item => {
                const inCart = cart.find(c => c.item_id === item.id)
                return (
                  <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                    {/* Icon */}
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{item.item_name}</p>
                        {getItemCategoryName(item) && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                            {getItemCategoryName(item)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">ITEM CODE: {item.item_code} | Unit: {item.unit || 'pcs'}</p>
                      {item.last_unit_price && (
                        <p className="text-sm text-green-600 font-medium">
                          Last Price: {formatCurrency(item.last_unit_price)}
                        </p>
                      )}
                    </div>

                    {/* Add to Cart */}
                    <div className="flex items-center gap-3">
                      {canManageCatalog && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditItemModal(item)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}
                      {inCart ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-sm font-medium">In cart: {inCart.quantity}</span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="number"
                            min="1"
                            value={itemQuantities[item.id] ?? 1}
                            onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addToCart(item)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-500">
                {totalItems > 0 ? (
                  <>
                    Showing {(currentPage - 1) * pageSize + 1}-
                    {Math.min(currentPage * pageSize, totalItems)} of {totalItems} items
                  </>
                ) : (
                  'No items found'
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1 || itemsLoading}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {totalItems === 0 ? 0 : currentPage} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages || itemsLoading || totalItems === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Create PR Modal */}
      {showPRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Purchase Request</h3>
              <button onClick={closePRModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitPR} className="p-6">
              {/* Selected Items Summary */}
              <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Selected Items ({cart.length})</h4>
                <div className="space-y-3 max-h-60 overflow-auto">
                  {cart.map((item, index) => (
                    <div key={item.item_id} className="bg-white p-3 rounded border">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium text-sm">{item.item_name}</span>
                        <span className="text-xs text-gray-500">{item.unit}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateCartQuantity(item.item_id, parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Unit Cost</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price === 0 || item.unit_price === undefined ? '' : item.unit_price}
                            onChange={(e) => {
                              const value = e.target.value
                              const newPrice = value === '' ? '' : parseFloat(value)
                              setCart(cart.map(c => c.item_id === item.item_id ? { ...c, unit_price: newPrice } : c))
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Total</label>
                          <div className="text-sm font-medium py-1">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-3 pt-3 text-right font-semibold">
                  Total: {formatCurrency(calculateCartTotal())}
                </div>
              </div>

              <Input label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                  <select
                    value={project}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                    disabled={loadingBranches}
                  >
                    <option value="">{loadingBranches ? 'Loading projects...' : 'Select project...'}</option>
                    {branches
                      .filter(b => b?.branch_name)
                      .map(b => (
                        <option key={b.id || b.branch_id || b.branch_name} value={b.branch_name}>
                          {b.branch_name}
                        </option>
                      ))}
                  </select>
                </div>
                <Input label="Project Address" value={projectAddress} onChange={(e) => setProjectAddress(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Date Needed" type="date" value={dateNeeded} onChange={(e) => setDateNeeded(e.target.value)} />
                <Input label="Request Number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Optional" />
              </div>

<div className="space-y-4 mb-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
    <input
      type="text"
      value={supplierInput}
      onChange={(e) => setSupplierInput(e.target.value)}
      placeholder="Type supplier name"
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
    />
    {suggestedSupplierName && (
      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-yellow-800">
          Did you mean: <span className="font-semibold">{suggestedSupplierName}</span>?
          <button
            type="button"
            onClick={handleAcceptSuggestedName}
            className="ml-2 text-yellow-700 underline hover:text-yellow-900"
          >
            Yes, use this
          </button>
        </p>
      </div>
    )}
    {supplierAccreditationStatus && supplierAccreditationStatus.found && !supplierAccreditationStatus.accredited && (
      <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
        <p className="text-sm text-orange-800">
          ⚠️ Supplier is not accredited. This PR will be flagged for accreditation review.
        </p>
      </div>
    )}
    {supplierAccreditationStatus && supplierAccreditationStatus.found && supplierAccreditationStatus.accredited && (
      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
        <p className="text-sm text-green-800">
          ✅ Supplier is accredited.
        </p>
      </div>
    )}
  </div>
  <Input
    label="Supplier Address"
    value={supplierAddress}
    onChange={(e) => setSupplierAddress(e.target.value)}
    placeholder="Type supplier address"
  />
</div>

<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Supplier Accreditation Documents (Optional)
  </label>
  <p className="text-xs text-gray-500 mb-2">
    Upload PDF, images, or other documents to prove supplier accreditation
  </p>
  <input
    type="file"
    multiple
    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
    onChange={handleFileUpload}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
  />
  {accreditationFiles.length > 0 && (
    <div className="mt-2 space-y-1">
      {accreditationFiles.map((file, index) => (
        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
          <span className="text-sm text-gray-700 truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => handleRemoveFile(index)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )}
</div>

              <Select 
                label="Payment Basis" 
                value={paymentBasis} 
                onChange={(e) => setPaymentBasis(e.target.value)} 
                options={[
                  { value: 'debt', label: 'Credit' },
                  { value: 'non_debt', label: 'Debit' }
                ]} 
                required 
              />

              {/*
              Payment details are intentionally hidden while payment schedule implementation is paused.
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
                  <div key={`items-schedule-${index}`} className="grid grid-cols-12 gap-2 mb-2 items-end">
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
                        <Button type="button" variant="outline" size="sm" onClick={() => removePaymentSchedule(index)}>
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              */}

              <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={closePRModal} disabled={submitting}>Cancel</Button>
                <Button type="button" variant="outline" onClick={openPreview} disabled={submitting || cart.length === 0}>Preview</Button>
                <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={submitting}>Save Draft</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Purchase Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Categories</h3>
                <p className="text-sm text-gray-500 mt-1">Visible to everyone, editable by non-engineers only.</p>
              </div>
              <button onClick={closeCategoryModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleCreateCategory} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">Add Category</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Category Name *"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="e.g., Electrical"
                    required
                  />
                  <Input
                    label="Description"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={submittingCategory}>
                    {submittingCategory ? 'Saving...' : 'Create Category'}
                  </Button>
                </div>
              </form>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Existing Categories</h4>
                  {loadingCategories && <span className="text-sm text-gray-500">Refreshing...</span>}
                </div>

                {dbCategories.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                    No categories found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dbCategories.map((category) => {
                      const isEditing = editingCategoryId === category.id

                      return (
                        <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                          {isEditing ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                  label="Category Name *"
                                  value={editingCategoryForm.name}
                                  onChange={(e) => setEditingCategoryForm({ ...editingCategoryForm, name: e.target.value })}
                                  placeholder="Category name"
                                  required
                                />
                                <Input
                                  label="Description"
                                  value={editingCategoryForm.description}
                                  onChange={(e) => setEditingCategoryForm({ ...editingCategoryForm, description: e.target.value })}
                                  placeholder="Optional description"
                                />
                              </div>
                              <div className="flex justify-end gap-3">
                                <Button type="button" variant="secondary" onClick={cancelEditingCategory} disabled={submittingCategory}>
                                  Cancel
                                </Button>
                                <Button type="button" onClick={() => handleUpdateCategory(category.id)} disabled={submittingCategory}>
                                  {submittingCategory ? 'Saving...' : 'Save Changes'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900">{category.category_name}</p>
                                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                    {category.items_count || 0} items
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{category.description || 'No description'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button type="button" variant="secondary" size="sm" onClick={() => startEditingCategory(category)}>
                                  <Pencil className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <Button type="button" variant="danger" size="sm" onClick={() => handleDeleteCategory(category)} disabled={submittingCategory}>
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add New Item</h3>
              <button onClick={() => setShowAddItemModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddItemSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Item Code"
                  value={generatingSkuFromName ? 'Generating...' : newItemForm.item_code}
                  onChange={() => {}}
                  placeholder="e.g., HLBK-001"
                  required
                  readOnly
                  disabled={generatingSkuFromName}
                  className="font-mono"
                />
                <Input
                  label="Item Name"
                  value={newItemForm.item_name}
                  onChange={(e) => setNewItemForm({ ...newItemForm, item_name: e.target.value })}
                  placeholder="e.g., Hammer Claw 16oz"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newItemForm.description}
                  onChange={(e) => setNewItemForm({ ...newItemForm, description: e.target.value })}
                  placeholder="Provide a detailed description of the item."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Category"
                  value={newItemForm.category_id || ''}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  options={categoryOptions}
                  placeholder="Select category..."
                  required
                />
                <Select
                  label="Unit"
                  value={newItemForm.unit}
                  onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                  options={unitOptions.map(u => ({ value: u, label: u }))}
                />
              </div>

              

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={closeAddItemModal} disabled={addingItem}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addingItem}>
                  {addingItem ? 'Creating...' : 'Create Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Item</h3>
              <button onClick={closeEditItemModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditItemSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SKU *"
                  value={editItemForm.item_code}
                  onChange={(e) => setEditItemForm({ ...editItemForm, item_code: e.target.value })}
                  placeholder="e.g., CEM-001"
                  required
                />
                <Input
                  label="Item Name *"
                  value={editItemForm.item_name}
                  onChange={(e) => setEditItemForm({ ...editItemForm, item_name: e.target.value })}
                  placeholder="e.g., Cement"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editItemForm.description}
                  onChange={(e) => setEditItemForm({ ...editItemForm, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Category *"
                  value={editItemForm.category_id || ''}
                  onChange={(e) => setEditItemForm({ ...editItemForm, category_id: e.target.value })}
                  options={categoryOptions}
                  placeholder="Select category..."
                  required
                />
                <Select
                  label="Unit"
                  value={editItemForm.unit}
                  onChange={(e) => setEditItemForm({ ...editItemForm, unit: e.target.value })}
                  options={unitOptions.map(u => ({ value: u, label: u }))}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={closeEditItemModal} disabled={updatingItem}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updatingItem}>
                  {updatingItem ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Items
