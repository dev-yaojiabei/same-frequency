CREATE TABLE `nicknames` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_windows` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_expiry` ON `rate_windows` (`expires_at`);--> statement-breakpoint
CREATE TABLE `pair_records` (
	`nickname` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`score` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`nickname`, `id`),
	FOREIGN KEY (`nickname`) REFERENCES `nicknames`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `records_by_nickname_date` ON `pair_records` (`nickname`,`created_at`);