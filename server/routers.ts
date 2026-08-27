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
  createStockMovement,
} from "./db";
import type { Filament } from "../drizzle/schema";
import { createInventoryProduct, createProduction, deleteInventoryProduct, getInventoryProduct, getProductInventorySummary, listInventoryProducts, listProductionRecords, updateInventoryProduct, updateProductInventory } from "./products";

const filamentInput = z.object({
  material: z.string().trim().min(1, "Informe o material").max(80),
  color: z.string().trim().min(1, "Informe a cor").max(80),
  brand: z.string().trim().min(1, "Informe a marca").max(120),
  diameter: z.enum(["1.75", "2.85"]),
  baseUnit: z.enum(["weight", "unit"]).default("weight"),
  weightPerUnit: z.number().int().positive("O peso por unidade precisa ser maior que zero").optional().nullable(),
  initialWeight: z.number().int().min(0, "O peso não pode ser negativo"),
  currentWeight: z.number().int().min(0, "O peso não pode ser negativo"),
  minimumWeight: z.number().int().min(0, "O estoque mínimo não pode ser negativo"),
  rollCost: z.number().min(0, "O custo não pode ser negativo"),
  location: z.string().trim().min(1, "Informe a localização").max(120),
  status: z.enum(["available", "reserved", "finished"]),
  observation: z.string().trim().max(1000).optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.baseUnit === "unit" && value.weightPerUnit != null) ctx.addIssue({ code: "custom", path: ["weightPerUnit"], message: "Itens por unidade não usam peso por unidade" });
  if (value.baseUnit === "weight" && value.weightPerUnit != null && value.weightPerUnit <= 0) ctx.addIssue({ code: "custom", path: ["weightPerUnit"], message: "O peso por unidade precisa ser maior que zero" });
  if (value.currentWeight > value.initialWeight) ctx.addIssue({ code: "custom", path: ["currentWeight"], message: "O peso atual não pode ser maior que o peso inicial" });
});
/* legacy validation replaced above */
/* .refine(value => value.currentWeight <= value.initialWeight, {
  message: "O peso atual não pode ser maior que o peso inicial",
  path: ["currentWeight"],
}); */

async function notifyLowStock(filament: Filament): Promise<boolean> {
  try {
    return await notifyOwner({
      title: `Estoque baixo: ${filament.material} ${filament.color}`,
      content: `O filamento ${filament.brand} ${filament.material} (${filament.color}) está com ${filament.currentWeight} ${filament.baseUnit === "unit" ? "un" : "g"} disponíveis, no limite mínimo de ${filament.minimumWeight} ${filament.baseUnit === "unit" ? "un" : "g"}. Localização: ${filament.location}.`,
    });
  } catch (error) {
    console.warn("[Filaments] Could not send low-stock notification:", error);
    return false;
  }
}

const movementInput = z.object({
  filamentId: z.number().int().positive(),
  type: z.enum(["entry", "consumption", "loss", "adjustment", "reservation", "release_reservation"]),
  inputUnit: z.enum(["g", "kg", "roll", "unit"]),
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

const productInput = z.object({
  name: z.string().trim().min(1, "Informe o nome do produto").max(160),
  category: z.string().trim().max(120).optional().nullable(),
  imageUrl: z.string().url("Informe uma URL válida").optional().nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  externalProductId: z.string().trim().max(120).optional().nullable(),
  active: z.boolean().default(true),
});

const productInventoryInput = z.object({
  productId: z.string().uuid(),
  quantityAvailable: z.number().int().min(0),
  minimumQuantity: z.number().int().min(0),
  storageLocation: z.string().trim().max(120).optional().nullable(),
});

const productionInput = z.object({
  productId: z.string().uuid(),
  filamentId: z.number().int().positive(),
  quantityProduced: z.number().int().positive(),
  quantityPerUnit: z.number().positive(),
  unitUsed: z.enum(["g", "kg", "roll", "unit"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const movementRouter = router({
  list: protectedProcedure.query(({ ctx }) => listStockMovementsByOwner(ctx.user.id)),
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
    const created = await createFilament({
      ...input,
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

      const updated = await updateFilament(input.id, ctx.user.id, {
        ...input.data,
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
  create: protectedProcedure.input(productInput).mutation(({ ctx, input }) => createInventoryProduct({ ...input, ownerId: ctx.user.id })),
  update: protectedProcedure.input(z.object({ id: z.string().uuid(), data: productInput })).mutation(({ ctx, input }) => updateInventoryProduct(input.id, ctx.user.id, { ...input.data, active: input.data.active })),
  remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ ctx, input }) => deleteInventoryProduct(input.id, ctx.user.id)),
  inventoryUpdate: protectedProcedure.input(productInventoryInput).mutation(({ ctx, input }) => updateProductInventory(input.productId, ctx.user.id, input.quantityAvailable, input.minimumQuantity, input.storageLocation)),
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
