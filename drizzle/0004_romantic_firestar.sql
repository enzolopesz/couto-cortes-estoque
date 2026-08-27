CREATE TABLE `inventory_products` (
	`id` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(120),
	`image_url` text,
	`sku` varchar(80),
	`external_product_id` varchar(120),
	`active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_inventory` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`quantity_available` int NOT NULL DEFAULT 0,
	`minimum_quantity` int NOT NULL DEFAULT 0,
	`storage_location` varchar(120),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_inventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_inventory_product_id_unique` UNIQUE(`product_id`)
);
--> statement-breakpoint
CREATE TABLE `production_records` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`filament_id` int NOT NULL,
	`quantity_produced` int NOT NULL,
	`quantity_per_unit` decimal(12,3) NOT NULL,
	`unit_used` varchar(12) NOT NULL,
	`total_consumed_base` decimal(12,2) NOT NULL,
	`notes` text,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inventory_products` ADD CONSTRAINT `inventory_products_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_inventory` ADD CONSTRAINT `product_inventory_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_inventory` ADD CONSTRAINT `product_inventory_product_id_inventory_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `inventory_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_records` ADD CONSTRAINT `production_records_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_records` ADD CONSTRAINT `production_records_product_id_inventory_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `inventory_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_records` ADD CONSTRAINT `production_records_filament_id_filaments_id_fk` FOREIGN KEY (`filament_id`) REFERENCES `filaments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_records` ADD CONSTRAINT `production_records_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;