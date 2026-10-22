CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text NOT NULL,
	`meta_description` text NOT NULL,
	`tags` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` text NOT NULL
);
