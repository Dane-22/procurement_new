import React from 'react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import { Eye, CheckCircle, XCircle, Edit, Trash2, Shield, X, AlertTriangle, AlertCircle, ChevronUp, ChevronDown, Settings, FileSpreadsheet } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { formatCurrency, formatDate, formatPaymentTerms } from '../../utils/formatters';
import { purchaseRequestService } from "../../services/purchaseRequests";

export const PRTable = ({
  purchaseRequests, user, expandedId, setExpandedId,
  expandedPRDetails, setExpandedPRDetails, setLoadingExpanded, loadingExpanded,
  openProcurementApproval, openProcurementReject,
  openEditModal, handleDelete,
  openReviewModal, openProcessModal, openSuperAdminModal,
  total, startItem, endItem, page, totalPages, goToPage,
  procurementSubmitting, superAdminSubmitting, reviewSubmitting,
  onExport, handleMarkAsReceived, openPreview
}) => {
  const urlTab = new URLSearchParams(window.location.search).get('tab') || 'my-prs';

  // Wrapper function for deletion to match props
  const handleDeleteRequest = (pr) => handleDelete(pr);

  return (
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
                                                                    {/* eslint-disable-next-line no-constant-binary-expression */}
                        {false && user?.role === 'procurement' && pr.status === 'For Procurement Review' && (
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
                        {user?.role === 'super_admin' && pr.status === 'For Super Admin Final Approval' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openSuperAdminModal(pr, 'approved')
                              }}
                              title="Approve"
                              disabled={superAdminSubmitting}
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openSuperAdminModal(pr, 'rejected')
                              }}
                              title="Reject"
                              disabled={superAdminSubmitting}
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
                            onExport(pr.id, pr.pr_number)
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
                        {(pr.status === 'Draft' || pr.status === 'Rejected' || pr.status === 'Returned') && pr.requested_by === user?.id && (
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
                        )}
                        {((pr.status === 'Draft' || pr.status === 'Rejected' || pr.status === 'Returned') && pr.requested_by === user?.id) || user?.role === 'super_admin' ? (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRequest(pr);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        ) : null}
                        {urlTab === 'reviews' && (pr.status === 'For Engineer Review' || pr.status === 'For Admin Review' || pr.status === 'For Super Admin Rep Review' || pr.status === 'For Super Admin Final Approval') && (
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
                        {urlTab === 'admin_processing' && pr.status === 'For Admin Processing' && (user?.role === 'admin' || user?.role === 'super_admin') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openProcessModal(pr)
                            }}
                            title="Process Request"
                          >
                            <Settings className="w-4 h-4 text-blue-600" />
                          </Button>
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
                                          <p key={idx} className="text-sm text-red-600">ΓÇó {remark.remark}</p>
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
                className={`border rounded-lg p-3 cursor-pointer transition-all ${expandedId === pr.id
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
                    {/* eslint-disable-next-line no-constant-binary-expression */}
                        {false && user?.role === 'procurement' && pr.status === 'For Procurement Review' && (
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
                    {user?.role === 'super_admin' && pr.status === 'For Super Admin Final Approval' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openSuperAdminModal(pr, 'approved')
                          }}
                          disabled={superAdminSubmitting}
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openSuperAdminModal(pr, 'rejected')
                          }}
                          disabled={superAdminSubmitting}
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
                        onExport(pr.id, pr.pr_number)
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </Button>
                    {urlTab === 'reviews' && (pr.status === 'For Engineer Review' || pr.status === 'For Admin Review' || pr.status === 'For Super Admin Rep Review' || pr.status === 'For Super Admin Final Approval') && (
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
                    {(pr.status === 'Draft' || pr.status === 'Rejected' || pr.status === 'Returned') && pr.requested_by === user?.id && (
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
                    )}
                    {((pr.status === 'Draft' || pr.status === 'Rejected' || pr.status === 'Returned') && pr.requested_by === user?.id) || user?.role === 'super_admin' ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRequest(pr);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    ) : null}
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
  );
};
