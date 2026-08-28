import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { cancelProduction, createPrinter, deletePrinter, finishProduction, getProductionEstimate, getProductionPreview, getRunMaterials, getTrackingSummary, listPrinters, listProductionRunHistory, startProduction, updatePrinter } from "./printers";

const printerData = z.object({
  name: z.string().trim().min(1, "Informe o nome da impressora").max(120),
  model: z.string().trim().max(160).optional().nullable(),
  active: z.boolean().default(true),
});

function badRequest(error: unknown, fallback: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : fallback });
}

export const printerRouter = router({
  list: protectedProcedure.query(({ ctx }) => listPrinters(ctx.user.id)),
  summary: protectedProcedure.query(({ ctx }) => getTrackingSummary(ctx.user.id)),
  history: protectedProcedure.query(({ ctx }) => listProductionRunHistory(ctx.user.id)),
  materials: protectedProcedure.input(z.object({ runId: z.string().uuid() })).query(({ ctx, input }) => getRunMaterials(ctx.user.id, input.runId)),
  estimate: protectedProcedure.input(z.object({ productId: z.string().uuid(), printerId: z.string().uuid(), quantity: z.number().int().positive() })).query(({ ctx, input }) => getProductionEstimate(ctx.user.id, input.productId, input.printerId, input.quantity)),
  preview: protectedProcedure.input(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).query(({ ctx, input }) => getProductionPreview(ctx.user.id, input.productId, input.quantity)),
  create: protectedProcedure.input(printerData).mutation(async ({ ctx, input }) => {
    try { return await createPrinter({ ...input, ownerId: ctx.user.id }); } catch (error) { return badRequest(error, "Não foi possível cadastrar a impressora"); }
  }),
  update: protectedProcedure.input(z.object({ id: z.string().uuid(), data: printerData })).mutation(async ({ ctx, input }) => {
    try { return await updatePrinter({ ...input.data, id: input.id, ownerId: ctx.user.id }); } catch (error) { return badRequest(error, "Não foi possível atualizar a impressora"); }
  }),
  remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    try { return await deletePrinter(ctx.user.id, input.id); } catch (error) { return badRequest(error, "Não foi possível excluir a impressora"); }
  }),
  start: protectedProcedure.input(z.object({ printerId: z.string().uuid(), productId: z.string().uuid(), plannedQuantity: z.number().int().positive(), notes: z.string().trim().max(1000).optional().nullable() })).mutation(async ({ ctx, input }) => {
    try { return await startProduction({ ...input, ownerId: ctx.user.id, startedBy: ctx.user.id }); } catch (error) { return badRequest(error, "Não foi possível iniciar a produção"); }
  }),
  finish: protectedProcedure.input(z.object({ runId: z.string().uuid(), producedQuantity: z.number().int().min(0), notes: z.string().trim().max(1000).optional().nullable() })).mutation(async ({ ctx, input }) => {
    try { return await finishProduction({ ...input, ownerId: ctx.user.id, finishedBy: ctx.user.id }); } catch (error) { return badRequest(error, "Não foi possível finalizar a produção"); }
  }),
  cancel: protectedProcedure.input(z.object({ runId: z.string().uuid(), notes: z.string().trim().max(1000).optional().nullable() })).mutation(async ({ ctx, input }) => {
    try { return await cancelProduction({ ...input, ownerId: ctx.user.id, finishedBy: ctx.user.id }); } catch (error) { return badRequest(error, "Não foi possível cancelar a produção"); }
  }),
});
