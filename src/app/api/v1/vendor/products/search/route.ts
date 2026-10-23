import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { searchCatalogue } from "@/server/services/vendor/listing.service";

const Query = z.object({ q: z.string().trim().max(80).default("") });

/** GET /api/v1/vendor/products/search?q= — approved catalogue products to attach an offer to. */
export const GET = withRoute({ auth: "required", query: Query }, async ({ actor, query }) =>
  searchCatalogue(actor, query.q),
);
