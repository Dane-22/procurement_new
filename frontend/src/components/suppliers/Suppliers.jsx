import React, { useState, useEffect } from 'react'
import { supplierService } from '../../services/suppliers'
import { useAuth } from '../../contexts/AuthContext'
import { Search, Plus, X, Trash2, Pencil, Truck, Eye } from 'lucide-react'

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

const Input = ({ label, type = 'text', name, value, onChange, placeholder, required = false }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
      required={required}
    />
  </div>
)

const Modal = ({ isOpen, onClose, title, children, className = '' }) => {
  console.log('Modal called with:', { isOpen, title })
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => { console.log('Backdrop clicked'); onClose() }} />
      <div className={`relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto m-4 ${className}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={() => { console.log('Close button clicked'); onClose() }} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

const Suppliers = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isSuperAdmin = user?.role === 'super_admin'

  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalSuppliers, setTotalSuppliers] = useState(0)
  const pageSize = 20

  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showAccreditationModal, setShowAccreditationModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showFilesModal, setShowFilesModal] = useState(false)
  const [viewingFilesSupplier, setViewingFilesSupplier] = useState(null)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [deletingSupplier, setDeletingSupplier] = useState(null)
  const [accreditingSupplier, setAccreditingSupplier] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [accreditationNotes, setAccreditationNotes] = useState('')
  const [accreditationStatus, setAccreditationStatus] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [previewContent, setPreviewContent] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: ''
  })

  useEffect(() => {
    loadSuppliers()
  }, [currentPage])

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const response = await supplierService.getAll({ page: currentPage, pageSize })
      setSuppliers(response.suppliers || response)
      setTotalSuppliers(response.total || response.length)
    } catch (err) {
      console.error('Failed to load suppliers:', err)
      setError('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleAccreditationToggle = async (supplierName, currentAccredited) => {
    try {
      const newAccreditedValue = !currentAccredited
      setSuppliers(prevSuppliers =>
        prevSuppliers.map(supplier =>
          supplier.supplier_name === supplierName
            ? { ...supplier, accredited: newAccreditedValue ? 1 : 0 }
            : supplier
        )
      )
      await supplierService.updateAccreditation(supplierName, newAccreditedValue)
      // Reload to ensure server state is reflected
      await loadSuppliers()
    } catch (err) {
      console.error('Failed to update accreditation:', err)
      setError('Failed to update accreditation status')
      // Revert the optimistic update on error
      await loadSuppliers()
    }
  }

  const openAccreditationModal = (supplier) => {
    setAccreditingSupplier(supplier)
    setAccreditationNotes(supplier.accreditation_notes || '')
    setAccreditationStatus(supplier.accredited === 1)
    setSelectedFiles([])
    setShowAccreditationModal(true)
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setSelectedFiles([...selectedFiles, ...files])
  }

  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
  }

  const handleUploadFiles = async () => {
    if (!accreditingSupplier || selectedFiles.length === 0) return

    try {
      setUploadingFiles(true)
      await supplierService.uploadAccreditationFiles(accreditingSupplier.supplier_name, selectedFiles)
      setSelectedFiles([])
      // Refresh the accreditingSupplier data to show updated file list
      const response = await supplierService.getAll({ page: currentPage, pageSize })
      const updatedSupplier = response.suppliers?.find(s => s.supplier_name === accreditingSupplier.supplier_name)
      if (updatedSupplier) {
        setAccreditingSupplier(updatedSupplier)
      }
      // Reload to ensure server state is reflected
      await loadSuppliers()
    } catch (err) {
      console.error('Failed to upload files:', err)
      if (err.response?.data?.message?.includes('migration')) {
        setError('Database migration required. Please run the accreditation files migration.')
      } else {
        setError('Failed to upload accreditation files')
      }
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleDeleteFile = async (supplierName, filename) => {
    try {
      await supplierService.deleteAccreditationFile(supplierName, filename)
      // Refresh the accreditingSupplier data to show updated file list
      const response = await supplierService.getAll({ page: currentPage, pageSize })
      const updatedSupplier = response.suppliers?.find(s => s.supplier_name === accreditingSupplier.supplier_name)
      if (updatedSupplier) {
        setAccreditingSupplier(updatedSupplier)
      }
    } catch (err) {
      console.error('Failed to delete file:', err)
      const errorMessage = err.response?.data?.message || 'Failed to delete accreditation file'
      if (errorMessage.includes('migration')) {
        setError('Database migration required. Please run the accreditation files migration.')
      } else if (errorMessage.includes('Access denied')) {
        setError('Access denied. Only super admins can delete accreditation files.')
      } else {
        setError(errorMessage)
      }
    }
  }

  const handleViewFile = async (supplierName, filename) => {
    try {
      setLoadingPreview(true)
      setPreviewContent(null)
      const blob = await supplierService.getAccreditationFile(supplierName, filename)
      const url = window.URL.createObjectURL(blob)
      setPreviewFile({ url, filename })

      // For text files, read the content
      if (filename.match(/\.(txt|csv|xml|json|md)$/i)) {
        const text = await blob.text()
        setPreviewContent(text)
      }

      setShowPreviewModal(true)
    } catch (err) {
      console.error('Failed to view file:', err)
      const errorMessage = err.response?.data?.message || 'Failed to view accreditation file'
      if (errorMessage.includes('migration')) {
        setError('Database migration required. Please run the accreditation files migration.')
      } else if (errorMessage.includes('Access denied')) {
        setError('Access denied. Only super admins can view accreditation files.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleDownloadFile = () => {
    if (previewFile?.url) {
      const a = document.createElement('a')
      a.href = previewFile.url
      a.download = previewFile.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const closePreviewModal = () => {
    if (previewFile?.url) {
      window.URL.revokeObjectURL(previewFile.url)
    }
    setPreviewFile(null)
    setShowPreviewModal(false)
  }

  const handleSaveAccreditation = async () => {
    if (!accreditingSupplier) return

    try {
      setSaving(true)
      
      // Upload any selected files first
      if (selectedFiles.length > 0) {
        await supplierService.uploadAccreditationFiles(accreditingSupplier.supplier_name, selectedFiles)
        setSelectedFiles([])
        // Refresh the accreditingSupplier data to show updated file list
        const response = await supplierService.getAll({ page: currentPage, pageSize })
        const updatedSupplier = response.suppliers?.find(s => s.supplier_name === accreditingSupplier.supplier_name)
        if (updatedSupplier) {
          setAccreditingSupplier(updatedSupplier)
        }
      }
      
      // Save accreditation status and notes
      await supplierService.updateAccreditation(
        accreditingSupplier.supplier_name,
        accreditationStatus,
        accreditationNotes
      )
      setShowAccreditationModal(false)
      // Reload to ensure server state is reflected
      await loadSuppliers()
    } catch (err) {
      console.error('Failed to save accreditation:', err)
      if (err.response?.data?.message?.includes('migration')) {
        setError('Database migration required. Please run the accreditation migration.')
      } else {
        setError('Failed to save accreditation')
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredSuppliers = suppliers.filter(supplier => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      supplier.supplier_name?.toLowerCase().includes(query) ||
      supplier.supplier_code?.toLowerCase().includes(query) ||
      supplier.contact_person?.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query)
    )
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const openAddModal = () => {
    setEditingSupplier(null)
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: ''
    })
    setShowModal(true)
  }

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.supplier_name || '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || ''
    })
    setShowModal(true)
  }

  const openDeleteModal = (supplier) => {
    console.log('DEBUG: openDeleteModal called')
    console.log('openDeleteModal called with supplier:', supplier)
    // Safety check: ensure supplier exists and has an id
    if (!supplier || !supplier.id) {
      console.error('Invalid supplier object:', supplier)
      return
    }
    setDeletingSupplier(supplier)
    setShowDeleteModal(true)
    console.log('showDeleteModal set to TRUE in openDeleteModal')
  }

  const openFilesModal = (supplier) => {
    setViewingFilesSupplier(supplier)
    setShowFilesModal(true)
  }

  const closeFilesModal = () => {
    setViewingFilesSupplier(null)
    setShowFilesModal(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    
    try {
      setSaving(true)
      if (editingSupplier) {
        await supplierService.update(editingSupplier.id, formData)
      } else {
        await supplierService.create(formData)
      }
      setShowModal(false)
      loadSuppliers()
    } catch (err) {
      console.error('Failed to save supplier:', err)
      setError(editingSupplier ? 'Failed to update supplier' : 'Failed to create supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingSupplier) return
    console.log('handleDelete called, deleting supplier ID:', deletingSupplier.id)
    
    try {
      setSaving(true)
      await supplierService.delete(deletingSupplier.id)
      console.log('showDeleteModal set to FALSE in handleDelete')
      setShowDeleteModal(false)
      setDeletingSupplier(null)
      loadSuppliers()
    } catch (err) {
      console.error('Failed to delete supplier:', err)
      setError('Failed to delete supplier')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(totalSuppliers / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your suppliers and vendors</p>
        </div>
        {isAdmin && (
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Card>
        <div className="p-4 border-b">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Person</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Files</th>
                {isSuperAdmin && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Accredited</th>}
                {isAdmin && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                    Loading suppliers...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                    No suppliers found
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {supplier.supplier_code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {supplier.supplier_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {supplier.contact_person || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {supplier.email || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {supplier.phone || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {supplier.address || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {supplier.items_count || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openFilesModal(supplier)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="View Accreditation Files"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="checkbox"
                            checked={supplier.accredited === 1}
                            onChange={() => handleAccreditationToggle(supplier.supplier_name, supplier.accredited === 1)}
                            className="w-4 h-4 text-yellow-500 rounded focus:ring-yellow-500"
                          />
                          <button
                            onClick={() => openAccreditationModal(supplier)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Manage Accreditation Files"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(supplier)}
                            className="p-1 text-gray-400 hover:text-yellow-600"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openDeleteModal(supplier) }}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalSuppliers)} of {totalSuppliers}
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Supplier Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter supplier name"
            required
          />
          <Input
            label="Contact Person"
            name="contact_person"
            value={formData.contact_person}
            onChange={handleInputChange}
            placeholder="Enter contact person name"
          />
          <Input
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Enter phone number"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter email address"
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter address"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !formData.name.trim()}>
              {saving ? 'Saving...' : editingSupplier ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => { console.log('showDeleteModal set to FALSE in Modal onClose'); setShowDeleteModal(false) }}
        title="Delete Supplier"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deletingSupplier?.supplier_name}</strong>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={(e) => { console.log('CANCEL BUTTON CLICKED'); e.stopPropagation(); setShowDeleteModal(false) }}>
            Cancel
          </Button>
          <Button variant="danger" onClick={(e) => { console.log('DELETE BUTTON CLICKED'); e.stopPropagation(); handleDelete() }} disabled={saving}>
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showAccreditationModal}
        onClose={() => setShowAccreditationModal(false)}
        title="Manage Accreditation"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Accreditation Status
            </label>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="accredited-checkbox"
                checked={accreditationStatus}
                onChange={(e) => setAccreditationStatus(e.target.checked)}
                className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500 cursor-pointer"
              />
              <label htmlFor="accredited-checkbox" className="text-sm text-gray-600 cursor-pointer">
                {accreditationStatus ? '✓ Accredited (Legit Supplier)' : '✗ Not Accredited (Fake/Unverified)'}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Accreditation Notes
            </label>
            <textarea
              value={accreditationNotes}
              onChange={(e) => setAccreditationNotes(e.target.value)}
              placeholder="Add notes about accreditation (e.g., business license, certifications, verification details)..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Accreditation Documents
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <p className="text-xs text-gray-500 mt-1">All file formats allowed (max 10MB per file)</p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Files to Upload
              </label>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded">
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleUploadFiles}
                disabled={uploadingFiles}
                className="mt-3 w-full"
              >
                {uploadingFiles ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          )}

          {accreditingSupplier?.accreditation_files && (() => {
            try {
              const files = JSON.parse(accreditingSupplier.accreditation_files)
              if (!Array.isArray(files) || files.length === 0) return null
              return (
                <div className="bg-green-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Uploaded Documents
                  </label>
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded">
                        <span className="text-sm text-gray-700">{file.originalname}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewFile(accreditingSupplier.supplier_name, file.filename)}
                            className="text-blue-500 hover:text-blue-700"
                            title="View/Download"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(accreditingSupplier.supplier_name, file.filename)}
                            className="text-red-500 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            } catch (e) {
              console.error('Failed to parse accreditation_files:', e)
              return null
            }
          })()}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowAccreditationModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAccreditation} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showPreviewModal}
        onClose={closePreviewModal}
        title="File Preview"
        className="z-[60]"
      >
        <div className="space-y-4">
          {previewFile && (
            <>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  File: {previewFile.filename}
                </p>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
                {loadingPreview ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                  </div>
                ) : previewFile.filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.filename}
                    className="w-full h-auto max-h-[600px] object-contain"
                  />
                ) : previewFile.filename.match(/\.pdf$/i) ? (
                  <iframe
                    src={previewFile.url}
                    className="w-full h-[600px]"
                    title="PDF Preview"
                  />
                ) : previewFile.filename.match(/\.(mp3|wav|ogg|m4a)$/i) ? (
                  <div className="p-8">
                    <audio controls src={previewFile.url} className="w-full">
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                ) : previewFile.filename.match(/\.(mp4|webm|ogg|flv|mov)$/i) ? (
                  <video controls src={previewFile.url} className="w-full h-auto max-h-[600px]">
                    Your browser does not support the video tag.
                  </video>
                ) : previewFile.filename.match(/\.(txt|csv|xml|json|md)$/i) ? (
                  <div className="p-4 overflow-auto max-h-[600px]">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {previewContent || 'No content available'}
                    </pre>
                  </div>
                ) : previewFile.filename.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i) ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                    <p className="text-center px-4 mb-4">
                      Office documents cannot be previewed directly.
                    </p>
                    <Button
                      onClick={handleDownloadFile}
                    >
                      Download File
                    </Button>
                  </div>
                ) : previewFile.filename.match(/\.(psd|eps|ai)$/i) ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                    <p className="text-center px-4 mb-4">
                      Adobe design files cannot be previewed in browser.
                    </p>
                    <Button
                      onClick={handleDownloadFile}
                    >
                      Download File
                    </Button>
                  </div>
                ) : previewFile.filename.match(/\.(rar|zip|7z|tar|gz)$/i) ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                    <p className="text-center px-4 mb-4">
                      Archive files cannot be previewed.
                    </p>
                    <Button
                      onClick={handleDownloadFile}
                    >
                      Download File
                    </Button>
                  </div>
                ) : previewFile.filename.match(/\.(exe|msi|dmg|app)$/i) ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                    <p className="text-center px-4 mb-4">
                      Executable files cannot be previewed.
                    </p>
                    <Button
                      onClick={handleDownloadFile}
                    >
                      Download File
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                    <p className="text-center px-4 mb-4">
                      Preview not available for this file type.
                    </p>
                    <Button
                      onClick={handleDownloadFile}
                    >
                      Download File
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={handleDownloadFile}>
                  Download
                </Button>
                <Button onClick={closePreviewModal}>
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showFilesModal}
        onClose={closeFilesModal}
        title="Supplier Accreditation Files"
      >
        <div className="space-y-4">
          {viewingFilesSupplier && (
            <>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700">
                  Supplier: {viewingFilesSupplier.supplier_name}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Accreditation Status: {viewingFilesSupplier.accredited === 1 ? '✓ Accredited' : '✗ Not Accredited'}
                </p>
              </div>

              {viewingFilesSupplier.accreditation_files && (() => {
                try {
                  const files = JSON.parse(viewingFilesSupplier.accreditation_files)
                  if (!Array.isArray(files) || files.length === 0) {
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                        No accreditation files attached
                      </div>
                    )
                  }
                  return (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accreditation Documents ({files.length})
                      </label>
                      <div className="space-y-2">
                        {files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">{file.originalname}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(file.uploaded_at).toLocaleString()} • {(file.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <button
                                onClick={() => handleViewFile(viewingFilesSupplier.supplier_name, file.filename)}
                                className="text-blue-500 hover:text-blue-700"
                                title="View/Download"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                } catch (e) {
                  console.error('Failed to parse accreditation_files:', e)
                  return (
                    <div className="bg-red-50 p-4 rounded-lg text-center text-red-500">
                      Error loading accreditation files
                    </div>
                  )
                }
              })()}
            </>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="secondary" onClick={closeFilesModal}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Suppliers



