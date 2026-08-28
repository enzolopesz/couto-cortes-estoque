import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./_core/notification";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createFilament,
  deleteFilament,
  getFilamentById,
  getInventorySummary,
  listFilamentsByOwner,
  updateFilament,
  listStockMovementsByOwner,
  listAllInventoryMovementsByOwner,
  createStockMovement,
} from "./db";
import type { Filament } from "../drizzle/schema";
import { createInventoryProduct, createProduction, deleteInventoryProduct, getInventoryProduct, getProductInventorySummary, listInventoryProducts,   listProductionRecords,
  listProductMaterials,
  listProductStockMovements,
  createProductStockOut,
  updateInventoryProduct, updateProductInventory } from "./products";

const filamentInput = z.object({
  material: z.string().trim().min(1, "Informe o material").max(80),
  color: z.string().trim().min(1, "Informe a cor").max(80),
  brand: z.string().trim().min(1, "Informe a marca").max(120),
  diameter: z.enum(["1.75", "2.85"]),
  baseUnit: z.enum(["weight", "unit", "length"]).default("weight"),
  measurementUnit: z.enum(["g", "kg", "unit", "m"]).optional(),
  weightPerUnit: z.number().finite().positive("O peso por unidade precisa ser maior que zero").optional().nullable(),
  initialWeight: z.number().finite().min(0, "O saldo inicial não pode ser negativo"),
  currentWeight: z.number().finite().min(0, "O saldo disponível não pode ser negativo"),
  minimumWeight: z.number().finite().min(0, "O estoque mínimo não pode ser negativo"),
  rollCost: z.number().min(0, "O custo não pode ser negativo"),
  status: z.enum(["available", "reserved", "finished"]),
  observation: z.string().trim().max(1000).optional().nullable(),
}).superRefine((value, ctx) => {
  const measurementUnit = value.measurementUnit ?? (value.baseUnit === "weight" ? "g" : value.baseUnit === "unit" ? "unit" : "m");
  const compatibleUnit = value.baseUnit === "weight" ? ["g", "kg"] : value.baseUnit === "unit" ? ["unit"] : ["m"];
  if (!compatibleUnit.includes(measurementUnit)) ctx.addIssue({ code: "custom", path: ["measurementUnit"], message: "A unidade de medida não é compatível com o tipo de controle" });
  const toStorage = (amount: number) => measurementUnit === "kg" ? amount * 1000 : amount;
  if (![toStorage(value.initialWeight), toStorage(value.currentWeight), toStorage(value.minimumWeight), value.weightPerUnit == null ? null : toStorage(value.weightPerUnit)].every(amount => amount == null || Number.isInteger(amount))) ctx.addIssue({ code: "custom", path: ["measurementUnit"], message: "Os valores precisam resultar em números inteiros na unidade interna" });
  if (value.baseUnit !== "weight" && value.weightPerUnit != null) ctx.addIssue({ code: "custom", path: ["weightPerUnit"], message: "Somente itens controlados por peso usam peso por unidade" });
  if (value.baseUnit === "weight" && value.weightPerUnit != null && value.weightPerUnit <= 0) ctx.addIssue({ code: "custom", path: ["weightPerUnit"], message: "O peso por unidade precisa ser maior que zero" });
  if (value.currentWeight > value.initialWeight) ctx.addIssue({ code: "custom", path: ["currentWeight"], message: "O saldo disponível não pode ser maior que o saldo inicial" });
});
/* legacy validation replaced above */
/* .refine(value => value.currentWeight <= value.initialWeight, {
  message: "O peso atual não pode ser maior que o peso inicial",
  path: ["currentWeight"],
}); */

export function normalizeFilamentInput(input: z.infer<typeof filamentInput>) {
  const measurementUnit = input.measurementUnit ?? (input.baseUnit === "weight" ? "g" : input.baseUnit === "unit" ? "unit" : "m");
  const toStorage = (amount: number) => measurementUnit === "kg" ? amount * 1000 : amount;
  return { ...input, measurementUnit, weightPerUnit: input.baseUnit === "weight" && input.weightPerUnit != null ? toStorage(input.weightPerUnit) : null, initialWeight: toStorage(input.initialWeight), currentWeight: toStorage(input.currentWeight), minimumWeight: toStorage(input.minimumWeight) };
}

async function notifyLowStock(filament: Filament): Promise<boolean> {
  try {
    const unit = filament.baseUnit === "unit" ? "un" : filament.baseUnit === "length" ? "m" : filament.measurementUnit === "kg" ? "kg" : "g";
    const divisor = filament.baseUnit === "weight" && filament.measurementUnit === "kg" ? 1000 : 1;
    const current = Number(filament.currentWeight) / divisor;
    const minimum = Number(filament.minimumWeight) / divisor;
    return await notifyOwner({
      title: `Estoque baixo: ${filament.material} ${filament.color}`,
      content: `O filamento ${filament.brand} ${filament.material} (${filament.color}) está com ${current} ${unit} disponíveis, no limite mínimo de ${minimum} ${unit}.`,
    });
  } catch (error) {
    console.warn("[Filaments] Could not send low-stock notification:", error);
    return false;
  }
}

