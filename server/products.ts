import { and, asc, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { inventoryProducts, productInventory, productMaterials, productStockMovements, productionRecords, filaments, stockMovements, users } from "../drizzle/schema";
import { calculateMovementResult, convertMovementToBase, getDb } from "./db";

export type MaterialUnit = "g" | "kg" | "m" | "unit";
export type ProductMaterialInput = { filamentId: number; quantity: number; unit: MaterialUnit };
export type ProductInput = {
  ownerId: number;
  name: string;
  category?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  externalProductId?: string | null;
  active?: boolean;
  quantityAvailable?: number;
  minimumQuantity?: number;
  materials?: ProductMaterialInput[];
};

export function compatibleProductMaterialUnits(baseUnit: "weight" | "unit" | "length"): MaterialUnit[] {
  return baseUnit === "weight" ? ["g", "kg"] : baseUnit === "length" ? ["m"] : ["unit"];
}

export function convertProductMaterialToBase(quantity: number, unit: MaterialUnit, baseUnit: "weight" | "unit" | "length") {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("A quantidade consumida precisa ser maior que zero");
  if (!compatibleProductMaterialUnits(baseUnit).includes(unit)) throw new Error("A unidade do material não é compatível com o tipo de controle do filamento");
  const quantityBase = baseUnit === "weight" && unit === "kg" ? quantity * 1000 : quantity;
  if (!Number.isFinite(quantityBase) || Math.abs(quantityBase - Number(quantityBase.toFixed(3))) > 1e-9) throw new Error("A quantidade precisa ter no máximo três casas decimais na unidade interna");
  return { quantityBase: Number(quantityBase.toFixed(3)), unitType: (baseUnit === "weight" ? "g" : baseUnit === "length" ? "m" : "unit") as "g" | "m" | "unit" };
}

async function normalizeProductMaterials(tx: any, ownerId: number, materials: ProductMaterialInput[] | undefined) {
  if (materials === undefined) return undefined;
  const normalized: Array<{ ownerId: number; productId: string; filamentId: number; quantityBase: number; unitType: "g" | "m" | "unit" }> = [];
  for (const material of materials) {
    const [filament] = await tx.select().from(filaments).where(and(eq(filaments.id, material.filamentId), eq(filaments.ownerId, ownerId))).limit(1);
    if (!filament || filament.ownerId !== ownerId) throw new Error("Um dos filamentos selecionados não pertence ao proprietário atual");
    const converted = convertProductMaterialToBase(material.quantity, material.unit, filament.baseUnit);
    normalized.push({ ownerId, productId: "", filamentId: material.filamentId, ...converted });
  }
  return normalized;
}

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
    ownerId: inventoryProducts.ownerId,
  }).from(inventoryProducts)
    .leftJoin(productInventory, eq(productInventory.productId, inventoryProducts.id))
    .where(eq(inventoryProducts.ownerId, ownerId))
    .orderBy(asc(inventoryProducts.name)).then(rows => rows.filter(row => row.ownerId === ownerId));
}

export async function listProductMaterials(productId: string, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.select({ id: productMaterials.id, productId: productMaterials.productId, filamentId: filaments.id, filamentMaterial: filaments.material, filamentBrand: filaments.brand, filamentColor: filaments.color, filamentDiameter: filaments.diameter, baseUnit: filaments.baseUnit, currentWeight: filaments.currentWeight, quantityBase: productMaterials.quantityBase, unitType: productMaterials.unitType }).from(productMaterials).innerJoin(inventoryProducts, eq(productMaterials.productId, inventoryProducts.id)).innerJoin(filaments, eq(productMaterials.filamentId, filaments.id)).where(and(eq(productMaterials.productId, productId), eq(productMaterials.ownerId, ownerId), eq(inventoryProducts.ownerId, ownerId))).orderBy(asc(productMaterials.createdAt));
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
    await tx.insert(productInventory).values({ id: randomUUID(), ownerId: input.ownerId, productId: id, quantityAvailable: input.quantityAvailable ?? 0, minimumQuantity: input.minimumQuantity ?? 0 });
    const materials = await normalizeProductMaterials(tx, input.ownerId, input.materials);
    if (materials?.length) await tx.insert(productMaterials).values(materials.map(material => ({ ...material, id: randomUUID(), productId: id, quantityBase: material.quantityBase.toFixed(3) })));
  });
  return getInventoryProduct(id, input.ownerId);
}

