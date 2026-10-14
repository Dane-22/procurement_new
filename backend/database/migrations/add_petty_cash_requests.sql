-- Run once before deploying the Petty Cash Request application changes.
-- Petty Cash shares the Cash Request approval record but has its own payee and detail lines.
ALTER TABLE cash_requests
  ADD COLUMN request_kind VARCHAR(20) NOT NULL DEFAULT 'standard' AFTER cr_type,
  ADD COLUMN payee_name VARCHAR(255) NULL AFTER request_kind,
  ADD COLUMN payee_address TEXT NULL AFTER payee_name,
  ADD COLUMN released_by INT NULL AFTER approved_at,
  ADD COLUMN released_at DATETIME NULL AFTER released_by,
  ADD COLUMN release_amount DECIMAL(15,2) NULL AFTER released_at,
  ADD COLUMN received_by INT NULL AFTER release_amount,
  ADD COLUMN received_at DATETIME NULL AFTER received_by;

-- The checked-in dump omits statuses already referenced by the Cash Request routes.
-- Preserve all existing enum values while adding those needed by current and Petty Cash flows.
ALTER TABLE cash_requests
  MODIFY COLUMN status ENUM(
    'Draft', 'For Procurement Review', 'For Admin Review',
    'For Engineer Review', 'For Department Head Review', 'For Senior Project Manager Review',
    'For Super Admin Review', 'For CEO Approval', 'For Super Admin Final Approval', 'Approved', 'Cash Request Created',
    'Payment Request Created', 'Payment Order Created', 'Paid', 'Released',
    'On Hold', 'Rejected', 'Returned', 'Received'
  ) NULL;

CREATE TABLE petty_cash_request_details (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cash_request_id INT NOT NULL,
  line_number INT NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) NULL,
  unit VARCHAR(50) NULL,
  unit_cost DECIMAL(15,2) NULL,
  amount DECIMAL(15,2) NULL,
  is_priced TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_petty_cash_line (cash_request_id, line_number),
  CONSTRAINT fk_petty_cash_detail_request FOREIGN KEY (cash_request_id)
    REFERENCES cash_requests(id) ON DELETE CASCADE
);
