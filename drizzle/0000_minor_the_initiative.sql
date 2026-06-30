CREATE TABLE `coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`max_redemptions` integer,
	`redemption_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`subject` text NOT NULL,
	`body_text` text NOT NULL,
	`provider_message_id` text,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_page_url` text NOT NULL,
	`info_banner_first` text NOT NULL,
	`info_banner_second` text NOT NULL,
	`event_start_date` text NOT NULL,
	`event_end_date` text NOT NULL,
	`valid_start_date` text NOT NULL,
	`valid_end_date` text NOT NULL,
	`hotel_special_rate_available` integer DEFAULT 0 NOT NULL,
	`hotel_name` text,
	`hotel_booking_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_event_page_url_unique` ON `events` (`event_page_url`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_start_date` text NOT NULL,
	`visit_end_date` text NOT NULL,
	`theme_park_days` integer NOT NULL,
	`park_hopper` integer DEFAULT 0 NOT NULL,
	`guests_10_plus` integer NOT NULL,
	`guests_3_to_9` integer NOT NULL,
	`florida_resident` integer DEFAULT 0 NOT NULL,
	`email` text NOT NULL,
	`status` text NOT NULL,
	`matched_event_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount_cents` integer DEFAULT 9900 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`confirmation_number` text,
	`coupon_code` text,
	`square_payment_link_id` text,
	`square_order_id` text,
	`checkout_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`paid_at` text
);
--> statement-breakpoint
CREATE TABLE `scrape_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`candidate_count` integer DEFAULT 0 NOT NULL,
	`upserted_count` integer DEFAULT 0 NOT NULL,
	`ignored_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
