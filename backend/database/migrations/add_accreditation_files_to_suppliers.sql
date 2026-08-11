-- Add accreditation_files field to suppliers table
-- This field will store the file path of accreditation documents uploaded by Super Admin

ALTER TABLE `suppliers` 
ADD COLUMN `accreditation_files` TEXT DEFAULT NULL COMMENT 'JSON array of accreditation file paths',
ADD COLUMN `accreditation_notes` TEXT DEFAULT NULL COMMENT 'Notes about accreditation documents';
