-- Additive storage only. Status enums are merged by scripts/requestWorkflowMigration.js.
CREATE TABLE IF NOT EXISTS request_workflow_rounds (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 module VARCHAR(2) NOT NULL, document_id INT NOT NULL, round_number INT NOT NULL,
 owner_id INT NOT NULL, owner_role VARCHAR(50) NOT NULL,
 total_amount DECIMAL(15,2) NOT NULL, stage VARCHAR(50) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'review', held_stage VARCHAR(50) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_workflow_round(module,document_id,round_number), KEY idx_workflow_status(module,status,stage)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS request_workflow_reviews (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, round_id BIGINT UNSIGNED NOT NULL,
 reviewer_id INT NOT NULL, role VARCHAR(50) NOT NULL, stage VARCHAR(50) NOT NULL,
 decision VARCHAR(20) NOT NULL DEFAULT 'pending', comment TEXT NULL, reviewed_at DATETIME NULL,
 UNIQUE KEY uq_workflow_vote(round_id,stage,reviewer_id), KEY idx_workflow_reviewer(reviewer_id,decision),
 FOREIGN KEY(round_id) REFERENCES request_workflow_rounds(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS request_workflow_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, module VARCHAR(2) NOT NULL,
 document_id INT NOT NULL, round_id BIGINT UNSIGNED NULL, actor_id INT NOT NULL,
 action VARCHAR(60) NOT NULL, payload JSON NOT NULL, recipients JSON NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, delivered_at DATETIME NULL,
 attempts INT NOT NULL DEFAULT 0, next_attempt_at DATETIME NULL, last_error VARCHAR(500) NULL,
 KEY idx_workflow_delivery(delivered_at,next_attempt_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS request_workflow_receipts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, module VARCHAR(2) NOT NULL,
 document_id INT NOT NULL, round_id BIGINT UNSIGNED NOT NULL, actor_id INT NOT NULL,
 event_key VARCHAR(100) NOT NULL, original_name VARCHAR(255) NOT NULL, stored_name VARCHAR(80) NOT NULL,
 mime_type VARCHAR(50) NOT NULL, amount DECIMAL(15,2) NULL, details JSON NOT NULL,
 verified_by INT NULL, verified_at DATETIME NULL, confirmed_at DATETIME NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'pending', review_comment TEXT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_workflow_receipt_event(module,document_id,event_key),
 FOREIGN KEY(round_id) REFERENCES request_workflow_rounds(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS request_workflow_migration_reviews (
 module VARCHAR(2) NOT NULL, document_id INT NOT NULL, reviewed_by INT NOT NULL,
 linked_documents JSON NOT NULL, note TEXT NOT NULL, reviewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(module,document_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS request_workflow_event_notifications (
 event_id BIGINT UNSIGNED NOT NULL, recipient_id INT NOT NULL, notification_id INT NOT NULL,
 PRIMARY KEY(event_id,recipient_id)
) ENGINE=InnoDB;
