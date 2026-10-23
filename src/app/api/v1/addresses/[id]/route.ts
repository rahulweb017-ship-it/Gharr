import { z } from "zod";
import { withRoute } from "@/server/http/route";
import { removeAddress, updateAddress } from "@/server/services/address.service";
import { AddressUpdateInput } from "@/shared/contracts/address";

const Params = z.object({ id: z.string().min(1) });

/** PATCH /api/v1/addresses/:id */
export const PATCH = withRoute(
  { auth: "required", params: Params, body: AddressUpdateInput },
  async ({ actor, params, body }) => updateAddress(actor.userId, params.id, body),
);

/** DELETE /api/v1/addresses/:id */
export const DELETE = withRoute(
  { auth: "required", params: Params },
  async ({ actor, params }) => {
    await removeAddress(actor.userId, params.id);
    return null;
  },
);
