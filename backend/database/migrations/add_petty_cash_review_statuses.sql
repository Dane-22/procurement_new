-- Allow Petty Cash to enter its Admin, Super Admin, and CEO review stages.
-- For Super Admin Review is retained for requests created during the previous flow.
ALTER TABLE cash_requests
  MODIFY COLUMN status ENUM(
    'Draft', 'For Procurement Review', 'For Admin Review',
    'For Engineer Review', 'For Department Head Review', 'For Senior Project Manager Review',
    'For Super Admin Review', 'For CEO Approval', 'For Super Admin Final Approval',
    'Approved', 'Cash Request Created', 'Payment Request Created',
    'Payment Order Created', 'Paid', 'Released', 'On Hold', 'Rejected',
    'Returned', 'Received', 'Liquidation Submitted', 'Liquidation Returned', 'Closed'
  ) NULL;
