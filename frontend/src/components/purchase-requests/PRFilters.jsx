import React from 'react';
import { Search, X } from 'lucide-react';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { displayReviewStatus } from '../../utils/reviewLabels';

export const PRFilters = ({
  searchQuery, setSearchQuery, commitSearchToUrl,
  statusFilter, handleStatusFilterChange,
  pageSize, handlePageSizeChange, clearFilters,
  userRole, urlView, handleViewAllChange, STATUS_FILTER_OPTIONS
}) => {
  return (
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
                <option key={s} value={s}>{displayReviewStatus(s)}</option>
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

            {userRole === 'engineer' && (
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
  );
};
