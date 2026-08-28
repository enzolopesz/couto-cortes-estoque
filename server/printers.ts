import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  filaments,
  inventoryProducts,
  productInventory,
  productMaterials,
  productStockMovements,
  productionRecords,
  productionRunLocks,
  productionRunMaterials,
  productionRuns,
  printers,
  stockMovements,
} from "../drizzle/schema";
import { getDb } from "./db";
import { assertSingleRowAffected, affectedRowsOf } from "./products";

type RunStatus = "RUNNING" | "FINISHED" | "CANCELED" | "FAILED";
type RunUnit = "g" | "m" | "unit";

type LockedFilament = {
  id: number;
  brand: string;
  material: string;
  color: string;
  baseUnit: "weight" | "unit" | "length";
  currentWeight: number;
  status: "available" | "reserved" | "finished";
};

function requireDb() {
  return getDb().then(db => {
    if (!db) throw new Error("Database is not configured");
    return db;
  });
}

function normalizeRun(row: any) {
  return row ? { ...row, plannedQuantity: Number(row.plannedQuantity), producedQuantity: Number(row.producedQuantity ?? 0) } : row;
}

function durationMinutes(startedAt: Date | string, finishedAt: Date | string | null) {
  if (!finishedAt) return null;
  return Math.max(0, (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000);
}

function formatRunUnit(baseUnit: string): RunUnit {
  return baseUnit === "unit" ? "unit" : baseUnit === "length" ? "m" : "g";
}

export function calculateReservationPreview(physical: number, reserved: number, required: number) {
  const available = physical - reserved;
  return { physical, reserved, required, available, missing: Math.max(0, required - available) };
}

export function calculateHistoricalEstimate(records: Array<{ startedAt: Date | string; finishedAt: Date | string | null; producedQuantity: number | string }>, quantity: number, source: "printer" | "product") {
  const perUnit = records.map(record => durationMinutes(record.startedAt, record.finishedAt)! / Number(record.producedQuantity)).filter(value => Number.isFinite(value) && value > 0);
  if (!perUnit.length) return { estimatedMinutes: null, sampleCount: 0, source: "none" as const };
  return { estimatedMinutes: perUnit.reduce((sum, value) => sum + value, 0) / perUnit.length * quantity, sampleCount: perUnit.length, source };
}

async function lockFilament(tx: any, filamentId: number, ownerId: number): Promise<LockedFilament> {
  const result = await tx.execute(sql`SELECT id, brand, material, color, baseUnit AS base_unit, currentWeight AS current_weight, status FROM filaments WHERE id = ${filamentId} AND ownerId = ${ownerId} FOR UPDATE`);
  const row = (result as any)[0]?.[0] ?? (result as any)[0];
  if (!row) throw new Error("Um material da ficha técnica não foi encontrado");
  return { id: Number(row.id), brand: row.brand, material: row.material, color: row.color, baseUnit: row.base_unit, currentWeight: Number(row.current_weight), status: row.status };
}

async function reservedForFilament(tx: any, filamentId: number, ownerId: number) {
  const [row] = await tx.select({ reserved: sql<number>`COALESCE(SUM(${productionRunMaterials.reservedQuantityBase}), 0)` })
    .from(productionRunMaterials)
    .innerJoin(productionRuns, eq(productionRunMaterials.runId, productionRuns.id))
    .where(and(eq(productionRunMaterials.filamentId, filamentId), eq(productionRunMaterials.ownerId, ownerId), eq(productionRuns.status, "RUNNING")));
  return Number(row?.reserved ?? 0);
}

export async function listPrinters(ownerId: number) {
  const db = await requireDb();
  const rows = await db.select().from(printers).where(eq(printers.ownerId, ownerId)).orderBy(desc(printers.createdAt));
  const locks = await db.select({ runId: productionRunLocks.runId, printerId: productionRunLocks.printerId }).from(productionRunLocks).where(eq(productionRunLocks.ownerId, ownerId));
  const lockByPrinter = new Map(locks.map(lock => [lock.printerId, lock.runId]));
  const runs = locks.length ? await db.select({ run: productionRuns, product: inventoryProducts }).from(productionRuns).innerJoin(inventoryProducts, eq(productionRuns.productId, inventoryProducts.id)).where(and(eq(productionRuns.ownerId, ownerId), eq(productionRuns.status, "RUNNING"))) : [];
  const runById = new Map(runs.map(row => [row.run.id, { ...normalizeRun(row.run), product: row.product }]));
  return Promise.all(rows.map(async printer => {
    const run = lockByPrinter.get(printer.id) ? runById.get(lockByPrinter.get(printer.id)!) ?? null : null;
    const estimate = run ? await getEstimateTx(db, ownerId, run.productId, printer.id, run.plannedQuantity) : null;
    return { ...printer, active: Boolean(printer.active), status: lockByPrinter.has(printer.id) ? "PRODUCING" as const : "FREE" as const, run: run ? { ...run, estimate } : null };
  }));
}

export async function createPrinter(input: { ownerId: number; name: string; model?: string | null; active?: boolean }) {
  const db = await requireDb();
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome da impressora");
  const id = randomUUID();
  await db.insert(printers).values({ id, ownerId: input.ownerId, name, model: input.model?.trim() || null, active: input.active === false ? 0 : 1 });
  return db.select().from(printers).where(and(eq(printers.id, id), eq(printers.ownerId, input.ownerId))).limit(1).then(rows => rows[0]);
}

export async function updatePrinter(input: { ownerId: number; id: string; name: string; model?: string | null; active: boolean }) {
  const db = await requireDb();
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome da impressora");
  const [running] = await db.select({ runId: productionRunLocks.runId }).from(productionRunLocks).where(and(eq(productionRunLocks.printerId, input.id), eq(productionRunLocks.ownerId, input.ownerId))).limit(1);
  if (running && !input.active) throw new Error("Finalize ou cancele a produção antes de inativar esta impressora");
  await db.update(printers).set({ name, model: input.model?.trim() || null, active: input.active ? 1 : 0, updatedAt: new Date() }).where(and(eq(printers.id, input.id), eq(printers.ownerId, input.ownerId)));
  const [printer] = await db.select().from(printers).where(and(eq(printers.id, input.id), eq(printers.ownerId, input.ownerId))).limit(1);
  if (!printer) throw new Error("Impressora não encontrada");
  return printer;
}

export async function deletePrinter(ownerId: number, id: string) {
  const db = await requireDb();
  const [running] = await db.select({ runId: productionRunLocks.runId }).from(productionRunLocks).where(and(eq(productionRunLocks.printerId, id), eq(productionRunLocks.ownerId, ownerId))).limit(1);
  if (running) throw new Error("Não é possível excluir uma impressora produzindo");
  const runs = await db.select({ id: productionRuns.id }).from(productionRuns).where(and(eq(productionRuns.printerId, id), eq(productionRuns.ownerId, ownerId))).limit(1);
  if (runs.length) throw new Error("Não é possível excluir uma impressora com histórico; inative-a para preservar os registros");
  await db.delete(printers).where(and(eq(printers.id, id), eq(printers.ownerId, ownerId)));
  return { id };
}

async function getEstimateTx(tx: any, ownerId: number, productId: string, printerId: string, quantity: number) {
  const samePrinter = await tx.select({ startedAt: productionRuns.startedAt, finishedAt: productionRuns.finishedAt, producedQuantity: productionRuns.producedQuantity })
    .from(productionRuns).where(and(eq(productionRuns.ownerId, ownerId), eq(productionRuns.productId, productId), eq(productionRuns.printerId, printerId), eq(productionRuns.status, "FINISHED"), sql`${productionRuns.producedQuantity} > 0`, sql`${productionRuns.finishedAt} IS NOT NULL`)).orderBy(desc(productionRuns.finishedAt)).limit(5);
  const usePrinterHistory = samePrinter.length >= 5;
  const general = usePrinterHistory ? samePrinter : await tx.select({ startedAt: productionRuns.startedAt, finishedAt: productionRuns.finishedAt, producedQuantity: productionRuns.producedQuantity })
    .from(productionRuns).where(and(eq(productionRuns.ownerId, ownerId), eq(productionRuns.productId, productId), eq(productionRuns.status, "FINISHED"), sql`${productionRuns.producedQuantity} > 0`, sql`${productionRuns.finishedAt} IS NOT NULL`)).orderBy(desc(productionRuns.finishedAt)).limit(5);
  return calculateHistoricalEstimate(general, quantity, usePrinterHistory ? "printer" : "product");
}

export async function getProductionEstimate(ownerId: number, productId: string, printerId: string, quantity: number) {
  const db = await requireDb();
  return getEstimateTx(db, ownerId, productId, printerId, quantity);
}

export async function getProductionPreview(ownerId: number, productId: string, quantity: number) {
  const db = await requireDb();
  const bom = await db.select({ material: productMaterials, filament: filaments }).from(productMaterials).innerJoin(filaments, eq(productMaterials.filamentId, filaments.id)).where(and(eq(productMaterials.ownerId, ownerId), eq(productMaterials.productId, productId), eq(filaments.ownerId, ownerId))).limit(100);
  return Promise.all(bom.map(async row => {
    const physical = Number(row.filament.currentWeight);
    const reserved = await reservedForFilament(db, row.filament.id, ownerId);
    const required = Number(row.material.quantityBase) * quantity;
    const balance = calculateReservationPreview(physical, reserved, required);
    return { filamentId: row.filament.id, name: `${row.filament.brand} · ${row.filament.material} · ${row.filament.color}`, unit: row.material.unitType as RunUnit, perUnit: Number(row.material.quantityBase), ...balance };
  }));
}

export async function startProduction(input: { ownerId: number; startedBy: number; printerId: string; productId: string; plannedQuantity: number; notes?: string | null }) {
  if (!Number.isInteger(input.plannedQuantity) || input.plannedQuantity <= 0) throw new Error("A quantidade planejada precisa ser um inteiro maior que zero");
  const db = await requireDb();
  return db.transaction(async tx => {
    const [printer] = await tx.select().from(printers).where(and(eq(printers.id, input.printerId), eq(printers.ownerId, input.ownerId), eq(printers.active, 1))).limit(1);
    if (!printer) throw new Error("Impressora não encontrada ou inativa");
    const [existingLock] = await tx.select().from(productionRunLocks).where(and(eq(productionRunLocks.printerId, input.printerId), eq(productionRunLocks.ownerId, input.ownerId))).limit(1);
    if (existingLock) throw new Error("Esta impressora já possui uma produção em andamento");
    const [product] = await tx.select().from(inventoryProducts).where(and(eq(inventoryProducts.id, input.productId), eq(inventoryProducts.ownerId, input.ownerId), eq(inventoryProducts.active, 1))).limit(1);
    if (!product) throw new Error("Produto interno não encontrado ou inativo");
    const bom = await tx.select().from(productMaterials).where(and(eq(productMaterials.productId, input.productId), eq(productMaterials.ownerId, input.ownerId))).limit(100);
    if (!bom.length) throw new Error("O produto não possui materiais cadastrados na ficha técnica");
    const calculations: Array<{ filament: LockedFilament; perUnit: number; reserved: number; unitType: RunUnit; available: number }> = [];
    for (const row of bom) {
      const filament = await lockFilament(tx, row.filamentId, input.ownerId);
      const reserved = Number(row.quantityBase) * input.plannedQuantity;
      const alreadyReserved = await reservedForFilament(tx, filament.id, input.ownerId);
      const available = filament.currentWeight - alreadyReserved;
      if (!Number.isFinite(reserved) || reserved <= 0) throw new Error(`Consumo inválido para ${filament.brand} ${filament.material}`);
      if (available < reserved) throw new Error(`Estoque disponível insuficiente para ${filament.brand} ${filament.material} ${filament.color}. Necessário: ${reserved} ${formatRunUnit(filament.baseUnit)}. Disponível: ${Math.max(0, available)} ${formatRunUnit(filament.baseUnit)}. Faltam: ${reserved - Math.max(0, available)} ${formatRunUnit(filament.baseUnit)}.`);
      calculations.push({ filament, perUnit: Number(row.quantityBase), reserved, unitType: row.unitType as RunUnit, available });
    }
    const runId = randomUUID();
    const startedAt = new Date();
    await tx.insert(productionRuns).values({ id: runId, ownerId: input.ownerId, printerId: input.printerId, productId: input.productId, plannedQuantity: input.plannedQuantity, producedQuantity: 0, status: "RUNNING", startedAt, startedBy: input.startedBy, notes: input.notes?.trim() || null });
    try {
      await tx.insert(productionRunLocks).values({ printerId: input.printerId, runId, ownerId: input.ownerId });
    } catch {
      throw new Error("Esta impressora já possui uma produção em andamento");
    }
    await tx.insert(productionRunMaterials).values(calculations.map(item => ({ id: randomUUID(), ownerId: input.ownerId, runId, filamentId: item.filament.id, quantityPerUnitBase: item.perUnit.toFixed(3), reservedQuantityBase: item.reserved.toFixed(3), consumedQuantityBase: "0", unitType: item.unitType })));
    const estimate = await getEstimateTx(tx, input.ownerId, input.productId, input.printerId, input.plannedQuantity);
    return { id: runId, startedAt, estimate, productName: product.name, printerName: printer.name, materials: calculations.map(item => ({ filamentId: item.filament.id, name: `${item.filament.brand} · ${item.filament.material} · ${item.filament.color}`, quantityPerUnit: item.perUnit, totalReserved: item.reserved, unit: item.unitType, physical: item.filament.currentWeight, reserved: item.reserved, available: item.available })) };
  });
}

async function getLockedRun(tx: any, ownerId: number, runId: string) {
  const result = await tx.execute(sql`SELECT id, owner_id, printer_id, product_id, planned_quantity, produced_quantity, status, started_at, finished_at, started_by, finished_by, notes, created_at FROM production_runs WHERE id = ${runId} AND owner_id = ${ownerId} FOR UPDATE`);
  const row = (result as any)[0]?.[0] ?? (result as any)[0];
  if (!row) throw new Error("Produção não encontrada");
  return { id: row.id, ownerId: Number(row.owner_id), printerId: row.printer_id, productId: row.product_id, plannedQuantity: Number(row.planned_quantity), producedQuantity: Number(row.produced_quantity), status: row.status as RunStatus, startedAt: row.started_at, finishedAt: row.finished_at, startedBy: Number(row.started_by), finishedBy: row.finished_by ? Number(row.finished_by) : null, notes: row.notes, createdAt: row.created_at };
}

export async function finishProduction(input: { ownerId: number; finishedBy: number; runId: string; producedQuantity: number; notes?: string | null }) {
  if (!Number.isInteger(input.producedQuantity) || input.producedQuantity < 0) throw new Error("A quantidade produzida precisa ser um inteiro igual ou maior que zero");
  const db = await requireDb();
  return db.transaction(async tx => {
    const run = await getLockedRun(tx, input.ownerId, input.runId);
    if (run.status !== "RUNNING") throw new Error("Esta produção já foi encerrada");
    if (input.producedQuantity > run.plannedQuantity) throw new Error("A quantidade produzida não pode ser maior que a planejada");
    const [product] = await tx.select().from(inventoryProducts).where(and(eq(inventoryProducts.id, run.productId), eq(inventoryProducts.ownerId, input.ownerId))).limit(1);
    const [inventory] = await tx.select().from(productInventory).where(and(eq(productInventory.productId, run.productId), eq(productInventory.ownerId, input.ownerId))).limit(1);
    if (!product || !inventory) throw new Error("Produto ou estoque do produto não encontrado");
    const materials = await tx.select().from(productionRunMaterials).where(and(eq(productionRunMaterials.runId, run.id), eq(productionRunMaterials.ownerId, input.ownerId))).limit(100);
    for (const material of materials) {
      const filament = await lockFilament(tx, material.filamentId, input.ownerId);
      const consumed = Number(material.quantityPerUnitBase) * input.producedQuantity;
      const next = filament.currentWeight - consumed;
      if (next < 0) throw new Error(`O saldo físico de ${filament.brand} ${filament.material} ficou insuficiente para finalizar a produção`);
      const update = await tx.update(filaments).set({ currentWeight: filament.baseUnit === "unit" ? Math.round(next) : Number(next.toFixed(3)), status: next === 0 ? "finished" : filament.status, updatedAt: new Date() }).where(and(eq(filaments.id, filament.id), eq(filaments.ownerId, input.ownerId), eq(filaments.currentWeight, filament.currentWeight)));
      assertSingleRowAffected(update, "O saldo de um material foi alterado por outra operação. Atualize e tente novamente");
      if (consumed > 0) await tx.insert(stockMovements).values({ id: randomUUID(), filamentId: filament.id, type: "consumption", quantityGrams: filament.baseUnit === "weight" ? consumed.toFixed(2) : "0", previousWeightGrams: filament.baseUnit === "weight" ? filament.currentWeight.toFixed(2) : "0", resultingWeightGrams: filament.baseUnit === "weight" ? next.toFixed(2) : "0", inputUnit: material.unitType, inputQuantity: consumed.toFixed(3), quantityBase: consumed.toFixed(filament.baseUnit === "unit" ? 0 : 2), previousBalance: filament.currentWeight.toFixed(filament.baseUnit === "unit" ? 0 : 2), resultingBalance: next.toFixed(filament.baseUnit === "unit" ? 0 : 2), description: `Produção finalizada · ${product.name}`, createdBy: input.finishedBy });
      await tx.update(productionRunMaterials).set({ consumedQuantityBase: consumed.toFixed(3) }).where(and(eq(productionRunMaterials.id, material.id), eq(productionRunMaterials.runId, run.id)));
      await tx.insert(productionRecords).values({ id: randomUUID(), ownerId: input.ownerId, productId: run.productId, filamentId: filament.id, productionEventId: run.id, quantityProduced: input.producedQuantity, quantityPerUnit: Number(material.quantityPerUnitBase).toFixed(3), unitUsed: material.unitType, totalConsumedBase: consumed.toFixed(2), notes: input.notes?.trim() || run.notes || null, createdBy: input.finishedBy });
    }
    const nextProduct = Number(inventory.quantityAvailable) + input.producedQuantity;
    const productUpdate = await tx.update(productInventory).set({ quantityAvailable: nextProduct, updatedAt: new Date() }).where(and(eq(productInventory.productId, run.productId), eq(productInventory.ownerId, input.ownerId), eq(productInventory.quantityAvailable, inventory.quantityAvailable)));
    assertSingleRowAffected(productUpdate, "O estoque do produto foi alterado por outra operação. Atualize e tente novamente");
    if (input.producedQuantity > 0) await tx.insert(productStockMovements).values({ id: randomUUID(), ownerId: input.ownerId, productId: run.productId, type: "production", previousQuantity: inventory.quantityAvailable, quantityDelta: input.producedQuantity, resultingQuantity: nextProduct, reason: "production", notes: input.notes?.trim() || run.notes || null, createdBy: input.finishedBy });
    const finishedAt = new Date();
    const runUpdate = await tx.update(productionRuns).set({ producedQuantity: input.producedQuantity, status: "FINISHED", finishedAt, finishedBy: input.finishedBy, notes: input.notes?.trim() || run.notes || null }).where(and(eq(productionRuns.id, run.id), eq(productionRuns.ownerId, input.ownerId), eq(productionRuns.status, "RUNNING")));
    assertSingleRowAffected(runUpdate, "A produção foi encerrada por outra operação");
    await tx.delete(productionRunLocks).where(and(eq(productionRunLocks.printerId, run.printerId), eq(productionRunLocks.runId, run.id)));
    return { runId: run.id, producedQuantity: input.producedQuantity, quantityAvailable: nextProduct, durationMinutes: durationMinutes(run.startedAt, finishedAt) };
  });
}

export async function cancelProduction(input: { ownerId: number; finishedBy: number; runId: string; notes?: string | null }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const run = await getLockedRun(tx, input.ownerId, input.runId);
    if (run.status !== "RUNNING") throw new Error("Esta produção já foi encerrada");
    const finishedAt = new Date();
    const update = await tx.update(productionRuns).set({ status: "CANCELED", finishedAt, finishedBy: input.finishedBy, notes: input.notes?.trim() || run.notes || null }).where(and(eq(productionRuns.id, run.id), eq(productionRuns.ownerId, input.ownerId), eq(productionRuns.status, "RUNNING")));
    assertSingleRowAffected(update, "A produção foi encerrada por outra operação");
    await tx.delete(productionRunLocks).where(and(eq(productionRunLocks.printerId, run.printerId), eq(productionRunLocks.runId, run.id)));
    return { runId: run.id, status: "CANCELED" as const };
  });
}

