-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: May 30, 2026 at 12:40 AM
-- Server version: 8.4.7
-- PHP Version: 8.3.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `procurement_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `cash_requests`
--

DROP TABLE IF EXISTS `cash_requests`;
CREATE TABLE IF NOT EXISTS `cash_requests` (
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
  `status` enum('Draft','For Procurement Review','For Super Admin Final Approval','Approved','Cash Request Created','On Hold','Rejected','Received') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_general_ci,
  `rejection_reason` text COLLATE utf8mb4_general_ci,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cr_number` (`cr_number`),
  KEY `supplier_id` (`supplier_id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_cr_status` (`status`),
  KEY `idx_cr_requested_by` (`requested_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cash_request_payment_schedules`
--

DROP TABLE IF EXISTS `cash_request_payment_schedules`;
CREATE TABLE IF NOT EXISTS `cash_request_payment_schedules` (
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
  KEY `fk_cr_schedule_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cash_schedule_reminder_logs`
--

DROP TABLE IF EXISTS `cash_schedule_reminder_logs`;
CREATE TABLE IF NOT EXISTS `cash_schedule_reminder_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `reminder_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cr_schedule_reminder` (`schedule_id`,`reminder_type`),
  KEY `idx_csrl_type_sent_at` (`reminder_type`,`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('Active','Inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_name` (`category_name`),
  KEY `created_by` (`created_by`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `category_name`, `description`, `status`, `created_by`, `created_at`) VALUES
(1, 'Electronics', 'Computers, monitors, printers, and IT accessories', 'Active', NULL, '2026-05-22 02:01:44'),
(2, 'Office Supplies', 'Paper, pens, folders, and general stationery', 'Active', NULL, '2026-05-22 02:01:44'),
(3, 'Safety Equipment', 'PPE, helmets, gloves, vests, and site safety gear', 'Active', NULL, '2026-05-22 02:01:44'),
(4, 'Tools & Hardware', 'Hand tools, power tools, fasteners, and hardware', 'Active', NULL, '2026-05-22 02:01:44'),
(5, 'Raw Materials', 'Cement, steel, lumber, aggregates, and building materials', 'Active', NULL, '2026-05-22 02:01:44'),
(6, 'Electrical', 'Wiring, breakers, outlets, lighting, and electrical fittings', 'Active', NULL, '2026-05-22 02:01:44'),
(7, 'Plumbing', 'Pipes, fittings, valves, and plumbing fixtures', 'Active', NULL, '2026-05-22 02:01:44'),
(8, 'Paint & Finishing', 'Paint, primer, brushes, rollers, and surface prep supplies', 'Active', NULL, '2026-05-22 02:01:44'),
(9, 'Heavy Equipment Parts', 'Spare parts and consumables for machinery and vehicles', 'Active', NULL, '2026-05-22 02:01:44'),
(10, 'Cleaning & Janitorial', 'Cleaning chemicals, mops, trash bags, and hygiene supplies', 'Active', NULL, '2026-05-22 02:01:44'),
(11, 'Furniture & Fixtures', 'Desks, chairs, cabinets, and office/site furniture', 'Active', NULL, '2026-05-22 02:01:44'),
(12, 'Packaging & Shipping', 'Boxes, pallets, tape, and shipping materials', 'Active', NULL, '2026-05-22 02:01:44');

-- --------------------------------------------------------

--
-- Table structure for table `disbursement_vouchers`
--

DROP TABLE IF EXISTS `disbursement_vouchers`;
CREATE TABLE IF NOT EXISTS `disbursement_vouchers` (
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
  KEY `fk_dv_payment_order` (`payment_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
CREATE TABLE IF NOT EXISTS `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_no` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middle_initial` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('engineer','procurement','admin','super_admin') COLLATE utf8mb4_unicode_ci DEFAULT 'engineer',
  `department` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_no` (`employee_no`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employees`
--

INSERT INTO `employees` (`id`, `employee_no`, `first_name`, `middle_initial`, `last_name`, `role`, `department`, `password`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'EMP-0001', 'John', 'D', 'Doe', 'super_admin', 'Executive Office', '$2y$10$xyzMockPasswordHashForTestingOnly', 0, '2026-05-22 02:45:35', '2026-05-29 01:31:47'),
(2, 'EMP-0002', 'Alice', 'M', 'Smith', 'procurement', 'Procurement Department', '$2y$10$xyzMockPasswordHashForTestingOnly', 0, '2026-05-22 02:45:35', '2026-05-29 01:31:43'),
(3, 'EMP-0003', 'Robert', 'L', 'Green', 'engineer', 'Civil Engineering', '$2y$10$xyzMockPasswordHashForTestingOnly', 0, '2026-05-22 02:45:35', '2026-05-29 01:31:50'),
(4, 'EMP-0004', 'Emily', 'S', 'Davis', 'admin', 'Finance & Administration', '$2y$10$xyzMockPasswordHashForTestingOnly', 0, '2026-05-22 02:45:35', '2026-05-29 01:31:52'),
(5, 'ENG-2026-0001', 'Michelle', 'T', 'Norial', 'engineer', 'Engineering', '$2a$10$te379KJk9Z8nAgG9hr1Ct.HuvvOC2sSt.i7YTr7IQEBfp1e2FylBK', 1, '2026-02-10 02:36:33', '2026-02-12 02:21:26'),
(6, 'PRO-2026-0001', 'Junnel', 'B', 'Tadina', 'procurement', 'Procurement', '$2a$10$gqG3xZE0xaT/aA5BvUMpJeVQ3vbYoOoiqS2QP7HBC3XZwm.4qusQu', 1, '2026-02-10 02:36:33', '2026-02-11 04:13:17'),
(7, 'ADMIN-2026-0001', 'Elain', 'M', 'Torres', 'admin', 'Administration', '$2a$10$gqG3xZE0xaT/aA5BvUMpJeVQ3vbYoOoiqS2QP7HBC3XZwm.4qusQu', 1, '2026-02-10 02:36:33', '2026-02-12 02:48:40'),
(8, 'SA-2026-004', 'Marc', 'J', 'Arzadon', 'super_admin', 'Management', '$2a$10$axW..03rjtzmDLOgyvn2ceyJResqKMyiyWQD7vYUa3gmTWvRqaENq', 1, '2026-02-10 02:36:33', '2026-04-14 01:20:11'),
(9, 'ENG-2026-0002', 'John Kennedy', 'K', 'Lucas', 'engineer', 'Engineering', '$2a$10$5WmbWmSvEq3gBe8cdW3RPefxhH6mQebKZ5/FYQ9FZd0WgLJdp6hDe', 1, '2026-02-10 04:42:55', '2026-02-11 04:13:26'),
(10, 'SA001', 'Super', 'D', 'Adminesu', 'super_admin', 'Management', '$2a$10$2VAa8J7EZDnfspG1/t4G1ez6MXGEnf3DLiPNqcJEm4ypE0p9RATNq', 1, '2026-02-12 00:55:00', '2026-02-12 02:48:05'),
(11, 'ENG-2026-0003', 'Julius John', 'F', 'Echague', 'engineer', 'Engineering', '$2a$10$SgSe2J/dqlMH.uPUVkXYQePzJfBd744bL2THGSA3x1B6Wm53oJlMC', 1, '2026-02-12 02:44:49', '2026-02-12 02:50:14'),
(12, 'ENG-2026-0005', 'Joylene', 'F', 'Balanon', 'engineer', 'Engineering', '$2a$10$fFUgVn7r1fE8YPLnwcTDZOhWhEhjxY1gg3rULIps0uoMBVsBE95W.', 1, '2026-02-12 02:45:21', '2026-02-12 02:50:16'),
(13, 'ENG-2026-0006', 'Winnielyn Kaye', 'W', 'Olarte', 'engineer', 'Procurement', '$2a$10$.GDmwlv/XvEmPJzt3oIb0.39RVYiJMsxBwcTaMbmFInk3th76KpIu', 1, '2026-02-12 02:45:41', '2026-02-12 02:54:11'),
(14, 'ADMIN-2026-0002', 'Ronalyn', 'W', 'Mallare', 'admin', 'Administration', '$2a$10$zZXZI/tYRPS37ZQVDeThpeaBi5uCv1P1e1EsBkScqRmt/1.iZPFWK', 1, '2026-02-12 02:46:45', '2026-02-12 02:50:21'),
(15, 'ADMIN-2026-0003', 'Admin', 'G', 'Charisse', 'admin', 'Administration', '$2a$10$a1JGadOlyuKzlNVK.ydC0ucBTKkg8c8u1CyNBmlLRDI.SzKKYXtOK', 1, '2026-02-12 02:47:14', '2026-02-12 02:50:24'),
(16, 'ADMIN-2026-0004', 'Marjorie', 'O', 'Garcia', 'admin', 'Administration', '$2a$10$pj5HrIzaIYIkWlCbcOy9sOBNxrQitgV2.Umuh.wldfJWEYy5t0Ta6', 1, '2026-02-12 02:47:46', '2026-02-12 02:50:28'),
(18, 'SA-2026-002', 'Lee Aldrich', 'M', 'Rimando', 'super_admin', 'Management', '$2a$10$iak0MDLyC1X9FVzCK0OjDeyOjQNF2h.sV8rWkQtt/r4KXzuAe6/zC', 1, '2026-04-14 01:11:27', '2026-04-14 01:11:27');

-- --------------------------------------------------------

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
CREATE TABLE IF NOT EXISTS `items` (
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_code` (`item_code`),
  UNIQUE KEY `item_name` (`item_name`),
  KEY `category_id` (`category_id`),
  KEY `created_by` (`created_by`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `items`
--

INSERT INTO `items` (`id`, `item_code`, `item_name`, `description`, `category_id`, `unit`, `created_by`, `status`, `created_at`, `updated_at`) VALUES
(1, 'sdfgsdfg', 'sdfgsdg', 'sadgfs', 10, 'pcs', 8, 'Active', '2026-05-22 02:01:54', '2026-05-22 02:01:54'),
(2, 'asefsdfgdsg', 'dsfgdf', 'afrwfasdtgsdg', 10, 'set', 8, 'Active', '2026-05-22 02:02:38', '2026-05-22 02:02:38'),
(3, 'ITM001', 'Laptop Dell Latitude', 'Business laptop 15.6 inch', 1, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(4, 'ITM002', 'Wireless Mouse', 'USB wireless mouse', 1, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(5, 'ITM003', 'A4 Paper (Ream)', 'Premium quality A4 paper', 2, 'ream', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(6, 'ITM004', 'Ballpen Blue (Box)', 'Box of 12 blue ballpens', 2, 'box', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(7, 'ITM005', 'Safety Helmet', 'Hard hat for construction', 3, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(8, 'ITM006', 'Safety Vest Reflective', 'High-vis safety vest', 3, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(9, 'ITM007', 'Cordless Drill 18V', 'Cordless drill driver', 4, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(10, 'ITM008', 'Hammer Claw 16oz', 'Fiberglass handle hammer', 4, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(11, 'ITM009', 'Portland Cement 40kg', 'Type I cement bag', 5, 'bag', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(12, 'ITM010', 'Steel Rod 10mm', 'Deformed steel bar', 5, 'length', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(13, 'ITM011', 'THHN Wire 2.0mm', 'Electrical building wire roll', 6, 'roll', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(14, 'ITM012', 'Circuit Breaker 20A', 'Single pole breaker', 6, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(15, 'ITM013', 'PVC Pipe 2 inch', '6m Schedule 40 PVC pipe', 7, 'length', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(16, 'ITM014', 'Gate Valve 1 inch', 'Brass gate valve', 7, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(17, 'ITM015', 'Latex Paint White 4L', 'White latex paint', 8, 'gal', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(18, 'ITM016', 'Paint Roller 9 inch', 'Foam roller', 8, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(19, 'ITM017', 'Hydraulic Oil 46', '20L hydraulic fluid', 9, 'drum', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(20, 'ITM018', 'Floor Cleaner 5L', 'Industrial floor cleaner', 10, 'bottle', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(21, 'ITM019', 'Office Chair Ergonomic', 'Mesh office chair', 11, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05'),
(22, 'ITM020', 'Carton Box Medium', 'Corrugated shipping box', 12, 'pcs', NULL, 'Active', '2026-05-22 02:03:05', '2026-05-22 02:03:05');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
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
  KEY `recipient_id` (`recipient_id`)
) ENGINE=InnoDB AUTO_INCREMENT=175 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `recipient_id`, `title`, `message`, `type`, `related_id`, `related_type`, `is_read`, `created_at`) VALUES
(1, 2, 'New PR Created', 'Purchase Request JBT-2026-05-001 has been created and is ready for your review', 'PR Created', 2, 'purchase_request', 0, '2026-05-25 08:48:08'),
(2, 6, 'New PR Created', 'Purchase Request JBT-2026-05-001 has been created and is ready for your review', 'PR Created', 2, 'purchase_request', 0, '2026-05-25 08:48:08'),
(3, 2, 'New PR Created', 'Purchase Request MTN-2026-05-001 has been created and is ready for your review', 'PR Created', 3, 'purchase_request', 0, '2026-05-26 04:53:06'),
(4, 6, 'New PR Created', 'Purchase Request MTN-2026-05-001 has been created and is ready for your review', 'PR Created', 3, 'purchase_request', 0, '2026-05-26 04:53:06'),
(5, 2, 'New PR Created', 'Purchase Request MTN-2026-05-002 has been created and is ready for your review', 'PR Created', 4, 'purchase_request', 0, '2026-05-26 05:07:24'),
(6, 6, 'New PR Created', 'Purchase Request MTN-2026-05-002 has been created and is ready for your review', 'PR Created', 4, 'purchase_request', 0, '2026-05-26 05:07:24'),
(7, 2, 'New PR Created', 'Purchase Request MTN-2026-05-003 has been created and is ready for your review', 'PR Created', 5, 'purchase_request', 0, '2026-05-26 05:10:24'),
(8, 6, 'New PR Created', 'Purchase Request MTN-2026-05-003 has been created and is ready for your review', 'PR Created', 5, 'purchase_request', 0, '2026-05-26 05:10:24'),
(9, 2, 'New PR Created', 'Purchase Request MTN-2026-05-004 has been created and is ready for your review', 'PR Created', 6, 'purchase_request', 0, '2026-05-26 05:11:48'),
(10, 6, 'New PR Created', 'Purchase Request MTN-2026-05-004 has been created and is ready for your review', 'PR Created', 6, 'purchase_request', 0, '2026-05-26 05:11:48'),
(11, 2, 'New PR Created', 'Purchase Request JBT-2026-05-002 has been created and is ready for your review', 'PR Created', 7, 'purchase_request', 0, '2026-05-26 05:28:19'),
(12, 6, 'New PR Created', 'Purchase Request JBT-2026-05-002 has been created and is ready for your review', 'PR Created', 7, 'purchase_request', 0, '2026-05-26 05:28:19'),
(13, 2, 'New PR Created', 'Purchase Request JBT-2026-05-003 has been created and is ready for your review', 'PR Created', 8, 'purchase_request', 0, '2026-05-26 05:31:05'),
(14, 6, 'New PR Created', 'Purchase Request JBT-2026-05-003 has been created and is ready for your review', 'PR Created', 8, 'purchase_request', 0, '2026-05-26 05:31:05'),
(15, 2, 'New PR Created', 'Purchase Request MTN-2026-05-005 has been created and is ready for your review', 'PR Created', 9, 'purchase_request', 0, '2026-05-26 05:35:10'),
(16, 6, 'New PR Created', 'Purchase Request MTN-2026-05-005 has been created and is ready for your review', 'PR Created', 9, 'purchase_request', 0, '2026-05-26 05:35:10'),
(17, 2, 'New PR Created', 'Purchase Request MTN-2026-05-006 has been created and is ready for your review', 'PR Created', 10, 'purchase_request', 0, '2026-05-26 05:48:41'),
(18, 6, 'New PR Created', 'Purchase Request MTN-2026-05-006 has been created and is ready for your review', 'PR Created', 10, 'purchase_request', 0, '2026-05-26 05:48:41'),
(19, 2, 'New PR Created', 'Purchase Request MTN-2026-05-007 has been created and is ready for your review', 'PR Created', 11, 'purchase_request', 0, '2026-05-26 05:55:56'),
(20, 6, 'New PR Created', 'Purchase Request MTN-2026-05-007 has been created and is ready for your review', 'PR Created', 11, 'purchase_request', 0, '2026-05-26 05:55:56'),
(21, 2, 'New PR Created', 'Purchase Request MTN-2026-05-008 has been created and is ready for your review', 'PR Created', 12, 'purchase_request', 0, '2026-05-26 05:59:11'),
(22, 6, 'New PR Created', 'Purchase Request MTN-2026-05-008 has been created and is ready for your review', 'PR Created', 12, 'purchase_request', 0, '2026-05-26 05:59:11'),
(23, 2, 'New PR Created', 'Purchase Request 2026-05-001 has been created and is ready for your review', 'PR Created', 13, 'purchase_request', 0, '2026-05-26 06:05:47'),
(24, 6, 'New PR Created', 'Purchase Request 2026-05-001 has been created and is ready for your review', 'PR Created', 13, 'purchase_request', 0, '2026-05-26 06:05:47'),
(25, 2, 'New PR Created', 'Purchase Request 2026-05-002 has been created and is ready for your review', 'PR Created', 14, 'purchase_request', 0, '2026-05-26 08:44:26'),
(26, 6, 'New PR Created', 'Purchase Request 2026-05-002 has been created and is ready for your review', 'PR Created', 14, 'purchase_request', 0, '2026-05-26 08:44:26'),
(27, 2, 'New PR Created', 'Purchase Request 2026-05-003 has been created and is ready for your review', 'PR Created', 15, 'purchase_request', 0, '2026-05-26 08:53:32'),
(28, 6, 'New PR Created', 'Purchase Request 2026-05-003 has been created and is ready for your review', 'PR Created', 15, 'purchase_request', 0, '2026-05-26 08:53:32'),
(29, 2, 'New PR Created', 'Purchase Request 2026-05-004 has been created and is ready for your review', 'PR Created', 16, 'purchase_request', 0, '2026-05-29 00:25:27'),
(30, 6, 'New PR Created', 'Purchase Request 2026-05-004 has been created and is ready for your review', 'PR Created', 16, 'purchase_request', 0, '2026-05-29 00:25:27'),
(31, 3, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(32, 5, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(33, 9, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(34, 11, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 1, '2026-05-29 00:52:55'),
(35, 12, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(36, 13, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(37, 2, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(38, 6, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(39, 1, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(40, 8, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(41, 10, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(42, 18, 'New PR Created', 'Purchase Request 2026-05-005 has been created and is ready for your review', 'PR Created', 17, 'purchase_request', 0, '2026-05-29 00:52:55'),
(43, 3, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(44, 5, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(45, 9, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(46, 11, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(47, 12, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(48, 13, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(49, 2, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(50, 6, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(51, 1, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(52, 8, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(53, 10, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(54, 18, 'New PR Created', 'Purchase Request 2026-05-006 has been created and is ready for your review', 'PR Created', 18, 'purchase_request', 0, '2026-05-29 00:59:33'),
(55, 3, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(56, 5, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(57, 9, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(58, 11, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(59, 12, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(60, 13, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(61, 2, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(62, 6, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(63, 1, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(64, 8, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(65, 10, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(66, 18, 'New PR Created', 'Purchase Request 2026-05-007 has been created and is ready for your review', 'PR Created', 19, 'purchase_request', 0, '2026-05-29 01:00:48'),
(67, 3, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(68, 9, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(69, 11, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(70, 12, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(71, 13, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(72, 2, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(73, 6, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(74, 1, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(75, 8, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(76, 10, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(77, 18, 'New PR Created', 'Purchase Request 2026-05-008 has been created and is ready for your review', 'PR Created', 20, 'purchase_request', 0, '2026-05-29 01:04:15'),
(78, 3, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(79, 9, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(80, 11, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(81, 12, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(82, 13, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(83, 2, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(84, 6, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(85, 1, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(86, 8, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(87, 10, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(88, 18, 'New PR Created', 'Purchase Request 2026-05-009 has been created and is ready for your review', 'PR Created', 21, 'purchase_request', 0, '2026-05-29 01:07:23'),
(89, 3, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(90, 9, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(91, 11, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(92, 12, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(93, 13, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(94, 2, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(95, 6, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(96, 1, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(97, 8, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(98, 10, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(99, 18, 'New PR Created', 'Purchase Request 2026-05-010 has been created and is ready for your review', 'PR Created', 22, 'purchase_request', 0, '2026-05-29 01:11:48'),
(100, 3, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(101, 9, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(102, 11, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(103, 12, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(104, 13, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(105, 2, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(106, 6, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(107, 1, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(108, 8, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(109, 10, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(110, 18, 'New PR Created', 'Purchase Request 2026-05-011 has been created and is ready for your review', 'PR Created', 23, 'purchase_request', 0, '2026-05-29 01:13:39'),
(111, 3, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(112, 9, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(113, 11, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(114, 12, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(115, 13, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(116, 2, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(117, 6, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(118, 1, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(119, 8, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(120, 10, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(121, 18, 'New PR Created', 'Purchase Request 2026-05-012 has been created and is ready for your review', 'PR Created', 24, 'purchase_request', 0, '2026-05-29 01:18:36'),
(122, 9, 'New PR Created', 'Purchase Request 2026-05-013 has been created and is ready for your review', 'PR Created', 25, 'purchase_request', 0, '2026-05-29 01:37:31'),
(123, 11, 'New PR Created', 'Purchase Request 2026-05-013 has been created and is ready for your review', 'PR Created', 25, 'purchase_request', 0, '2026-05-29 01:37:31'),
(124, 12, 'New PR Created', 'Purchase Request 2026-05-013 has been created and is ready for your review', 'PR Created', 25, 'purchase_request', 0, '2026-05-29 01:37:31'),
(125, 13, 'New PR Created', 'Purchase Request 2026-05-013 has been created and is ready for your review', 'PR Created', 25, 'purchase_request', 0, '2026-05-29 01:37:31'),
(126, 6, 'New PR Created', 'Purchase Request 2026-05-013 has been created and is ready for your review', 'PR Created', 25, 'purchase_request', 0, '2026-05-29 01:37:31'),
(127, 8, 'New PR Created', 'Purchase Request 2026-05-013 has been created and is ready for your review', 'PR Created', 25, 'purchase_request', 0, '2026-05-29 01:37:31'),
(128, 10, 'New PR Created', 'Purchase Request 2026-05-013 has been created and is ready for your review', 'PR Created', 25, 'purchase_request', 0, '2026-05-29 01:37:31'),
(129, 18, 'New PR Created', 'Purchase Request 2026-05-013 has been created and is ready for your review', 'PR Created', 25, 'purchase_request', 0, '2026-05-29 01:37:31'),
(130, 9, 'New PR Created', 'Purchase Request 2026-05-014 has been created and is ready for your review', 'PR Created', 26, 'purchase_request', 0, '2026-05-29 01:41:29'),
(131, 11, 'New PR Created', 'Purchase Request 2026-05-014 has been created and is ready for your review', 'PR Created', 26, 'purchase_request', 0, '2026-05-29 01:41:29'),
(132, 12, 'New PR Created', 'Purchase Request 2026-05-014 has been created and is ready for your review', 'PR Created', 26, 'purchase_request', 0, '2026-05-29 01:41:29'),
(133, 13, 'New PR Created', 'Purchase Request 2026-05-014 has been created and is ready for your review', 'PR Created', 26, 'purchase_request', 0, '2026-05-29 01:41:29'),
(134, 6, 'New PR Created', 'Purchase Request 2026-05-014 has been created and is ready for your review', 'PR Created', 26, 'purchase_request', 0, '2026-05-29 01:41:29'),
(135, 8, 'New PR Created', 'Purchase Request 2026-05-014 has been created and is ready for your review', 'PR Created', 26, 'purchase_request', 0, '2026-05-29 01:41:29'),
(136, 10, 'New PR Created', 'Purchase Request 2026-05-014 has been created and is ready for your review', 'PR Created', 26, 'purchase_request', 0, '2026-05-29 01:41:29'),
(137, 18, 'New PR Created', 'Purchase Request 2026-05-014 has been created and is ready for your review', 'PR Created', 26, 'purchase_request', 0, '2026-05-29 01:41:29'),
(138, 6, 'PR Ready for Procurement Review', 'Purchase Request 2026-05-014 has been reviewed by admins and is ready for procurement review', 'PR Review', 26, 'purchase_request', 0, '2026-05-29 01:42:06'),
(139, 8, 'PR Ready for Final Approval', 'Purchase Request 2026-05-014 has been reviewed by all required reviewers and is ready for your final approval', 'PR Review', 26, 'purchase_request', 0, '2026-05-29 01:42:12'),
(140, 10, 'PR Ready for Final Approval', 'Purchase Request 2026-05-014 has been reviewed by all required reviewers and is ready for your final approval', 'PR Review', 26, 'purchase_request', 0, '2026-05-29 01:42:12'),
(141, 18, 'PR Ready for Final Approval', 'Purchase Request 2026-05-014 has been reviewed by all required reviewers and is ready for your final approval', 'PR Review', 26, 'purchase_request', 0, '2026-05-29 01:42:12'),
(142, 9, 'New PR Created', 'Purchase Request 2026-05-015 has been created and is ready for your review', 'PR Created', 27, 'purchase_request', 0, '2026-05-29 01:45:45'),
(143, 11, 'New PR Created', 'Purchase Request 2026-05-015 has been created and is ready for your review', 'PR Created', 27, 'purchase_request', 0, '2026-05-29 01:45:45'),
(144, 12, 'New PR Created', 'Purchase Request 2026-05-015 has been created and is ready for your review', 'PR Created', 27, 'purchase_request', 0, '2026-05-29 01:45:45'),
(145, 13, 'New PR Created', 'Purchase Request 2026-05-015 has been created and is ready for your review', 'PR Created', 27, 'purchase_request', 0, '2026-05-29 01:45:45'),
(146, 6, 'New PR Created', 'Purchase Request 2026-05-015 has been created and is ready for your review', 'PR Created', 27, 'purchase_request', 0, '2026-05-29 01:45:45'),
(147, 8, 'New PR Created', 'Purchase Request 2026-05-015 has been created and is ready for your review', 'PR Created', 27, 'purchase_request', 0, '2026-05-29 01:45:45'),
(148, 10, 'New PR Created', 'Purchase Request 2026-05-015 has been created and is ready for your review', 'PR Created', 27, 'purchase_request', 0, '2026-05-29 01:45:45'),
(149, 18, 'New PR Created', 'Purchase Request 2026-05-015 has been created and is ready for your review', 'PR Created', 27, 'purchase_request', 0, '2026-05-29 01:45:45'),
(150, 2, 'PO Approved - Order Placed', 'Your Purchase Order has been approved and placed. Related PR: PR-2026-05-001', 'PO Created', 1, 'purchase_order', 0, '2026-05-29 01:45:51'),
(151, 9, 'New PR Created', 'Purchase Request 2026-05-016 has been created and is ready for your review', 'PR Created', 28, 'purchase_request', 0, '2026-05-29 01:46:17'),
(152, 11, 'New PR Created', 'Purchase Request 2026-05-016 has been created and is ready for your review', 'PR Created', 28, 'purchase_request', 0, '2026-05-29 01:46:17'),
(153, 12, 'New PR Created', 'Purchase Request 2026-05-016 has been created and is ready for your review', 'PR Created', 28, 'purchase_request', 0, '2026-05-29 01:46:17'),
(154, 13, 'New PR Created', 'Purchase Request 2026-05-016 has been created and is ready for your review', 'PR Created', 28, 'purchase_request', 0, '2026-05-29 01:46:17'),
(155, 6, 'New PR Created', 'Purchase Request 2026-05-016 has been created and is ready for your review', 'PR Created', 28, 'purchase_request', 0, '2026-05-29 01:46:17'),
(156, 8, 'New PR Created', 'Purchase Request 2026-05-016 has been created and is ready for your review', 'PR Created', 28, 'purchase_request', 0, '2026-05-29 01:46:17'),
(157, 10, 'New PR Created', 'Purchase Request 2026-05-016 has been created and is ready for your review', 'PR Created', 28, 'purchase_request', 0, '2026-05-29 01:46:17'),
(158, 18, 'New PR Created', 'Purchase Request 2026-05-016 has been created and is ready for your review', 'PR Created', 28, 'purchase_request', 0, '2026-05-29 01:46:17'),
(159, 9, 'New PR Created', 'Purchase Request 2026-05-017 has been created and is ready for your review', 'PR Created', 29, 'purchase_request', 0, '2026-05-29 01:49:16'),
(160, 11, 'New PR Created', 'Purchase Request 2026-05-017 has been created and is ready for your review', 'PR Created', 29, 'purchase_request', 0, '2026-05-29 01:49:16'),
(161, 12, 'New PR Created', 'Purchase Request 2026-05-017 has been created and is ready for your review', 'PR Created', 29, 'purchase_request', 0, '2026-05-29 01:49:16'),
(162, 13, 'New PR Created', 'Purchase Request 2026-05-017 has been created and is ready for your review', 'PR Created', 29, 'purchase_request', 0, '2026-05-29 01:49:16'),
(163, 6, 'New PR Created', 'Purchase Request 2026-05-017 has been created and is ready for your review', 'PR Created', 29, 'purchase_request', 0, '2026-05-29 01:49:16'),
(164, 8, 'New PR Created', 'Purchase Request 2026-05-017 has been created and is ready for your review', 'PR Created', 29, 'purchase_request', 0, '2026-05-29 01:49:16'),
(165, 10, 'New PR Created', 'Purchase Request 2026-05-017 has been created and is ready for your review', 'PR Created', 29, 'purchase_request', 0, '2026-05-29 01:49:16'),
(166, 18, 'New PR Created', 'Purchase Request 2026-05-017 has been created and is ready for your review', 'PR Created', 29, 'purchase_request', 0, '2026-05-29 01:49:16'),
(167, 9, 'New PR Created', 'Purchase Request 2026-05-018 has been created and is ready for your review', 'PR Created', 30, 'purchase_request', 0, '2026-05-29 01:53:11'),
(168, 11, 'New PR Created', 'Purchase Request 2026-05-018 has been created and is ready for your review', 'PR Created', 30, 'purchase_request', 0, '2026-05-29 01:53:11'),
(169, 12, 'New PR Created', 'Purchase Request 2026-05-018 has been created and is ready for your review', 'PR Created', 30, 'purchase_request', 0, '2026-05-29 01:53:11'),
(170, 13, 'New PR Created', 'Purchase Request 2026-05-018 has been created and is ready for your review', 'PR Created', 30, 'purchase_request', 0, '2026-05-29 01:53:11'),
(171, 6, 'New PR Created', 'Purchase Request 2026-05-018 has been created and is ready for your review', 'PR Created', 30, 'purchase_request', 0, '2026-05-29 01:53:11'),
(172, 8, 'New PR Created', 'Purchase Request 2026-05-018 has been created and is ready for your review', 'PR Created', 30, 'purchase_request', 0, '2026-05-29 01:53:11'),
(173, 10, 'New PR Created', 'Purchase Request 2026-05-018 has been created and is ready for your review', 'PR Created', 30, 'purchase_request', 0, '2026-05-29 01:53:11'),
(174, 18, 'New PR Created', 'Purchase Request 2026-05-018 has been created and is ready for your review', 'PR Created', 30, 'purchase_request', 0, '2026-05-29 01:53:11');

-- --------------------------------------------------------

--
-- Table structure for table `order_number_budgets`
--

DROP TABLE IF EXISTS `order_number_budgets`;
CREATE TABLE IF NOT EXISTS `order_number_budgets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `planned_cost` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_project` (`order_number`,`project`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_number_locks`
--

DROP TABLE IF EXISTS `order_number_locks`;
CREATE TABLE IF NOT EXISTS `order_number_locks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `locked_by` int NOT NULL,
  `locked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_number_lock` (`order_number`),
  KEY `idx_locked_by` (`locked_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_orders`
--

DROP TABLE IF EXISTS `payment_orders`;
CREATE TABLE IF NOT EXISTS `payment_orders` (
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
  KEY `fk_po_cash_request` (`cash_request_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_requests`
--

DROP TABLE IF EXISTS `payment_requests`;
CREATE TABLE IF NOT EXISTS `payment_requests` (
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `pr_number` (`pr_number`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `status` (`status`),
  KEY `dv_id` (`dv_id`),
  KEY `idx_service_request_id` (`service_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_request_items`
--

DROP TABLE IF EXISTS `payment_request_items`;
CREATE TABLE IF NOT EXISTS `payment_request_items` (
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
  KEY `item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_schedule_reminder_logs`
--

DROP TABLE IF EXISTS `payment_schedule_reminder_logs`;
CREATE TABLE IF NOT EXISTS `payment_schedule_reminder_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `reminder_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schedule_reminder` (`schedule_id`,`reminder_type`),
  KEY `idx_psrl_type_sent_at` (`reminder_type`,`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `po_attachments`
--

DROP TABLE IF EXISTS `po_attachments`;
CREATE TABLE IF NOT EXISTS `po_attachments` (
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
  KEY `uploaded_by` (`uploaded_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pricing_history`
--

DROP TABLE IF EXISTS `pricing_history`;
CREATE TABLE IF NOT EXISTS `pricing_history` (
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
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pricing_history`
--

INSERT INTO `pricing_history` (`id`, `item_id`, `supplier_id`, `unit_price`, `quantity`, `total_amount`, `purchase_order_id`, `purchase_request_id`, `po_number`, `pr_number`, `date_recorded`, `notes`, `created_by`, `created_at`, `updated_at`) VALUES
(28, 1, 1, 250.00, 100.00, 25000.00, NULL, NULL, NULL, NULL, '2025-01-15', 'Bulk purchase for Project Alpha', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(29, 1, 1, 255.00, 50.00, 12750.00, NULL, NULL, NULL, NULL, '2025-02-20', 'Additional order', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(30, 1, 2, 248.00, 100.00, 24800.00, NULL, NULL, NULL, NULL, '2025-03-10', 'New supplier trial', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(31, 1, 1, 260.00, 75.00, 19500.00, NULL, NULL, NULL, NULL, '2025-04-05', 'Price increase due to demand', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(32, 2, 3, 450.00, 200.00, 90000.00, NULL, NULL, NULL, NULL, '2025-01-10', 'Construction materials', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(33, 2, 3, 445.00, 150.00, 66750.00, NULL, NULL, NULL, NULL, '2025-02-15', 'Negotiated discount', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(34, 2, 1, 455.00, 100.00, 45500.00, NULL, NULL, NULL, NULL, '2025-03-20', 'Emergency restock', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(35, 3, 2, 850.00, 10.00, 8500.00, NULL, NULL, NULL, NULL, '2025-01-20', 'Truck load delivery', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(36, 3, 2, 820.00, 15.00, 12300.00, NULL, NULL, NULL, NULL, '2025-02-25', 'Volume discount applied', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(37, 3, 4, 875.00, 8.00, 7000.00, NULL, NULL, NULL, NULL, '2025-03-15', 'Alternative supplier', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(38, 4, 2, 750.00, 12.00, 9000.00, NULL, NULL, NULL, NULL, '2025-01-25', 'Foundation work', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(39, 4, 2, 740.00, 20.00, 14800.00, NULL, NULL, NULL, NULL, '2025-03-05', 'Large project order', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(40, 5, 4, 1200.00, 25.00, 30000.00, NULL, NULL, NULL, NULL, '2025-02-01', 'Interior painting project', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(41, 5, 4, 1150.00, 30.00, 34500.00, NULL, NULL, NULL, NULL, '2025-03-25', 'Bulk discount negotiated', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(42, 5, 1, 1250.00, 10.00, 12500.00, NULL, NULL, NULL, NULL, '2025-04-10', 'Premium grade paint', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(43, 6, 3, 45.00, 500.00, 22500.00, NULL, NULL, NULL, NULL, '2025-02-10', 'Wiring for new building', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(44, 6, 3, 42.00, 1000.00, 42000.00, NULL, NULL, NULL, NULL, '2025-03-30', 'Large scale project', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(45, 7, 2, 180.00, 50.00, 9000.00, NULL, NULL, NULL, NULL, '2025-01-30', 'Plumbing installation', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(46, 7, 4, 175.00, 75.00, 13125.00, NULL, NULL, NULL, NULL, '2025-03-12', 'Better pricing found', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(47, 7, 2, 185.00, 40.00, 7400.00, NULL, NULL, NULL, NULL, '2025-04-08', 'Quality preferred over price', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(48, 8, 1, 35.00, 1000.00, 35000.00, NULL, NULL, NULL, NULL, '2025-02-20', 'Complete roof replacement', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(49, 8, 1, 33.00, 500.00, 16500.00, NULL, NULL, NULL, NULL, '2025-04-01', 'Loyalty discount', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(50, 9, 4, 2500.00, 20.00, 50000.00, NULL, NULL, NULL, NULL, '2025-03-01', 'Office building windows', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(51, 9, 3, 2450.00, 15.00, 36750.00, NULL, NULL, NULL, NULL, '2025-04-15', 'Competitive bid', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(52, 10, 1, 650.00, 100.00, 65000.00, NULL, NULL, NULL, NULL, '2025-01-05', 'Framing materials', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(53, 10, 1, 625.00, 150.00, 93750.00, NULL, NULL, NULL, NULL, '2025-02-28', 'Volume discount', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(54, 10, 2, 640.00, 80.00, 51200.00, NULL, NULL, NULL, NULL, '2025-04-20', 'Alternative source', NULL, '2026-03-06 07:44:53', '2026-03-06 07:44:53'),
(55, 1, 1, 245.00, 100.00, 24500.00, NULL, NULL, NULL, NULL, '2025-01-15', 'January bulk order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(56, 1, 1, 248.00, 80.00, 19840.00, NULL, NULL, NULL, NULL, '2025-02-10', 'February order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(57, 1, 1, 255.00, 120.00, 30600.00, NULL, NULL, NULL, NULL, '2025-03-20', 'March - price increase', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(58, 1, 1, 252.00, 90.00, 22680.00, NULL, NULL, NULL, NULL, '2025-04-12', 'April order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(59, 1, 1, 260.00, 100.00, 26000.00, NULL, NULL, NULL, NULL, '2025-05-15', 'May - peak season pricing', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(60, 1, 1, 258.00, 110.00, 28380.00, NULL, NULL, NULL, NULL, '2025-06-18', 'June order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(61, 1, 1, 265.00, 95.00, 25175.00, NULL, NULL, NULL, NULL, '2025-07-22', 'July - high demand', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(62, 1, 1, 262.00, 85.00, 22270.00, NULL, NULL, NULL, NULL, '2025-08-14', 'August order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(63, 1, 1, 255.00, 100.00, 25500.00, NULL, NULL, NULL, NULL, '2025-09-16', 'September - price drop', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(64, 1, 1, 250.00, 120.00, 30000.00, NULL, NULL, NULL, NULL, '2025-10-20', 'October bulk order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(65, 1, 1, 248.00, 90.00, 22320.00, NULL, NULL, NULL, NULL, '2025-11-15', 'November order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(66, 1, 1, 252.00, 100.00, 25200.00, NULL, NULL, NULL, NULL, '2025-12-10', 'December year-end order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(67, 1, 2, 242.00, 50.00, 12100.00, NULL, NULL, NULL, NULL, '2025-01-20', 'Jan - Supplier 2 trial', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(68, 1, 2, 245.00, 60.00, 14700.00, NULL, NULL, NULL, NULL, '2025-03-05', 'Mar - Supplier 2', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(69, 1, 2, 250.00, 70.00, 17500.00, NULL, NULL, NULL, NULL, '2025-05-08', 'May - Supplier 2', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(70, 1, 2, 248.00, 55.00, 13640.00, NULL, NULL, NULL, NULL, '2025-07-12', 'Jul - Supplier 2', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(71, 1, 2, 245.00, 80.00, 19600.00, NULL, NULL, NULL, NULL, '2025-09-20', 'Sep - Supplier 2', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(72, 1, 2, 240.00, 65.00, 15600.00, NULL, NULL, NULL, NULL, '2025-11-25', 'Nov - Supplier 2 discount', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(73, 2, 3, 440.00, 150.00, 66000.00, NULL, NULL, NULL, NULL, '2025-01-10', 'January steel order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(74, 2, 3, 445.00, 120.00, 53400.00, NULL, NULL, NULL, NULL, '2025-02-15', 'February steel', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(75, 2, 3, 450.00, 180.00, 81000.00, NULL, NULL, NULL, NULL, '2025-03-25', 'March steel - price up', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(76, 2, 3, 455.00, 140.00, 63700.00, NULL, NULL, NULL, NULL, '2025-04-18', 'April steel', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(77, 2, 3, 460.00, 160.00, 73600.00, NULL, NULL, NULL, NULL, '2025-05-22', 'May steel - peak pricing', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(78, 2, 3, 458.00, 130.00, 59540.00, NULL, NULL, NULL, NULL, '2025-06-14', 'June steel', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(79, 2, 3, 465.00, 170.00, 79050.00, NULL, NULL, NULL, NULL, '2025-07-28', 'July steel - high demand', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(80, 2, 3, 462.00, 145.00, 66990.00, NULL, NULL, NULL, NULL, '2025-08-16', 'August steel', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(81, 2, 3, 455.00, 155.00, 70525.00, NULL, NULL, NULL, NULL, '2025-09-24', 'September steel - slight drop', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(82, 2, 3, 450.00, 175.00, 78750.00, NULL, NULL, NULL, NULL, '2025-10-30', 'October steel', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(83, 2, 3, 448.00, 140.00, 62720.00, NULL, NULL, NULL, NULL, '2025-11-20', 'November steel', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(84, 2, 3, 452.00, 160.00, 72320.00, NULL, NULL, NULL, NULL, '2025-12-15', 'December steel', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(85, 5, 4, 1150.00, 20.00, 23000.00, NULL, NULL, NULL, NULL, '2025-01-08', 'January paint order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(86, 5, 4, 1180.00, 25.00, 29500.00, NULL, NULL, NULL, NULL, '2025-02-14', 'February paint', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(87, 5, 4, 1200.00, 30.00, 36000.00, NULL, NULL, NULL, NULL, '2025-03-22', 'March paint - spring projects', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(88, 5, 4, 1220.00, 35.00, 42700.00, NULL, NULL, NULL, NULL, '2025-04-28', 'April paint - high season', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(89, 5, 4, 1250.00, 40.00, 50000.00, NULL, NULL, NULL, NULL, '2025-05-30', 'May paint - peak season', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(90, 5, 4, 1240.00, 32.00, 39680.00, NULL, NULL, NULL, NULL, '2025-06-18', 'June paint', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(91, 5, 4, 1220.00, 28.00, 34160.00, NULL, NULL, NULL, NULL, '2025-07-25', 'July paint', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(92, 5, 4, 1200.00, 30.00, 36000.00, NULL, NULL, NULL, NULL, '2025-08-20', 'August paint', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(93, 5, 4, 1180.00, 35.00, 41300.00, NULL, NULL, NULL, NULL, '2025-09-26', 'September paint', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(94, 5, 4, 1150.00, 42.00, 48300.00, NULL, NULL, NULL, NULL, '2025-10-15', 'October paint - bulk order', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(95, 5, 4, 1120.00, 38.00, 42560.00, NULL, NULL, NULL, NULL, '2025-11-22', 'November paint - discount', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(96, 5, 4, 1100.00, 45.00, 49500.00, NULL, NULL, NULL, NULL, '2025-12-18', 'December paint - year end sale', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(97, 10, 1, 620.00, 80.00, 49600.00, NULL, NULL, NULL, NULL, '2025-01-12', 'January lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(98, 10, 1, 635.00, 75.00, 47625.00, NULL, NULL, NULL, NULL, '2025-02-18', 'February lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(99, 10, 1, 650.00, 90.00, 58500.00, NULL, NULL, NULL, NULL, '2025-03-24', 'March lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(100, 10, 1, 665.00, 85.00, 56525.00, NULL, NULL, NULL, NULL, '2025-04-16', 'April lumber - price up', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(101, 10, 1, 680.00, 95.00, 64600.00, NULL, NULL, NULL, NULL, '2025-05-28', 'May lumber - peak price', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(102, 10, 1, 675.00, 88.00, 59400.00, NULL, NULL, NULL, NULL, '2025-06-22', 'June lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(103, 10, 1, 660.00, 82.00, 54120.00, NULL, NULL, NULL, NULL, '2025-07-19', 'July lumber - slight drop', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(104, 10, 1, 655.00, 78.00, 51090.00, NULL, NULL, NULL, NULL, '2025-08-25', 'August lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(105, 10, 1, 645.00, 85.00, 54825.00, NULL, NULL, NULL, NULL, '2025-09-17', 'September lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(106, 10, 1, 640.00, 92.00, 58880.00, NULL, NULL, NULL, NULL, '2025-10-24', 'October lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(107, 10, 1, 630.00, 87.00, 54810.00, NULL, NULL, NULL, NULL, '2025-11-21', 'November lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(108, 10, 1, 625.00, 95.00, 59375.00, NULL, NULL, NULL, NULL, '2025-12-16', 'December lumber', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(109, 6, 3, 42.00, 400.00, 16800.00, NULL, NULL, NULL, NULL, '2025-01-25', 'January wire', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(110, 6, 3, 43.00, 380.00, 16340.00, NULL, NULL, NULL, NULL, '2025-02-20', 'February wire', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(111, 6, 3, 44.00, 420.00, 18480.00, NULL, NULL, NULL, NULL, '2025-03-28', 'March wire', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(112, 6, 3, 45.00, 450.00, 20250.00, NULL, NULL, NULL, NULL, '2025-04-22', 'April wire', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(113, 6, 3, 46.00, 480.00, 22080.00, NULL, NULL, NULL, NULL, '2025-05-18', 'May wire', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(114, 6, 3, 45.50, 460.00, 20930.00, NULL, NULL, NULL, NULL, '2025-06-24', 'June wire', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(115, 6, 3, 44.00, 440.00, 19360.00, NULL, NULL, NULL, NULL, '2025-07-30', 'July wire - price drop', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(116, 6, 3, 43.50, 470.00, 20445.00, NULL, NULL, NULL, NULL, '2025-08-26', 'August wire', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(117, 6, 3, 42.00, 500.00, 21000.00, NULL, NULL, NULL, NULL, '2025-09-21', 'September wire - bulk', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(118, 6, 3, 41.00, 520.00, 21320.00, NULL, NULL, NULL, NULL, '2025-10-27', 'October wire - discount', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(119, 6, 3, 40.50, 480.00, 19440.00, NULL, NULL, NULL, NULL, '2025-11-19', 'November wire', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(120, 6, 3, 41.00, 550.00, 22550.00, NULL, NULL, NULL, NULL, '2025-12-28', 'December wire - year end stock', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(121, 7, 2, 175.00, 60.00, 10500.00, NULL, NULL, NULL, NULL, '2025-01-30', 'January pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(122, 7, 2, 178.00, 55.00, 9790.00, NULL, NULL, NULL, NULL, '2025-02-25', 'February pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(123, 7, 2, 180.00, 70.00, 12600.00, NULL, NULL, NULL, NULL, '2025-03-20', 'March pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(124, 7, 2, 182.00, 65.00, 11830.00, NULL, NULL, NULL, NULL, '2025-04-28', 'April pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(125, 7, 2, 185.00, 80.00, 14800.00, NULL, NULL, NULL, NULL, '2025-05-26', 'May pipes - peak season', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(126, 7, 2, 183.00, 72.00, 13176.00, NULL, NULL, NULL, NULL, '2025-06-22', 'June pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(127, 7, 2, 180.00, 68.00, 12240.00, NULL, NULL, NULL, NULL, '2025-07-18', 'July pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(128, 7, 2, 178.00, 75.00, 13350.00, NULL, NULL, NULL, NULL, '2025-08-24', 'August pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(129, 7, 2, 176.00, 62.00, 10912.00, NULL, NULL, NULL, NULL, '2025-09-29', 'September pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(130, 7, 2, 174.00, 85.00, 14790.00, NULL, NULL, NULL, NULL, '2025-10-31', 'October pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(131, 7, 2, 172.00, 78.00, 13416.00, NULL, NULL, NULL, NULL, '2025-11-23', 'November pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(132, 7, 2, 175.00, 90.00, 15750.00, NULL, NULL, NULL, NULL, '2025-12-19', 'December pipes', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(133, 8, 1, 32.00, 800.00, 25600.00, NULL, NULL, NULL, NULL, '2025-01-15', 'January tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(134, 8, 1, 33.00, 750.00, 24750.00, NULL, NULL, NULL, NULL, '2025-02-28', 'February tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(135, 8, 1, 34.00, 900.00, 30600.00, NULL, NULL, NULL, NULL, '2025-03-25', 'March tiles - pre-season', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(136, 8, 1, 35.00, 1000.00, 35000.00, NULL, NULL, NULL, NULL, '2025-04-30', 'April tiles - construction season', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(137, 8, 1, 36.00, 1200.00, 43200.00, NULL, NULL, NULL, NULL, '2025-05-28', 'May tiles - peak season', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(138, 8, 1, 36.50, 1100.00, 40150.00, NULL, NULL, NULL, NULL, '2025-06-26', 'June tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(139, 8, 1, 35.50, 1050.00, 37275.00, NULL, NULL, NULL, NULL, '2025-07-24', 'July tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(140, 8, 1, 34.50, 950.00, 32775.00, NULL, NULL, NULL, NULL, '2025-08-22', 'August tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(141, 8, 1, 34.00, 880.00, 29920.00, NULL, NULL, NULL, NULL, '2025-09-20', 'September tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(142, 8, 1, 33.00, 920.00, 30360.00, NULL, NULL, NULL, NULL, '2025-10-18', 'October tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(143, 8, 1, 32.50, 850.00, 27625.00, NULL, NULL, NULL, NULL, '2025-11-16', 'November tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(144, 8, 1, 33.00, 780.00, 25740.00, NULL, NULL, NULL, NULL, '2025-12-14', 'December tiles', NULL, '2026-03-06 07:52:03', '2026-03-06 07:52:03'),
(145, 2, 4, 0.21, 1.00, 0.21, 15, 32, 'ETN-2026-03-001', 'MTN-2026-03-001', '2026-03-10', 'Auto-recorded from PO ETN-2026-03-001', NULL, '2026-03-10 02:20:27', '2026-03-10 02:20:27'),
(146, 6, 4, 320.00, 1.00, 320.00, 15, 32, 'ETN-2026-03-001', 'MTN-2026-03-001', '2026-03-10', 'Auto-recorded from PO ETN-2026-03-001', NULL, '2026-03-10 02:20:27', '2026-03-10 02:20:27'),
(147, 2, 2, 34.00, 3432.00, 116688.00, 16, 34, 'ETN-2026-03-002', 'EMT-2026-03-001', '2026-03-10', 'Auto-recorded from PO ETN-2026-03-002', NULL, '2026-03-10 02:35:35', '2026-03-10 02:35:35'),
(148, 6, 2, 45.00, 121.00, 5445.00, 16, 34, 'ETN-2026-03-002', 'EMT-2026-03-001', '2026-03-10', 'Auto-recorded from PO ETN-2026-03-002', NULL, '2026-03-10 02:35:35', '2026-03-10 02:35:35'),
(149, 2, 3, 43.00, 1.00, 43.00, 17, 35, 'ETN-2026-03-003', 'WWO-2026-03-001', '2026-03-10', 'Auto-recorded from PO ETN-2026-03-003', NULL, '2026-03-10 06:08:35', '2026-03-10 06:08:35'),
(150, 6, 3, 78.00, 1.00, 78.00, 17, 35, 'ETN-2026-03-003', 'WWO-2026-03-001', '2026-03-10', 'Auto-recorded from PO ETN-2026-03-003', NULL, '2026-03-10 06:08:35', '2026-03-10 06:08:35'),
(151, 173, 4, 100000.00, 1.00, 100000.00, 22, 48, 'ETN-2026-04-001', 'JBT-2026-04-002', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-001', NULL, '2026-04-13 01:54:41', '2026-04-13 01:54:41'),
(152, 173, 4, 100.00, 1.00, 100.00, 23, 49, 'ETN-2026-04-002', 'JBT-2026-04-003', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-002', NULL, '2026-04-13 02:26:16', '2026-04-13 02:26:16'),
(153, 173, 2, 3000.00, 1.00, 3000.00, 24, 51, 'ETN-2026-04-003', 'EMT-2026-04-002', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-003', NULL, '2026-04-13 03:50:34', '2026-04-13 03:50:34'),
(154, 282, 2, 3000.00, 1.00, 3000.00, 24, 51, 'ETN-2026-04-003', 'EMT-2026-04-002', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-003', NULL, '2026-04-13 03:50:34', '2026-04-13 03:50:34'),
(155, 173, 2, 3000.00, 1.00, 3000.00, 25, 52, 'ETN-2026-04-001', 'EMT-2026-04-001', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-001', NULL, '2026-04-13 05:11:27', '2026-04-13 05:11:27'),
(156, 173, 2, 3000.00, 1.00, 3000.00, 28, 52, 'ETN-2026-04-001', 'EMT-2026-04-001', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-001', NULL, '2026-04-13 05:27:43', '2026-04-13 05:27:43'),
(157, 173, 2, 3000.00, 1.00, 3000.00, 31, 52, 'ETN-2026-04-001', 'EMT-2026-04-001', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-001', NULL, '2026-04-13 05:47:09', '2026-04-13 05:47:09'),
(158, 173, 4, 300.00, 1.00, 300.00, 32, 53, 'ETN-2026-04-001', 'EMT-2026-04-001', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-001', NULL, '2026-04-13 07:08:24', '2026-04-13 07:08:24'),
(159, 282, 4, 340.00, 1.00, 340.00, 32, 53, 'ETN-2026-04-001', 'EMT-2026-04-001', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-001', NULL, '2026-04-13 07:08:24', '2026-04-13 07:08:24'),
(160, 290, 4, 560.00, 1.00, 560.00, 32, 53, 'ETN-2026-04-001', 'EMT-2026-04-001', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-001', NULL, '2026-04-13 07:08:24', '2026-04-13 07:08:24'),
(161, 173, 2, 1000.00, 1.00, 1000.00, 33, 54, 'ETN-2026-04-002', 'EMT-2026-04-002', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-002', NULL, '2026-04-13 07:51:37', '2026-04-13 07:51:37'),
(162, 282, 2, 1000.00, 1.00, 1000.00, 33, 54, 'ETN-2026-04-002', 'EMT-2026-04-002', '2026-04-13', 'Auto-recorded from PO ETN-2026-04-002', NULL, '2026-04-13 07:51:37', '2026-04-13 07:51:37'),
(163, 173, 4, 500.00, 1.00, 500.00, 34, 55, 'ETN-2026-04-003', 'MTN-2026-04-001', '2026-04-14', 'Auto-recorded from PO ETN-2026-04-003', NULL, '2026-04-14 01:49:26', '2026-04-14 01:49:26'),
(164, 282, 4, 1000.00, 1.00, 1000.00, 34, 55, 'ETN-2026-04-003', 'MTN-2026-04-001', '2026-04-14', 'Auto-recorded from PO ETN-2026-04-003', NULL, '2026-04-14 01:49:26', '2026-04-14 01:49:26'),
(165, 173, 4, 1000.00, 1.00, 1000.00, 35, 69, 'ETN-2026-04-001', 'MTN-2026-04-001', '2026-04-16', 'Auto-recorded from PO ETN-2026-04-001', NULL, '2026-04-16 05:27:43', '2026-04-16 05:27:43');

-- --------------------------------------------------------

--
-- Table structure for table `pr_item_rejection_remarks`
--

DROP TABLE IF EXISTS `pr_item_rejection_remarks`;
CREATE TABLE IF NOT EXISTS `pr_item_rejection_remarks` (
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
  KEY `created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE IF NOT EXISTS `purchase_orders` (
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
  `status` enum('Draft','Pending Approval','Approved','On Hold','Delivered','Paid','Cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
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
  KEY `idx_po_installment_schedule_id` (`installment_schedule_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `purchase_orders`
--

INSERT INTO `purchase_orders` (`id`, `po_number`, `purchase_request_id`, `service_request_id`, `supplier_id`, `prepared_by`, `total_amount`, `po_date`, `expected_delivery_date`, `actual_delivery_date`, `status`, `created_at`, `updated_at`, `place_of_delivery`, `delivery_term`, `payment_term`, `project`, `notes`, `order_number`, `po_type`, `parent_po_id`, `installment_schedule_id`, `scheduled_payment_date`, `scheduled_amount`) VALUES
(1, 'PO-2026-0001', 1, NULL, 10, 2, 75250.00, '2026-05-22', '2026-05-29', NULL, 'Approved', '2026-05-22 02:41:53', '2026-05-29 01:45:51', 'Main Warehouse, Site A', 'COD', 'CASH', 'Project Alpha Phase 1', 'Standard mock order for system testing and procurement validation.', 'ORD-99541', 'purchase_order', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `purchase_order_items`
--

DROP TABLE IF EXISTS `purchase_order_items`;
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_order_id` int NOT NULL,
  `purchase_request_item_id` int DEFAULT NULL,
  `item_id` int DEFAULT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `purchase_order_id` (`purchase_order_id`),
  KEY `purchase_request_item_id` (`purchase_request_item_id`),
  KEY `item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `purchase_order_items`
--
DROP TRIGGER IF EXISTS `trg_record_pricing_history_after_po_item_insert`;
DELIMITER $$
CREATE TRIGGER `trg_record_pricing_history_after_po_item_insert` AFTER INSERT ON `purchase_order_items` FOR EACH ROW BEGIN
  DECLARE v_po_id INT;
  DECLARE v_po_number VARCHAR(50);
  DECLARE v_pr_id INT;
  DECLARE v_pr_number VARCHAR(50);
  DECLARE v_supplier_id INT;
  DECLARE v_po_date DATE;
  
  
  SELECT 
    po.id,
    po.po_number,
    po.purchase_request_id,
    po.supplier_id,
    po.created_at
  INTO 
    v_po_id,
    v_po_number,
    v_pr_id,
    v_supplier_id,
    v_po_date
  FROM purchase_orders po
  WHERE po.id = NEW.purchase_order_id;
  
  
  IF v_pr_id IS NOT NULL THEN
    SELECT pr.pr_number INTO v_pr_number
    FROM purchase_requests pr
    WHERE pr.id = v_pr_id;
  END IF;
  
  
  INSERT INTO pricing_history (
    item_id,
    supplier_id,
    unit_price,
    quantity,
    total_amount,
    purchase_order_id,
    purchase_request_id,
    po_number,
    pr_number,
    date_recorded,
    notes,
    created_by
  ) VALUES (
    NEW.item_id,
    v_supplier_id,
    NEW.unit_price,
    NEW.quantity,
    NEW.quantity * NEW.unit_price,
    v_po_id,
    v_pr_id,
    v_po_number,
    v_pr_number,
    DATE(v_po_date),
    CONCAT('Auto-recorded from PO ', v_po_number),
    NULL
  );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_requests`
--

DROP TABLE IF EXISTS `purchase_requests`;
CREATE TABLE IF NOT EXISTS `purchase_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pr_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_by` int DEFAULT NULL,
  `purpose` text COLLATE utf8mb4_unicode_ci,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `date_needed` date DEFAULT NULL,
  `project` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `project_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Draft','Pending','For Procurement Review','For Engineer Review','For Admin Review','For Super Admin Final Approval','On Hold','For Purchase','PO Created','Payment Request Created','Completed','Rejected','Cancelled','Received') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `pr_number` (`pr_number`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `supplier_id` (`supplier_id`),
  KEY `payment_basis` (`payment_basis`),
  KEY `purchase_requests_payment_terms_set_by_fk` (`payment_terms_set_by`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `purchase_requests`
--

INSERT INTO `purchase_requests` (`id`, `pr_number`, `requested_by`, `purpose`, `remarks`, `date_needed`, `project`, `project_address`, `status`, `approved_by`, `approved_at`, `rejection_reason`, `total_amount`, `created_at`, `updated_at`, `supplier_id`, `supplier_address`, `order_number`, `payment_basis`, `payment_terms_code`, `payment_terms_note`, `payment_terms_set_by`, `payment_terms_set_at`, `supplier_name`) VALUES
(1, 'PR-2026-05-001', 2, 'Procurement of raw structural materials for site foundation.', 'Urgent request to avoid project delays.', '2026-06-05', 'JAJR Construction HQ Expansion', 'San Fernando, La Union', 'Completed', NULL, NULL, NULL, 125500.00, '2026-05-22 02:43:46', '2026-05-29 01:45:51', 10, 'Industrial Zone, Building 4, Metro Manila', 'ORD-99541', 'debt', 'NET_30', 'Standard terms agreed upon with supplier for Q2 billing.', NULL, NULL, ''),
(2, 'JBT-2026-05-001', 6, 'aqrawfasf', NULL, NULL, 'Panicsican', 'Panicsican, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:46:00', NULL, 0.00, '2026-05-25 08:48:08', '2026-05-29 01:46:00', NULL, NULL, '159166591', 'non_debt', NULL, NULL, NULL, NULL, ''),
(3, 'MTN-2026-05-001', 5, 'Para office', '', '2026-05-28', 'Panicsican', 'Panicsican, San Juan, La Union', 'On Hold', NULL, NULL, NULL, 0.00, '2026-05-26 04:53:06', '2026-05-29 01:45:59', NULL, NULL, '159166591', 'non_debt', NULL, NULL, NULL, NULL, ''),
(4, 'MTN-2026-05-002', 5, 'ghjgik', '', NULL, 'BCDA - CCTV', 'Poro point, San Fernando City, La Union', 'On Hold', NULL, NULL, NULL, 0.00, '2026-05-26 05:07:24', '2026-05-29 01:45:59', NULL, NULL, '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'sdfgh'),
(5, 'MTN-2026-05-003', 5, 'for testing purposes', NULL, '2026-05-27', 'BCDA - Control Tower', 'Poro point, San Fernando City, La Union', 'For Purchase', 8, '2026-05-29 01:45:59', NULL, 0.00, '2026-05-26 05:10:24', '2026-05-29 01:45:59', NULL, NULL, '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'dante'),
(6, 'MTN-2026-05-004', 5, 'For testing againq', NULL, '2026-05-27', 'Panicsican', 'Panicsican, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:45:58', NULL, 500.00, '2026-05-26 05:11:48', '2026-05-29 01:45:58', NULL, NULL, '159166591', 'non_debt', NULL, NULL, NULL, NULL, 'Dante Gulapina'),
(7, 'JBT-2026-05-002', 6, 'para ken ni daniel gulapa', NULL, '2026-05-28', 'BCDA - Control Tower', 'Poro point, San Fernando City, La Union', 'For Purchase', 8, '2026-05-29 01:45:58', NULL, 0.00, '2026-05-26 05:28:19', '2026-05-29 01:45:58', NULL, NULL, '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'Dante Gulapinapino'),
(8, 'JBT-2026-05-003', 6, 'atgsdfgdfg', NULL, '2026-05-29', 'Pias - Sundara', NULL, 'For Purchase', 8, '2026-05-29 01:45:58', NULL, 0.00, '2026-05-26 05:31:05', '2026-05-29 01:45:58', NULL, NULL, '228984422', 'non_debt', NULL, NULL, NULL, NULL, 'dfgsdfg'),
(9, 'MTN-2026-05-005', 5, 'pang hollow blocks', NULL, '2026-05-29', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:45:58', NULL, 0.00, '2026-05-26 05:35:10', '2026-05-29 01:45:58', NULL, NULL, '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'Junjun'),
(10, 'MTN-2026-05-006', 5, 'Para hollow blocks', NULL, '2026-05-28', 'Panicsican', 'Panicsican, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:45:58', NULL, 0.00, '2026-05-26 05:48:41', '2026-05-29 01:45:58', NULL, NULL, '159166591', 'non_debt', NULL, NULL, NULL, NULL, 'Dante Obaldo'),
(11, 'MTN-2026-05-007', 5, 'asfsadf', NULL, '2026-05-29', 'Panicsican', 'Panicsican, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:45:58', NULL, 0.00, '2026-05-26 05:55:56', '2026-05-29 01:45:58', NULL, NULL, '159166591', 'non_debt', NULL, NULL, NULL, NULL, 'ewrweff'),
(12, 'MTN-2026-05-008', 5, 'safsdf', NULL, '2026-05-30', 'BCDA - CCA', 'Poro point, San Fernando City, La Union', 'For Purchase', 8, '2026-05-29 01:45:28', NULL, 0.00, '2026-05-26 05:59:11', '2026-05-29 01:45:28', NULL, 'sdfsadfsfsdf', '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'sadfasdf'),
(13, '2026-05-001', 5, 'awrfawfdsfasdfasd', NULL, '2026-05-30', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:45:26', NULL, 0.00, '2026-05-26 06:05:47', '2026-05-29 01:45:26', NULL, 'sdfasdf', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'asfasdf'),
(14, '2026-05-002', 8, 'sdfgsdfgsdfg', 'dsfgsdfg', '2026-05-30', 'Panicsican', 'Panicsican, San Juan, La Union', 'On Hold', NULL, NULL, NULL, 0.00, '2026-05-26 08:44:26', '2026-05-29 01:45:56', NULL, 'sdgfsdfg', '159166591', 'non_debt', NULL, NULL, NULL, NULL, 'sdfgsdfg'),
(15, '2026-05-003', 5, 'dhdfgh', '', '2026-05-29', 'Panicsican', 'Panicsican, San Juan, La Union', 'On Hold', NULL, NULL, NULL, 0.00, '2026-05-26 08:53:32', '2026-05-29 01:45:56', NULL, 'dfhdfhf', '159166591', 'non_debt', NULL, NULL, NULL, NULL, 'dfhdfgh'),
(16, '2026-05-004', 5, 'For ceiling', NULL, '2026-05-30', 'Panicsican', 'Panicsican, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:45:56', NULL, 600.00, '2026-05-29 00:25:27', '2026-05-29 01:45:56', NULL, 'Domondon Street, Bitalag, Bacnotan, La Union', '159166591', 'non_debt', NULL, NULL, NULL, NULL, 'Kaandingay Construction Supply'),
(17, '2026-05-005', 5, 'For testing', NULL, '2026-05-30', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:42:43', NULL, 412.00, '2026-05-29 00:52:55', '2026-05-29 01:42:43', NULL, 'Puguil, Naguillan, La Union', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'Puguil Construction Supplies'),
(18, '2026-05-006', 11, 'Pang balay', NULL, '2026-05-31', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:42:43', NULL, 0.00, '2026-05-29 00:59:33', '2026-05-29 01:42:43', NULL, 'Legleg, San Juan, La Union', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'This is mock supplier for testing'),
(19, '2026-05-007', 12, 'gsdfgsdf', NULL, '2026-05-31', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:42:42', NULL, 0.00, '2026-05-29 01:00:48', '2026-05-29 01:42:42', NULL, 'dfgdfg', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'dgsdfgdg'),
(20, '2026-05-008', 5, 'sfdsdfsd', NULL, '2026-05-31', 'BCDA - CCTV', 'Poro point, San Fernando City, La Union', 'For Purchase', 8, '2026-05-29 01:42:42', NULL, 0.00, '2026-05-29 01:04:15', '2026-05-29 01:42:42', NULL, 'fasdfsdf', '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'fasdfasd'),
(21, '2026-05-009', 5, 'sdgdfg', NULL, '2026-05-30', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:42:42', NULL, 0.00, '2026-05-29 01:07:23', '2026-05-29 01:42:42', NULL, 'gsdfgdsf', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'dfgsdf'),
(22, '2026-05-010', 5, 'hulhjklhjkl', NULL, '2026-06-01', 'BCDA - Admin', 'Poro point, San Fernando City, La Union', 'For Purchase', 8, '2026-05-29 01:42:42', NULL, 57.00, '2026-05-29 01:11:48', '2026-05-29 01:42:42', NULL, 'jklhjklhjljkl', '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'khlhklhl'),
(23, '2026-05-011', 5, 'ygkghjk', NULL, '2026-05-30', 'BCDA - CCA', 'Poro point, San Fernando City, La Union', 'For Purchase', 8, '2026-05-29 01:42:42', NULL, 4657.00, '2026-05-29 01:13:39', '2026-05-29 01:42:42', NULL, 'hjkghk', '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'ykghkghjkg'),
(24, '2026-05-012', 5, 'sgdfg', NULL, '2026-05-31', 'BCDA - Fire Station', 'Poro point, San Fernando City, La Union', 'For Purchase', 8, '2026-05-29 01:42:41', NULL, 3453.00, '2026-05-29 01:18:36', '2026-05-29 01:42:41', NULL, 'dsfgdfgs', '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'sdgfsdfgdsfg'),
(25, '2026-05-013', 5, 'fghfghdfh', NULL, '2026-05-30', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:42:39', NULL, 0.00, '2026-05-29 01:37:31', '2026-05-29 01:42:39', NULL, 'hhdfhdfg', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'fghd'),
(26, '2026-05-014', 5, 'fzgf', NULL, '2026-05-31', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:45:55', NULL, 3453.00, '2026-05-29 01:41:29', '2026-05-29 01:45:55', NULL, 'dsfgsdfgsdfg', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'sdfgsdfg'),
(27, '2026-05-015', 5, 'sdfdsg', NULL, '2026-06-05', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:45:54', NULL, 34444.00, '2026-05-29 01:45:45', '2026-05-29 01:45:54', NULL, 'sdfgsdg', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'gsdfg'),
(28, '2026-05-016', 5, 'gsdfgrger', NULL, '2026-06-06', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:46:26', NULL, 0.00, '2026-05-29 01:46:17', '2026-05-29 01:46:26', NULL, 'tewt', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'ewtetrwe'),
(29, '2026-05-017', 5, 'cgh', NULL, '2026-06-04', 'Sto. Rosario', 'Sto. Rosario, San Juan, La Union', 'For Purchase', 8, '2026-05-29 01:49:32', NULL, 5.00, '2026-05-29 01:49:16', '2026-05-29 01:49:32', NULL, 'fghjgf', '299269388', 'non_debt', NULL, NULL, NULL, NULL, 'jhfgjh'),
(30, '2026-05-018', 5, 'dddddddd', 'ertyerty', '2026-06-04', 'BCDA - Fire Station', 'Poro point, San Fernando City, La Union', 'For Engineer Review', NULL, NULL, NULL, 5463.00, '2026-05-29 01:53:11', '2026-05-29 01:53:11', NULL, 'retyertyerty', '393859493', 'non_debt', NULL, NULL, NULL, NULL, 'ertyrt');

-- --------------------------------------------------------

--
-- Table structure for table `purchase_request_items`
--

DROP TABLE IF EXISTS `purchase_request_items`;
CREATE TABLE IF NOT EXISTS `purchase_request_items` (
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
  PRIMARY KEY (`id`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `item_id` (`item_id`),
  KEY `received_by` (`received_by`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `purchase_request_items`
--

INSERT INTO `purchase_request_items` (`id`, `purchase_request_id`, `item_id`, `quantity`, `unit_price`, `total_price`, `unit`, `remarks`, `status`, `received_by`, `received_at`, `created_at`) VALUES
(1, 2, 5, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-25 08:48:08'),
(2, 3, 6, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 04:53:06'),
(3, 4, 14, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:07:24'),
(4, 5, 11, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:10:24'),
(5, 6, 14, 1, 500.00, 500.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:11:48'),
(6, 7, 14, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:28:19'),
(7, 8, 8, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:31:05'),
(8, 9, 12, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:35:10'),
(9, 10, 6, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:48:41'),
(10, 11, 21, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:55:56'),
(11, 12, 4, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 05:59:11'),
(12, 13, 13, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 06:05:47'),
(13, 14, 9, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 08:44:26'),
(14, 15, 22, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-26 08:53:32'),
(15, 16, 5, 1, 600.00, 600.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 00:25:27'),
(16, 17, 6, 1, 412.00, 412.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 00:52:55'),
(17, 18, 22, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 00:59:33'),
(18, 19, 6, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:00:48'),
(19, 20, 14, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:04:15'),
(20, 21, 9, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:07:23'),
(21, 22, 22, 1, 57.00, 57.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:11:48'),
(22, 23, 16, 1, 4657.00, 4657.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:13:39'),
(23, 24, 5, 1, 3453.00, 3453.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:18:36'),
(24, 25, 22, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:37:31'),
(25, 26, 22, 1, 3453.00, 3453.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:41:29'),
(26, 27, 2, 1, 34444.00, 34444.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:45:45'),
(27, 28, 14, 1, 0.00, 0.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:46:17'),
(28, 29, 20, 1, 5.00, 5.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:49:16'),
(29, 30, 2, 1, 5463.00, 5463.00, NULL, NULL, 'Pending', NULL, NULL, '2026-05-29 01:53:11');

-- --------------------------------------------------------

--
-- Table structure for table `purchase_request_payment_schedules`
--

DROP TABLE IF EXISTS `purchase_request_payment_schedules`;
CREATE TABLE IF NOT EXISTS `purchase_request_payment_schedules` (
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
  KEY `fk_pr_schedule_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_request_reviews`
--

DROP TABLE IF EXISTS `purchase_request_reviews`;
CREATE TABLE IF NOT EXISTS `purchase_request_reviews` (
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
  KEY `review_status` (`review_status`)
) ENGINE=InnoDB AUTO_INCREMENT=140 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `purchase_request_reviews`
--

INSERT INTO `purchase_request_reviews` (`id`, `purchase_request_id`, `reviewer_id`, `review_status`, `review_comment`, `reviewed_at`, `created_at`) VALUES
(1, 17, 3, 'pending', NULL, NULL, '2026-05-29 00:52:55'),
(2, 17, 5, 'approved', NULL, '2026-05-29 00:59:54', '2026-05-29 00:52:55'),
(3, 17, 9, 'approved', NULL, '2026-05-29 01:24:16', '2026-05-29 00:52:55'),
(4, 17, 11, 'approved', NULL, '2026-05-29 01:26:13', '2026-05-29 00:52:55'),
(5, 17, 12, 'approved', NULL, '2026-05-29 01:23:33', '2026-05-29 00:52:55'),
(6, 17, 13, 'approved', NULL, '2026-05-29 01:25:54', '2026-05-29 00:52:55'),
(7, 17, 2, 'pending', NULL, NULL, '2026-05-29 00:52:55'),
(8, 17, 6, 'approved', NULL, '2026-05-29 01:26:45', '2026-05-29 00:52:55'),
(9, 17, 1, 'pending', NULL, NULL, '2026-05-29 00:52:55'),
(10, 17, 8, 'pending', NULL, NULL, '2026-05-29 00:52:55'),
(11, 17, 10, 'pending', NULL, NULL, '2026-05-29 00:52:55'),
(12, 17, 18, 'pending', NULL, NULL, '2026-05-29 00:52:55'),
(13, 18, 3, 'pending', NULL, NULL, '2026-05-29 00:59:33'),
(14, 18, 5, 'approved', NULL, '2026-05-29 01:23:53', '2026-05-29 00:59:33'),
(15, 18, 9, 'approved', NULL, '2026-05-29 01:24:14', '2026-05-29 00:59:33'),
(16, 18, 11, 'approved', NULL, '2026-05-29 01:00:18', '2026-05-29 00:59:33'),
(17, 18, 12, 'approved', NULL, '2026-05-29 01:23:29', '2026-05-29 00:59:33'),
(18, 18, 13, 'approved', NULL, '2026-05-29 01:25:53', '2026-05-29 00:59:33'),
(19, 18, 2, 'pending', NULL, NULL, '2026-05-29 00:59:33'),
(20, 18, 6, 'approved', NULL, '2026-05-29 01:26:43', '2026-05-29 00:59:33'),
(21, 18, 1, 'pending', NULL, NULL, '2026-05-29 00:59:33'),
(22, 18, 8, 'pending', NULL, NULL, '2026-05-29 00:59:33'),
(23, 18, 10, 'pending', NULL, NULL, '2026-05-29 00:59:33'),
(24, 18, 18, 'pending', NULL, NULL, '2026-05-29 00:59:33'),
(25, 19, 3, 'pending', NULL, NULL, '2026-05-29 01:00:48'),
(26, 19, 5, 'approved', NULL, '2026-05-29 01:23:51', '2026-05-29 01:00:48'),
(27, 19, 9, 'approved', NULL, '2026-05-29 01:24:12', '2026-05-29 01:00:48'),
(28, 19, 11, 'approved', NULL, '2026-05-29 01:26:11', '2026-05-29 01:00:48'),
(29, 19, 12, 'approved', NULL, '2026-05-29 01:23:25', '2026-05-29 01:00:48'),
(30, 19, 13, 'approved', NULL, '2026-05-29 01:25:51', '2026-05-29 01:00:48'),
(31, 19, 2, 'pending', NULL, NULL, '2026-05-29 01:00:48'),
(32, 19, 6, 'approved', NULL, '2026-05-29 01:26:42', '2026-05-29 01:00:48'),
(33, 19, 1, 'pending', NULL, NULL, '2026-05-29 01:00:48'),
(34, 19, 8, 'pending', NULL, NULL, '2026-05-29 01:00:48'),
(35, 19, 10, 'pending', NULL, NULL, '2026-05-29 01:00:48'),
(36, 19, 18, 'pending', NULL, NULL, '2026-05-29 01:00:48'),
(37, 20, 3, 'pending', NULL, NULL, '2026-05-29 01:04:15'),
(38, 20, 9, 'approved', NULL, '2026-05-29 01:24:10', '2026-05-29 01:04:15'),
(39, 20, 11, 'approved', NULL, '2026-05-29 01:26:10', '2026-05-29 01:04:15'),
(40, 20, 12, 'approved', NULL, '2026-05-29 01:23:23', '2026-05-29 01:04:15'),
(41, 20, 13, 'approved', NULL, '2026-05-29 01:25:50', '2026-05-29 01:04:15'),
(42, 20, 2, 'pending', NULL, NULL, '2026-05-29 01:04:15'),
(43, 20, 6, 'approved', NULL, '2026-05-29 01:26:40', '2026-05-29 01:04:15'),
(44, 20, 1, 'pending', NULL, NULL, '2026-05-29 01:04:15'),
(45, 20, 8, 'pending', NULL, NULL, '2026-05-29 01:04:15'),
(46, 20, 10, 'pending', NULL, NULL, '2026-05-29 01:04:15'),
(47, 20, 18, 'pending', NULL, NULL, '2026-05-29 01:04:15'),
(48, 21, 3, 'pending', NULL, NULL, '2026-05-29 01:07:23'),
(49, 21, 9, 'approved', NULL, '2026-05-29 01:24:09', '2026-05-29 01:07:23'),
(50, 21, 11, 'approved', NULL, '2026-05-29 01:26:08', '2026-05-29 01:07:23'),
(51, 21, 12, 'approved', NULL, '2026-05-29 01:23:21', '2026-05-29 01:07:23'),
(52, 21, 13, 'approved', NULL, '2026-05-29 01:25:48', '2026-05-29 01:07:23'),
(53, 21, 2, 'pending', NULL, NULL, '2026-05-29 01:07:23'),
(54, 21, 6, 'approved', NULL, '2026-05-29 01:26:39', '2026-05-29 01:07:23'),
(55, 21, 1, 'pending', NULL, NULL, '2026-05-29 01:07:23'),
(56, 21, 8, 'pending', NULL, NULL, '2026-05-29 01:07:23'),
(57, 21, 10, 'pending', NULL, NULL, '2026-05-29 01:07:23'),
(58, 21, 18, 'pending', NULL, NULL, '2026-05-29 01:07:23'),
(59, 22, 3, 'pending', NULL, NULL, '2026-05-29 01:11:48'),
(60, 22, 9, 'approved', NULL, '2026-05-29 01:24:06', '2026-05-29 01:11:48'),
(61, 22, 11, 'approved', NULL, '2026-05-29 01:26:07', '2026-05-29 01:11:48'),
(62, 22, 12, 'approved', NULL, '2026-05-29 01:23:18', '2026-05-29 01:11:48'),
(63, 22, 13, 'approved', NULL, '2026-05-29 01:25:46', '2026-05-29 01:11:48'),
(64, 22, 2, 'pending', NULL, NULL, '2026-05-29 01:11:48'),
(65, 22, 6, 'approved', NULL, '2026-05-29 01:26:37', '2026-05-29 01:11:48'),
(66, 22, 1, 'pending', NULL, NULL, '2026-05-29 01:11:48'),
(67, 22, 8, 'pending', NULL, NULL, '2026-05-29 01:11:48'),
(68, 22, 10, 'pending', NULL, NULL, '2026-05-29 01:11:48'),
(69, 22, 18, 'pending', NULL, NULL, '2026-05-29 01:11:48'),
(70, 23, 3, 'pending', NULL, NULL, '2026-05-29 01:13:39'),
(71, 23, 9, 'approved', NULL, '2026-05-29 01:24:04', '2026-05-29 01:13:39'),
(72, 23, 11, 'approved', NULL, '2026-05-29 01:26:05', '2026-05-29 01:13:39'),
(73, 23, 12, 'approved', NULL, '2026-05-29 01:23:14', '2026-05-29 01:13:39'),
(74, 23, 13, 'approved', NULL, '2026-05-29 01:25:45', '2026-05-29 01:13:39'),
(75, 23, 2, 'pending', NULL, NULL, '2026-05-29 01:13:39'),
(76, 23, 6, 'approved', NULL, '2026-05-29 01:26:35', '2026-05-29 01:13:39'),
(77, 23, 1, 'pending', NULL, NULL, '2026-05-29 01:13:39'),
(78, 23, 8, 'pending', NULL, NULL, '2026-05-29 01:13:39'),
(79, 23, 10, 'pending', NULL, NULL, '2026-05-29 01:13:39'),
(80, 23, 18, 'pending', NULL, NULL, '2026-05-29 01:13:39'),
(81, 24, 3, 'pending', NULL, NULL, '2026-05-29 01:18:36'),
(82, 24, 9, 'approved', NULL, '2026-05-29 01:24:02', '2026-05-29 01:18:36'),
(83, 24, 11, 'approved', NULL, '2026-05-29 01:23:00', '2026-05-29 01:18:36'),
(84, 24, 12, 'approved', NULL, '2026-05-29 01:23:09', '2026-05-29 01:18:36'),
(85, 24, 13, 'approved', NULL, '2026-05-29 01:25:43', '2026-05-29 01:18:36'),
(86, 24, 2, 'pending', NULL, NULL, '2026-05-29 01:18:36'),
(87, 24, 6, 'approved', NULL, '2026-05-29 01:26:32', '2026-05-29 01:18:36'),
(88, 24, 1, 'pending', NULL, NULL, '2026-05-29 01:18:36'),
(89, 24, 8, 'pending', NULL, NULL, '2026-05-29 01:18:36'),
(90, 24, 10, 'pending', NULL, NULL, '2026-05-29 01:18:36'),
(91, 24, 18, 'pending', NULL, NULL, '2026-05-29 01:18:36'),
(92, 25, 9, 'approved', NULL, '2026-05-29 01:37:37', '2026-05-29 01:37:31'),
(93, 25, 11, 'approved', NULL, '2026-05-29 01:37:44', '2026-05-29 01:37:31'),
(94, 25, 12, 'approved', NULL, '2026-05-29 01:37:50', '2026-05-29 01:37:31'),
(95, 25, 13, 'approved', NULL, '2026-05-29 01:37:57', '2026-05-29 01:37:31'),
(96, 25, 6, 'approved', NULL, '2026-05-29 01:38:07', '2026-05-29 01:37:31'),
(97, 25, 8, 'pending', NULL, NULL, '2026-05-29 01:37:31'),
(98, 25, 10, 'pending', NULL, NULL, '2026-05-29 01:37:31'),
(99, 25, 18, 'pending', NULL, NULL, '2026-05-29 01:37:31'),
(100, 26, 9, 'approved', NULL, '2026-05-29 01:41:43', '2026-05-29 01:41:29'),
(101, 26, 11, 'approved', NULL, '2026-05-29 01:41:50', '2026-05-29 01:41:29'),
(102, 26, 12, 'approved', NULL, '2026-05-29 01:41:57', '2026-05-29 01:41:29'),
(103, 26, 13, 'approved', NULL, '2026-05-29 01:42:06', '2026-05-29 01:41:29'),
(104, 26, 6, 'approved', NULL, '2026-05-29 01:42:12', '2026-05-29 01:41:29'),
(105, 26, 8, 'pending', NULL, NULL, '2026-05-29 01:41:29'),
(106, 26, 10, 'pending', NULL, NULL, '2026-05-29 01:41:29'),
(107, 26, 18, 'pending', NULL, NULL, '2026-05-29 01:41:29'),
(108, 27, 9, 'pending', NULL, NULL, '2026-05-29 01:45:45'),
(109, 27, 11, 'pending', NULL, NULL, '2026-05-29 01:45:45'),
(110, 27, 12, 'pending', NULL, NULL, '2026-05-29 01:45:45'),
(111, 27, 13, 'pending', NULL, NULL, '2026-05-29 01:45:45'),
(112, 27, 6, 'pending', NULL, NULL, '2026-05-29 01:45:45'),
(113, 27, 8, 'pending', NULL, NULL, '2026-05-29 01:45:45'),
(114, 27, 10, 'pending', NULL, NULL, '2026-05-29 01:45:45'),
(115, 27, 18, 'pending', NULL, NULL, '2026-05-29 01:45:45'),
(116, 28, 9, 'pending', NULL, NULL, '2026-05-29 01:46:17'),
(117, 28, 11, 'pending', NULL, NULL, '2026-05-29 01:46:17'),
(118, 28, 12, 'pending', NULL, NULL, '2026-05-29 01:46:17'),
(119, 28, 13, 'pending', NULL, NULL, '2026-05-29 01:46:17'),
(120, 28, 6, 'pending', NULL, NULL, '2026-05-29 01:46:17'),
(121, 28, 8, 'pending', NULL, NULL, '2026-05-29 01:46:17'),
(122, 28, 10, 'pending', NULL, NULL, '2026-05-29 01:46:17'),
(123, 28, 18, 'pending', NULL, NULL, '2026-05-29 01:46:17'),
(124, 29, 9, 'pending', NULL, NULL, '2026-05-29 01:49:16'),
(125, 29, 11, 'pending', NULL, NULL, '2026-05-29 01:49:16'),
(126, 29, 12, 'pending', NULL, NULL, '2026-05-29 01:49:16'),
(127, 29, 13, 'pending', NULL, NULL, '2026-05-29 01:49:16'),
(128, 29, 6, 'pending', NULL, NULL, '2026-05-29 01:49:16'),
(129, 29, 8, 'pending', NULL, NULL, '2026-05-29 01:49:16'),
(130, 29, 10, 'pending', NULL, NULL, '2026-05-29 01:49:16'),
(131, 29, 18, 'pending', NULL, NULL, '2026-05-29 01:49:16'),
(132, 30, 9, 'approved', NULL, '2026-05-29 02:21:32', '2026-05-29 01:53:11'),
(133, 30, 11, 'pending', NULL, NULL, '2026-05-29 01:53:11'),
(134, 30, 12, 'pending', NULL, NULL, '2026-05-29 01:53:11'),
(135, 30, 13, 'approved', NULL, '2026-05-29 06:53:46', '2026-05-29 01:53:11'),
(136, 30, 6, 'pending', NULL, NULL, '2026-05-29 01:53:11'),
(137, 30, 8, 'pending', NULL, NULL, '2026-05-29 01:53:11'),
(138, 30, 10, 'pending', NULL, NULL, '2026-05-29 01:53:11'),
(139, 30, 18, 'pending', NULL, NULL, '2026-05-29 01:53:11');

-- --------------------------------------------------------

--
-- Table structure for table `reimbursements`
--

DROP TABLE IF EXISTS `reimbursements`;
CREATE TABLE IF NOT EXISTS `reimbursements` (
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
  `status` enum('Draft','Pending','For Procurement Review','For Super Admin Final Approval','On Hold','For Purchase','PO Created','Payment Request Created','Completed','Rejected','Cancelled','Received') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
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

-- --------------------------------------------------------

--
-- Table structure for table `reimbursement_attachments`
--

DROP TABLE IF EXISTS `reimbursement_attachments`;
CREATE TABLE IF NOT EXISTS `reimbursement_attachments` (
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

-- --------------------------------------------------------

--
-- Table structure for table `reimbursement_payment_schedules`
--

DROP TABLE IF EXISTS `reimbursement_payment_schedules`;
CREATE TABLE IF NOT EXISTS `reimbursement_payment_schedules` (
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
  KEY `fk_rmb_schedule_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reimbursement_schedule_reminder_logs`
--

DROP TABLE IF EXISTS `reimbursement_schedule_reminder_logs`;
CREATE TABLE IF NOT EXISTS `reimbursement_schedule_reminder_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `reminder_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rmb_schedule_reminder` (`schedule_id`,`reminder_type`),
  KEY `idx_rsrl_type_sent_at` (`reminder_type`,`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `service_requests`
--

DROP TABLE IF EXISTS `service_requests`;
CREATE TABLE IF NOT EXISTS `service_requests` (
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
  `status` enum('Draft','For Procurement Review','For Super Admin Final Approval','Approved','Payment Request Created','Payment Order Created','Rejected','Cancelled','PO Created','Paid','Received') COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
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

-- --------------------------------------------------------

--
-- Table structure for table `service_request_payment_schedules`
--

DROP TABLE IF EXISTS `service_request_payment_schedules`;
CREATE TABLE IF NOT EXISTS `service_request_payment_schedules` (
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
  KEY `fk_sr_schedule_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `service_schedule_reminder_logs`
--

DROP TABLE IF EXISTS `service_schedule_reminder_logs`;
CREATE TABLE IF NOT EXISTS `service_schedule_reminder_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `reminder_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sr_schedule_reminder` (`schedule_id`,`reminder_type`),
  KEY `idx_ssrl_type_sent_at` (`reminder_type`,`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE IF NOT EXISTS `suppliers` (
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_code` (`supplier_code`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_accredited_by` (`accredited_by`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `supplier_code`, `supplier_name`, `contact_person`, `email`, `phone`, `address`, `status`, `created_at`, `updated_at`, `accredited`, `accredited_by`, `accredited_at`, `accreditation_files`, `accreditation_notes`) VALUES
(1, 'SUP001', 'Tech Supplies Inc', 'Robert Wilson', 'robert@techsupplies.com', '09123456789', '123 Main St, Manila', 'Active', '2026-05-08 08:03:37', '2026-05-08 08:03:37', 0, NULL, NULL, NULL, NULL),
(2, 'SUP002', 'Office Depot PH', 'Maria Garcia', 'maria@officedepot.ph', '09234567890', '456 Business Ave, Quezon City', 'Active', '2026-05-08 08:03:37', '2026-05-08 08:03:37', 0, NULL, NULL, NULL, NULL),
(3, 'SUP003', 'Safety First Co', 'David Lee', 'david@safetyfirst.com', '09345678901', '789 Industrial Rd, Makati', 'Active', '2026-05-08 08:03:37', '2026-05-08 08:03:37', 0, NULL, NULL, NULL, NULL),
(4, 'SUP004', 'Your Supplier Name', 'Contact Person', 'email@supplier.com', '09123456789', 'Address here', 'Active', '2026-05-08 08:03:43', '2026-05-08 08:03:43', 0, NULL, NULL, NULL, NULL),
(10, 'SUP-ALPH', 'Alpha Steel & Concrete Corp.', 'Marc Johnson', 'sales@alphasteel.com', '+639171234567', 'Industrial Zone, Building 4, Metro Manila', 'Active', '2026-05-22 02:45:35', '2026-05-22 02:45:35', 0, NULL, NULL, NULL, NULL),
(11, 'SUP-TECH', 'TechSolutions Inc.', 'Sarah Perez', 'b2b@techsolutions.com', '+639189876543', '25F Ayala Tower One, Ayala Ave, Makati City', 'Active', '2026-05-22 02:45:35', '2026-05-22 02:45:35', 0, NULL, NULL, NULL, NULL),
(12, 'SUP-GLOB', 'Global Logistics & Freight', 'Kevin Santos', 'info@globallogistics.com', '+639225554433', 'Port Area, South Harbor, Manila', 'Active', '2026-05-22 02:45:35', '2026-05-22 02:45:35', 0, NULL, NULL, NULL, NULL),
(13, 'SUP41461563', 'asfasdf', NULL, NULL, NULL, 'sdfasdf', 'Active', '2026-05-29 02:56:54', '2026-05-29 05:58:19', 1, 8, '2026-05-29 05:58:19', '[{\"filename\":\"files-1780034129179-427504605.jpg\",\"originalname\":\"files-1780032304591-180534192.jpg\",\"path\":\"uploads\\\\accreditation\\\\files-1780034129179-427504605.jpg\",\"size\":205402,\"mimetype\":\"image/jpeg\",\"uploaded_at\":\"2026-05-29T05:55:29.180Z\"},{\"filename\":\"files-1780034271534-539374981.pdf\",\"originalname\":\"cctv-sdp (1) (1) (1).pdf\",\"path\":\"uploads\\\\accreditation\\\\files-1780034271534-539374981.pdf\",\"size\":84520,\"mimetype\":\"application/pdf\",\"uploaded_at\":\"2026-05-29T05:57:51.535Z\"},{\"filename\":\"files-1780034299501-343594514.pdf\",\"originalname\":\"CNC Order of Payment.pdf\",\"path\":\"uploads\\\\accreditation\\\\files-1780034299501-343594514.pdf\",\"size\":2477,\"mimetype\":\"application/pdf\",\"uploaded_at\":\"2026-05-29T05:58:19.502Z\"}]', 'sfsdf'),
(14, 'SUP41461947', 'dante', NULL, NULL, NULL, NULL, 'Active', '2026-05-29 02:56:54', '2026-05-29 05:41:07', 0, 8, '2026-05-29 05:41:07', '[{\"filename\":\"files-1780032929158-642472684.docx\",\"originalname\":\"files-1780032565780-641676311.docx\",\"path\":\"uploads\\\\accreditation\\\\files-1780032929158-642472684.docx\",\"size\":32026,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\",\"uploaded_at\":\"2026-05-29T05:35:29.160Z\"},{\"filename\":\"files-1780033006101-163541501.docx\",\"originalname\":\"BCDA-QUTATION-TAAW (2).docx\",\"path\":\"uploads\\\\accreditation\\\\files-1780033006101-163541501.docx\",\"size\":32026,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\",\"uploaded_at\":\"2026-05-29T05:36:46.103Z\"}]', NULL),
(15, 'SUP41462285', 'Dante Gulapina', NULL, NULL, NULL, NULL, 'Active', '2026-05-29 02:56:54', '2026-05-29 05:41:10', 0, 8, '2026-05-29 05:41:10', '[{\"filename\":\"files-1780033037625-734748863.xlsx\",\"originalname\":\"PR-PR-2026-05-001.xlsx\",\"path\":\"uploads\\\\accreditation\\\\files-1780033037625-734748863.xlsx\",\"size\":52238,\"mimetype\":\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\",\"uploaded_at\":\"2026-05-29T05:37:17.626Z\"},{\"filename\":\"files-1780033239016-613541488.docx\",\"originalname\":\"1273d99e-8c24-4ebf-b883-82ef97b31fa2.docx\",\"path\":\"uploads\\\\accreditation\\\\files-1780033239016-613541488.docx\",\"size\":32026,\"mimetype\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\",\"uploaded_at\":\"2026-05-29T05:40:39.018Z\"}]', NULL),
(16, 'SUP4146250', 'Dante Gulapinapino', NULL, NULL, NULL, NULL, 'Active', '2026-05-29 02:56:54', '2026-05-29 05:34:47', 0, 8, '2026-05-29 05:34:47', NULL, NULL),
(17, 'SUP41462774', 'Dante Obaldo', NULL, NULL, NULL, NULL, 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(18, 'SUP41462925', 'dfgsdf', NULL, NULL, NULL, 'gsdfgdsf', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(19, 'SUP41463125', 'dfgsdfg', NULL, NULL, NULL, NULL, 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(20, 'SUP41463457', 'dfhdfgh', NULL, NULL, NULL, 'dfhdfhf', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(21, 'SUP41463679', 'dgsdfgdg', NULL, NULL, NULL, 'dfgdfg', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(22, 'SUP41463840', 'ertyrt', NULL, NULL, NULL, 'retyertyerty', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(23, 'SUP41464053', 'ewrweff', NULL, NULL, NULL, NULL, 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(24, 'SUP41464221', 'ewtetrwe', NULL, NULL, NULL, 'tewt', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(25, 'SUP41464477', 'fasdfasd', NULL, NULL, NULL, 'fasdfsdf', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(26, 'SUP41464717', 'fghd', NULL, NULL, NULL, 'hhdfhdfg', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(27, 'SUP41465279', 'gsdfg', NULL, NULL, NULL, 'sdfgsdg', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(28, 'SUP41465593', 'jhfgjh', NULL, NULL, NULL, 'fghjgf', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(29, 'SUP41465884', 'Junjun', NULL, NULL, NULL, NULL, 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(30, 'SUP41466026', 'Kaandingay Construction Supply', NULL, NULL, NULL, 'Domondon Street, Bitalag, Bacnotan, La Union', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(31, 'SUP41466298', 'khlhklhl', NULL, NULL, NULL, 'jklhjklhjljkl', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(32, 'SUP41466445', 'Puguil Construction Supplies', NULL, NULL, NULL, 'Puguil, Naguillan, La Union', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(33, 'SUP41466624', 'sadfasdf', NULL, NULL, NULL, 'sdfsadfsfsdf', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(34, 'SUP41466731', 'sdfgh', NULL, NULL, NULL, NULL, 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(35, 'SUP41466951', 'sdfgsdfg', NULL, NULL, NULL, 'dsfgsdfgsdfg', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(36, 'SUP41467192', 'sdfgsdfg', NULL, NULL, NULL, 'sdgfsdfg', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(37, 'SUP41467287', 'sdgfsdfgdsfg', NULL, NULL, NULL, 'dsfgdfgs', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(38, 'SUP41467452', 'This is mock supplier for testing', NULL, NULL, NULL, 'Legleg, San Juan, La Union', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(39, 'SUP41467627', 'ykghkghjkg', NULL, NULL, NULL, 'hjkghk', 'Active', '2026-05-29 02:56:54', '2026-05-29 02:56:54', 0, NULL, NULL, NULL, NULL),
(40, 'SUP399401', 'Padas laeng met a sika met', 'Dante Obaldo Rillera', 'dantegulapina@gmail.com', '09668160595', 'Sitio Maiyaw-awan, Brgy. Mapukpukaw, Legleg, San Juan, La Union', 'Active', '2026-05-29 05:59:59', '2026-05-29 05:59:59', 0, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `supplier_items`
--

DROP TABLE IF EXISTS `supplier_items`;
CREATE TABLE IF NOT EXISTS `supplier_items` (
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

--
-- Constraints for dumped tables
--

--
-- Constraints for table `cash_requests`
--
ALTER TABLE `cash_requests`
  ADD CONSTRAINT `cash_requests_ibfk_1` FOREIGN KEY (`requested_by`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `cash_requests_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `cash_requests_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `cash_request_payment_schedules`
--
ALTER TABLE `cash_request_payment_schedules`
  ADD CONSTRAINT `fk_cr_schedule_cr` FOREIGN KEY (`cash_request_id`) REFERENCES `cash_requests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cr_schedule_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `cash_schedule_reminder_logs`
--
ALTER TABLE `cash_schedule_reminder_logs`
  ADD CONSTRAINT `fk_csrl_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `cash_request_payment_schedules` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `categories`
--
ALTER TABLE `categories`
  ADD CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`);

--
-- Constraints for table `disbursement_vouchers`
--
ALTER TABLE `disbursement_vouchers`
  ADD CONSTRAINT `disbursement_vouchers_ibfk_1` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `disbursement_vouchers_ibfk_2` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `disbursement_vouchers_ibfk_3` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  ADD CONSTRAINT `disbursement_vouchers_ibfk_4` FOREIGN KEY (`prepared_by`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `disbursement_vouchers_ibfk_5` FOREIGN KEY (`certified_by_accounting`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `disbursement_vouchers_ibfk_6` FOREIGN KEY (`certified_by_manager`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `disbursement_vouchers_ibfk_7` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `disbursement_vouchers_ibfk_8` FOREIGN KEY (`cash_request_id`) REFERENCES `cash_requests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_dv_payment_order` FOREIGN KEY (`payment_order_id`) REFERENCES `payment_orders` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `items`
--
ALTER TABLE `items`
  ADD CONSTRAINT `items_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  ADD CONSTRAINT `items_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`recipient_id`) REFERENCES `employees` (`id`);

--
-- Constraints for table `order_number_locks`
--
ALTER TABLE `order_number_locks`
  ADD CONSTRAINT `fk_order_number_locks_locked_by` FOREIGN KEY (`locked_by`) REFERENCES `employees` (`id`);

--
-- Constraints for table `payment_orders`
--
ALTER TABLE `payment_orders`
  ADD CONSTRAINT `fk_po_cash_request` FOREIGN KEY (`cash_request_id`) REFERENCES `cash_requests` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payment_orders_ibfk_1` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payment_orders_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `employees` (`id`);

--
-- Constraints for table `payment_requests`
--
ALTER TABLE `payment_requests`
  ADD CONSTRAINT `fk_payment_requests_service_request_id` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payment_requests_ibfk_1` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payment_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `payment_requests_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `payment_requests_ibfk_4` FOREIGN KEY (`dv_id`) REFERENCES `disbursement_vouchers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payment_request_items`
--
ALTER TABLE `payment_request_items`
  ADD CONSTRAINT `payment_request_items_ibfk_1` FOREIGN KEY (`payment_request_id`) REFERENCES `payment_requests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payment_request_items_ibfk_2` FOREIGN KEY (`pr_item_id`) REFERENCES `purchase_request_items` (`id`),
  ADD CONSTRAINT `payment_request_items_ibfk_3` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`);

--
-- Constraints for table `payment_schedule_reminder_logs`
--
ALTER TABLE `payment_schedule_reminder_logs`
  ADD CONSTRAINT `fk_reminder_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `purchase_request_payment_schedules` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `po_attachments`
--
ALTER TABLE `po_attachments`
  ADD CONSTRAINT `po_attachments_ibfk_1` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `po_attachments_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `employees` (`id`);

--
-- Constraints for table `pr_item_rejection_remarks`
--
ALTER TABLE `pr_item_rejection_remarks`
  ADD CONSTRAINT `pr_item_rejection_remarks_ibfk_1` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pr_item_rejection_remarks_ibfk_2` FOREIGN KEY (`purchase_request_item_id`) REFERENCES `purchase_request_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pr_item_rejection_remarks_ibfk_3` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`),
  ADD CONSTRAINT `pr_item_rejection_remarks_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`);

--
-- Constraints for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD CONSTRAINT `fk_po_installment_schedule_id` FOREIGN KEY (`installment_schedule_id`) REFERENCES `purchase_request_payment_schedules` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_po_parent_po_id` FOREIGN KEY (`parent_po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `purchase_requests`
--
ALTER TABLE `purchase_requests`
  ADD CONSTRAINT `purchase_requests_payment_terms_set_by_fk` FOREIGN KEY (`payment_terms_set_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `purchase_request_payment_schedules`
--
ALTER TABLE `purchase_request_payment_schedules`
  ADD CONSTRAINT `fk_pr_schedule_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pr_schedule_pr` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `purchase_request_reviews`
--
ALTER TABLE `purchase_request_reviews`
  ADD CONSTRAINT `pr_reviews_pr_fk` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pr_reviews_reviewer_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reimbursement_payment_schedules`
--
ALTER TABLE `reimbursement_payment_schedules`
  ADD CONSTRAINT `fk_rmb_schedule_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_rmb_schedule_rmb` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reimbursement_schedule_reminder_logs`
--
ALTER TABLE `reimbursement_schedule_reminder_logs`
  ADD CONSTRAINT `fk_rsrl_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `reimbursement_payment_schedules` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `service_request_payment_schedules`
--
ALTER TABLE `service_request_payment_schedules`
  ADD CONSTRAINT `fk_sr_schedule_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sr_schedule_sr` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `service_schedule_reminder_logs`
--
ALTER TABLE `service_schedule_reminder_logs`
  ADD CONSTRAINT `fk_ssrl_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `service_request_payment_schedules` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD CONSTRAINT `fk_accredited_by` FOREIGN KEY (`accredited_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
