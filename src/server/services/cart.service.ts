import { prisma } from "@/server/db/prisma";
import { env } from "@/server/env";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { snapQuantity, validateQuantity, type Unit } from "@/shared/units";
import {
  priceCart,
  type CouponRules,
  type PricingLine,
  type VendorDeliveryRules,
} from "./pricing.service";

/**
 * Cart reads and writes.
 *
 * The cart holds only what the customer chose — variant and quantity. Every
 * price is recomputed from the catalogue on each read, so a cart left open
 * overnight reflects this morning's prices rather than yesterday's. `addedPricePaise`
 * is kept purely so the UI can warn that a price moved.
 */

async function getCartId(userId: string): Promise<string> {
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  return cart.id;
}

/** Loads the cart, revalidates every line against the catalogue, and prices it. */
export async function getCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      id: true,
      couponCode: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          addedPricePaise: true,
          variant: {
            select: {
              id: true,
              label: true,
              unit: true,
              packSize: true,
              pricePaise: true,
              mrpPaise: true,
              moqQuantity: true,
              stepQuantity: true,
              maxOrderQuantity: true,
              deliveryMode: true,
              leadTimeDays: true,
              isActive: true,
              inventory: { select: { quantityAvailable: true } },
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: true,
                  taxRatePercent: true,
                  categoryId: true,
                },
              },
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  slug: true,
                  minOrderPaise: true,
                  baseDeliveryFeePaise: true,
                  perKmFeePaise: true,
                  freeDeliveryAbovePaise: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return {
      id: cart?.id ?? null,
      items: [],
      pricing: priceCart({
        lines: [],
        vendorRules: new Map(),
        maxOrderPaise: env.MAX_ORDER_PAISE,
      }),
      vendors: [],
      issues: [],
    };
  }

  const issues: Array<{ itemId: string; message: string }> = [];

  const lines: PricingLine[] = [];
  const vendorRules = new Map<string, VendorDeliveryRules>();
  const categoryByVariant = new Map<string, string>();

  const items = cart.items.map((item) => {
    const variant = item.variant;
    const quantity = Number(item.quantity);
    const stock = Number(variant.inventory?.quantityAvailable ?? 0);

    if (!variant.isActive) {
      issues.push({
        itemId: item.id,
        message: `${variant.product.name} is no longer available from this seller`,
      });
    } else if (stock <= 0) {
      issues.push({
        itemId: item.id,
        message: `${variant.product.name} is out of stock`,
      });
    } else if (quantity > stock) {
      issues.push({
        itemId: item.id,
        message: `Only ${stock} left of ${variant.product.name}`,
      });
    }

    if (variant.pricePaise !== item.addedPricePaise) {
      issues.push({
        itemId: item.id,
        message:
          variant.pricePaise > item.addedPricePaise
            ? `Price of ${variant.product.name} increased since you added it`
            : `Price of ${variant.product.name} dropped since you added it`,
      });
    }

    if (variant.isActive && stock > 0) {
      lines.push({
        variantId: variant.id,
        vendorId: variant.vendor.id,
        quantity,
        unitPricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        taxRatePercent: Number(variant.product.taxRatePercent),
      });

      categoryByVariant.set(variant.id, variant.product.categoryId);

      vendorRules.set(variant.vendor.id, {
        vendorId: variant.vendor.id,
        baseDeliveryFeePaise: variant.vendor.baseDeliveryFeePaise,
        perKmFeePaise: variant.vendor.perKmFeePaise,
        freeDeliveryAbovePaise: variant.vendor.freeDeliveryAbovePaise,
        minOrderPaise: variant.vendor.minOrderPaise,
      });
    }

    return {
      id: item.id,
      quantity,
      addedPricePaise: item.addedPricePaise,
      variantId: variant.id,
      variantLabel: variant.label,
      unit: variant.unit as Unit,
      packSize: Number(variant.packSize),
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      moqQuantity: Number(variant.moqQuantity),
      stepQuantity: Number(variant.stepQuantity),
      maxOrderQuantity:
        variant.maxOrderQuantity != null ? Number(variant.maxOrderQuantity) : null,
      stockQuantity: stock,
      deliveryMode: variant.deliveryMode,
      leadTimeDays: variant.leadTimeDays,
      isAvailable: variant.isActive && stock > 0,
      product: variant.product,
      vendor: variant.vendor,
    };
  });

  const coupon = cart.couponCode
    ? await loadCouponRules(cart.couponCode, userId)
    : null;

  const pricing = priceCart({
    lines,
    vendorRules,
    coupon,
    categoryByVariant,
    maxOrderPaise: env.MAX_ORDER_PAISE,
  });

  // Vendor display metadata, so the cart UI can group without another query.
  const vendors = [...vendorRules.keys()].map((vendorId) => {
    const sample = items.find((i) => i.vendor.id === vendorId)!;
    return {
      id: vendorId,
      businessName: sample.vendor.businessName,
      slug: sample.vendor.slug,
      minOrderPaise: sample.vendor.minOrderPaise,
      freeDeliveryAbovePaise: sample.vendor.freeDeliveryAbovePaise,
    };
  });

  return { id: cart.id, items, pricing, vendors, issues };
}

export type CartView = Awaited<ReturnType<typeof getCart>>;

