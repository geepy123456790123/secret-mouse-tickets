ALTER TABLE `orders` ADD COLUMN `payment_provider` text;--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `paypal_order_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `paypal_capture_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `paypal_payment_status` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_paypal_order_idx` ON `orders` (`paypal_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_paypal_capture_idx` ON `orders` (`paypal_capture_id`);
