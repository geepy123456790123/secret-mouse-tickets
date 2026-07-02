ALTER TABLE `leads` ADD COLUMN `utm_source` text;--> statement-breakpoint
ALTER TABLE `leads` ADD COLUMN `utm_medium` text;--> statement-breakpoint
ALTER TABLE `leads` ADD COLUMN `utm_campaign` text;--> statement-breakpoint
ALTER TABLE `leads` ADD COLUMN `utm_content` text;--> statement-breakpoint
ALTER TABLE `leads` ADD COLUMN `utm_term` text;--> statement-breakpoint
ALTER TABLE `leads` ADD COLUMN `landing_page` text;--> statement-breakpoint
ALTER TABLE `leads` ADD COLUMN `referrer` text;--> statement-breakpoint
CREATE INDEX `leads_created_at_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `orders_created_at_idx` ON `orders` (`created_at`);
