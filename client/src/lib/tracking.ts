export type TrackingEstimate = {
  estimatedMinutes: number | null;
  sampleCount: number;
  source: "printer" | "product" | "none";
};

export type TrackingRun = {
  id: string;
  productId: string | null;
  printerId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  plannedQuantity: number;
  producedQuantity: number;
  status: "RUNNING" | "FINISHED" | "CANCELED" | string;
  productName: string | null;
  estimate: TrackingEstimate | null;
};

export type TrackingPrinter = {
  id: string;
  name: string;
  model: string | null;
  active: boolean;
  status: "FREE" | "PRODUCING";
  run: TrackingRun | null;
};

type AnyRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is AnyRecord => Boolean(value) && typeof value === "object";
const pick = (record: AnyRecord, ...keys: string[]) => keys.map(key => record[key]).find(value => value !== undefined);
const stringValue = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const numberValue = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback;
const booleanValue = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

export function normalizeTrackingRun(value: unknown): TrackingRun | null {
  if (!isRecord(value)) return null;
  const product = isRecord(pick(value, "product", "inventoryProduct")) ? pick(value, "product", "inventoryProduct") as AnyRecord : null;
  const estimateValue = pick(value, "estimate", "estimation");
  const estimate = isRecord(estimateValue) ? {
    estimatedMinutes: stringValue(pick(estimateValue, "estimatedMinutes", "estimated_minutes")) !== null || typeof pick(estimateValue, "estimatedMinutes", "estimated_minutes") === "number" ? numberValue(pick(estimateValue, "estimatedMinutes", "estimated_minutes"), 0) : null,
    sampleCount: numberValue(pick(estimateValue, "sampleCount", "sample_count")),
    source: (pick(estimateValue, "source") === "printer" || pick(estimateValue, "source") === "product" ? pick(estimateValue, "source") : "none") as TrackingEstimate["source"],
  } : null;
  const startedAtValue = pick(value, "startedAt", "started_at");
  const finishedAtValue = pick(value, "finishedAt", "finished_at");
  return {
    id: stringValue(pick(value, "id", "runId", "run_id")) ?? "",
    productId: stringValue(pick(value, "productId", "product_id")),
    printerId: stringValue(pick(value, "printerId", "printer_id")),
    startedAt: stringValue(startedAtValue) ?? (startedAtValue instanceof Date ? startedAtValue.toISOString() : null),
    finishedAt: stringValue(finishedAtValue) ?? (finishedAtValue instanceof Date ? finishedAtValue.toISOString() : null),
    plannedQuantity: numberValue(pick(value, "plannedQuantity", "planned_quantity")),
    producedQuantity: numberValue(pick(value, "producedQuantity", "produced_quantity")),
    status: String(pick(value, "status") ?? "RUNNING").toUpperCase(),
    productName: stringValue(pick(product ?? {}, "name")) ?? stringValue(pick(value, "productName", "product_name")),
    estimate,
  };
}

export function normalizeTrackingPrinter(value: unknown): TrackingPrinter {
  const record = isRecord(value) ? value : {};
  const rawRun = pick(record, "run", "production", "activeProduction", "active_production");
  const run = normalizeTrackingRun(rawRun);
  const rawStatus = String(pick(record, "status") ?? "FREE").toUpperCase();
  return {
    id: stringValue(pick(record, "id", "printerId", "printer_id")) ?? "",
    name: stringValue(pick(record, "name", "printerName", "printer_name")) ?? "Impressora sem nome",
    model: stringValue(pick(record, "model")),
    active: booleanValue(pick(record, "active")),
    status: rawStatus === "PRODUCING" && run ? "PRODUCING" : "FREE",
    run,
  };
}

export function normalizeTrackingPrinters(value: unknown): TrackingPrinter[] {
  return Array.isArray(value) ? value.map(normalizeTrackingPrinter).filter(printer => printer.id) : [];
}
