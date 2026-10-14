export const modules = Object.freeze({
  po: { table: 'purchase_orders', owner: 'prepared_by', number: 'po_number', type: 'purchase_order' },
  sr: { table: 'service_requests', owner: 'requested_by', number: 'sr_number', type: 'service_request' },
  cr: { table: 'cash_requests', owner: 'requested_by', number: 'cr_number', type: 'cash_request' }
});
export const stageStatuses = Object.freeze({ engineer: 'For Engineer Review', admin: 'For Admin Review', senior_project_manager: 'For Senior Project Manager Review', final: 'For Super Admin Final Approval' });
export const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export function moneyCents(value) {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw fail('Amounts must be non-negative with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw fail('Amount is too large');
  return cents;
}
export function lineCents(unitPrice, quantity) {
  const price = moneyCents(unitPrice);
  const q = String(quantity ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(q)) throw fail('Quantity must have at most two decimal places');
  const hundredths = moneyCents(q);
  if (hundredths <= 0) throw fail('Quantity must be positive');
  const product = price * hundredths;
  if (!Number.isSafeInteger(product)) throw fail('Line total is too large');
  return Math.round(product / 100);
}
export function initialStage(kind, requesterRole) {
  return kind === 'po' || requesterRole === 'admin' ? 'admin' : requesterRole === 'engineer' ? 'engineer' : 'final';
}
export function nextStage(stage, totalCents) {
  if (stage === 'engineer') return 'admin';
  if (stage === 'admin') return totalCents < 10000000 ? 'senior_project_manager' : 'final';
  return null;
}
export function stageComplete(stage, votes) {
  const active = votes.filter(v => Number(v.is_active) === 1);
  // A deactivated required reviewer needs explicit replacement, not silent removal.
  if (stage !== 'final') return votes.length > 0 && active.length === votes.length && votes.every(v => v.decision === 'approved');
  return ['super_admin', 'ceo'].every(role => active.some(v => v.role === role && v.decision === 'approved'));
}
export function finalRoleAlreadyApproved(votes, role) {
  return votes.some(v => v.role === role && Number(v.is_active) === 1 && v.decision === 'approved');
}
