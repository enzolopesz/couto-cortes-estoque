import { describe, expect, it } from "vitest";
import { appRouter, normalizeFilamentInput } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("filaments access and validation", () => {
  it("blocks unauthenticated inventory reads", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.filaments.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects fractional balances for unit-based items", async () => {
    const caller = appRouter.createCaller(context({
      id: 42,
      openId: "unit-test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.filaments.create({
      material: "Caixa",
      color: "Natural",
      brand: "Marca teste",
      diameter: "1.75",
      baseUnit: "unit",
      weightPerUnit: null,
      initialWeight: 2.5,
      currentWeight: 2.5,
      minimumWeight: 1,
      rollCost: 10,
      status: "available",
      observation: null,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects current weight above initial weight", async () => {
    const caller = appRouter.createCaller(context({
      id: 42,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.filaments.create({
      material: "PLA",
      color: "Azul",
      brand: "Marca teste",
      diameter: "1.75",
      initialWeight: 500,
      currentWeight: 600,
      minimumWeight: 100,
      rollCost: 89.9,
      status: "available",
      observation: null,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("filament control and measurement units", () => {
  it("rejects a measurement unit incompatible with the control type", async () => {
    const caller = appRouter.createCaller(context({
      id: 42,
      openId: "measurement-test-user",
      name: "Measurement Test",
      email: "measurement@example.com",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    await expect(caller.filaments.create({
      material: "Bobina",
      color: "Azul",
      brand: "Marca teste",
      diameter: "1.75",
      baseUnit: "length",
      measurementUnit: "kg",
      weightPerUnit: null,
      initialWeight: 10,
      currentWeight: 10,
      minimumWeight: 1,
      rollCost: 10,
      status: "available",
      observation: null,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("filament storage normalization", () => {
  it("stores weight values in grams when the form unit is kg", () => {
    const normalized = normalizeFilamentInput({
      material: "PLA",
      color: "Preto",
      brand: "Marca teste",
      diameter: "1.75",
      baseUnit: "weight",
      measurementUnit: "kg",
      weightPerUnit: 0.5,
      initialWeight: 1,
      currentWeight: 0.75,
      minimumWeight: 0.2,
      rollCost: 89.9,
      status: "available",
      observation: null,
    });

    expect(normalized.measurementUnit).toBe("kg");
    expect(normalized.weightPerUnit).toBe(500);
    expect(normalized.initialWeight).toBe(1000);
    expect(normalized.currentWeight).toBe(750);
    expect(normalized.minimumWeight).toBe(200);
  });
});
