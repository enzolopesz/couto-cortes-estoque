import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "./routers";
import { backfillLegacyMovement, calculateMovementResult, compatibleMovementUnits, convertMovementToBase, createStockMovement, resetDbForTests } from "./db";
import type { TrpcContext } from "./_core/context";

const fakeState = vi.hoisted(() => ({
  db: null as { transaction: (callback: (tx: any) => Promise<unknown>) => Promise<unknown> } | null,
  operations: [] as string[],
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => fakeState.db,
}));

function context(user: TrpcContext["user"]): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const user = {
  id: 7,
  openId: "movement-user",
  name: "Gestor",
  email: "gestor@example.com",
  loginMethod: "test",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("movements", () => {
  it("requires authentication to read the audit history", async () => {
    await expect(appRouter.createCaller(context(null)).movements.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("calculates all movement types with the correct resulting weight", () => {
    expect(calculateMovementResult(1000, "entry", 250)).toMatchObject({ resulting: 1250, effectiveQuantity: 250 });
    expect(calculateMovementResult(1000, "consumption", 250)).toMatchObject({ resulting: 750, effectiveQuantity: 250 });
    expect(calculateMovementResult(1000, "loss", 125)).toMatchObject({ resulting: 875, effectiveQuantity: 125 });
    expect(calculateMovementResult(1000, "reservation", 300)).toMatchObject({ resulting: 700, effectiveQuantity: 300 });
    expect(calculateMovementResult(700, "release_reservation", 300)).toMatchObject({ resulting: 1000, effectiveQuantity: 300 });
    expect(calculateMovementResult(1000, "adjustment", 0, 640)).toMatchObject({ resulting: 640, effectiveQuantity: 360 });
  });

  it("converts only compatible units to the item's base", () => {
    expect(compatibleMovementUnits("weight", 1000)).toEqual(["g", "kg", "roll"]);
    expect(compatibleMovementUnits("weight", null)).toEqual(["g", "kg"]);
    expect(compatibleMovementUnits("unit", null)).toEqual(["unit"]);
    expect(compatibleMovementUnits("length", null)).toEqual(["m"]);
    expect(convertMovementToBase(2, "kg", "weight", null)).toBe(2000);
    expect(convertMovementToBase(2, "roll", "weight", 1000)).toBe(2000);
    expect(convertMovementToBase(3, "unit", "unit", null)).toBe(3);
    expect(convertMovementToBase(4, "m", "length", null)).toBe(4);
    expect(() => convertMovementToBase(2.5, "unit", "unit", null)).toThrow("números inteiros");
    expect(() => convertMovementToBase(2.5, "m", "length", null)).toThrow("números inteiros");
    expect(() => convertMovementToBase(2, "g", "unit", null)).toThrow("não aceitam g, kg, rolo ou m");
    expect(() => convertMovementToBase(2, "roll", "weight", null)).toThrow("peso por rolo");
  });

  it("rejects any movement that would make the balance negative", () => {
    expect(() => calculateMovementResult(100, "loss", 101)).toThrow("não pode ficar negativo");
    expect(() => calculateMovementResult(100, "adjustment", 0, -1)).toThrow("não pode ficar negativo");
  });

  it("updates the balance and writes the audit record inside one transaction", async () => {
    resetDbForTests();
    fakeState.operations = [];
    const filament = { id: 11, ownerId: 7, currentWeight: 1000, minimumWeight: 100, status: "available", baseUnit: "weight", weightPerUnit: 1000 };
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [filament] }) }) }),
      update: () => ({ set: () => ({ where: async () => { fakeState.operations.push("update-filament"); return [{ affectedRows: 1 }]; } }) }),
      insert: () => ({ values: async () => { fakeState.operations.push("insert-movement"); } }),
    };
    fakeState.db = { transaction: async callback => { fakeState.operations.push("transaction-start"); const result = await callback(tx); fakeState.operations.push("transaction-commit"); return result; } };
    process.env.DATABASE_URL = "movement-test";

    const result = await createStockMovement({ ownerId: 7, createdBy: 7, filamentId: 11, type: "consumption", inputUnit: "g", inputQuantity: 250 });

    expect(result.resultingWeight).toBe(750);
    expect(fakeState.operations).toEqual(["transaction-start", "update-filament", "insert-movement", "transaction-commit"]);
    delete process.env.DATABASE_URL;
    resetDbForTests();
    fakeState.db = null;
  });

  it("processes unit-based items only as integer un quantities", async () => {
    resetDbForTests();
    fakeState.operations = [];
    const filament = { id: 13, ownerId: 7, currentWeight: 5, minimumWeight: 1, status: "available", baseUnit: "unit", weightPerUnit: null };
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [filament] }) }) }),
      update: () => ({ set: () => ({ where: async () => { fakeState.operations.push("update-unit-filament"); return [{ affectedRows: 1 }]; } }) }),
      insert: () => ({ values: async () => { fakeState.operations.push("insert-unit-movement"); } }),
    };
    fakeState.db = { transaction: async callback => callback(tx) };
    process.env.DATABASE_URL = "movement-unit-test";

    const result = await createStockMovement({ ownerId: 7, createdBy: 7, filamentId: 13, type: "entry", inputUnit: "unit", inputQuantity: 2 });
    expect(result.resultingWeight).toBe(7);
    expect(fakeState.operations).toEqual(["update-unit-filament", "insert-unit-movement"]);
    fakeState.operations = [];
    await expect(createStockMovement({ ownerId: 7, createdBy: 7, filamentId: 13, type: "entry", inputUnit: "g", inputQuantity: 100 })).rejects.toThrow("não aceitam g, kg, rolo ou m");
    expect(fakeState.operations).toEqual([]);
    delete process.env.DATABASE_URL;
    resetDbForTests();
    fakeState.db = null;
  });

  it("rejects fractional adjustments for unit-based items before any write", async () => {
    resetDbForTests();
    fakeState.operations = [];
    const filament = { id: 14, ownerId: 7, currentWeight: 5, minimumWeight: 1, status: "available", baseUnit: "unit", weightPerUnit: null };
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [filament] }) }) }),
      update: () => ({ set: () => ({ where: async () => { fakeState.operations.push("update-fractional-unit"); return [{ affectedRows: 1 }]; } }) }),
      insert: () => ({ values: async () => { fakeState.operations.push("insert-fractional-unit"); } }),
    };
    fakeState.db = { transaction: async callback => callback(tx) };
    process.env.DATABASE_URL = "movement-unit-adjustment-test";

    await expect(createStockMovement({ ownerId: 7, createdBy: 7, filamentId: 14, type: "adjustment", inputUnit: "unit", inputQuantity: 1, adjustmentWeight: 2.5 })).rejects.toThrow("números inteiros");
    expect(fakeState.operations).toEqual([]);
    delete process.env.DATABASE_URL;
    resetDbForTests();
    fakeState.db = null;
  });

  it("executes the migration backfill mapping for legacy movements", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0003_spotty_psylocke.sql"), "utf8");
    const update = migration.split("UPDATE `stock_movements`")[1]?.split("WHERE")[0] ?? "";
    const legacy = { quantityGrams: "250.00", previousWeightGrams: "1000.00", resultingWeightGrams: "750.00" };
    const migrated: Record<string, number | string> = { inputUnit: "g" };
    for (const match of update.matchAll(/`(inputQuantity|quantityBase|previousBalance|resultingBalance)`\s*=\s*`(quantityGrams|previousWeightGrams|resultingWeightGrams)`/g)) {
      const [, target, source] = match;
      if (target && source) migrated[target] = Number(legacy[source as keyof typeof legacy]);
    }
    expect(migrated).toEqual({ inputUnit: "g", inputQuantity: 250, quantityBase: 250, previousBalance: 1000, resultingBalance: 750 });
    expect(backfillLegacyMovement(legacy)).toEqual(migrated);
  });

  it("requires a positive quantity for non-adjustment movements", async () => {
    const caller = appRouter.createCaller(context(user));
    await expect(caller.movements.create({ filamentId: 1, type: "consumption", inputUnit: "g", inputQuantity: 0, description: null })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires the real weight for adjustments", async () => {
    const caller = appRouter.createCaller(context(user));
    await expect(caller.movements.create({ filamentId: 1, type: "adjustment", inputUnit: "g", inputQuantity: 0, description: null })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

  it("rejects negative balance before any transaction write", async () => {
    resetDbForTests();
    fakeState.operations = [];
    const filament = { id: 12, ownerId: 7, currentWeight: 1000, minimumWeight: 10, status: "available", baseUnit: "weight", weightPerUnit: 1000 };
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [filament] }) }) }),
      update: () => ({ set: () => ({ where: async () => { throw new Error("update should not run"); } }) }),
      insert: () => ({ values: async () => { throw new Error("insert should not run"); } }),
    };
    fakeState.db = { transaction: async callback => callback(tx) };
    process.env.DATABASE_URL = "movement-negative-test";

    await expect(createStockMovement({ ownerId: 7, createdBy: 7, filamentId: 12, type: "loss", inputUnit: "g", inputQuantity: 1001 })).rejects.toThrow("não pode ficar negativo");
    expect(fakeState.operations).toEqual([]);

    delete process.env.DATABASE_URL;
    resetDbForTests();
    fakeState.db = null;
  });
