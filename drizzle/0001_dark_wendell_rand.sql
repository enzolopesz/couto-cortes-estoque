CREATE TABLE `filaments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`material` varchar(80) NOT NULL,
	`color` varchar(80) NOT NULL,
	`brand` varchar(120) NOT NULL,
	`diameter` decimal(4,2) NOT NULL,
	`initialWeight` int NOT NULL,
	`currentWeight` int NOT NULL,
	`minimumWeight` int NOT NULL,
	`rollCost` decimal(10,2) NOT NULL,
	`location` varchar(120) NOT NULL,
	`status` enum('available','reserved','finished') NOT NULL DEFAULT 'available',
	`observation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `filaments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `filaments` ADD CONSTRAINT `filaments_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;