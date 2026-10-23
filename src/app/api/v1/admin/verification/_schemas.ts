import { z } from "zod";

export const IdParams = z.object({ id: z.string().min(1) });

export const StatusBody = z.object({
  status: z.enum(["VERIFIED", "REJECTED", "PENDING"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const ReviewBody = z.object({
  kind: z.enum(["vendor", "worker"]),
  status: z.enum(["VERIFIED", "REJECTED"]),
  notes: z.string().trim().max(500).optional().nullable(),
});
