-- Add accreditation files column to purchase_requests table
-- This field will store the file path of accreditation documents uploaded by requester when creating a PR

ALTER TABLE `purchase_requests` 
ADD COLUMN `accreditation_files` TEXT DEFAULT NULL COMMENT 'JSON array of accreditation file paths uploaded by requester',
ADD COLUMN `supplier_accredited` TINYINT(1) DEFAULT NULL COMMENT '1 if supplier was accredited at time of PR creation, 0 if not, NULL if unknown';
