import React, { useState, useEffect } from 'react'
import { purchaseRequestService } from '../../services/purchaseRequests'
import { ChevronUp, ChevronDown, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

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
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300'
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

const PendingPurchaseRequests = () => {
  const [purchaseRequests, setPurchaseRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    fetchPurchaseRequests()
  }, [])

  const fetchPurchaseRequests = async () => {
    try {
      setLoading(true)
      const data = await purchaseRequestService.getAll()
      // Filter PRs that need admin attention (Pending, For Approval, or For Purchase)
      const pending = data.filter(pr => 
        pr.status === 'Pending' || pr.status === 'For Approval' || pr.status === 'For Purchase'
      )
      setPurchaseRequests(pending)
    } catch (err) {
      setError('Failed to fetch purchase requests')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      setProcessingId(id)
      await purchaseRequestService.approve(id, 'approved')
      await fetchPurchaseRequests()
    } catch (err) {
      alert('Failed to approve request')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    
    try {
      setProcessingId(id)
      await purchaseRequestService.approve(id, 'rejected', reason)
      await fetchPurchaseRequests()
    } catch (err) {
      alert('Failed to reject request')
    } finally {
      setProcessingId(null)
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
        <h2 className="text-lg font-semibold text-gray-900">Pending Purchase Requests</h2>
        <div className="text-sm text-gray-500">
          {purchaseRequests.length} Pending Request{purchaseRequests.length !== 1 ? 's' : ''}
        </div>
      </div>

      <Card>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">PR Number</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Payee Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRequests.map(pr => (
                <React.Fragment key={pr.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{pr.pr_number}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{pr.payee_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{pr.project}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(pr.amount)}</td>
                    <td className="py-3 px-4"><StatusBadge status={pr.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="success" 
                          size="sm" 
                          disabled={processingId === pr.id}
                          onClick={(e) => { e.stopPropagation(); handleApprove(pr.id); }}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="danger" 
                          size="sm"
                          disabled={processingId === pr.id}
                          onClick={(e) => { e.stopPropagation(); handleReject(pr.id); }}
                        >
                          <XCircle className="w-4 h-4" />
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
              {purchaseRequests.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    No pending purchase requests
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
                    <p className="text-sm font-semibold text-gray-900">{pr.payee_name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="success" 
                      size="sm" 
                      disabled={processingId === pr.id}
                      onClick={(e) => { e.stopPropagation(); handleApprove(pr.id); }}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm"
                      disabled={processingId === pr.id}
                      onClick={(e) => { e.stopPropagation(); handleReject(pr.id); }}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-sm text-gray-600">{pr.project}</p>
                  <p className="text-sm font-medium text-gray-700">{formatCurrency(pr.amount)}</p>
                </div>
                <StatusBadge status={pr.status} />
                {expandedId === pr.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <p className="text-xs text-gray-500">Purpose: {pr.purpose}</p>
                    {pr.payee_address && <p className="text-xs text-gray-500">Address: {pr.payee_address}</p>}
                    {pr.remarks && <p className="text-xs text-gray-500">Remarks: {pr.remarks}</p>}
                  </div>
                )}
              </div>
            ))}
            {purchaseRequests.length === 0 && (
              <p className="text-center text-gray-500 py-8">No pending purchase requests</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default PendingPurchaseRequests
