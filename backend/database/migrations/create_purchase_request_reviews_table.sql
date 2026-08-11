CREATE TABLE IF NOT EXISTS `purchase_request_reviews` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `purchase_request_id` int(11) NOT NULL,
  `reviewer_id` int(11) NOT NULL,
  `review_status` enum('pending','approved','rejected') DEFAULT 'pending',
  `review_comment` text DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pr_reviewer` (`purchase_request_id`,`reviewer_id`),
  KEY `purchase_request_id` (`purchase_request_id`),
  KEY `reviewer_id` (`reviewer_id`),
  KEY `review_status` (`review_status`),
  CONSTRAINT `pr_reviews_pr_fk` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pr_reviews_reviewer_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
