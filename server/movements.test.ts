import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { calculateMovementResult, createStockMovement, resetDbForTests } from "./db";
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

  it("rejects any movement that would make the balance negative", () => {
    expect(() => calculateMovementResult(100, "loss", 101)).toThrow("não pode ficar negativo");
    expect(() => calculateMovementResult(100, "adjustment", 0, -1)).toThrow("não pode ficar negativo");
  });

  it("updates the balance and writes the audit record inside one transaction", async () => {
    resetDbForTests();
    fakeState.operations = [];
    const filament = { id: 11, ownerId: 7, currentWeight: 1000, minimumWeight: 100, status: "available" };
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [filament] }) }) }),
      update: () => ({ set: () => ({ where: async () => { fakeState.operations.push("update-filament"); return [{ affectedRows: 1 }]; } }) }),
      insert: () => ({ values: async () => { fakeState.operations.push("insert-movement"); } }),
    };
    fakeState.db = { transaction: async callback => { fakeState.operations.push("transaction-start"); const result = await callback(tx); fakeState.operations.push("transaction-commit"); return result; } };
    process.env.DATABASE_URL = "movement-test";

    const result = await createStockMovement({ ownerId: 7, createdBy: 7, filamentId: 11, type: "consumption", quantityGrams: 250 });

    expect(result.resultingWeight).toBe(750);
    expect(fakeState.operations).toEqual(["transaction-start", "update-filament", "insert-movement", "transaction-commit"]);
    delete process.env.DATABASE_URL;
    resetDbForTests();
    fakeState.db = null;
  });

  it("requires a positive quantity for non-adjustment movements", async () => {
    const caller = appRouter.createCaller(context(user));
    await expect(caller.movements.create({ filamentId: 1, type: "consumption", quantityGrams: 0, description: null })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires the real weight for adjustments", async () => {
    const caller = appRouter.createCaller(context(user));
    await expect(caller.movements.create({ filamentId: 1, type: "adjustment", quantityGrams: 0, description: null })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

  it("rejects negative balance before any transaction write", async () => {
    resetDbForTests();
    fakeState.operations = [];
    const filament = { id: 12, ownerId: 7, currentWeight: 1000, minimumWeight: 10, status: "available" };
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [filament] }) }) }),
      update: () => ({ set: () => ({ where: async () => { throw new Error("update should not run"); } }) }),
      insert: () => ({ values: async () => { throw new Error("insert should not run"); } }),
    };
    fakeState.db = { transaction: async callback => callback(tx) };
    process.env.DATABASE_URL = "movement-negative-test";

    await expect(createStockMovement({ ownerId: 7, createdBy: 7, filamentId: 12, type: "loss", quantityGrams: 1001 })).rejects.toThrow("não pode ficar negativo");
    expect(fakeState.operations).toEqual([]);

    delete process.env.DATABASE_URL;
    resetDbForTests();
    fakeState.db = null;
  });
