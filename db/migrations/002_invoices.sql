-- 002: one invoice per placed order. Created in the same transaction that places/confirms the order (cash on delivery,
-- or the moment an online payment is captured); unpaid or failed online orders never get one. The amounts and a JSON
-- snapshot of the business, customer, address and items are frozen at creation, so later edits to products, prices,
-- the customer's profile or the shop settings never change an issued invoice. Only the payment fields are kept in
-- step with the order (e.g. cash collected later, refunds). Invoice numbers come from the `counters` table
-- ('invoice_number'), so they are unique and sequential. New table only: no existing data is touched.
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `invoice_date` datetime(3) NOT NULL,
  `subtotal_paise` int unsigned NOT NULL,
  `discount_paise` int unsigned NOT NULL DEFAULT '0',
  `shipping_paise` int unsigned NOT NULL DEFAULT '0',
  `tax_paise` int unsigned NOT NULL DEFAULT '0',
  `total_paise` int unsigned NOT NULL,
  `amount_paid_paise` int unsigned NOT NULL DEFAULT '0',
  `refunded_paise` int unsigned NOT NULL DEFAULT '0',
  `balance_due_paise` int unsigned NOT NULL DEFAULT '0',
  `payment_status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `snapshot` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoices_number` (`invoice_number`),
  UNIQUE KEY `uq_invoices_order` (`order_id`),
  KEY `idx_invoices_date` (`invoice_date`),
  CONSTRAINT `fk_invoices_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
