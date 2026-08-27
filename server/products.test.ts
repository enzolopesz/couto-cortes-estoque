import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { assertSingleRowAffected, createInventoryProduct, createProduction, deleteInventoryProduct, listInventoryProducts, updateInventoryProduct, updateProductInventory } from "./products";
import { inventoryProducts, productInventory } from "../drizzle/schema";
import { resetDbForTests, setDbForTests } from "./db";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"]): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const admin = { id: 9, openId: "products-test", name: "Products Test", email: "products@example.com", loginMethod: "test", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

describe("internal products and production", () => {
  it("requires authentication for internal product reads", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.products.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an invalid product before database access", async () => {
    const caller = appRouter.createCaller(context(admin));
    await expect(caller.products.create({ name: "", category: null, imageUrl: null, sku: null, externalProductId: null, active: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects fractional finished-product inventory", async () => {
    const caller = appRouter.createCaller(context(admin));
    await expect(caller.products.inventoryUpdate({ productId: "00000000-0000-0000-0000-000000000009", quantityAvailable: 1.5, minimumQuantity: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("guards the final production write so a failed inventory update aborts", () => {
    expect(() => assertSingleRowAffected({ affectedRows: 0 }, "rollback")).toThrow("rollback");
    expect(() => assertSingleRowAffected({ affectedRows: 1 }, "rollback")).not.toThrow();
  });

  it("keeps internal product access isolated from the public catalog table", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./products.ts", import.meta.url), "utf8"));
    expect(source).not.toMatch(/from\\s*\\(products\\)/);
    expect(source).toContain("inventoryProducts");
    expect(source).toContain("productInventory");
    expect(source).toContain("ownerId");
  });

  it("rolls back the production transaction when the final product update fails", async () => {
    const operations: string[] = [];
    let selectCall = 0;
    let updateCall = 0;
    let committed = false;
    let rolledBack = false;
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => { selectCall += 1; return selectCall === 1 ? [{ id: "00000000-0000-0000-0000-000000000009", ownerId: 9, active: 1 }] : selectCall === 2 ? [{ quantityAvailable: 0, productId: "00000000-0000-0000-0000-000000000009", ownerId: 9 }] : selectCall === 3 ? [{ filamentId: 3, quantityBase: "120.000", unitType: "g" }] : [{ id: 3, ownerId: 9, currentWeight: 1000, minimumWeight: 0, baseUnit: "weight", weightPerUnit: 1000, status: "available", brand: "Voolt3D", material: "PLA", color: "Preto" }]; } }) }) }),
      update: () => ({ set: () => ({ where: async () => { updateCall += 1; operations.push(`update-${updateCall}`); return [{ affectedRows: updateCall === 1 ? 1 : 0 }]; } }) }),
      insert: () => ({ values: async () => { operations.push("insert"); } }),
    };
    setDbForTests({ transaction: async callback => { try { const result = await callback(tx); committed = true; return result; } catch (error) { rolledBack = true; throw error; } } } as never);

    await expect(createProduction({ ownerId: 9, createdBy: 9, productId: "00000000-0000-0000-0000-000000000009", quantityProduced: 1 })).rejects.toThrow("estoque do produto");
    expect(rolledBack).toBe(true);
    expect(committed).toBe(false);
    expect(operations).toEqual(["update-1", "insert", "insert", "update-2"]);
    resetDbForTests();
  });

  it("rejects insufficient material before any production write", async () => {
    let selectCall = 0;
    const operations: string[] = [];
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => { selectCall += 1; return selectCall === 1 ? [{ id: "00000000-0000-0000-0000-000000000009", ownerId: 9, active: 1 }] : selectCall === 2 ? [{ quantityAvailable: 0, productId: "00000000-0000-0000-0000-000000000009", ownerId: 9 }] : selectCall === 3 ? [{ filamentId: 3, quantityBase: "120.000", unitType: "g" }] : [{ id: 3, ownerId: 9, currentWeight: 100, minimumWeight: 0, baseUnit: "weight", weightPerUnit: null, status: "available", brand: "Voolt3D", material: "PLA", color: "Preto" }]; } }) }) }),
      update: () => ({ set: () => ({ where: async () => { operations.push("update"); return [{ affectedRows: 1 }]; } }) }),
      insert: () => ({ values: async () => { operations.push("insert"); } }),
    };
    setDbForTests({ transaction: async callback => callback(tx) } as never);
    await expect(createProduction({ ownerId: 9, createdBy: 9, productId: "00000000-0000-0000-0000-000000000009", quantityProduced: 1 })).rejects.toThrow();
    expect(operations).toEqual([]);
    resetDbForTests();
  });

  it("covers internal CRUD success paths with a controlled driver", async () => {
    const product = { id: "00000000-0000-0000-0000-000000000010", ownerId: 9, name: "Suporte", category: "Casa", imageUrl: null, sku: "CC-010", externalProductId: null, active: 1, createdAt: new Date(), updatedAt: new Date() };
    const inventory = { id: "inventory-10", ownerId: 9, productId: product.id, quantityAvailable: 0, minimumQuantity: 0, updatedAt: new Date() };
    const state = { product, inventory };
    const db = {
      transaction: async (callback: (tx: typeof db) => Promise<unknown>) => callback(db),
      insert: (table: unknown) => ({ values: async (values: Record<string, unknown>) => { if (table === inventoryProducts) Object.assign(state.product, values); if (table === productInventory) Object.assign(state.inventory, values); } }),
      update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async () => { if (table === inventoryProducts) Object.assign(state.product, values); if (table === productInventory) Object.assign(state.inventory, values); return [{ affectedRows: 1 }]; } }) }),
      delete: () => ({ where: async () => [{ affectedRows: 1 }] }),
      select: () => ({ from: (table: unknown) => { const row = table === inventoryProducts ? { ...state.product, quantityAvailable: state.inventory.quantityAvailable, minimumQuantity: state.inventory.minimumQuantity } : state.inventory; const chain = { leftJoin: () => chain, where: () => chain, orderBy: async () => [row], limit: async () => [row] }; return chain; } }),
    };
    setDbForTests(db as never);
    const created = await createInventoryProduct({ ownerId: 9, name: "Suporte", category: "Casa", imageUrl: null, sku: "CC-010", externalProductId: null, active: true });
    expect(created?.ownerId).toBe(9);
    expect((await listInventoryProducts(9)).length).toBe(1);
    expect((await updateInventoryProduct(product.id, 9, { name: "Suporte novo", category: "Casa", imageUrl: null, sku: "CC-011", externalProductId: null, active: true }))?.name).toBe("Suporte novo");
    expect((await updateProductInventory(product.id, 9, 3, 1))?.quantityAvailable).toBe(3);
    expect(await deleteInventoryProduct(product.id, 9)).toBe(true);
    resetDbForTests();
  });

  it("blocks CRUD reads and writes when the controlled row belongs to another owner", async () => {
    const foreign = { id: "00000000-0000-0000-0000-000000000011", ownerId: 77, name: "Estranho", category: null, imageUrl: null, sku: null, externalProductId: null, active: 1, quantityAvailable: 2, minimumQuantity: 0 };
    const db = { select: () => ({ from: () => { const chain = { leftJoin: () => chain, where: () => chain, orderBy: async () => [foreign], limit: async () => [foreign] }; return chain; } }), update: () => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }), delete: () => ({ where: async () => [{ affectedRows: 1 }] }) };
    setDbForTests(db as never);
    expect(await listInventoryProducts(9)).toEqual([]);
    expect(await updateInventoryProduct(foreign.id, 9, { name: "Não alterar", category: null, imageUrl: null, sku: null, externalProductId: null, active: true })).toBeUndefined();
    expect(await updateProductInventory(foreign.id, 9, 2, 0)).toBeUndefined();
    expect(await deleteInventoryProduct(foreign.id, 9)).toBe(false);
    resetDbForTests();
  });

  it("blocks production when the selected product belongs to another owner", async () => {
    const operations: string[] = [];
    const db = {
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "foreign", ownerId: 77, active: 1 }] }) }) }),
        update: () => ({ set: () => ({ where: async () => { operations.push("update"); return [{ affectedRows: 1 }]; } }) }),
        insert: () => ({ values: async () => { operations.push("insert"); } }),
      }) as never,
    };
    setDbForTests(db as never);
    await expect(createProduction({ ownerId: 9, createdBy: 9, productId: "foreign", quantityProduced: 1 })).rejects.toThrow("Produto interno");
    expect(operations).toEqual([]);
    resetDbForTests();
  });

  it("keeps product modals bounded on desktop and mobile", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../client/src/pages/Products.tsx", import.meta.url), "utf8"));
    expect(source).toContain("sm:max-w-lg");
    expect(source).toContain("sm:max-w-2xl");
    expect(source).toContain("max-h-[90vh] overflow-y-auto");
    expect(source).toContain("grid gap-4 sm:grid-cols-2");
  });

  it("requires positive integer production quantity", async () => {
    const caller = appRouter.createCaller(context(admin));
    await expect(caller.products.produce({ productId: "00000000-0000-0000-0000-000000000009", quantityProduced: 0, notes: null })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});


describe("product material composition", () => {
  it("converts weight composition from kg to grams without changing other units", async () => {
    const { compatibleProductMaterialUnits, convertProductMaterialToBase } = await import("./products");
    expect(compatibleProductMaterialUnits("weight")).toEqual(["g", "kg"]);
    expect(convertProductMaterialToBase(0.3, "kg", "weight")).toEqual({ quantityBase: 300, unitType: "g" });
    expect(convertProductMaterialToBase(300, "g", "weight")).toEqual({ quantityBase: 300, unitType: "g" });
    expect(convertProductMaterialToBase(0.5, "m", "length")).toEqual({ quantityBase: 0.5, unitType: "m" });
  });

  it("exposes only the unit compatible with quantity-controlled filaments", async () => {
    const { compatibleProductMaterialUnits, convertProductMaterialToBase } = await import("./products");
    expect(compatibleProductMaterialUnits("unit")).toEqual(["unit"]);
    expect(() => convertProductMaterialToBase(1, "kg", "unit")).toThrow("compatível");
    expect(convertProductMaterialToBase(2.5, "unit", "unit")).toEqual({ quantityBase: 2.5, unitType: "unit" });
  });
});


describe("multi-material production", () => {
  it("consumes every BOM row and increases finished-product inventory atomically", async () => {
    const operations: string[] = [];
    let selectCall = 0;
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => { selectCall += 1; if (selectCall === 1) return [{ id: "product-bom", ownerId: 9, active: 1 }]; if (selectCall === 2) return [{ productId: "product-bom", ownerId: 9, quantityAvailable: 0 }]; if (selectCall === 3) return [{ filamentId: 3, quantityBase: "120.000", unitType: "g" }, { filamentId: 4, quantityBase: "2.000", unitType: "m" }]; if (selectCall === 4) return [{ id: 3, ownerId: 9, brand: "Voolt3D", material: "PLA", color: "Preto", baseUnit: "weight", currentWeight: 1000, status: "available" }]; return [{ id: 4, ownerId: 9, brand: "Voolt3D", material: "TPU", color: "Vermelho", baseUnit: "length", currentWeight: 50, status: "available" }]; } }) }) }),
      update: () => ({ set: () => ({ where: async () => { operations.push("update"); return [{ affectedRows: 1 }]; } }) }),
      insert: () => ({ values: async () => { operations.push("insert"); } }),
    };
    setDbForTests({ transaction: async callback => callback(tx) } as never);
    const result = await createProduction({ ownerId: 9, createdBy: 9, productId: "product-bom", quantityProduced: 3 });
    expect(result.materials).toEqual([{ filamentId: 3, totalConsumedBase: 360, resultingBalance: 640 }, { filamentId: 4, totalConsumedBase: 6, resultingBalance: 44 }]);
    expect(operations).toEqual(["update", "insert", "insert", "update", "insert", "insert", "update"]);
    resetDbForTests();
  });

  it("validates every material before writing when one BOM row is insufficient", async () => {
    const operations: string[] = [];
    let selectCall = 0;
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => { selectCall += 1; if (selectCall === 1) return [{ id: "product-bom", ownerId: 9, active: 1 }]; if (selectCall === 2) return [{ productId: "product-bom", ownerId: 9, quantityAvailable: 0 }]; if (selectCall === 3) return [{ filamentId: 3, quantityBase: "120.000", unitType: "g" }, { filamentId: 4, quantityBase: "2.000", unitType: "m" }]; if (selectCall === 4) return [{ id: 3, ownerId: 9, brand: "Voolt3D", material: "PLA", color: "Preto", baseUnit: "weight", currentWeight: 1000, status: "available" }]; return [{ id: 4, ownerId: 9, brand: "Voolt3D", material: "TPU", color: "Vermelho", baseUnit: "length", currentWeight: 1, status: "available" }]; } }) }) }),
      update: () => ({ set: () => ({ where: async () => { operations.push("update"); return [{ affectedRows: 1 }]; } }) }),
      insert: () => ({ values: async () => { operations.push("insert"); } }),
    };
    setDbForTests({ transaction: async callback => callback(tx) } as never);
    await expect(createProduction({ ownerId: 9, createdBy: 9, productId: "product-bom", quantityProduced: 3 })).rejects.toThrow("TPU");
    expect(operations).toEqual([]);
    resetDbForTests();
  });
});