export async function listProductionRunHistory(ownerId: number) {
  const db = await requireDb();
  const rows = await db.select({ run: productionRuns, printer: printers, product: inventoryProducts }).from(productionRuns).innerJoin(printers, eq(productionRuns.printerId, printers.id)).innerJoin(inventoryProducts, eq(productionRuns.productId, inventoryProducts.id)).where(and(eq(productionRuns.ownerId, ownerId), eq(printers.ownerId, ownerId), eq(inventoryProducts.ownerId, ownerId))).orderBy(desc(productionRuns.createdAt)).limit(50);
  return rows.map(row => ({ ...normalizeRun(row.run), printerName: row.printer.name, printerModel: row.printer.model, productName: row.product.name, durationMinutes: durationMinutes(row.run.startedAt, row.run.finishedAt) }));
}

export async function getTrackingSummary(ownerId: number) {
  const db = await requireDb();
  const [printerCount] = await db.select({ total: sql<number>`COUNT(*)` }).from(printers).where(and(eq(printers.ownerId, ownerId), eq(printers.active, 1)));
  const [runningCount] = await db.select({ total: sql<number>`COUNT(*)` }).from(productionRuns).where(and(eq(productionRuns.ownerId, ownerId), eq(productionRuns.status, "RUNNING")));
  return { activePrinters: Number(printerCount?.total ?? 0), runningProductions: Number(runningCount?.total ?? 0) };
}

export async function getRunMaterials(ownerId: number, runId: string) {
  const db = await requireDb();
  const rows = await db.select({ reservation: productionRunMaterials, filament: filaments }).from(productionRunMaterials).innerJoin(filaments, eq(productionRunMaterials.filamentId, filaments.id)).where(and(eq(productionRunMaterials.ownerId, ownerId), eq(productionRunMaterials.runId, runId), eq(filaments.ownerId, ownerId)));
  return rows.map(row => ({ ...row.reservation, filamentName: `${row.filament.brand} · ${row.filament.material} · ${row.filament.color}`, currentBalance: Number(row.filament.currentWeight), reservedBalance: Number(row.reservation.reservedQuantityBase), availableBalance: Number(row.filament.currentWeight) - Number(row.reservation.reservedQuantityBase) }));
}

export { durationMinutes };
