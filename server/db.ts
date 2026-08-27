import { and, count, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { filaments, InsertFilament, InsertUser, users, User } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: Partial<User> & { openId: string } = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach(field => {
      const value = user[field];
      if (value !== undefined) {
        values[field] = value ?? null;
        updateSet[field] = value ?? null;
      }
    });

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values as typeof users.$inferInsert).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

function requireDb() {
  if (!_db) {
    throw new Error("Database is not configured");
  }
  return _db;
}

export async function listFilamentsByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db
    .select()
    .from(filaments)
    .where(eq(filaments.ownerId, ownerId))
    .orderBy(desc(filaments.createdAt));
}

export async function getFilamentById(id: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const rows = await db
    .select()
    .from(filaments)
    .where(and(eq(filaments.id, id), eq(filaments.ownerId, ownerId)))
    .limit(1);
  return rows[0];
}

export async function createFilament(data: Omit<InsertFilament, "id" | "createdAt" | "updatedAt">) {
  const db = requireDb();
  const result = await db.insert(filaments).values(data);
  const insertedId = Number(result[0].insertId);
  return getFilamentById(insertedId, data.ownerId);
}

export async function updateFilament(id: number, ownerId: number, data: Partial<Omit<InsertFilament, "id" | "ownerId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db
    .update(filaments)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(filaments.id, id), eq(filaments.ownerId, ownerId)));
  return getFilamentById(id, ownerId);
}

export async function deleteFilament(id: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(filaments).where(and(eq(filaments.id, id), eq(filaments.ownerId, ownerId)));
}

export async function getInventorySummary(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const [summary] = await db
    .select({
      filamentCount: count(filaments.id),
      totalWeight: sql<number>`COALESCE(SUM(${filaments.currentWeight}), 0)`,
      lowStockCount: sql<number>`COALESCE(SUM(CASE WHEN ${filaments.currentWeight} <= ${filaments.minimumWeight} THEN 1 ELSE 0 END), 0)`,
    })
    .from(filaments)
    .where(eq(filaments.ownerId, ownerId));

  return {
    filamentCount: Number(summary?.filamentCount ?? 0),
    totalWeight: Number(summary?.totalWeight ?? 0),
    lowStockCount: Number(summary?.lowStockCount ?? 0),
  };
}
