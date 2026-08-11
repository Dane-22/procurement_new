-- Add payment_basis to purchase_requests
ALTER TABLE `purchase_requests` 
ADD COLUMN `payment_basis` enum('debt','non_debt') DEFAULT 'debt' 
COMMENT 'Determines if PR leads to Purchase Order (debt) or Payment Request (non_debt)';

-- Add po_type to purchase_orders
ALTER TABLE `purchase_orders` 
ADD COLUMN `po_type` enum('purchase_order','payment_order') DEFAULT 'purchase_order' 
COMMENT 'Type of PO: purchase_order (debt) or payment_order (Payment Request for non_debt/prepaid)';

-- Update purchase_orders status enum
ALTER TABLE `purchase_orders` 
MODIFY `status` enum('Draft','Pending Approval','Approved','On Hold','Ordered','Delivered','Paid','Cancelled') DEFAULT 'Draft';

-- Create service_requests Table
CREATE TABLE `service_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sr_number` varchar(50) NOT NULL COMMENT 'Format: SRV-YYYY-MM-XXX',
  `requested_by` int(11) NOT NULL,
  `purpose` text NOT NULL,
  `description` text DEFAULT NULL COMMENT 'Detailed service description',
  `service_type` enum('Rent','Job Order','Contractor','Service','Others') NOT NULL DEFAULT 'Service',
  `sr_type` enum('payment_request','payment_order') DEFAULT 'payment_request' COMMENT 'Type: payment_request (amount+qty) vs payment_order (amount only)',
  `quantity` decimal(10,2) DEFAULT NULL COMMENT 'Quantity for payment_request type',
  `unit` varchar(20) DEFAULT NULL COMMENT 'Unit of measurement (e.g., pcs, hours, days)',
  `project` varchar(100) DEFAULT NULL,
  `project_address` varchar(255) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL COMMENT 'Selected supplier/contractor',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `date_needed` date DEFAULT NULL,
  `status` enum('Draft','Pending','For Approval','Approved','Rejected','Cancelled','PO Created','Paid') DEFAULT 'Draft',
  `remarks` text DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `order_number` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sr_number` (`sr_number`),
  KEY `requested_by` (`requested_by`),
  KEY `supplier_id` (`supplier_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `service_requests_ibfk_1` FOREIGN KEY (`requested_by`) REFERENCES `employees` (`id`),
  CONSTRAINT `service_requests_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `service_requests_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add service_request_id as alternative to purchase_order_id
ALTER TABLE `disbursement_vouchers` 
ADD COLUMN `service_request_id` int(11) DEFAULT NULL AFTER `purchase_request_id`,
ADD COLUMN `dv_type` enum('po_based','sr_based') DEFAULT 'po_based' COMMENT 'Source of DV: PO or Service Request',
ADD KEY `service_request_id` (`service_request_id`),
ADD CONSTRAINT `disbursement_vouchers_ibfk_7` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE;

-- Make purchase_order_id nullable since DV can come from Service Request
ALTER TABLE `disbursement_vouchers` 
MODIFY `purchase_order_id` int(11) DEFAULT NULL;

-- Add service_request_id to purchase_orders for service request flow
ALTER TABLE `purchase_orders` 
ADD COLUMN `service_request_id` int(11) DEFAULT NULL AFTER `purchase_request_id`,
ADD KEY `service_request_id` (`service_request_id`),
ADD CONSTRAINT `purchase_orders_ibfk_4` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`);
