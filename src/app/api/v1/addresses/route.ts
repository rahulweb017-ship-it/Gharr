import { withRoute } from "@/server/http/route";
import { createAddress, listAddresses } from "@/server/services/address.service";
import { AddressInput } from "@/shared/contracts/address";

/** GET /api/v1/addresses */
export const GET = withRoute({ auth: "required" }, async ({ actor }) =>
  listAddresses(actor.userId),
);

/** POST /api/v1/addresses */
export const POST = withRoute(
  { auth: "required", body: AddressInput, status: 201 },
  async ({ actor, body }) => createAddress(actor.userId, body),
);
