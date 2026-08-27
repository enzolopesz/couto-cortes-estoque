import { and, count, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { filaments, InsertFilament, InsertUser, users, User, stockMovements } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/** Test-only reset hook; production code never calls this. */
export function resetDbForTests() {
  _db = null;
}

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

export async function listStockMovementsByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db
    .select({
      id: stockMovements.id,
      filamentId: filaments.id,
      filamentMaterial: filaments.material,
      filamentColor: filaments.color,
      filamentBrand: filaments.brand,
      type: stockMovements.type,
      quantityGrams: stockMovements.quantityGrams,
      previousWeightGrams: stockMovements.previousWeightGrams,
      resultingWeightGrams: stockMovements.resultingWeightGrams,
      description: stockMovements.description,
      createdBy: stockMovements.createdBy,
      userName: users.name,
      userEmail: users.email,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(filaments, eq(stockMovements.filamentId, filaments.id))
    .innerJoin(users, eq(stockMovements.createdBy, users.id))
    .where(eq(filaments.ownerId, ownerId))
    .orderBy(desc(stockMovements.createdAt));
}

export type MovementType = "entry" | "consumption" | "loss" | "adjustment" | "reservation" | "release_reservation";

export function calculateMovementResult(previous: number, type: MovementType, quantityGrams: number, adjustmentWeight?: number) {
  const resulting = type === "adjustment"
    ? Number(adjustmentWeight)
    : previous + (["entry", "release_reservation"].includes(type) ? quantityGrams : -quantityGrams);
  if (!Number.isFinite(resulting) || resulting < 0) throw new Error("O saldo do filamento não pode ficar negativo");
  const effectiveQuantity = type === "adjustment" ? Math.abs(resulting - previous) : quantityGrams;
  if (effectiveQuantity <= 0) throw new Error("A movimentação precisa alterar o saldo");
  return { resulting, effectiveQuantity };
}

export async function createStockMovement(input: {
  ownerId: number;
  createdBy: number;
  filamentId: number;
  type: MovementType;
  quantityGrams: number;
  adjustmentWeight?: number;
  description?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");

  return db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(filaments)
      .where(and(eq(filaments.id, input.filamentId), eq(filaments.ownerId, input.ownerId)))
      .limit(1);
    const filament = rows[0];
    if (!filament) throw new Error("Filamento não encontrado");

    const previous = Number(filament.currentWeight);
    const { resulting, effectiveQuantity } = calculateMovementResult(previous, input.type, input.quantityGrams, input.adjustmentWeight);

    const nextStatus = resulting === 0
      ? "finished"
      : input.type === "reservation"
        ? "reserved"
        : input.type === "release_reservation" || filament.status === "finished"
          ? "available"
          : filament.status;
    const updateResult = await tx
      .update(filaments)
      .set({ currentWeight: Math.round(resulting), status: nextStatus, updatedAt: new Date() })
      .where(and(eq(filaments.id, input.filamentId), eq(filaments.ownerId, input.ownerId), eq(filaments.currentWeight, filament.currentWeight)));
    const affectedRows = Number((updateResult as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
    if (affectedRows !== 1) throw new Error("O saldo foi alterado por outra operação. Atualize e tente novamente");

    const movementId = randomUUID();
    await tx.insert(stockMovements).values({
      id: movementId,
      filamentId: input.filamentId,
      type: input.type,
      quantityGrams: effectiveQuantity.toFixed(2),
      previousWeightGrams: previous.toFixed(2),
      resultingWeightGrams: resulting.toFixed(2),
      description: input.description?.trim() || null,
      createdBy: input.createdBy,
    });

    return { movement: { id: movementId }, previousWeight: previous, resultingWeight: resulting };
  });
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