const movementInput = z.object({
  filamentId: z.number().int().positive(),
  type: z.enum(["entry", "consumption", "loss", "adjustment", "reservation", "release_reservation"]),
  inputUnit: z.enum(["g", "kg", "roll", "unit", "m"]),
  inputQuantity: z.number().min(0).max(100000),
  adjustmentWeight: z.number().min(0).max(100000).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.type === "adjustment" && value.adjustmentWeight === undefined) {
    ctx.addIssue({ code: "custom", path: ["adjustmentWeight"], message: "Informe o novo peso real do rolo" });
  }
  if (value.type !== "adjustment" && value.inputQuantity <= 0) {
    ctx.addIssue({ code: "custom", path: ["inputQuantity"], message: "Informe uma quantidade maior que zero" });
  }
});

const productMaterialInput = z.object({
  filamentId: z.number().int().positive(),
  quantity: z.number().finite().positive(),
  unit: z.enum(["g", "kg", "m", "unit"]),
});

const productInput = z.object({
  name: z.string().trim().min(1, "Informe o nome do produto").max(160),
  category: z.string().trim().max(120).optional().nullable(),
  imageUrl: z.string().url("Informe uma URL válida").optional().nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  externalProductId: z.string().trim().max(120).optional().nullable(),
  active: z.boolean().default(true),
  quantityAvailable: z.number().int().min(0).optional(),
  minimumQuantity: z.number().int().min(0).optional(),
  materials: z.array(productMaterialInput).max(100).optional(),
});

const productInventoryInput = z.object({
  productId: z.string().uuid(),
  quantityAvailable: z.number().int().min(0),
  minimumQuantity: z.number().int().min(0),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const productStockOutInput = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.enum(["sale", "delivery", "internal_use", "adjustment", "other"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const productionInput = z.object({
  productId: z.string().uuid(),
  quantityProduced: z.number().int().positive(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const movementRouter = router({
  list: protectedProcedure.query(({ ctx }) => listAllInventoryMovementsByOwner(ctx.user.id)),
  create: protectedProcedure.input(movementInput).mutation(async ({ ctx, input }) => {
    try {
      return await createStockMovement({ ...input, ownerId: ctx.user.id, createdBy: ctx.user.id });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível registrar a movimentação" });
    }
  }),
});

const filamentRouter = router({
  list: protectedProcedure.query(({ ctx }) => listFilamentsByOwner(ctx.user.id)),

  summary: protectedProcedure.query(({ ctx }) => getInventorySummary(ctx.user.id)),

  create: protectedProcedure.input(filamentInput).mutation(async ({ ctx, input }) => {
    const normalized = normalizeFilamentInput(input);
    const created = await createFilament({
      ...normalized,
      ownerId: ctx.user.id,
      diameter: input.diameter,
      rollCost: input.rollCost.toFixed(2),
      observation: input.observation || null,
    });
    const notificationSent = created && created.currentWeight <= created.minimumWeight
      ? await notifyLowStock(created)
      : true;
    return { filament: created, notificationSent };
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), data: filamentInput }))
    .mutation(async ({ ctx, input }) => {
      const previous = await getFilamentById(input.id, ctx.user.id);
      if (!previous) return null;

      const normalized = normalizeFilamentInput(input.data);
      const updated = await updateFilament(input.id, ctx.user.id, {
        ...normalized,
        diameter: input.data.diameter,
        rollCost: input.data.rollCost.toFixed(2),
        observation: input.data.observation || null,
      });
      const notificationSent = updated && updated.currentWeight <= updated.minimumWeight
        ? await notifyLowStock(updated)
        : true;
      return { filament: updated, notificationSent };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getFilamentById(input.id, ctx.user.id);
      if (!existing) return { success: false as const };
      await deleteFilament(input.id, ctx.user.id);
      return { success: true as const };
    }),
});

const productsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listInventoryProducts(ctx.user.id)),
  summary: protectedProcedure.query(({ ctx }) => getProductInventorySummary(ctx.user.id)),
  materials: protectedProcedure.input(z.object({ productId: z.string().uuid() })).query(({ ctx, input }) => listProductMaterials(input.productId, ctx.user.id)),
  create: protectedProcedure.input(productInput).mutation(({ ctx, input }) => createInventoryProduct({ ...input, ownerId: ctx.user.id })),
  update: protectedProcedure.input(z.object({ id: z.string().uuid(), data: productInput })).mutation(({ ctx, input }) => updateInventoryProduct(input.id, ctx.user.id, { ...input.data, active: input.data.active })),
  remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ ctx, input }) => deleteInventoryProduct(input.id, ctx.user.id)),
  inventoryUpdate: protectedProcedure.input(productInventoryInput).mutation(({ ctx, input }) => updateProductInventory(input.productId, ctx.user.id, input.quantityAvailable, input.minimumQuantity, ctx.user.id, input.notes)),
  stockMovements: protectedProcedure.query(({ ctx }) => listProductStockMovements(ctx.user.id)),
  stockOut: protectedProcedure.input(productStockOutInput).mutation(async ({ ctx, input }) => {
    try {
      return await createProductStockOut({ ...input, ownerId: ctx.user.id, createdBy: ctx.user.id });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível registrar a saída" });
    }
  }),
  productions: protectedProcedure.query(({ ctx }) => listProductionRecords(ctx.user.id)),
  produce: protectedProcedure.input(productionInput).mutation(async ({ ctx, input }) => {
    try {
      return await createProduction({ ...input, ownerId: ctx.user.id, createdBy: ctx.user.id });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível registrar a produção" });
    }
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  filaments: filamentRouter,
  movements: movementRouter,
  products: productsRouter,
});

export type AppRouter = typeof appRouter;