/** Loads a coupon and checks the caller is still entitled to use it. */
async function loadCouponRules(
  code: string,
  userId: string,
): Promise<CouponRules | null> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon || !coupon.isActive) return null;

  const now = new Date();
  if (coupon.validFrom > now || coupon.validTo < now) return null;
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return null;
  }

  const usedByUser = await prisma.couponRedemption.count({
    where: { couponId: coupon.id, userId },
  });
  if (usedByUser >= coupon.perUserLimit) return null;

  return {
    code: coupon.code,
    type: coupon.type,
    percentValue: coupon.percentValue != null ? Number(coupon.percentValue) : null,
    flatPaise: coupon.flatPaise,
    minOrderPaise: coupon.minOrderPaise,
    maxDiscountPaise: coupon.maxDiscountPaise,
    scope: coupon.scope,
    vendorIds: coupon.vendorIds,
    categoryIds: coupon.categoryIds,
  };
}

export async function addItem(
  userId: string,
  variantId: string,
  requestedQuantity: number,
) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, isActive: true },
    select: {
      id: true,
      unit: true,
      pricePaise: true,
      moqQuantity: true,
      stepQuantity: true,
      maxOrderQuantity: true,
      inventory: { select: { quantityAvailable: true } },
      product: { select: { name: true } },
    },
  });

  if (!variant) throw new NotFoundError("Product");

  const stock = Number(variant.inventory?.quantityAvailable ?? 0);
  if (stock <= 0) {
    throw new ConflictError(`${variant.product.name} is out of stock`);
  }

  const rules = {
    moq: Number(variant.moqQuantity),
    step: Number(variant.stepQuantity),
    max: variant.maxOrderQuantity != null ? Number(variant.maxOrderQuantity) : null,
    unit: variant.unit as Unit,
  };

  const validation = validateQuantity(requestedQuantity, rules);
  if (!validation.ok) throw new ValidationError(validation.reason);

  if (requestedQuantity > stock) {
    throw new ConflictError(`Only ${stock} available`);
  }

  const cartId = await getCartId(userId);

  // Adding an item already in the cart increases its quantity rather than
  // creating a duplicate line, then re-snaps to a legal step.
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
    select: { id: true, quantity: true },
  });

  if (existing) {
    const combined = snapQuantity(
      Number(existing.quantity) + requestedQuantity,
      rules,
    );
    const capped = Math.min(combined, stock);

    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: capped, addedPricePaise: variant.pricePaise },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId,
        variantId,
        quantity: validation.quantity,
        addedPricePaise: variant.pricePaise,
      },
    });
  }

  return getCart(userId);
}

export async function updateItemQuantity(
  userId: string,
  itemId: string,
  quantity: number,
) {
  // Ownership is enforced by filtering on the user's cart, never by fetching
  // then comparing — see the IDOR note in server/auth/session.ts.
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    select: {
      id: true,
      variant: {
        select: {
          unit: true,
          moqQuantity: true,
          stepQuantity: true,
          maxOrderQuantity: true,
          inventory: { select: { quantityAvailable: true } },
        },
      },
    },
  });

  if (!item) throw new NotFoundError("Cart item");

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return getCart(userId);
  }

  const validation = validateQuantity(quantity, {
    moq: Number(item.variant.moqQuantity),
    step: Number(item.variant.stepQuantity),
    max:
      item.variant.maxOrderQuantity != null
        ? Number(item.variant.maxOrderQuantity)
        : null,
    unit: item.variant.unit as Unit,
  });

  if (!validation.ok) throw new ValidationError(validation.reason);

  const stock = Number(item.variant.inventory?.quantityAvailable ?? 0);
  if (validation.quantity > stock) {
    throw new ConflictError(`Only ${stock} available`);
  }

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: validation.quantity },
  });

  return getCart(userId);
}

export async function removeItem(userId: string, itemId: string) {
  const deleted = await prisma.cartItem.deleteMany({
    where: { id: itemId, cart: { userId } },
  });

  if (deleted.count === 0) throw new NotFoundError("Cart item");

  return getCart(userId);
}

export async function clearCart(userId: string) {
  const cartId = await getCartId(userId);
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await prisma.cart.update({
    where: { id: cartId },
    data: { couponCode: null },
  });
  return getCart(userId);
}

export async function applyCoupon(userId: string, code: string) {
  const normalised = code.trim().toUpperCase();
  const rules = await loadCouponRules(normalised, userId);

  if (!rules) {
    throw new ValidationError("This code is not valid or has already been used");
  }

  const cartId = await getCartId(userId);
  await prisma.cart.update({
    where: { id: cartId },
    data: { couponCode: normalised },
  });

  const cart = await getCart(userId);

  // The coupon may be structurally valid but not applicable to this cart —
  // the pricing engine reports why, and an inapplicable code is not stored.
  if (cart.pricing.couponError) {
    await prisma.cart.update({ where: { id: cartId }, data: { couponCode: null } });
    throw new ValidationError(cart.pricing.couponError);
  }

  return cart;
}

export async function removeCoupon(userId: string) {
  const cartId = await getCartId(userId);
  await prisma.cart.update({ where: { id: cartId }, data: { couponCode: null } });
  return getCart(userId);
}

/** Badge count for the bottom navigation. */
export async function getCartCount(userId: string): Promise<number> {
  return prisma.cartItem.count({ where: { cart: { userId } } });
}
