ALTER TABLE `events` ADD COLUMN `destination` text DEFAULT 'disney_world' NOT NULL;--> statement-breakpoint
CREATE INDEX `events_destination_idx` ON `events` (`destination`);
