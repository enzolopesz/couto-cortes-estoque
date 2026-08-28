CREATE TABLE `product_stock_movements` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`type` enum('adjustment','out') NOT NULL,
	`previous_quantity` int NOT NULL,
	`quantity_delta` int NOT NULL,
	`resulting_quantity` int NOT NULL,
	`reason` varchar(32),
	`notes` text,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `product_stock_movements` ADD CONSTRAINT `product_stock_movements_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_stock_movements` ADD CONSTRAINT `product_stock_movements_product_id_inventory_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `inventory_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_stock_movements` ADD CONSTRAINT `product_stock_movements_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;