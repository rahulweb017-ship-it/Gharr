import { prisma } from "@/server/db/prisma";
import { NotFoundError, ValidationError } from "@/server/http/errors";
import type { AddressInput, AddressUpdateInput } from "@/shared/contracts/address";

/**
 * Customer addresses — delivery points for materials and job sites for labour.
 *
 * Addresses are soft-deleted: orders and bookings snapshot the address at the
 * time of purchase, but support still needs to see what a customer had on file.
 *
 * Every query is scoped to the owner. A foreign id surfaces as 404, never 403,
 * so the endpoint cannot be used to discover other people's address ids.
 */

const ADDRESS_SELECT = {
  id: true,
  type: true,
  contactName: true,
  contactPhone: true,
  line1: true,
  line2: true,
  landmark: true,
  city: true,
  state: true,
  pincode: true,
  gstin: true,
  isDefault: true,
} as const;

/** A user may keep a generous but finite number of addresses. */
const MAX_ADDRESSES = 20;

export async function listAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: ADDRESS_SELECT,
  });
}

async function findOwned(userId: string, id: string) {
  const address = await prisma.address.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, isDefault: true },
  });
  if (!address) throw new NotFoundError("Address");
  return address;
}

export async function createAddress(userId: string, input: AddressInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.count({ where: { userId, deletedAt: null } });
    if (existing >= MAX_ADDRESSES) {
      throw new ValidationError(`You can save up to ${MAX_ADDRESSES} addresses`);
    }

    // The first address is always the default, otherwise checkout would open
    // with nothing selected.
    const makeDefault = existing === 0 || input.isDefault === true;
    if (makeDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.address.create({
      data: {
        userId,
        type: input.type,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        line1: input.line1,
        line2: input.line2 ?? null,
        landmark: input.landmark ?? null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        gstin: input.gstin ?? null,
        isDefault: makeDefault,
      },
      select: ADDRESS_SELECT,
    });
  });
}

export async function updateAddress(
  userId: string,
  id: string,
  input: AddressUpdateInput,
) {
  await findOwned(userId, id);

  return prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const { isDefault, line2, landmark, gstin, ...rest } = input;

    return tx.address.update({
      where: { id },
      data: {
        ...rest,
        // Un-defaulting is not offered: the default moves only by choosing
        // another address, so a user can never end up with none.
        ...(isDefault === true ? { isDefault: true } : {}),
        ...("line2" in input ? { line2: line2 ?? null } : {}),
        ...("landmark" in input ? { landmark: landmark ?? null } : {}),
        ...("gstin" in input ? { gstin: gstin ?? null } : {}),
      },
      select: ADDRESS_SELECT,
    });
  });
}

export async function removeAddress(userId: string, id: string) {
  const address = await findOwned(userId, id);

  await prisma.$transaction(async (tx) => {
    await tx.address.update({
      where: { id },
      data: { deletedAt: new Date(), isDefault: false },
    });

    // Hand the default to the most recently used remaining address.
    if (address.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (next) {
        await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
  });
}
