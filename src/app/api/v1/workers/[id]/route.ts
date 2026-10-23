import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { getWorkerById } from "@/server/services/worker.service";

const Params = z.object({ id: z.string().min(1) });

/** GET /api/v1/workers/:id */
export const GET = withRoute(
  { auth: "public", params: Params },
  async ({ params }) => getWorkerById(params.id),
);
