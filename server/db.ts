import { and, count, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { filaments, InsertFilament, InsertUser, users, User, stockMovements, inventoryProducts, productStockMovements } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/** Test-only reset hook; production code never calls this. */
export function resetDbForTests() {
  _db = null;
}

export function setDbForTests(db: ReturnType<typeof drizzle> | null) {
  _db = db;
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

export function backfillLegacyMovement(row: { quantityGrams: string | number; previousWeightGrams: string | number; resultingWeightGrams: string | number }) {
  return {
    inputUnit: "g" as const,
    inputQuantity: Number(row.quantityGrams),
    quantityBase: Number(row.quantityGrams),
    previousBalance: Number(row.previousWeightGrams),
    resultingBalance: Number(row.resultingWeightGrams),
  };
}

export async function listStockMovementsByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const rows = await db
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
      resultingBalance: stockMovements.resultingBalance,
      inputUnit: stockMovements.inputUnit,
      inputQuantity: stockMovements.inputQuantity,
      quantityBase: stockMovements.quantityBase,
      previousBalance: stockMovements.previousBalance,
      baseUnit: filaments.baseUnit,
      weightPerUnit: filaments.weightPerUnit,
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
  return rows.map(row => ({
    ...row,
    ...((Number(row.inputQuantity) === 0 && Number(row.quantityGrams) !== 0) ? backfillLegacyMovement(row) : {}),
  }));
}

export async function listAllInventoryMovementsByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const filamentRows = await listStockMovementsByOwner(ownerId);
  const productRows = await db.select({ id: productStockMovements.id, productId: inventoryProducts.id, productName: inventoryProducts.name, type: productStockMovements.type, previousQuantity: productStockMovements.previousQuantity, quantityDelta: productStockMovements.quantityDelta, resultingQuantity: productStockMovements.resultingQuantity, reason: productStockMovements.reason, notes: productStockMovements.notes, userName: users.name, userEmail: users.email, createdAt: productStockMovements.createdAt }).from(productStockMovements).innerJoin(inventoryProducts, eq(productStockMovements.productId, inventoryProducts.id)).innerJoin(users, eq(productStockMovements.createdBy, users.id)).where(and(eq(productStockMovements.ownerId, ownerId), eq(inventoryProducts.ownerId, ownerId))).orderBy(desc(productStockMovements.createdAt));
  return [
    ...filamentRows.map(row => ({ entityType: "filament" as const, entityId: String(row.filamentId), entityName: `${row.filamentBrand} · ${row.filamentMaterial}`, reason: null, notes: null, ...row })),
    ...productRows.map(row => ({ entityType: "product" as const, entityId: row.productId, entityName: row.productName, id: row.id, productId: row.productId, productName: row.productName, filamentId: null, filamentMaterial: "", filamentColor: "PRODUTO PRONTO", filamentBrand: row.productName, type: row.type === "out" ? "product_out" as const : row.type === "production" ? "product_production" as const : "product_adjustment" as const, quantityGrams: "0", previousWeightGrams: "0", resultingWeightGrams: "0", resultingBalance: row.resultingQuantity, inputUnit: "unit" as const, inputQuantity: Math.abs(Number(row.quantityDelta)), quantityBase: Math.abs(Number(row.quantityDelta)), previousBalance: row.previousQuantity, baseUnit: "unit" as const, weightPerUnit: null, description: row.notes, createdBy: null, userName: row.userName, userEmail: row.userEmail, createdAt: row.createdAt, reason: row.reason, notes: row.notes })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type MovementType = "entry" | "consumption" | "loss" | "adjustment" | "reservation" | "release_reservation";
export type BaseUnit = "weight" | "unit" | "length";
export type InputUnit = "g" | "kg" | "roll" | "unit" | "m";

export function compatibleMovementUnits(baseUnit: BaseUnit, weightPerUnit?: number | null): InputUnit[] {
  if (baseUnit === "unit") return ["unit"];
  if (baseUnit === "length") return ["m"];
  return weightPerUnit && weightPerUnit > 0 ? ["g", "kg", "roll"] : ["g", "kg"];
}

export function convertMovementToBase(inputQuantity: number, inputUnit: InputUnit, baseUnit: BaseUnit, weightPerUnit?: number | null) {
  if (!Number.isFinite(inputQuantity) || inputQuantity <= 0) throw new Error("A quantidade precisa ser maior que zero");
  if (baseUnit === "unit") {
    if (inputUnit !== "unit") throw new Error("Itens controlados por quantidade não aceitam g, kg, rolo ou m; use un");
    if (!Number.isInteger(inputQuantity)) throw new Error("Itens controlados por quantidade aceitam somente números inteiros em un");
    return inputQuantity;
  }
  if (baseUnit === "length") {
    if (inputUnit !== "m") throw new Error("Itens controlados por comprimento aceitam somente m");
    if (!Number.isInteger(inputQuantity)) throw new Error("Itens controlados por comprimento aceitam somente números inteiros em m");
    return inputQuantity;
  }
  if (inputUnit === "unit" || inputUnit === "m") throw new Error("Itens controlados por peso não aceitam un ou m");
  if (inputUnit === "roll" && (!weightPerUnit || weightPerUnit <= 0)) throw new Error("Este item não possui peso por rolo configurado");
  const grams = inputUnit === "kg" ? inputQuantity * 1000 : inputUnit === "roll" ? inputQuantity * Number(weightPerUnit) : inputQuantity;
  if (!Number.isFinite(grams) || grams <= 0) throw new Error("A conversão da quantidade é inválida");
  return grams;
}

export function calculateMovementResult(previous: number, type: MovementType, quantityBase: number, adjustmentWeight?: number) {
  const resulting = type === "adjustment"
    ? Number(adjustmentWeight)
    : previous + (["entry", "release_reservation"].includes(type) ? quantityBase : -quantityBase);
  if (!Number.isFinite(resulting) || resulting < 0) throw new Error("O saldo do filamento não pode ficar negativo");
  const effectiveQuantity = type === "adjustment" ? Math.abs(resulting - previous) : quantityBase;
  if (effectiveQuantity <= 0) throw new Error("A movimentação precisa alterar o saldo");
  return { resulting, effectiveQuantity };
}

export async function createStockMovement(input: {
  ownerId: number;
  createdBy: number;
  filamentId: number;
  type: MovementType;
  inputUnit: InputUnit;
  inputQuantity: number;
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
    const adjustmentWeight = Number(input.adjustmentWeight);
    if (input.type === "adjustment") {
      if (!Number.isFinite(adjustmentWeight) || adjustmentWeight < 0) throw new Error("O saldo real informado é inválido");
      if (filament.baseUnit !== "weight" && !Number.isInteger(adjustmentWeight)) throw new Error(filament.baseUnit === "length" ? "Itens controlados por comprimento aceitam somente números inteiros em m" : "Itens controlados por quantidade aceitam somente números inteiros em un");
    }
    const quantityBase = input.type === "adjustment"
      ? adjustmentWeight
      : convertMovementToBase(input.inputQuantity, input.inputUnit, filament.baseUnit, filament.weightPerUnit);
    const { resulting, effectiveQuantity } = calculateMovementResult(previous, input.type, quantityBase, adjustmentWeight);

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
      quantityGrams: filament.baseUnit === "weight" ? effectiveQuantity.toFixed(2) : "0",
      previousWeightGrams: filament.baseUnit === "weight" ? previous.toFixed(2) : "0",
      resultingWeightGrams: filament.baseUnit === "weight" ? resulting.toFixed(2) : "0",
      inputUnit: input.type === "adjustment" ? filament.baseUnit === "unit" ? "unit" : filament.baseUnit === "length" ? "m" : "g" : input.inputUnit,
      inputQuantity: input.type === "adjustment" ? effectiveQuantity.toFixed(3) : input.inputQuantity.toFixed(3),
      quantityBase: filament.baseUnit === "unit" ? effectiveQuantity.toFixed(0) : effectiveQuantity.toFixed(2),
      previousBalance: filament.baseUnit === "unit" ? previous.toFixed(0) : previous.toFixed(2),
      resultingBalance: filament.baseUnit === "unit" ? resulting.toFixed(0) : resulting.toFixed(2),
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
      totalWeight: sql<number>`COALESCE(SUM(CASE WHEN ${filaments.baseUnit} = 'weight' THEN ${filaments.currentWeight} ELSE 0 END), 0)`,
      totalLength: sql<number>`COALESCE(SUM(CASE WHEN ${filaments.baseUnit} = 'length' THEN ${filaments.currentWeight} ELSE 0 END), 0)`,
      totalUnits: sql<number>`COALESCE(SUM(CASE WHEN ${filaments.baseUnit} = 'unit' THEN ${filaments.currentWeight} ELSE 0 END), 0)`,
      lowStockCount: sql<number>`COALESCE(SUM(CASE WHEN ${filaments.currentWeight} <= ${filaments.minimumWeight} THEN 1 ELSE 0 END), 0)`,
    })
    .from(filaments)
    .where(eq(filaments.ownerId, ownerId));

  return {
    filamentCount: Number(summary?.filamentCount ?? 0),
    totalWeight: Number(summary?.totalWeight ?? 0),
    totalLength: Number(summary?.totalLength ?? 0),
    totalUnits: Number(summary?.totalUnits ?? 0),
    lowStockCount: Number(summary?.lowStockCount ?? 0),
  };
}
