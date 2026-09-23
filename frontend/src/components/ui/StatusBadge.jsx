import React from 'react'

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'For Approval': 'bg-blue-100 text-blue-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-gray-100 text-gray-600',
      'For Senior Project Manager Review': 'bg-orange-100 text-orange-800',
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

export default StatusBadge
