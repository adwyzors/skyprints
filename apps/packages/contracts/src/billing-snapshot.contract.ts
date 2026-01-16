import { z } from "zod";

/* =========================
 * Money
 * ========================= */

export const MoneySchema = z.object({
  amount: z.string(),        // decimal as string
  currency: z.string(),
});

/* =========================
 * Billing Input (per run)
 * ========================= */

export const BillingInputSchema = z.object({
  runId: z.string(),
  values: z.record(z.string(), z.number()),
});

/* =========================
 * Billing Snapshot (UI-safe)
 * ========================= */

export const BillingSnapshotSchema = z.object({
  version: z.number(),
  isLatest: z.boolean(),

  total: MoneySchema,

  inputs: z.array(BillingInputSchema),

  calculationType: z.enum([
    "INITIAL",
    "RECALCULATED",
  ]),

  createdAt: z.string(), // ISO date
});

/* =========================
 * Latest Billing Response
 * ========================= */

export const LatestBillingSnapshotSchema = z.object({
  orderProcessId: z.string(),
  snapshot: BillingSnapshotSchema,
});

/* =========================
 * Billing History Response
 * ========================= */

export const BillingHistorySchema = z.object({
  orderProcessId: z.string(),
  snapshots: z.array(BillingSnapshotSchema),
});

export type BillingSnapshotDto =
  z.infer<typeof BillingSnapshotSchema>;

export type LatestBillingSnapshotDto =
  z.infer<typeof LatestBillingSnapshotSchema>;

export type BillingHistoryDto =
  z.infer<typeof BillingHistorySchema>;
