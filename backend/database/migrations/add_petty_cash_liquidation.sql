-- Expense liquidation and Finance closeout for Petty Cash Requests.
ALTER TABLE cash_requests
  MODIFY COLUMN status ENUM(
    'Draft', 'For Procurement Review', 'For Admin Review',
    'For Engineer Review', 'For Department Head Review', 'For Senior Project Manager Review',
    'For Super Admin Review', 'For CEO Approval', 'For Super Admin Final Approval', 'Approved', 'Cash Request Created',
    'Payment Request Created', 'Payment Order Created', 'Paid', 'Released',
    'On Hold', 'Rejected', 'Returned', 'Received',
    'Liquidation Submitted', 'Liquidation Returned', 'Closed'
  ) NULL;

CREATE TABLE IF NOT EXISTS petty_cash_liquidations (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cash_request_id INT NOT NULL,
  status ENUM('Submitted', 'Returned', 'Closed') NOT NULL,
  current_round INT NOT NULL DEFAULT 1,
  finance_comment TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  verified_cash_returned DECIMAL(15,2) NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pcr_liquidation_request (cash_request_id),
  CONSTRAINT fk_pcr_liquidation_request FOREIGN KEY (cash_request_id) REFERENCES cash_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_pcr_liquidation_reviewer FOREIGN KEY (reviewed_by) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS petty_cash_liquidation_submissions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  liquidation_id INT NOT NULL,
  round_number INT NOT NULL,
  actual_spent DECIMAL(15,2) NOT NULL,
  cash_returned DECIMAL(15,2) NOT NULL DEFAULT 0,
  return_reference VARCHAR(255) NULL,
  notes TEXT NULL,
  submitted_by INT NOT NULL,
  submitted_at DATETIME NOT NULL,
  UNIQUE KEY uq_pcr_liquidation_submission_round (liquidation_id, round_number),
  CONSTRAINT fk_pcr_liquidation_submission FOREIGN KEY (liquidation_id) REFERENCES petty_cash_liquidations(id) ON DELETE CASCADE,
  CONSTRAINT fk_pcr_liquidation_submitter FOREIGN KEY (submitted_by) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS petty_cash_liquidation_expenses (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  expense_date DATE NOT NULL,
  vendor VARCHAR(255) NULL,
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pcr_liquidation_expense_submission (submission_id),
  CONSTRAINT fk_pcr_liquidation_expense FOREIGN KEY (submission_id) REFERENCES petty_cash_liquidation_submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS petty_cash_liquidation_receipts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  expense_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  uploaded_by INT NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pcr_liquidation_receipt_expense (expense_id),
  CONSTRAINT fk_pcr_liquidation_receipt_expense FOREIGN KEY (expense_id) REFERENCES petty_cash_liquidation_expenses(id) ON DELETE CASCADE,
  CONSTRAINT fk_pcr_liquidation_receipt_uploader FOREIGN KEY (uploaded_by) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS petty_cash_liquidation_reviews (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  liquidation_id INT NOT NULL,
  round_number INT NOT NULL,
  reviewer_id INT NOT NULL,
  decision ENUM('returned', 'closed') NOT NULL,
  comment TEXT NULL,
  verified_cash_returned DECIMAL(15,2) NULL,
  reviewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pcr_liquidation_review_request (liquidation_id, round_number),
  CONSTRAINT fk_pcr_liquidation_review FOREIGN KEY (liquidation_id) REFERENCES petty_cash_liquidations(id) ON DELETE CASCADE,
  CONSTRAINT fk_pcr_liquidation_review_actor FOREIGN KEY (reviewer_id) REFERENCES employees(id)
);
