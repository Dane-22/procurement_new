export const initialPettyCashReviewStage = (requesterRole) =>
  ['engineer', 'ceo', 'senior_project_manager'].includes(requesterRole) ? 'engineer' : 'admin';

export const nextPettyCashReviewStage = (stage, requesterRole, amount, status) => {
  if (stage === 'engineer') return 'admin';
  if (stage === 'admin' || (stage === 'super_admin' && status !== 'For Super Admin Final Approval')) {
    if (requesterRole === 'ceo') return 'senior_project_manager';
    if (requesterRole === 'senior_project_manager') return 'ceo';
    return Number(amount) <= 100000 ? 'senior_project_manager' : 'ceo';
  }
  return null;
};
