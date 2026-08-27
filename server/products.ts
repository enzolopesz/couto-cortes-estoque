import { and, asc, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { inventoryProducts, productInventory, productionRecords, filaments, stockMovements, users } from "../drizzle/schema";
import { calculateMovementResult, convertMovementToBase, getDb } from "./db";

export type ProductInput = {
  ownerId: number;
  name: string;
  category?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  externalProductId?: string | null;
  active?: boolean;
};

export async function listInventoryProducts(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.select({
    id: inventoryProducts.id,
    name: inventoryProducts.name,
    category: inventoryProducts.category,
    imageUrl: inventoryProducts.imageUrl,
    sku: inventoryProducts.sku,
    externalProductId: inventoryProducts.externalProductId,
    active: inventoryProducts.active,
    createdAt: inventoryProducts.createdAt,
    updatedAt: inventoryProducts.updatedAt,
    quantityAvailable: productInventory.quantityAvailable,
    minimumQuantity: productInventory.minimumQuantity,
    storageLocation: productInventory.storageLocation,
    ownerId: inventoryProducts.ownerId,
  }).from(inventoryProducts)
    .leftJoin(productInventory, eq(productInventory.productId, inventoryProducts.id))
    .where(eq(inventoryProducts.ownerId, ownerId))
    .orderBy(asc(inventoryProducts.name)).then(rows => rows.filter(row => row.ownerId === ownerId));
}

export async function getInventoryProduct(id: string, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const [row] = await db.select({
    id: inventoryProducts.id,
    name: inventoryProducts.name,
    category: inventoryProducts.category,
    imageUrl: inventoryProducts.imageUrl,
    sku: inventoryProducts.sku,
    externalProductId: inventoryProducts.externalProductId,
    active: inventoryProducts.active,
    quantityAvailable: productInventory.quantityAvailable,
    minimumQuantity: productInventory.minimumQuantity,
    storageLocation: productInventory.storageLocation,
    ownerId: inventoryProducts.ownerId,
  }).from(inventoryProducts)
    .leftJoin(productInventory, eq(productInventory.productId, inventoryProducts.id))
    .where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.ownerId, ownerId)))
    .limit(1);
  return row?.ownerId === ownerId ? row : undefined;
}

export async function createInventoryProduct(input: ProductInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const id = randomUUID();
  await db.transaction(async tx => {
    await tx.insert(inventoryProducts).values({
      id,
      ownerId: input.ownerId,
      name: input.name,
      category: input.category || null,
      imageUrl: input.imageUrl || null,
      sku: input.sku || null,
      externalProductId: input.externalProductId || null,
      active: input.active === false ? 0 : 1,
    });
    await tx.insert(productInventory).values({ id: randomUUID(), ownerId: input.ownerId, productId: id, quantityAvailable: 0, minimumQuantity: 0, storageLocation: null });
  });
  return getInventoryProduct(id, input.ownerId);
}

export async function updateInventoryProduct(id: string, ownerId: number, input: Omit<ProductInput, "ownerId">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await getInventoryProduct(id, ownerId);
  if (!existing) return undefined;
  await db.update(inventoryProducts).set({ name: input.name, category: input.category || null, imageUrl: input.imageUrl || null, sku: input.sku || null, externalProductId: input.externalProductId || null, active: input.active === false ? 0 : 1, updatedAt: new Date() }).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.ownerId, ownerId)));
  return getInventoryProduct(id, ownerId);
}

export async function deleteInventoryProduct(id: string, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await getInventoryProduct(id, ownerId);
  if (!existing) return false;
  await db.delete(productInventory).where(and(eq(productInventory.productId, id), eq(productInventory.ownerId, ownerId)));
  await db.delete(inventoryProducts).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.ownerId, ownerId)));
  return true;
}

export async function updateProductInventory(id: string, ownerId: number, quantity: number, minimumQuantity: number, storageLocation?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  if (!Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(minimumQuantity) || minimumQuantity < 0) throw new Error("O estoque de produtos prontos aceita somente números inteiros não negativos");
  const existing = await getInventoryProduct(id, ownerId);
  if (!existing) return undefined;
  await db.update(productInventory).set({ quantityAvailable: quantity, minimumQuantity, storageLocation: storageLocation?.trim() || null, updatedAt: new Date() }).where(and(eq(productInventory.productId, id), eq(productInventory.ownerId, ownerId)));
  return getInventoryProduct(id, ownerId);
}

