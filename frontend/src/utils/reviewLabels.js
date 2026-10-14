// Keep legacy database values stable while showing the correct business title.
export const displayReviewStatus = (status) =>
  status === 'For Senior Project Manager Review' ? 'For Senior Project Engineer Review' : status;

export const displayReviewerRole = (role) =>
  role === 'senior_project_manager' ? 'Senior Project Engineer' : String(role || '').replaceAll('_', ' ');
