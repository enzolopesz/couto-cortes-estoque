import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Inventory records are scoped to the authenticated owner. Every server
 * query and mutation also applies ownerId as an application-level RLS guard.
 */
export const filaments = mysqlTable("filaments", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id),
  material: varchar("material", { length: 80 }).notNull(),
  color: varchar("color", { length: 80 }).notNull(),
  brand: varchar("brand", { length: 120 }).notNull(),
  diameter: decimal("diameter", { precision: 4, scale: 2 }).notNull(),
  baseUnit: mysqlEnum("baseUnit", ["weight", "unit", "length"]).default("weight").notNull(),
  measurementUnit: mysqlEnum("measurementUnit", ["g", "kg", "unit", "m"]).default("g").notNull(),
  weightPerUnit: int("weightPerUnit"),
  initialWeight: int("initialWeight").notNull(),
  currentWeight: int("currentWeight").notNull(),
  minimumWeight: int("minimumWeight").notNull(),
  rollCost: decimal("rollCost", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["available", "reserved", "finished"]).default("available").notNull(),
  observation: text("observation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Filament = typeof filaments.$inferSelect;
export type InsertFilament = typeof filaments.$inferInsert;

/**
 * Immutable audit log for inventory changes. IDs use the project's existing
 * numeric user/filament keys; movement ids are UUID strings generated server-side.
 */
export const stockMovements = mysqlTable("stock_movements", {
  id: varchar("id", { length: 36 }).primaryKey(),
  filamentId: int("filamentId").notNull().references(() => filaments.id),
  type: mysqlEnum("type", ["entry", "consumption", "loss", "adjustment", "reservation", "release_reservation"]).notNull(),
  quantityGrams: decimal("quantityGrams", { precision: 12, scale: 2 }).notNull(),
  previousWeightGrams: decimal("previousWeightGrams", { precision: 12, scale: 2 }).notNull(),
  resultingWeightGrams: decimal("resultingWeightGrams", { precision: 12, scale: 2 }).notNull(),
  inputUnit: mysqlEnum("inputUnit", ["g", "kg", "roll", "unit", "m"]).default("g").notNull(),
  inputQuantity: decimal("inputQuantity", { precision: 12, scale: 3 }).default("0").notNull(),
  quantityBase: decimal("quantityBase", { precision: 12, scale: 2 }).default("0").notNull(),
  previousBalance: decimal("previousBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  resultingBalance: decimal("resultingBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  description: text("description"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;

/** Internal, independent catalog for finished products. */
export const inventoryProducts = mysqlTable("inventory_products", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 120 }),
  imageUrl: text("image_url"),
  sku: varchar("sku", { length: 80 }),
  externalProductId: varchar("external_product_id", { length: 120 }),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type InventoryProduct = typeof inventoryProducts.$inferSelect;
export type InsertInventoryProduct = typeof inventoryProducts.$inferInsert;

export const productMaterials = mysqlTable("product_materials", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => inventoryProducts.id),
  filamentId: int("filament_id").notNull().references(() => filaments.id),
  quantityBase: decimal("quantity_base", { precision: 12, scale: 3 }).notNull(),
  unitType: mysqlEnum("unit_type", ["g", "m", "unit"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ProductMaterial = typeof productMaterials.$inferSelect;
export type InsertProductMaterial = typeof productMaterials.$inferInsert;

export const productInventory = mysqlTable("product_inventory", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id),
  productId: varchar("product_id", { length: 36 }).notNull().unique().references(() => inventoryProducts.id),
  quantityAvailable: int("quantity_available").default(0).notNull(),
  minimumQuantity: int("minimum_quantity").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ProductInventory = typeof productInventory.$inferSelect;
export type InsertProductInventory = typeof productInventory.$inferInsert;

export const productionRecords = mysqlTable("production_records", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => inventoryProducts.id),
  filamentId: int("filament_id").notNull().references(() => filaments.id),
  quantityProduced: int("quantity_produced").notNull(),
  quantityPerUnit: decimal("quantity_per_unit", { precision: 12, scale: 3 }).notNull(),
  unitUsed: varchar("unit_used", { length: 12 }).notNull(),
  totalConsumedBase: decimal("total_consumed_base", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProductionRecord = typeof productionRecords.$inferSelect;
export type InsertProductionRecord = typeof productionRecords.$inferInsert;
