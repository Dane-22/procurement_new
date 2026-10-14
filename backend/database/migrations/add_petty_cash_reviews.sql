-- Preserve each assigned reviewer's decision across resubmission rounds.
CREATE TABLE IF NOT EXISTS petty_cash_request_reviews (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cash_request_id INT NOT NULL,
  round_number INT NOT NULL,
  stage VARCHAR(30) NOT NULL,
  reviewer_id INT NOT NULL,
  decision ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  comment TEXT NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pcr_round_stage_reviewer (cash_request_id, round_number, stage, reviewer_id),
  KEY idx_pcr_reviewer_pending (reviewer_id, decision),
  CONSTRAINT fk_pcr_review_request FOREIGN KEY (cash_request_id) REFERENCES cash_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_pcr_review_reviewer FOREIGN KEY (reviewer_id) REFERENCES employees(id)
);
