-- Add new review statuses to purchase_requests table
-- Note: MySQL doesn't support ALTER TABLE to modify ENUM directly, so we need to recreate the column
ALTER TABLE purchase_requests 
MODIFY COLUMN status enum('Draft','Pending','For Procurement Review','For Engineer Review','For Admin Review','For Super Admin Final Approval','On Hold','For Purchase','PO Created','Payment Request Created','Completed','Rejected','Cancelled','Received') DEFAULT 'Draft';