export async function updateInventoryProduct(id: string, ownerId: number, input: Omit<ProductInput, "ownerId">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await getInventoryProduct(id, ownerId);
  if (!existing) return undefined;
  await db.transaction(async tx => {
    await tx.update(inventoryProducts).set({ name: input.name, category: input.category || null, imageUrl: input.imageUrl || null, sku: input.sku || null, externalProductId: input.externalProductId || null, active: input.active === false ? 0 : 1, updatedAt: new Date() }).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.ownerId, ownerId)));
    if (input.quantityAvailable !== undefined || input.minimumQuantity !== undefined) {
      await tx.update(productInventory).set({ quantityAvailable: input.quantityAvailable ?? Number(existing.quantityAvailable ?? 0), minimumQuantity: input.minimumQuantity ?? Number(existing.minimumQuantity ?? 0), updatedAt: new Date() }).where(and(eq(productInventory.productId, id), eq(productInventory.ownerId, ownerId)));
    }
    if (input.materials !== undefined) {
      const materials = (await normalizeProductMaterials(tx, ownerId, input.materials)) ?? [];
      await tx.delete(productMaterials).where(and(eq(productMaterials.productId, id), eq(productMaterials.ownerId, ownerId)));
      if (materials.length) await tx.insert(productMaterials).values(materials.map(material => ({ ...material, id: randomUUID(), productId: id, quantityBase: material.quantityBase.toFixed(3) })));
    }
  });
  return getInventoryProduct(id, ownerId);
}

export async function deleteInventoryProduct(id: string, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await getInventoryProduct(id, ownerId);
  if (!existing) return false;
  await db.delete(productMaterials).where(and(eq(productMaterials.productId, id), eq(productMaterials.ownerId, ownerId)));
  await db.delete(productInventory).where(and(eq(productInventory.productId, id), eq(productInventory.ownerId, ownerId)));
  await db.delete(inventoryProducts).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.ownerId, ownerId)));
  return true;
}

export async function updateProductInventory(id: string, ownerId: number, quantity: number, minimumQuantity: number, createdBy = ownerId, notes?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  if (!Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(minimumQuantity) || minimumQuantity < 0) throw new Error("O estoque de produtos prontos aceita somente números inteiros não negativos");
  return db.transaction(async tx => {
    const [inventory] = await tx.select().from(productInventory).where(and(eq(productInventory.productId, id), eq(productInventory.ownerId, ownerId))).limit(1);
    if (!inventory || inventory.ownerId !== ownerId) return undefined;
    const previousQuantity = Number(inventory.quantityAvailable);
    const quantityDelta = quantity - previousQuantity;
    const updateResult = await tx.update(productInventory).set({ quantityAvailable: quantity, minimumQuantity, updatedAt: new Date() }).where(and(eq(productInventory.productId, id), eq(productInventory.ownerId, ownerId), eq(productInventory.quantityAvailable, inventory.quantityAvailable)));
    assertSingleRowAffected(updateResult, "O estoque do produto foi alterado por outra operação. Atualize e tente novamente");
    if (quantityDelta !== 0) {
      await tx.insert(productStockMovements).values({ id: randomUUID(), ownerId, productId: id, type: "adjustment", previousQuantity, quantityDelta, resultingQuantity: quantity, reason: "manual", notes: notes?.trim() || null, createdBy });
    }
    return { previousQuantity, quantityDelta, resultingQuantity: quantity };
  }).then(async result => result ? { ...await getInventoryProduct(id, ownerId), stockChange: result } : undefined);
}

