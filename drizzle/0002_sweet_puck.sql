CREATE TABLE `stock_movements` (
	`id` varchar(36) NOT NULL,
	`filamentId` int NOT NULL,
	`type` enum('entry','consumption','loss','adjustment','reservation','release_reservation') NOT NULL,
	`quantityGrams` decimal(12,2) NOT NULL,
	`previousWeightGrams` decimal(12,2) NOT NULL,
	`resultingWeightGrams` decimal(12,2) NOT NULL,
	`description` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_filamentId_filaments_id_fk` FOREIGN KEY (`filamentId`) REFERENCES `filaments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;