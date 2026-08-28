import { describe, expect, it } from "vitest";
import { getInitialTrackingProductId, getSelectableTrackingPrinters, normalizeTrackingPrinters } from "./tracking";

describe("tracking response normalization", () => {
  it("maps snake_case fields and nested active production to a stable camelCase shape", () => {
    const [printer] = normalizeTrackingPrinters([{
      printer_id: "p-1",
      printer_name: "Bambu A1",
      model: "A1",
      active: 1,
      status: "PRODUCING",
      active_production: {
        run_id: "run-1",
        product_id: "prod-1",
        printer_id: "p-1",
        started_at: "2026-08-28T10:00:00.000Z",
        planned_quantity: "3",
        produced_quantity: 0,
        status: "RUNNING",
        product_name: "Suporte",
        estimate: { estimated_minutes: 60, sample_count: 5, source: "printer" },
      },
    }]);

    expect(printer).toMatchObject({ id: "p-1", name: "Bambu A1", active: true, status: "PRODUCING" });
    expect(printer.run).toMatchObject({ id: "run-1", startedAt: "2026-08-28T10:00:00.000Z", plannedQuantity: 3, productName: "Suporte" });
    expect(printer.run?.estimate).toEqual({ estimatedMinutes: 60, sampleCount: 5, source: "printer" });
  });

  it("normalizes missing or null production as a free printer", () => {
    expect(normalizeTrackingPrinters([{ id: "p-1", name: "Livre", active: true, status: "PRODUCING", run: null }])).toEqual([
      { id: "p-1", name: "Livre", model: null, active: true, status: "FREE", run: null },
    ]);
  });

  it("keeps absent startedAt as null and never invents a timestamp", () => {
    const [printer] = normalizeTrackingPrinters([{ id: "p-1", name: "Inválida", active: true, status: "PRODUCING", run: { id: "run-1", status: "RUNNING" } }]);
    expect(printer.status).toBe("PRODUCING");
    expect(printer.run?.startedAt).toBeNull();
  });

  it("returns only active and free printers as selectable", () => {
    expect(getSelectableTrackingPrinters([
      { id: "free", name: "Livre", active: true, status: "FREE", run: null },
      { id: "running", name: "Produzindo", active: true, status: "PRODUCING", run: { id: "r-1", status: "RUNNING", startedAt: "2026-01-01T10:00:00.000Z" } },
      { id: "inactive", name: "Inativa", active: false, status: "FREE", run: null },
    ]).map(printer => printer.id)).toEqual(["free"]);
  });

  it("extracts the product id from the card query without inventing a fallback", () => {
    expect(getInitialTrackingProductId("?produto=product-123")).toBe("product-123");
    expect(getInitialTrackingProductId("")).toBe("");
  });

  it("returns an empty collection for null, undefined or non-array responses", () => {
    expect(normalizeTrackingPrinters(null)).toEqual([]);
    expect(normalizeTrackingPrinters(undefined)).toEqual([]);
    expect(normalizeTrackingPrinters({ data: [] })).toEqual([]);
  });
});
