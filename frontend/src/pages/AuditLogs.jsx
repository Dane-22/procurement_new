import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from "../contexts/AuthContext";
import { format } from 'date-fns';
import { Search, X, Filter } from 'lucide-react';

const SkeletonRow = () => (
  <tr>
    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div></td>
    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div></td>
    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div></td>
    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div></td>
    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div></td>
  </tr>
);

const AuditLogs = () => {
  const { user } = useAuth();
  
  // Data states
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;
  
  // Filters data
  const [availableActions, setAvailableActions] = useState([]);
  const [availableEntities, setAvailableEntities] = useState([]);
  
  // Active filters
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    entity_type: '',
    start_date: '',
    end_date: ''
  });
  
  // Modal State
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await api.get('/audit-logs/filters');
        setAvailableActions(response.data.actions || []);
        setAvailableEntities(response.data.entityTypes || []);
      } catch (err) {
        console.error('Error fetching filters:', err);
      }
    };
    
    if (['super_admin', 'ceo'].includes(user?.role) || user?.role === 'Super Admin') {
      fetchFilters();
    }
  }, [user]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page,
          limit,
          ...(filters.search && { search: filters.search }),
          ...(filters.action && { action: filters.action }),
          ...(filters.entity_type && { entity_type: filters.entity_type }),
          ...(filters.start_date && { start_date: filters.start_date }),
          ...(filters.end_date && { end_date: filters.end_date }),
        });
        
        const response = await api.get(`/audit-logs?${queryParams.toString()}`);
        setLogs(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load audit logs.');
      } finally {
        setLoading(false);
      }
    };

    if (['super_admin', 'ceo'].includes(user?.role) || user?.role === 'Super Admin') {
      fetchLogs();
    } else {
      setLoading(false);
      setError('Access denied. Super Admin only.');
    }
  }, [user, page, filters]); // Will re-fetch on filter change

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1); // Reset to page 1 on filter change
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      action: '',
      entity_type: '',
      start_date: '',
      end_date: ''
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(val => val !== '');

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams({
        ...(filters.search && { search: filters.search }),
        ...(filters.action && { action: filters.action }),
        ...(filters.entity_type && { entity_type: filters.entity_type }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
      });
      
      const response = await api.get(`/audit-logs/export?${queryParams.toString()}`, {
        responseType: 'blob' // Important for file download
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export audit logs.');
    }
  };

  const formatJSON = (details) => {
    try {
      if (typeof details === 'string') {
        const parsed = JSON.parse(details);
        return JSON.stringify(parsed, null, 2);
      }
      return JSON.stringify(details, null, 2);
    } catch (e) {
      return details; // Not a valid JSON, return as is
    }
  };

  if (error) return <div className="p-4 text-red-500 font-medium">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="sm:flex sm:items-center justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">System Audit Logs</h1>
          <p className="mt-2 text-sm text-gray-700">
            A chronological timeline of all activities across the system. This view is restricted to Super Admins.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={handleExport}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Export to CSV
          </button>
        </div>
      </div>
      
      {/* Filters Section */}
      <div className="mt-6 bg-white p-5 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            Filter Logs
          </h2>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear All
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
          <div className="lg:col-span-2 relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Search</label>
            <div className="relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                name="search"
                placeholder="Search details or user name..."
                value={filters.search}
                onChange={handleFilterChange}
                className="block w-full rounded-lg border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Action Type</label>
            <select
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
              className="block w-full rounded-lg border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-colors"
            >
              <option value="">All Actions</option>
              {availableActions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Entity</label>
            <select
              name="entity_type"
              value={filters.entity_type}
              onChange={handleFilterChange}
              className="block w-full rounded-lg border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-colors"
            >
              <option value="">All Entities</option>
              {availableEntities.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date Range</label>
            <div className="flex items-center rounded-lg shadow-sm border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 overflow-hidden transition-colors">
              <input
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
                title="Start Date"
                className="flex-1 block w-full border-0 py-2 px-3 text-sm focus:ring-0 text-gray-600"
              />
              <span className="text-gray-400 text-xs px-2 bg-gray-50 h-full flex items-center border-x border-gray-200">to</span>
              <input
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
                title="End Date"
                className="flex-1 block w-full border-0 py-2 px-3 text-sm focus:ring-0 text-gray-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Date & Time</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">User</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Action</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Entity</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : logs.length > 0 ? (
                    logs.map((log) => (
                      <tr 
                        key={log.id} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                          {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                          {log.first_name ? `${log.first_name} ${log.last_name}` : 'System'}
                          {log.employee_no && <span className="text-gray-400 text-xs block">{log.employee_no}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.action.includes('Delete') ? 'bg-red-100 text-red-800' :
                            log.action.includes('Logged') ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500 truncate max-w-xs">
                          {log.details ? log.details : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-6 text-gray-500 text-sm">
                        No audit logs found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1 border rounded-md text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1 border rounded-md text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="text-sm text-gray-700">
                Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setSelectedLog(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            {/* Modal Panel */}
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Audit Log Details
                  </h3>
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Date</dt>
                        <dd className="mt-1 text-sm text-gray-900">{format(new Date(selectedLog.created_at), 'MMM d, yyyy h:mm a')}</dd>
                      </div>
                      <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">User</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedLog.first_name ? `${selectedLog.first_name} ${selectedLog.last_name}` : 'System'}</dd>
                      </div>
                      <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Action</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedLog.action}</dd>
                      </div>
                      <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Entity</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedLog.entity_type} {selectedLog.entity_id ? `(#${selectedLog.entity_id})` : ''}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Details Payload</dt>
                        <dd className="mt-1 text-sm text-gray-900 bg-gray-50 p-4 rounded-md overflow-x-auto">
                          <pre className="text-xs text-gray-800">
                            {selectedLog.details ? formatJSON(selectedLog.details) : 'No additional details provided.'}
                          </pre>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                  onClick={() => setSelectedLog(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
