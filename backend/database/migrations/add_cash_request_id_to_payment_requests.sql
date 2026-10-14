-- Preserve the Cash Request source when creating a Payment Request.
-- The checked-in database dump predates this column. Some deployed databases
-- may already have it, so this migration is safe to run more than once.
SET @payment_request_cr_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_requests'
    AND COLUMN_NAME = 'cash_request_id'
);

SET @payment_request_cr_column_sql = IF(
  @payment_request_cr_column_exists = 0,
  'ALTER TABLE payment_requests ADD COLUMN cash_request_id INT NULL',
  'SELECT 1'
);

PREPARE payment_request_cr_column_statement FROM @payment_request_cr_column_sql;
EXECUTE payment_request_cr_column_statement;
DEALLOCATE PREPARE payment_request_cr_column_statement;

SET @payment_request_cr_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_requests'
    AND INDEX_NAME = 'idx_payment_requests_cash_request_id'
);

SET @payment_request_cr_index_sql = IF(
  @payment_request_cr_index_exists = 0,
  'CREATE INDEX idx_payment_requests_cash_request_id ON payment_requests (cash_request_id)',
  'SELECT 1'
);

PREPARE payment_request_cr_index_statement FROM @payment_request_cr_index_sql;
EXECUTE payment_request_cr_index_statement;
DEALLOCATE PREPARE payment_request_cr_index_statement;