export async function createProductStockOut(input: { ownerId: number; createdBy: number; productId: string; quantity: number; reason: "sale" | "delivery" | "internal_use" | "adjustment" | "other"; notes?: string | null }) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error("A quantidade de saída precisa ser um número inteiro maior que zero");
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.transaction(async tx => {
    const [inventory] = await tx.select().from(productInventory).where(and(eq(productInventory.productId, input.productId), eq(productInventory.ownerId, input.ownerId))).limit(1);
    if (!inventory || inventory.ownerId !== input.ownerId) throw new Error("Estoque do produto não encontrado");
    const previousQuantity = Number(inventory.quantityAvailable);
    if (input.quantity > previousQuantity) throw new Error(`Estoque insuficiente: disponível ${previousQuantity} un`);
    const resultingQuantity = previousQuantity - input.quantity;
    const updateResult = await tx.update(productInventory).set({ quantityAvailable: resultingQuantity, updatedAt: new Date() }).where(and(eq(productInventory.productId, input.productId), eq(productInventory.ownerId, input.ownerId), eq(productInventory.quantityAvailable, inventory.quantityAvailable)));
    assertSingleRowAffected(updateResult, "O estoque do produto foi alterado por outra operação. Atualize e tente novamente");
    await tx.insert(productStockMovements).values({ id: randomUUID(), ownerId: input.ownerId, productId: input.productId, type: "out", previousQuantity, quantityDelta: -input.quantity, resultingQuantity, reason: input.reason, notes: input.notes?.trim() || null, createdBy: input.createdBy });
    return { previousQuantity, quantityDelta: -input.quantity, resultingQuantity };
  });
}

