CREATE TABLE `printers` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`model` varchar(160),
	`active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `printers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_run_locks` (
	`printer_id` varchar(36) NOT NULL,
	`run_id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_run_locks_printer_id` PRIMARY KEY(`printer_id`),
	CONSTRAINT `production_run_locks_run_id_unique` UNIQUE(`run_id`)
);
--> statement-breakpoint
CREATE TABLE `production_run_materials` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`run_id` varchar(36) NOT NULL,
	`filament_id` int NOT NULL,
	`quantity_per_unit_base` decimal(12,3) NOT NULL,
	`reserved_quantity_base` decimal(12,3) NOT NULL,
	`consumed_quantity_base` decimal(12,3) NOT NULL DEFAULT '0',
	`unit_type` enum('g','m','unit') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_run_materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_runs` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`printer_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`planned_quantity` int NOT NULL,
	`produced_quantity` int NOT NULL DEFAULT 0,
	`status` enum('RUNNING','FINISHED','CANCELED','FAILED') NOT NULL DEFAULT 'RUNNING',
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`finished_at` timestamp,
	`started_by` int NOT NULL,
	`finished_by` int,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `printers` ADD CONSTRAINT `printers_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_run_locks` ADD CONSTRAINT `production_run_locks_printer_id_printers_id_fk` FOREIGN KEY (`printer_id`) REFERENCES `printers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_run_locks` ADD CONSTRAINT `production_run_locks_run_id_production_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `production_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_run_locks` ADD CONSTRAINT `production_run_locks_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_run_materials` ADD CONSTRAINT `production_run_materials_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_run_materials` ADD CONSTRAINT `production_run_materials_run_id_production_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `production_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_run_materials` ADD CONSTRAINT `production_run_materials_filament_id_filaments_id_fk` FOREIGN KEY (`filament_id`) REFERENCES `filaments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_runs` ADD CONSTRAINT `production_runs_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_runs` ADD CONSTRAINT `production_runs_printer_id_printers_id_fk` FOREIGN KEY (`printer_id`) REFERENCES `printers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_runs` ADD CONSTRAINT `production_runs_product_id_inventory_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `inventory_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_runs` ADD CONSTRAINT `production_runs_started_by_users_id_fk` FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_runs` ADD CONSTRAINT `production_runs_finished_by_users_id_fk` FOREIGN KEY (`finished_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;