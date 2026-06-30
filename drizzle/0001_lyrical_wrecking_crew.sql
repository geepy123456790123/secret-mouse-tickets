CREATE INDEX `events_valid_window_idx` ON `events` (`valid_start_date`,`valid_end_date`);--> statement-breakpoint
CREATE INDEX `events_event_start_idx` ON `events` (`event_start_date`);--> statement-breakpoint
CREATE INDEX `orders_paid_at_idx` ON `orders` (`paid_at`);