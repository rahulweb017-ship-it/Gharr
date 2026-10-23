import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getProductBySlug } from "@/server/services/catalog.service";

const Params = z.object({ slug: z.string().min(1) });

/** GET /api/v1/products/:slug */
export const GET = withRoute(
  { auth: "public", params: Params },
  async ({ params }) => getProductBySlug(params.slug),
);
