-- Schema-only CI fixture. Contains no employee, financial, or credential rows.

-- Apply only to a disposable test database; upgrade behavior is tested separately.

SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE `cash_request_payment_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cash_request_id` int NOT NULL,
  `payment_date` date NOT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cr_payment_date` (`cash_request_id`,`payment_date`),
  KEY `idx_crps_payment_date` (`payment_date`),
  KEY `fk_cr_schedule_created_by` (`created_by`),
  CONSTRAINT `fk_cr_schedule_cr` FOREIGN KEY (`cash_request_id`) REFERENCES `cash_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cr_schedule_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cash_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cr_number` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `requested_by` int NOT NULL,
  `purpose` text COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `quantity` decimal(10,2) DEFAULT '1.00',
  `unit` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'pcs',
  `project` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `project_address` text COLLATE utf8mb4_general_ci,
  `date_needed` date DEFAULT NULL,
  `order_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payment_terms_note` text COLLATE utf8mb4_general_ci,
  `supplier_id` int DEFAULT NULL,
  `supplier_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `supplier_address` text COLLATE utf8mb4_general_ci,
  `cr_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'payment_request',
  `request_kind` varchar(20) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'standard',
  `payee_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payee_address` text COLLATE utf8mb4_general_ci,
  `status` enum('Draft','For Procurement Review','For Admin Review','For Engineer Review','For Department Head Review','For Senior Project Manager Review','For Super Admin Review','For CEO Approval','For Super Admin Final Approval','Approved','Cash Request Created','Payment Request Created','Payment Order Created','Paid','Released','On Hold','Rejected','Returned','Received','Liquidation Submitted','Liquidation Returned','Closed','Partial Received','Completed') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_general_ci,
  `rejection_reason` text COLLATE utf8mb4_general_ci,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `released_by` int DEFAULT NULL,
  `released_at` datetime DEFAULT NULL,
  `release_amount` decimal(15,2) DEFAULT NULL,
  `received_by` int DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cr_number` (`cr_number`),
  KEY `supplier_id` (`supplier_id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_cr_status` (`status`),
  KEY `idx_cr_requested_by` (`requested_by`),
  CONSTRAINT `cash_requests_ibfk_1` FOREIGN KEY (`requested_by`) REFERENCES `employees` (`id`),
  CONSTRAINT `cash_requests_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cash_requests_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `cash_schedule_reminder_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `reminder_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cr_schedule_reminder` (`schedule_id`,`reminder_type`),
  KEY `idx_csrl_type_sent_at` (`reminder_type`,`sent_at`),
  CONSTRAINT `fk_csrl_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `cash_request_payment_schedules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('Active','Inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_name` (`category_name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `disbursement_vouchers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dv_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Format: YYYY-MM-001 (incremental starting from 001)',
  `purchase_order_id` int DEFAULT NULL,
  `purchase_request_id` int DEFAULT NULL,
  `service_request_id` int DEFAULT NULL,
  `cash_request_id` int DEFAULT NULL,
  `payment_request_id` int DEFAULT NULL,
  `payment_order_id` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `prepared_by` int NOT NULL COMMENT 'Employee who created the DV',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Total amount from PO',
  `dv_date` date NOT NULL COMMENT 'Date when DV was created',
  `particulars` text COLLATE utf8mb4_unicode_ci COMMENT 'Payment particulars/description',
  `project` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pr_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Reference to PR number',
  `sr_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cr_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `po_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `check_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Check number when payment is processed',
  `bank_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `received_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Person who received payment',
  `received_date` date DEFAULT NULL,
  `status` enum('Draft','Pending','Approved','Paid','Cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
  `certified_by_accounting` int DEFAULT NULL COMMENT 'Employee who certified availability of funds',
  `certified_by_manager` int DEFAULT NULL COMMENT 'General Manager who approved the DV',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `order_number` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dv_type` enum('po_based','sr_based','cash_based','pr_based','payment_order_based') COLLATE utf8mb4_unicode_ci DEFAULT 'po_based',
  PRIMARY KEY (`id`),
  UNIQUE KEY `dv_number` (`dv_number`),
  KEY `purchase_order_id` (`purchase_order_id`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `prepared_by` (`prepared_by`),
  KEY `certified_by_accounting` (`certified_by_accounting`),
  KEY `certified_by_manager` (`certified_by_manager`),
  KEY `service_request_id` (`service_request_id`),
  KEY `dv_type` (`dv_type`),
  KEY `cash_request_id` (`cash_request_id`),
  KEY `idx_payment_request_id` (`payment_request_id`),
  KEY `fk_dv_payment_order` (`payment_order_id`),
  CONSTRAINT `disbursement_vouchers_ibfk_1` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `disbursement_vouchers_ibfk_2` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `disbursement_vouchers_ibfk_3` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `disbursement_vouchers_ibfk_4` FOREIGN KEY (`prepared_by`) REFERENCES `employees` (`id`),
  CONSTRAINT `disbursement_vouchers_ibfk_5` FOREIGN KEY (`certified_by_accounting`) REFERENCES `employees` (`id`),
  CONSTRAINT `disbursement_vouchers_ibfk_6` FOREIGN KEY (`certified_by_manager`) REFERENCES `employees` (`id`),
  CONSTRAINT `disbursement_vouchers_ibfk_7` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `disbursement_vouchers_ibfk_8` FOREIGN KEY (`cash_request_id`) REFERENCES `cash_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dv_payment_order` FOREIGN KEY (`payment_order_id`) REFERENCES `payment_orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `document_layouts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type of document (purchase_request, purchase_order, payment_request, etc.)',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name for the layout',
  `layout_config` json NOT NULL COMMENT 'JSON configuration for the layout structure',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Whether this layout is currently active',
  `is_default` tinyint(1) DEFAULT '0' COMMENT 'Whether this is the default layout for the document type',
  `created_by` int DEFAULT NULL COMMENT 'ID of employee who created this layout',
  `updated_by` int DEFAULT NULL COMMENT 'ID of employee who last updated this layout',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `document_type` (`document_type`),
  KEY `is_active` (`is_active`),
  KEY `created_by` (`created_by`),
  KEY `document_layouts_updated_by_fk` (`updated_by`),
  CONSTRAINT `document_layouts_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `document_layouts_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_no` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middle_initial` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('engineer','procurement','admin','super_admin','senior_project_manager','ceo') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'engineer',
  `department` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fcm_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_no` (`employee_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category_id` int DEFAULT NULL,
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int DEFAULT NULL,
  `status` enum('Active','Inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_code` (`item_code`),
  UNIQUE KEY `item_name` (`item_name`),
  KEY `category_id` (`category_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `items_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  CONSTRAINT `items_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `layout_versions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `layout_id` int NOT NULL COMMENT 'Reference to the parent layout',
  `version` int NOT NULL COMMENT 'Version number',
  `layout_config` json NOT NULL COMMENT 'JSON configuration for this version',
  `change_description` text COLLATE utf8mb4_unicode_ci COMMENT 'Description of changes made in this version',
  `created_by` int DEFAULT NULL COMMENT 'ID of employee who created this version',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_layout_version` (`layout_id`,`version`),
  KEY `layout_id` (`layout_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `layout_versions_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `layout_versions_layout_fk` FOREIGN KEY (`layout_id`) REFERENCES `document_layouts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `recipient_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'System',
  `related_id` int DEFAULT NULL COMMENT 'ID of related record (PR, PO, etc.)',
  `related_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Type of related record',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `recipient_id` (`recipient_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`recipient_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_number_budgets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `planned_cost` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_project` (`order_number`,`project`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_number_locks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `locked_by` int NOT NULL,
  `locked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_number_lock` (`order_number`),
  KEY `idx_locked_by` (`locked_by`),
  CONSTRAINT `fk_order_number_locks_locked_by` FOREIGN KEY (`locked_by`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_number` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `service_request_id` int DEFAULT NULL,
  `cash_request_id` int DEFAULT NULL,
  `payee_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `payee_address` text COLLATE utf8mb4_general_ci,
  `purpose` text COLLATE utf8mb4_general_ci,
  `project` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `project_address` text COLLATE utf8mb4_general_ci,
  `order_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('Draft','Pending','For Admin Approval','For Super Admin Final Approval','Approved','PO Created','DV Created','On Hold','Rejected') COLLATE utf8mb4_general_ci DEFAULT 'Draft',
  `remarks` text COLLATE utf8mb4_general_ci,
  `requested_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `po_number` (`po_number`),
  KEY `requested_by` (`requested_by`),
  KEY `idx_po_status` (`status`),
  KEY `idx_po_service_request_id` (`service_request_id`),
  KEY `fk_po_cash_request` (`cash_request_id`),
  CONSTRAINT `fk_po_cash_request` FOREIGN KEY (`cash_request_id`) REFERENCES `cash_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_orders_ibfk_1` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_orders_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `payment_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payment_request_id` int NOT NULL,
  `pr_item_id` int DEFAULT NULL,
  `item_id` int DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT '0.00',
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pcs',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payment_request_id` (`payment_request_id`),
  KEY `pr_item_id` (`pr_item_id`),
  KEY `item_id` (`item_id`),
  CONSTRAINT `payment_request_items_ibfk_1` FOREIGN KEY (`payment_request_id`) REFERENCES `payment_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_request_items_ibfk_2` FOREIGN KEY (`pr_item_id`) REFERENCES `purchase_request_items` (`id`),
  CONSTRAINT `payment_request_items_ibfk_3` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pr_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_request_id` int DEFAULT NULL,
  `service_request_id` int DEFAULT NULL,
  `payee_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Person/entity to pay',
  `payee_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purpose` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `project` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `project_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_number` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_basis` enum('debt','non_debt') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'non_debt',
  `requested_by` int NOT NULL,
  `status` enum('Draft','Pending','For Approval','On Hold','Approved','Rejected','Cancelled','DV Created','Paid') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `dv_id` int DEFAULT NULL COMMENT 'Reference to Disbursement Voucher when created',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cash_request_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pr_number` (`pr_number`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `status` (`status`),
  KEY `dv_id` (`dv_id`),
  KEY `idx_service_request_id` (`service_request_id`),
  KEY `idx_payment_requests_cash_request_id` (`cash_request_id`),
  CONSTRAINT `fk_payment_requests_service_request_id` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_requests_ibfk_1` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `employees` (`id`),
  CONSTRAINT `payment_requests_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`),
  CONSTRAINT `payment_requests_ibfk_4` FOREIGN KEY (`dv_id`) REFERENCES `disbursement_vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment_schedule_reminder_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `reminder_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schedule_reminder` (`schedule_id`,`reminder_type`),
  KEY `idx_psrl_type_sent_at` (`reminder_type`,`sent_at`),
  CONSTRAINT `fk_reminder_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `purchase_request_payment_schedules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_liquidation_expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `expense_date` date NOT NULL,
  `vendor` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pcr_liquidation_expense_submission` (`submission_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_liquidation_receipts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `expense_id` int NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int NOT NULL,
  `uploaded_by` int NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pcr_liquidation_receipt_expense` (`expense_id`),
  KEY `fk_pcr_liquidation_receipt_uploader` (`uploaded_by`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_liquidation_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `liquidation_id` int NOT NULL,
  `round_number` int NOT NULL,
  `reviewer_id` int NOT NULL,
  `decision` enum('returned','closed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `verified_cash_returned` decimal(15,2) DEFAULT NULL,
  `reviewed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pcr_liquidation_review_request` (`liquidation_id`,`round_number`),
  KEY `fk_pcr_liquidation_reviewer` (`reviewer_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_liquidation_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `liquidation_id` int NOT NULL,
  `round_number` int NOT NULL,
  `actual_spent` decimal(15,2) NOT NULL,
  `cash_returned` decimal(15,2) NOT NULL DEFAULT '0.00',
  `return_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `submitted_by` int NOT NULL,
  `submitted_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pcr_liquidation_submission_round` (`liquidation_id`,`round_number`),
  KEY `fk_pcr_liquidation_submitter` (`submitted_by`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_liquidations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cash_request_id` int NOT NULL,
  `status` enum('Submitted','Returned','Closed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_round` int NOT NULL DEFAULT '1',
  `finance_comment` text COLLATE utf8mb4_unicode_ci,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `verified_cash_returned` decimal(15,2) DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pcr_liquidation_request` (`cash_request_id`),
  KEY `fk_pcr_liquidation_reviewer` (`reviewed_by`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_request_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cash_request_id` int NOT NULL,
  `line_number` int NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_cost` decimal(15,2) DEFAULT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `is_priced` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_petty_cash_line` (`cash_request_id`,`line_number`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `petty_cash_request_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cash_request_id` int NOT NULL,
  `round_number` int NOT NULL,
  `stage` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reviewer_id` int NOT NULL,
  `decision` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `comment` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pcr_round_stage_reviewer` (`cash_request_id`,`round_number`,`stage`,`reviewer_id`),
  KEY `idx_pcr_reviewer_pending` (`reviewer_id`,`decision`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_admin_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_id` int NOT NULL,
  `reviewer_id` int NOT NULL,
  `review_status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `review_comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `is_current` tinyint(1) DEFAULT '1',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `po_id` (`po_id`),
  KEY `reviewer_id` (`reviewer_id`),
  CONSTRAINT `po_reviews_po_fk` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `po_reviews_reviewer_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_order_id` int NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Relative path to file storage',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original file name',
  `file_size` int DEFAULT NULL COMMENT 'File size in bytes',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_by` int NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `purchase_order_id` (`purchase_order_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `po_attachments_ibfk_1` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `po_attachments_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pr_item_rejection_remarks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_request_id` int NOT NULL,
  `purchase_request_item_id` int NOT NULL,
  `item_id` int NOT NULL,
  `remark` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `purchase_request_item_id` (`purchase_request_item_id`),
  KEY `item_id` (`item_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `pr_item_rejection_remarks_ibfk_1` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pr_item_rejection_remarks_ibfk_2` FOREIGN KEY (`purchase_request_item_id`) REFERENCES `purchase_request_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pr_item_rejection_remarks_ibfk_3` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`),
  CONSTRAINT `pr_item_rejection_remarks_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pricing_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `supplier_id` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `purchase_order_id` int DEFAULT NULL,
  `purchase_request_id` int DEFAULT NULL,
  `po_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pr_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `date_recorded` date NOT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_pricing_pr` (`purchase_request_id`),
  KEY `fk_pricing_created_by` (`created_by`),
  KEY `idx_pricing_item_id` (`item_id`),
  KEY `idx_pricing_supplier_id` (`supplier_id`),
  KEY `idx_pricing_date` (`date_recorded`),
  KEY `idx_pricing_po` (`purchase_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `purchase_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_order_id` int NOT NULL,
  `purchase_request_item_id` int DEFAULT NULL,
  `item_id` int DEFAULT NULL,
  `quantity` decimal(15,2) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `received_quantity` decimal(15,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `purchase_order_id` (`purchase_order_id`),
  KEY `purchase_request_item_id` (`purchase_request_item_id`),
  KEY `item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `purchase_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_request_id` int DEFAULT NULL,
  `service_request_id` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `prepared_by` int NOT NULL,
  `total_amount` decimal(10,2) DEFAULT '0.00',
  `po_date` date NOT NULL,
  `expected_delivery_date` date DEFAULT NULL,
  `actual_delivery_date` date DEFAULT NULL,
  `status` enum('Draft','Pending Approval','Approved','On Hold','Delivered','Paid','Cancelled','For Engineer Review','For Admin Review','For Senior Project Manager Review','For Super Admin Final Approval','Rejected','Returned','Partial Received','Completed','Received') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `place_of_delivery` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_term` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'COD',
  `payment_term` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'CASH',
  `project` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `order_number` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `po_type` enum('purchase_order','payment_order') COLLATE utf8mb4_unicode_ci DEFAULT 'purchase_order' COMMENT 'Type of PO: purchase_order (debt) or payment_order (non-debt/prepaid)',
  `parent_po_id` int DEFAULT NULL,
  `installment_schedule_id` int DEFAULT NULL,
  `scheduled_payment_date` date DEFAULT NULL,
  `scheduled_amount` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `po_number` (`po_number`),
  UNIQUE KEY `uq_po_installment` (`parent_po_id`,`installment_schedule_id`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `prepared_by` (`prepared_by`),
  KEY `po_type` (`po_type`),
  KEY `service_request_id` (`service_request_id`),
  KEY `idx_po_type` (`po_type`),
  KEY `idx_po_parent_po_id` (`parent_po_id`),
  KEY `idx_po_installment_schedule_id` (`installment_schedule_id`),
  CONSTRAINT `fk_po_installment_schedule_id` FOREIGN KEY (`installment_schedule_id`) REFERENCES `purchase_request_payment_schedules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_po_parent_po_id` FOREIGN KEY (`parent_po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `purchase_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_request_id` int NOT NULL,
  `item_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) DEFAULT '0.00',
  `total_price` decimal(10,2) DEFAULT '0.00',
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `status` enum('Pending','For Purchase','Purchased','Received') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `received_by` int DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `item_id` (`item_id`),
  KEY `received_by` (`received_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `purchase_request_payment_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_request_id` int NOT NULL,
  `payment_date` date NOT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pr_payment_date` (`purchase_request_id`,`payment_date`),
  KEY `idx_prps_payment_date` (`payment_date`),
  KEY `fk_pr_schedule_created_by` (`created_by`),
  CONSTRAINT `fk_pr_schedule_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pr_schedule_pr` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `purchase_request_review_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `purchase_request_id` int NOT NULL,
  `archived_by` int NOT NULL,
  `reviews` longtext NOT NULL,
  `archived_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pr_review_history` (`purchase_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `purchase_request_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_request_id` int NOT NULL,
  `reviewer_id` int NOT NULL,
  `review_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `review_comment` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pr_reviewer` (`purchase_request_id`,`reviewer_id`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `reviewer_id` (`reviewer_id`),
  KEY `review_status` (`review_status`),
  CONSTRAINT `pr_reviews_pr_fk` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pr_reviews_reviewer_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `purchase_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pr_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_by` int DEFAULT NULL,
  `purpose` text COLLATE utf8mb4_unicode_ci,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `date_needed` date DEFAULT NULL,
  `project` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `project_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Draft','Pending','Pending Admin Processing','Under Admin Review','For Admin Processing','For Procurement Review','For Engineer Review','For Admin Review','For Senior Project Manager Review','For Super Admin Final Approval','On Hold','For Purchase','PO Created','Payment Request Created','Completed','Rejected','Cancelled','Received','Pending Accreditation Review') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `supplier_id` int DEFAULT NULL,
  `supplier_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_number` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_basis` enum('debt','non_debt') COLLATE utf8mb4_unicode_ci DEFAULT 'debt' COMMENT 'Determines if PR leads to Purchase Order (debt) or Payment Order (non_debt)',
  `payment_terms_code` enum('CASH','COD','NET_7','NET_15','NET_30','CUSTOM') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_terms_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_terms_set_by` int DEFAULT NULL,
  `payment_terms_set_at` timestamp NULL DEFAULT NULL,
  `supplier_name` varchar(111) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accreditation_files` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON array of accreditation file paths uploaded by requester',
  `supplier_accredited` tinyint(1) DEFAULT NULL COMMENT '1 if supplier was accredited at time of PR creation, 0 if not, NULL if unknown',
  `is_bypassed` tinyint(1) DEFAULT '0',
  `bypassed_by` int DEFAULT NULL,
  `processed_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pr_number` (`pr_number`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `supplier_id` (`supplier_id`),
  KEY `payment_basis` (`payment_basis`),
  KEY `purchase_requests_payment_terms_set_by_fk` (`payment_terms_set_by`),
  KEY `bypassed_by` (`bypassed_by`),
  CONSTRAINT `purchase_requests_ibfk_1` FOREIGN KEY (`bypassed_by`) REFERENCES `employees` (`id`),
  CONSTRAINT `purchase_requests_payment_terms_set_by_fk` FOREIGN KEY (`payment_terms_set_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `endpoint` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `p256dh` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reimbursement_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reimbursement_id` int NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int DEFAULT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_by` int NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reimbursement_id` (`reimbursement_id`),
  KEY `uploaded_by` (`uploaded_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reimbursement_payment_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reimbursement_id` int NOT NULL,
  `payment_date` date NOT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rmb_payment_date` (`reimbursement_id`,`payment_date`),
  KEY `idx_rps_payment_date` (`payment_date`),
  KEY `fk_rmb_schedule_created_by` (`created_by`),
  CONSTRAINT `fk_rmb_schedule_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rmb_schedule_rmb` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reimbursement_schedule_reminder_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `reminder_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rmb_schedule_reminder` (`schedule_id`,`reminder_type`),
  KEY `idx_rsrl_type_sent_at` (`reminder_type`,`sent_at`),
  CONSTRAINT `fk_rsrl_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `reimbursement_payment_schedules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reimbursements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rmb_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_by` int NOT NULL,
  `payee` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` text COLLATE utf8mb4_unicode_ci,
  `project` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `project_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_number` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_terms_note` text COLLATE utf8mb4_unicode_ci,
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `date_needed` date DEFAULT NULL,
  `status` enum('Draft','Pending','For Procurement Review','For Super Admin Final Approval','On Hold','For Purchase','PO Created','Payment Request Created','Completed','Rejected','Cancelled','Received','For Admin Review','Payment Order Created') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rmb_number` (`rmb_number`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `request_workflow_event_notifications` (
  `event_id` bigint unsigned NOT NULL,
  `recipient_id` int NOT NULL,
  `notification_id` int NOT NULL,
  PRIMARY KEY (`event_id`,`recipient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `request_workflow_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `module` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_id` int NOT NULL,
  `round_id` bigint unsigned DEFAULT NULL,
  `actor_id` int NOT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `recipients` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivered_at` datetime DEFAULT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `next_attempt_at` datetime DEFAULT NULL,
  `last_error` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_workflow_delivery` (`delivered_at`,`next_attempt_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `request_workflow_migration_reviews` (
  `module` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_id` int NOT NULL,
  `reviewed_by` int NOT NULL,
  `linked_documents` json NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `reviewed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`module`,`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `request_workflow_receipts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `module` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_id` int NOT NULL,
  `round_id` bigint unsigned NOT NULL,
  `actor_id` int NOT NULL,
  `event_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stored_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `details` json NOT NULL,
  `verified_by` int DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `review_comment` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_receipt_event` (`module`,`document_id`,`event_key`),
  KEY `round_id` (`round_id`),
  CONSTRAINT `request_workflow_receipts_ibfk_1` FOREIGN KEY (`round_id`) REFERENCES `request_workflow_rounds` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `request_workflow_reviews` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `round_id` bigint unsigned NOT NULL,
  `reviewer_id` int NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `decision` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `comment` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_vote` (`round_id`,`stage`,`reviewer_id`),
  KEY `idx_workflow_reviewer` (`reviewer_id`,`decision`),
  CONSTRAINT `request_workflow_reviews_ibfk_1` FOREIGN KEY (`round_id`) REFERENCES `request_workflow_rounds` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `request_workflow_rounds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `module` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_id` int NOT NULL,
  `round_number` int NOT NULL,
  `owner_id` int NOT NULL,
  `owner_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` decimal(15,2) NOT NULL,
  `stage` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'review',
  `held_stage` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_round` (`module`,`document_id`,`round_number`),
  KEY `idx_workflow_status` (`module`,`status`,`stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_request_payment_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_request_id` int NOT NULL,
  `payment_date` date NOT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sr_payment_date` (`service_request_id`,`payment_date`),
  KEY `idx_srps_payment_date` (`payment_date`),
  KEY `fk_sr_schedule_created_by` (`created_by`),
  CONSTRAINT `fk_sr_schedule_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sr_schedule_sr` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sr_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Format: SRV-YYYY-MM-XXX',
  `requested_by` int NOT NULL,
  `purpose` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Detailed service description',
  `service_type` enum('Rent','Job Order','Contractor','Service','Others') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Service',
  `project` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `project_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_id` int DEFAULT NULL COMMENT 'Selected supplier/contractor',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `date_needed` date DEFAULT NULL,
  `status` enum('Draft','For Procurement Review','For Super Admin Final Approval','Approved','Payment Request Created','Payment Order Created','Rejected','Cancelled','PO Created','Paid','Received','For Engineer Review','For Admin Review','For Senior Project Manager Review','Returned','On Hold','Partial Received','Completed') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `order_number` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_terms_note` text COLLATE utf8mb4_unicode_ci,
  `sr_type` enum('payment_request','payment_order') COLLATE utf8mb4_unicode_ci DEFAULT 'payment_request' COMMENT 'Type: payment_request (amount+qty) vs payment_order (amount only)',
  `quantity` decimal(10,2) DEFAULT NULL COMMENT 'Quantity for payment_request type',
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Unit of measurement (e.g., pcs, hours, days)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sr_number` (`sr_number`),
  KEY `requested_by` (`requested_by`),
  KEY `supplier_id` (`supplier_id`),
  KEY `approved_by` (`approved_by`),
  KEY `status` (`status`),
  KEY `service_type` (`service_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_schedule_reminder_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `reminder_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sr_schedule_reminder` (`schedule_id`,`reminder_type`),
  KEY `idx_ssrl_type_sent_at` (`reminder_type`,`sent_at`),
  CONSTRAINT `fk_ssrl_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `service_request_payment_schedules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `supplier_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int NOT NULL,
  `item_id` int NOT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `lead_time_days` int DEFAULT NULL COMMENT 'Estimated delivery time in days',
  `is_preferred` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_supplier_item` (`supplier_id`,`item_id`),
  KEY `item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_person` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `status` enum('Active','Inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `accredited` tinyint(1) DEFAULT '0' COMMENT '1 if supplier is accredited/legit, 0 if not accredited/fake',
  `accredited_by` int DEFAULT NULL COMMENT 'Employee who accredited the supplier',
  `accredited_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp when supplier was accredited',
  `accreditation_files` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON array of accreditation file paths',
  `accreditation_notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Notes about accreditation documents',
  `rating_delivery` decimal(3,2) DEFAULT NULL,
  `rating_quality` decimal(3,2) DEFAULT NULL,
  `rating_pricing` decimal(3,2) DEFAULT NULL,
  `performance_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_code` (`supplier_code`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_accredited_by` (`accredited_by`),
  CONSTRAINT `fk_accredited_by` FOREIGN KEY (`accredited_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `system_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_push_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_token` (`user_id`,`token`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
