import { describe, expect, it } from "vitest";
import { calculateHistoricalEstimate, calculateReservationPreview } from "./printers";

describe("production tracking calculations", () => {
  it("subtracts active reservations from physical balance and reports missing amount", () => {
    expect(calculateReservationPreview(1000, 250, 900)).toEqual({ physical: 1000, reserved: 250, required: 900, available: 750, missing: 150 });
  });

  it("does not report a shortage when the unreserved balance is enough", () => {
    expect(calculateReservationPreview(1000, 200, 800).missing).toBe(0);
    expect(calculateReservationPreview(1000, 200, 800).available).toBe(800);
  });

  it("calculates average minutes per produced unit and scales by planned quantity", () => {
    const startedAt = new Date("2026-01-01T10:00:00Z");
    const records = [
      { startedAt, finishedAt: new Date("2026-01-01T11:00:00Z"), producedQuantity: 2 },
      { startedAt, finishedAt: new Date("2026-01-01T11:30:00Z"), producedQuantity: 1 },
    ];
    expect(calculateHistoricalEstimate(records, 3, "printer")).toEqual({ estimatedMinutes: 180, sampleCount: 2, source: "printer" });
  });

  it("returns no estimate for invalid, unfinished or non-positive samples", () => {
    expect(calculateHistoricalEstimate([{ startedAt: "2026-01-01T10:00:00Z", finishedAt: null, producedQuantity: 1 }], 1, "product")).toEqual({ estimatedMinutes: null, sampleCount: 0, source: "none" });
    expect(calculateHistoricalEstimate([{ startedAt: "2026-01-01T10:00:00Z", finishedAt: "2026-01-01T11:00:00Z", producedQuantity: 0 }], 1, "product")).toEqual({ estimatedMinutes: null, sampleCount: 0, source: "none" });
  });
});
