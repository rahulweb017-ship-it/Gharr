import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { createVariant, listMyVariants } from "@/server/services/vendor/listing.service";
import { CreateVariantInput } from "@/shared/contracts/vendor";

const Query = z.object({
  q: z.string().trim().max(80).optional(),
  lowStock: z.enum(["1", "true"]).optional(),
});

/** GET /api/v1/vendor/variants — the caller's own offers. */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) =>
  listMyVariants(actor, { q: query.q, lowStock: Boolean(query.lowStock) }),
);

/** POST /api/v1/vendor/variants — sell an existing catalogue product. */
export const POST = withRoute(
  { auth: "required", body: CreateVariantInput, status: 201 },
  async ({ actor, body, requestId, ipHash }) => createVariant(actor, body, { requestId, ipHash }),
);
