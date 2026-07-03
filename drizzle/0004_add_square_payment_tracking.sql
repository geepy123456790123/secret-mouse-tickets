ALTER TABLE `orders` ADD COLUMN `square_payment_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `square_payment_status` text;--> statement-breakpoint
CREATE INDEX `orders_square_payment_link_idx` ON `orders` (`square_payment_link_id`);--> statement-breakpoint
CREATE INDEX `orders_square_order_idx` ON `orders` (`square_order_id`);--> statement-breakpoint
CREATE INDEX `orders_square_payment_idx` ON `orders` (`square_payment_id`);
