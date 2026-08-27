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
  initialWeight: int("initialWeight").notNull(),
  currentWeight: int("currentWeight").notNull(),
  minimumWeight: int("minimumWeight").notNull(),
  rollCost: decimal("rollCost", { precision: 10, scale: 2 }).notNull(),
  location: varchar("location", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["available", "reserved", "finished"]).default("available").notNull(),
  observation: text("observation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Filament = typeof filaments.$inferSelect;
export type InsertFilament = typeof filaments.$inferInsert;
