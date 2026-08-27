CREATE TABLE `product_materials` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`filament_id` int NOT NULL,
	`quantity_base` decimal(12,3) NOT NULL,
	`unit_type` enum('g','m','unit') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `product_materials` ADD CONSTRAINT `product_materials_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_materials` ADD CONSTRAINT `product_materials_product_id_inventory_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `inventory_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_materials` ADD CONSTRAINT `product_materials_filament_id_filaments_id_fk` FOREIGN KEY (`filament_id`) REFERENCES `filaments`(`id`) ON DELETE no action ON UPDATE no action;