-- Add Pending Accreditation Review status to purchase_requests table
-- This status will be used when a supplier is not accredited but the PR still proceeds

ALTER TABLE `purchase_requests` 
MODIFY COLUMN `status` enum('Draft','Pending','For Procurement Review','For Engineer Review','For Admin Review','For Super Admin Final Approval','On Hold','For Purchase','PO Created','Payment Request Created','Completed','Rejected','Cancelled','Received','Pending Accreditation Review') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft';
