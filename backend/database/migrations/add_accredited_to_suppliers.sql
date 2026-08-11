-- Add accredited field to suppliers table
-- This field will allow Super Admin to mark suppliers as accredited (legit) or not accredited (fake)

ALTER TABLE `suppliers` 
ADD COLUMN `accredited` TINYINT(1) DEFAULT 0 COMMENT '1 if supplier is accredited/legit, 0 if not accredited/fake',
ADD COLUMN `accredited_by` INT(11) DEFAULT NULL COMMENT 'Employee who accredited the supplier',
ADD COLUMN `accredited_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when supplier was accredited',
ADD KEY `fk_accredited_by` (`accredited_by`),
ADD CONSTRAINT `fk_accredited_by` FOREIGN KEY (`accredited_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
