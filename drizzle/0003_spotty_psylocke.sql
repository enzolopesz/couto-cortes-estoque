ALTER TABLE `filaments` ADD `baseUnit` enum('weight','unit') DEFAULT 'weight' NOT NULL;--> statement-breakpoint
ALTER TABLE `filaments` ADD `weightPerUnit` int;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `inputUnit` enum('g','kg','roll','unit') DEFAULT 'g' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `inputQuantity` decimal(12,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `quantityBase` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `previousBalance` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `resultingBalance` decimal(12,2) DEFAULT '0' NOT NULL;

--> statement-breakpoint
UPDATE `stock_movements`
SET `inputUnit` = 'g',
    `inputQuantity` = `quantityGrams`,
    `quantityBase` = `quantityGrams`,
    `previousBalance` = `previousWeightGrams`,
    `resultingBalance` = `resultingWeightGrams`
WHERE `inputQuantity` = 0 AND `quantityGrams` <> 0;
