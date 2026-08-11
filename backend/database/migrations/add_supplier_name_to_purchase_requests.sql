-- Check if column exists before adding
SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'purchase_requests'
  AND COLUMN_NAME = 'supplier_name'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE purchase_requests ADD COLUMN supplier_name varchar(255) DEFAULT NULL AFTER supplier_id',
  'SELECT ''Column supplier_name already exists'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