export async function listProductStockMovements(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.select({ id: productStockMovements.id, productId: inventoryProducts.id, productName: inventoryProducts.name, type: productStockMovements.type, previousQuantity: productStockMovements.previousQuantity, quantityDelta: productStockMovements.quantityDelta, resultingQuantity: productStockMovements.resultingQuantity, reason: productStockMovements.reason, notes: productStockMovements.notes, userName: users.name, createdAt: productStockMovements.createdAt }).from(productStockMovements).innerJoin(inventoryProducts, eq(productStockMovements.productId, inventoryProducts.id)).innerJoin(users, eq(productStockMovements.createdBy, users.id)).where(and(eq(productStockMovements.ownerId, ownerId), eq(inventoryProducts.ownerId, ownerId))).orderBy(desc(productStockMovements.createdAt)).limit(50);
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

export async function createProduction(input: { ownerId: number; createdBy: number; productId: string; quantityProduced: number; notes?: string | null }) {
  if (!Number.isInteger(input.quantityProduced) || input.quantityProduced <= 0) throw new Error("A quantidade produzida precisa ser um número inteiro maior que zero");
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.transaction(async tx => {
    const [product] = await tx.select({ id: inventoryProducts.id, ownerId: inventoryProducts.ownerId }).from(inventoryProducts).where(and(eq(inventoryProducts.id, input.productId), eq(inventoryProducts.ownerId, input.ownerId), eq(inventoryProducts.active, 1))).limit(1);
    if (!product || product.ownerId !== input.ownerId) throw new Error("Produto interno não encontrado ou inativo");
    const [inventory] = await tx.select().from(productInventory).where(and(eq(productInventory.productId, input.productId), eq(productInventory.ownerId, input.ownerId))).limit(1);
    if (!inventory || inventory.ownerId !== input.ownerId) throw new Error("Estoque do produto não encontrado");
    const bomRows = await tx.select().from(productMaterials).where(and(eq(productMaterials.productId, input.productId), eq(productMaterials.ownerId, input.ownerId))).limit(100);
    const materials = [] as Array<{ filamentId: number; filamentBrand: string; filamentMaterial: string; filamentColor: string; baseUnit: "weight" | "unit" | "length"; currentWeight: number; status: "available" | "reserved" | "finished"; quantityBase: string | number; unitType: "g" | "m" | "unit" }>;
    for (const bomRow of bomRows) {
      const [filament] = await tx.select().from(filaments).where(and(eq(filaments.id, bomRow.filamentId), eq(filaments.ownerId, input.ownerId))).limit(1);
      if (!filament) throw new Error("Um material da ficha técnica não foi encontrado");
      materials.push({ filamentId: filament.id, filamentBrand: filament.brand, filamentMaterial: filament.material, filamentColor: filament.color, baseUnit: filament.baseUnit, currentWeight: filament.currentWeight, status: filament.status, quantityBase: bomRow.quantityBase, unitType: bomRow.unitType });
    }
    if (!materials.length) throw new Error("O produto não possui materiais cadastrados na ficha técnica");
    const calculations = materials.map(material => {
      const perUnitBase = Number(material.quantityBase);
      const totalConsumedBase = perUnitBase * input.quantityProduced;
      const currentBalance = Number(material.currentWeight);
      if (!Number.isFinite(currentBalance) || !Number.isFinite(totalConsumedBase)) throw new Error("Saldo ou consumo inválido na ficha técnica");
      return { ...material, perUnitBase, totalConsumedBase, resulting: currentBalance - totalConsumedBase };
    });
    const insufficient = calculations.find(material => material.resulting < 0);
    if (insufficient) throw new Error(`Saldo insuficiente para ${insufficient.filamentBrand || "material"} ${insufficient.filamentMaterial} ${insufficient.filamentColor}`);
    for (const material of calculations) {
      const filamentUpdate = await tx.update(filaments).set({ currentWeight: material.baseUnit === "unit" ? Math.round(material.resulting) : Number(material.resulting.toFixed(3)), status: material.resulting === 0 ? "finished" : material.status, updatedAt: new Date() }).where(and(eq(filaments.id, material.filamentId), eq(filaments.ownerId, input.ownerId), eq(filaments.currentWeight, material.currentWeight)));
      const affectedRows = Number((filamentUpdate as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
      if (affectedRows !== 1) throw new Error(`O saldo de ${material.filamentMaterial} foi alterado por outra operação. Atualize e tente novamente`);
      const unitUsed = material.unitType as "g" | "m" | "unit";
      await tx.insert(stockMovements).values({ id: randomUUID(), filamentId: material.filamentId, type: "consumption", quantityGrams: material.baseUnit === "weight" ? material.totalConsumedBase.toFixed(2) : "0", previousWeightGrams: material.baseUnit === "weight" ? Number(material.currentWeight).toFixed(2) : "0", resultingWeightGrams: material.baseUnit === "weight" ? material.resulting.toFixed(2) : "0", inputUnit: unitUsed, inputQuantity: material.totalConsumedBase.toFixed(3), quantityBase: material.totalConsumedBase.toFixed(material.baseUnit === "unit" ? 0 : 2), previousBalance: Number(material.currentWeight).toFixed(material.baseUnit === "unit" ? 0 : 2), resultingBalance: material.resulting.toFixed(material.baseUnit === "unit" ? 0 : 2), description: `Produção de ${input.quantityProduced} unidade(s) de ${product.id}`, createdBy: input.createdBy });
      await tx.insert(productionRecords).values({ id: randomUUID(), ownerId: input.ownerId, productId: input.productId, filamentId: material.filamentId, quantityProduced: input.quantityProduced, quantityPerUnit: material.perUnitBase.toFixed(3), unitUsed, totalConsumedBase: material.totalConsumedBase.toFixed(2), notes: input.notes?.trim() || null, createdBy: input.createdBy });
    }
    const nextProductQuantity = Number(inventory.quantityAvailable) + input.quantityProduced;
    const productUpdate = await tx.update(productInventory).set({ quantityAvailable: nextProductQuantity, updatedAt: new Date() }).where(and(eq(productInventory.productId, input.productId), eq(productInventory.ownerId, input.ownerId), eq(productInventory.quantityAvailable, inventory.quantityAvailable)));
    assertSingleRowAffected(productUpdate, "O estoque do produto foi alterado por outra operação. Atualize e tente novamente");
    return { productId: input.productId, quantityAvailable: nextProductQuantity, materials: calculations.map(material => ({ filamentId: material.filamentId, totalConsumedBase: material.totalConsumedBase, resultingBalance: material.resulting })) };
  });
}
