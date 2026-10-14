import React from 'react';
import { X } from 'lucide-react';

const amount = (value) => new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false
}).format(Number(value) || 0);

const date = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`;
};

const Field = ({ label, children, className = '' }) => (
  <div className={`flex min-h-[16px] border-b border-black text-[10px] leading-tight ${className}`}>
    <div className="w-[106px] shrink-0 border-r border-black px-1 font-bold">{label}</div>
    <div className="min-w-0 flex-1 px-1 font-semibold">{children || '-'}</div>
  </div>
);

const CompanyMark = () => (
  <div className="flex h-full items-center justify-center border-r border-black">
    <div className="flex h-12 w-12 rotate-45 items-center justify-center border-2 border-yellow-400 bg-black">
      <div className="-rotate-45 text-center text-[8px] font-bold leading-none text-yellow-300">JAJR<div className="text-[5px] font-normal text-white">CONSTRUCTION</div></div>
    </div>
  </div>
);

const Signature = ({ label, name, caption, right = true, top = false, nameClassName = '', captionClassName = '' }) => (
  <div className={`${right ? 'border-r ' : ''}${top ? 'border-t ' : ''}border-black`}>
    <div className="border-b border-black px-1">{label}</div>
    <div className={`flex min-h-8 items-end justify-center px-2 py-1 text-center font-semibold leading-tight ${nameClassName}`}>{name || '-'}</div>
    <div className={`border-t border-black text-center italic ${captionClassName}`}>{caption}</div>
  </div>
);

export default function PettyCashPreviewModal({ request, onClose, children, actions }) {
  if (!request) return null;
  const details = Array.isArray(request.details) ? request.details : [];
  const total = Number(request.amount) || details.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const requester = `${request.requester_first_name || ''} ${request.requester_last_name || ''}`.trim() || request.requested_by_name || '-';
  const reviews = Array.isArray(request.reviews) ? request.reviews : [];
  const currentRound = reviews.reduce((round, review) => Math.max(round, Number(review.round_number) || 0), 0);
  const currentStage = ({
    'For Engineer Review': 'engineer',
    'For Super Admin Review': 'super_admin',
    'For CEO Approval': 'ceo',
    // Read the legacy stage while previously submitted requests finish review.
    'For Admin Review': 'admin',
    'For Senior Project Manager Review': 'senior_project_manager',
    'For Super Admin Final Approval': 'super_admin'
  })[request.status];
  const activeRoundReviews = reviews.filter((review) => Number(review.round_number) === currentRound);
  const reviewedBy = activeRoundReviews.filter((review) => review.decision === 'approved');
  const pendingReview = currentStage
    ? activeRoundReviews.filter((review) => review.stage === currentStage && review.decision === 'pending')
    : [];
  const reviewerName = (review) => `${review.first_name || ''} ${review.last_name || ''}`.trim() || 'Reviewer';
  const reviewerRole = (review) => review.stage === 'senior_project_manager'
    ? 'Senior Project Engineer'
    : review.stage === 'super_admin'
      ? 'Super Admin'
      : ({ engineer: 'Engineer', admin: 'Admin', ceo: 'CEO' })[review.stage]
        || String(review.stage || 'Reviewer').replaceAll('_', ' ');
  const reviewedSummary = reviewedBy.length
    ? reviewedBy.map((review) => `${reviewerName(review)} (${reviewerRole(review)})`).join(', ')
    : 'None yet';
  const pendingSummary = pendingReview.length
    ? pendingReview.map((review) => `${reviewerName(review)} (${reviewerRole(review)})`).join(', ')
    : request.status === 'Draft'
      ? 'Not submitted yet'
      : 'None';
  const additionalReviewerRows = [];
  for (let index = 1; index < reviewedBy.length; index += 3) {
    additionalReviewerRows.push(reviewedBy.slice(index, index + 3));
  }
  const primaryReviewer = reviewedBy[0] || activeRoundReviews.find((review) => review.decision === 'rejected');
  const primaryReviewerName = primaryReviewer
    ? `${reviewerName(primaryReviewer)}${primaryReviewer.decision === 'rejected' ? ' (declined)' : ''}`
    : currentStage ? 'Pending review' : '—';
  const primaryReviewerRole = primaryReviewer
    ? reviewerRole(primaryReviewer)
    : currentStage ? reviewerRole({ stage: currentStage }) : 'Reviewer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">Petty Cash Request Preview</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600" aria-label="Close preview"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-auto bg-gray-100 p-3">
          <div className="mx-auto w-[480px] min-w-[480px] bg-white text-black shadow-sm">
            <div className="border-2 border-blue-700 bg-white font-serif">
              <div className="grid h-[68px] grid-cols-[108px_1fr_125px] overflow-hidden border-b border-black">
                <CompanyMark />
                <div className="overflow-hidden px-1 text-center leading-[1.05]">
                  <div className="whitespace-nowrap text-[17px] font-bold">JAJr CONSTRUCTION</div>
                  <div className="whitespace-nowrap text-[7.5px]">P.P. Zamora St. Barangay II, San Fernando City, La Union</div>
                  <div className="whitespace-nowrap text-[8px]">Telephone #(072) 607-1150</div>
                  <div className="whitespace-nowrap text-[8px]">E-mail Address: jajrconstruction@yahoo.com</div>
                </div>
                <div className="grid grid-cols-[50px_1fr] border-l border-black text-[9px]">
                  <div className="flex items-center justify-center border-b border-r border-black text-center font-bold leading-tight">PCR No.</div>
                  <div className="flex items-center justify-center break-all border-b border-black px-1 text-[12px] font-bold">{request.cr_number || '-'}</div>
                  <div className="border-r border-black" /><div />
                </div>
              </div>
              <div className="border-b border-black py-1.5 text-center text-[19px] font-bold leading-none tracking-wide">PETTY CASH REQUEST</div>
              <div className="grid grid-cols-[1fr_165px] border-b border-black">
                <div><Field label="PAYEE :">{request.payee_name}</Field><Field label="Address :">{request.payee_address}</Field><Field label="Project :">{request.project}</Field></div>
                <div className="border-l border-black"><Field label="Date Prepared">{date(request.created_at)}</Field><Field label="Date Needed">{date(request.date_needed)}</Field><Field label="Payment Basis">Cash</Field></div>
              </div>
              <Field label="Project Address :" className="border-b-2 border-green-700">{request.project_address}</Field>
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-0 top-28 z-0 text-center text-[70px] text-gray-400/70">Page 1</div>
                <table className="relative z-10 w-full table-fixed border-collapse text-[12px] leading-tight">
                  <thead><tr className="border-b border-black"><th className="w-[10%] border-r border-black py-1">QTY.</th><th className="w-[11%] border-r border-black py-1">UNIT</th><th className="border-r border-black py-1">DESCRIPTION</th><th className="w-[16%] border-r border-black py-1">UNIT COST</th><th className="w-[18%] py-1">AMOUNT</th></tr></thead>
                  <tbody>
                    {details.map((line, index) => <tr key={line.id || index} className="h-[18px] border-b border-black"><td className="border-r border-black px-1 text-center">{line.is_priced ? line.quantity : ''}</td><td className="border-r border-black px-1 text-center">{line.is_priced ? line.unit || '' : ''}</td><td className="border-r border-black px-1">{line.description}</td><td className="border-r border-black px-1 text-right">{line.is_priced ? amount(line.unit_cost) : ''}</td><td className="px-1 text-right">{line.is_priced ? amount(line.amount) : ''}</td></tr>)}
                    <tr className="h-[15px] border-b border-black text-center text-[11px] text-red-600"><td className="border-r border-black" /><td className="border-r border-black" /><td className="border-r border-black font-bold">*** NOTHING FOLLOWS ***</td><td className="border-r border-black" /><td /></tr>
                    {Array.from({ length: Math.max(4, 13 - details.length) }, (_, index) => <tr key={`blank-${index}`} className="h-[15px] border-b border-black"><td className="border-r border-black">&nbsp;</td><td className="border-r border-black">&nbsp;</td><td className="border-r border-black">&nbsp;</td><td className="border-r border-black">&nbsp;</td><td>&nbsp;</td></tr>)}
                  </tbody>
                  <tfoot><tr className="h-[28px] border-b border-black text-[12px] font-bold"><td colSpan="3" /><td className="border-r border-black text-right">GRAND TOTAL&nbsp;</td><td className="px-1 text-center">{amount(total)}</td></tr></tfoot>
                </table>
              </div>
              <div className="grid grid-cols-3 text-[11px]">
                <div className="col-span-2 grid grid-cols-2">
                  <Signature label="Prepared by:" name={requester} caption="Prepared by" />
                  <Signature label="Reviewed by:" name={primaryReviewerName} caption={primaryReviewerRole} nameClassName="text-[10px]" captionClassName="text-[10px]" />
                </div>
                {additionalReviewerRows.map((reviewRow, rowIndex) => reviewRow.map((review, cellIndex) => (
                  <Signature
                    key={review.id || `${review.reviewer_id}-${review.round_number}`}
                    label="Reviewed by:"
                    name={reviewerName(review)}
                    caption={reviewerRole(review)}
                    right={cellIndex < 2}
                    top
                    nameClassName="text-[10px]"
                    captionClassName="text-[10px]"
                  />
                )).concat(Array.from({ length: 3 - reviewRow.length }, (_, emptyIndex) => (
                  <div key={`review-empty-${rowIndex}-${emptyIndex}`} className={`${reviewRow.length + emptyIndex < 2 ? 'border-r ' : ''}border-t border-black`} />
                ))))}
              </div>
              <div className="h-[60px] border-t border-black" />
            </div>
          </div>
          <div className="mx-auto mt-3 w-full max-w-3xl space-y-3">{children}</div>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Review status</p>
            <div className="space-y-1 text-xs leading-relaxed">
              <p className="text-green-700"><span className="font-semibold">Reviewed by:</span> {reviewedSummary}</p>
              <p className="text-amber-700"><span className="font-semibold">Pending review:</span> {pendingSummary}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2"><button type="button" className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200" onClick={onClose}>Close</button>{actions}</div>
        </div>
      </div>
    </div>
  );
}
