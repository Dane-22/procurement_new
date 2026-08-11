import React, { useState } from 'react'
import { itemService } from '../../services/items'
import { useNavigate } from 'react-router-dom'
import { Package, ArrowLeft } from 'lucide-react'

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
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500'
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
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
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

const TextArea = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
    />
  </div>
)

const AddItem = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    description: '',
    category: '',
    unit: 'pcs',
    unit_price: '',
    reorder_level: ''
  })

  const categories = [
    'Construction Materials',
    'Electrical Supplies',
    'Plumbing Supplies',
    'Hardware',
    'Office Supplies',
    'Safety Equipment',
    'Tools',
    'Paint',
    'Other'
  ]

  const units = [
    'pcs',
    'box',
    'set',
    'unit',
    'meter',
    'roll',
    'kg',
    'liter',
    'gallon',
    'sheet',
    'pack',
    'bundle'
  ]

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.item_code || !formData.item_name) {
      alert('SKU and Item Name are required')
      return
    }

    try {
      setLoading(true)
      const dataToSubmit = {
        ...formData,
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
        reorder_level: formData.reorder_level ? parseInt(formData.reorder_level) : null
      }
      
      await itemService.create(dataToSubmit)
      alert('Item created successfully!')
      navigate('/items')
    } catch (err) {
      console.error('Failed to create item:', err)
      alert('Failed to create item: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/items')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="sm" onClick={handleCancel}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Add Item</h2>
          <p className="text-sm text-gray-500">Create a new item in the catalog</p>
        </div>
      </div>

      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU"
              value={formData.item_code}
              onChange={(e) => handleChange('item_code', e.target.value)}
              placeholder="e.g., CEM-001"
              required
            />
            
            <Input
              label="Item Name"
              value={formData.item_name}
              onChange={(e) => handleChange('item_name', e.target.value)}
              placeholder="e.g., Cement"
              required
            />
          </div>

          <TextArea
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Optional description of the item"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              options={categories.map(cat => ({ value: cat, label: cat }))}
              placeholder="Select category..."
            />
            
            <Select
              label="Unit"
              value={formData.unit}
              onChange={(e) => handleChange('unit', e.target.value)}
              options={units.map(u => ({ value: u, label: u }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Default Unit Price"
              type="number"
              step="0.01"
              value={formData.unit_price}
              onChange={(e) => handleChange('unit_price', e.target.value)}
              placeholder="0.00"
            />
            
            <Input
              label="Reorder Level"
              type="number"
              value={formData.reorder_level}
              onChange={(e) => handleChange('reorder_level', e.target.value)}
              placeholder="Minimum stock quantity"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default AddItem