export async function getProductInventorySummary(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const [summary] = await db.select({ productCount: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryProducts.active} = 1 THEN 1 ELSE 0 END), 0)`, totalAvailable: sql<number>`COALESCE(SUM(${productInventory.quantityAvailable}), 0)`, lowStockCount: sql<number>`COALESCE(SUM(CASE WHEN ${productInventory.quantityAvailable} <= ${productInventory.minimumQuantity} THEN 1 ELSE 0 END), 0)` }).from(inventoryProducts).leftJoin(productInventory, eq(productInventory.productId, inventoryProducts.id)).where(eq(inventoryProducts.ownerId, ownerId));
  return { productCount: Number(summary?.productCount ?? 0), totalAvailable: Number(summary?.totalAvailable ?? 0), lowStockCount: Number(summary?.lowStockCount ?? 0) };
}

export async function listProductionRecords(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.select({ id: productionRecords.id, productId: inventoryProducts.id, productName: inventoryProducts.name, filamentId: filaments.id, filamentMaterial: filaments.material, filamentColor: filaments.color, quantityProduced: productionRecords.quantityProduced, quantityPerUnit: productionRecords.quantityPerUnit, unitUsed: productionRecords.unitUsed, totalConsumedBase: productionRecords.totalConsumedBase, notes: productionRecords.notes, userName: users.name, createdAt: productionRecords.createdAt }).from(productionRecords).innerJoin(inventoryProducts, eq(productionRecords.productId, inventoryProducts.id)).innerJoin(filaments, eq(productionRecords.filamentId, filaments.id)).innerJoin(users, eq(productionRecords.createdBy, users.id)).where(eq(productionRecords.ownerId, ownerId)).orderBy(desc(productionRecords.createdAt)).limit(10);
}

export function affectedRowsOf(result: unknown) {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
  return Number((result as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

export function assertSingleRowAffected(result: unknown, message: string) {
  if (affectedRowsOf(result) !== 1) throw new Error(message);
}

export async function createProduction(input: { ownerId: number; createdBy: number; productId: string; filamentId: number; quantityProduced: number; quantityPerUnit: number; unitUsed: "g" | "kg" | "roll" | "unit"; notes?: string | null }) {
  if (!Number.isInteger(input.quantityProduced) || input.quantityProduced <= 0) throw new Error("A quantidade produzida precisa ser um número inteiro maior que zero");
  if (!Number.isFinite(input.quantityPerUnit) || input.quantityPerUnit <= 0) throw new Error("O consumo por unidade precisa ser maior que zero");
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.transaction(async tx => {
    const [product] = await tx.select({ id: inventoryProducts.id, ownerId: inventoryProducts.ownerId }).from(inventoryProducts).where(and(eq(inventoryProducts.id, input.productId), eq(inventoryProducts.ownerId, input.ownerId), eq(inventoryProducts.active, 1))).limit(1);
    if (!product || product.ownerId !== input.ownerId) throw new Error("Produto interno não encontrado ou inativo");
    const [inventory] = await tx.select().from(productInventory).where(and(eq(productInventory.productId, input.productId), eq(productInventory.ownerId, input.ownerId))).limit(1);
    if (!inventory || inventory.ownerId !== input.ownerId) throw new Error("Estoque do produto não encontrado");
    const [filament] = await tx.select().from(filaments).where(and(eq(filaments.id, input.filamentId), eq(filaments.ownerId, input.ownerId))).limit(1);
    if (!filament || filament.ownerId !== input.ownerId) throw new Error("Material não encontrado");
    const perUnitBase = convertMovementToBase(input.quantityPerUnit, input.unitUsed, filament.baseUnit, filament.weightPerUnit);
    const totalConsumedBase = perUnitBase * input.quantityProduced;
    const { resulting } = calculateMovementResult(Number(filament.currentWeight), "consumption", totalConsumedBase);
    const nextProductQuantity = Number(inventory.quantityAvailable) + input.quantityProduced;
    const filamentUpdate = await tx.update(filaments).set({ currentWeight: filament.baseUnit === "unit" ? resulting : Math.round(resulting), status: resulting === 0 ? "finished" : filament.status, updatedAt: new Date() }).where(and(eq(filaments.id, input.filamentId), eq(filaments.ownerId, input.ownerId), eq(filaments.currentWeight, filament.currentWeight)));
    const affectedRows = Number((filamentUpdate as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
    if (affectedRows !== 1) throw new Error("O saldo do material foi alterado por outra operação. Atualize e tente novamente");
    const movementId = randomUUID();
    await tx.insert(stockMovements).values({ id: movementId, filamentId: input.filamentId, type: "consumption", quantityGrams: filament.baseUnit === "weight" ? totalConsumedBase.toFixed(2) : "0", previousWeightGrams: filament.baseUnit === "weight" ? Number(filament.currentWeight).toFixed(2) : "0", resultingWeightGrams: filament.baseUnit === "weight" ? resulting.toFixed(2) : "0", inputUnit: input.unitUsed, inputQuantity: (input.quantityPerUnit * input.quantityProduced).toFixed(3), quantityBase: totalConsumedBase.toFixed(filament.baseUnit === "unit" ? 0 : 2), previousBalance: Number(filament.currentWeight).toFixed(filament.baseUnit === "unit" ? 0 : 2), resultingBalance: resulting.toFixed(filament.baseUnit === "unit" ? 0 : 2), description: `Produção de ${input.quantityProduced} unidade(s) de ${product.id}`, createdBy: input.createdBy });
    await tx.insert(productionRecords).values({ id: randomUUID(), ownerId: input.ownerId, productId: input.productId, filamentId: input.filamentId, quantityProduced: input.quantityProduced, quantityPerUnit: input.quantityPerUnit.toFixed(3), unitUsed: input.unitUsed, totalConsumedBase: totalConsumedBase.toFixed(2), notes: input.notes?.trim() || null, createdBy: input.createdBy });
    const productUpdate = await tx.update(productInventory).set({ quantityAvailable: nextProductQuantity, updatedAt: new Date() }).where(and(eq(productInventory.productId, input.productId), eq(productInventory.ownerId, input.ownerId), eq(productInventory.quantityAvailable, inventory.quantityAvailable)));
    assertSingleRowAffected(productUpdate, "O estoque do produto foi alterado por outra operação. Atualize e tente novamente");
    return { productId: input.productId, quantityAvailable: nextProductQuantity, materialBalance: resulting, movementId };
  });
}
