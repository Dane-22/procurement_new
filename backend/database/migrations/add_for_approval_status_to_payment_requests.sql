-- Add 'For Approval' status to payment_requests table enum
ALTER TABLE payment_requests 
MODIFY COLUMN status enum('Draft','Pending','For Approval','On Hold','Approved','Rejected','Cancelled','DV Created','Paid') DEFAULT 'Draft';
