import React, { useState } from 'react'
import { itemService } from '../../services/items'
import { useNavigate } from 'react-router-dom'
import { Package, ArrowLeft, Search, X } from 'lucide-react'

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
  const [scraping, setScraping] = useState(false)
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [scrapedVariants, setScrapedVariants] = useState([])
  const [selectedVariants, setSelectedVariants] = useState(new Set())
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
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

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const proceedWithSave = async () => {
    try {
      setLoading(true)

      let imageUrl = null;
      if (imageFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('image', imageFile);
        
        const uploadRes = await fetch('http://localhost:5005/api/uploads', {
          method: 'POST',
          body: formDataUpload
        });
        
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          imageUrl = uploadData.imageUrl;
        } else {
          throw new Error('Image upload failed');
        }
      }

      const dataToSubmit = {
        ...formData,
        image_url: imageUrl,
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.item_code || !formData.item_name) {
      alert('SKU and Item Name are required')
      return
    }

    // Automatically trigger scraping when the user tries to save
    try {
      setLoading(true)
      const variants = await itemService.scrapeVariants({
        item_name: formData.item_name,
        category: formData.category,
        description: formData.description,
        unit: formData.unit
      })
      
      if (variants && variants.length > 0) {
        setScrapedVariants(variants)
        // Select all by default for better UX
        setSelectedVariants(new Set(variants.map((_, i) => i)))
        setShowVariantModal(true)
        setLoading(false)
        return // Stop here and wait for modal interaction
      }
    } catch (err) {
      console.error('Failed to auto-scrape variants, falling back to standard save:', err)
      // If scraping fails, we just proceed with saving the base item
    }

    // If no variants were found or scraping errored, proceed with normal save
    await proceedWithSave()
  }

  const handleCancel = () => {
    navigate('/items')
  }

  const handleAutoFind = async () => {
    if (!formData.item_name || !formData.category) {
      alert('Please enter Item Name and Category first to find variants.')
      return
    }

    try {
      setScraping(true)
      const variants = await itemService.scrapeVariants({
        item_name: formData.item_name,
        category: formData.category,
        description: formData.description,
        unit: formData.unit
      })
      
      if (variants && variants.length > 0) {
        setScrapedVariants(variants)
        setSelectedVariants(new Set())
        setShowVariantModal(true)
      } else {
        alert('No variants found online.')
      }
    } catch (err) {
      console.error('Failed to scrape variants:', err)
      alert('Failed to find variants online: ' + (err.response?.data?.message || err.message))
    } finally {
      setScraping(false)
    }
  }

  const toggleVariantSelection = (index) => {
    const newSelection = new Set(selectedVariants)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else {
      newSelection.add(index)
    }
    setSelectedVariants(newSelection)
  }

  const handleSaveVariants = async () => {
    if (selectedVariants.size === 0) return
    
    try {
      setLoading(true)
      const variantsToSave = Array.from(selectedVariants).map(index => scrapedVariants[index])
      
      await itemService.bulkCreate(variantsToSave)
      
      alert(`Successfully added ${variantsToSave.length} variants!`)
      setShowVariantModal(false)
      navigate('/items')
    } catch (err) {
      console.error('Failed to save variants:', err)
      alert('Failed to save some variants: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
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
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
            <div className="flex items-center gap-4">
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
              />
            </div>
          </div>

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

          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={handleAutoFind} disabled={loading || scraping}>
              {scraping ? 'Searching...' : <><Search className="w-4 h-4 mr-2 inline" /> Auto-Find Variants</>}
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Item'}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Variant Selection Modal */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Select Variants to Add</h3>
              <button onClick={() => setShowVariantModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVariants(new Set(scrapedVariants.map((_, i) => i)))
                          } else {
                            setSelectedVariants(new Set())
                          }
                        }}
                        checked={selectedVariants.size === scrapedVariants.length && scrapedVariants.length > 0}
                      />
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scrapedVariants.map((variant, index) => (
                    <tr key={index} className={selectedVariants.has(index) ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input 
                          type="checkbox" 
                          checked={selectedVariants.has(index)}
                          onChange={() => toggleVariantSelection(index)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{variant.item_code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{variant.item_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{variant.unit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{variant.unit_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <Button variant="secondary" onClick={() => setShowVariantModal(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSaveVariants} disabled={loading || selectedVariants.size === 0}>
                {loading ? 'Saving...' : `Save ${selectedVariants.size} Selected Variants`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AddItem
