/**
 * Admin-console demo data, so every admin screen has something real to act on:
 * a verification queue with documents, orders across the lifecycle (including a
 * prepaid one to refund), a disputed labour booking and a few support tickets.
 *
 * Rows are inserted directly rather than through the services (which need the
 * full server env), but with the same money arithmetic: line = qty × unit
 * price, tax on the line, total = subtotal + tax + delivery.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentType, OrderStatus, PaymentMethod, PrismaClient } from "@prisma/client";

const STORAGE_DIR = process.env.PRIVATE_STORAGE_DIR ?? "./storage/private";

const daysAgo = (n: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/** SVG is XML: a bare "&" (as in "Shops & Establishments") breaks the whole image. */
const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A labelled placeholder "scan" so the document viewer has something to show. */
function sampleDocumentSvg(title: string, lines: string[]): string {
  const body = lines
    .map((line, i) => `<text x="40" y="${170 + i * 34}" font-size="20" fill="#364463">${xml(line)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
<rect width="800" height="520" rx="18" fill="#f5f7fb" stroke="#d3dbea" stroke-width="3"/>
<rect x="0" y="0" width="800" height="90" rx="18" fill="#0c2657"/>
<text x="40" y="58" font-family="Arial" font-size="30" font-weight="bold" fill="#ffffff">${xml(title)}</text>
<text x="600" y="58" font-family="Arial" font-size="16" fill="#ffa872">SAMPLE · NOT A REAL DOCUMENT</text>
<g font-family="Arial">${body}</g>
</svg>`;
}

async function writeDoc(key: string, title: string, lines: string[]) {
  const full = path.resolve(STORAGE_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, sampleDocumentSvg(title, lines));
  return key;
}

async function nextNumber(prisma: PrismaClient, seq: "homeall_order_seq" | "homeall_booking_seq", prefix: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ value: bigint }>>(`SELECT nextval('${seq}') AS value`);
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${yymm}-${String(rows[0].value).padStart(6, "0")}`;
}

export async function seedAdminDemo(prisma: PrismaClient) {
  // --- Support staff account ---
  await prisma.user.create({
    data: { phoneE164: "+919000000008", phoneVerifiedAt: new Date(), name: "Gharr Support", roles: ["SUPPORT", "CUSTOMER"], cart: { create: {} } },
  });

  // --- Verification queue ---
  const pendingVendorUser = await prisma.user.create({
    data: { phoneE164: "+919848000011", phoneVerifiedAt: new Date(), name: "Venu Goud", roles: ["VENDOR"] },
  });
  const pendingVendor = await prisma.vendor.create({
    data: {
      userId: pendingVendorUser.id,
      businessName: "Kompally Building Supplies",
      slug: "kompally-building-supplies",
      legalName: "Kompally Building Supplies LLP",
      gstin: "36AAKFK1234L1Z5",
      phoneE164: "+919848000011",
      email: "accounts@kompallysupplies.example",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500014",
      servicePincodes: ["500014", "500067", "500100"],
      status: "PENDING",
      isActive: false,
      baseDeliveryFeePaise: 30000,
    },
  });
  const vendorDocs: Array<[DocumentType, string, string[]]> = [
    ["GST", "GST Registration Certificate", ["Legal name: Kompally Building Supplies LLP", "GSTIN: 36AAKFK1234L1Z5", "State: Telangana", "Date of liability: 01/04/2024"]],
    ["SHOP_LICENSE", "Shops & Establishments Licence", ["Trade name: Kompally Building Supplies", "Licence no: TS-HYD-SE-2024-118822", "Valid till: 31/03/2027"]],
  ];
  for (const [type, title, lines] of vendorDocs) {
    const key = await writeDoc(`docs/vendor/${pendingVendor.id.toLowerCase()}/${type.toLowerCase()}.svg`, title, lines);
    await prisma.vendorDocument.create({ data: { vendorId: pendingVendor.id, type, storageKey: key, createdAt: daysAgo(1) } });
  }

  const kiran = await prisma.worker.findFirst({ where: { idVerificationStatus: "PENDING" }, select: { id: true, displayName: true } });
  if (kiran) {
    const workerDocs: Array<[DocumentType, string, string[]]> = [
      ["PHOTO_ID", "Voter ID Card", [`Name: ${kiran.displayName}`, "EPIC no: TSX1234567", "Constituency: Serilingampally"]],
      ["AADHAAR", "Aadhaar (masked)", [`Name: ${kiran.displayName}`, "Aadhaar: XXXX XXXX 4821", "Address: Madhapur, Hyderabad 500081"]],
    ];
    for (const [type, title, lines] of workerDocs) {
      const key = await writeDoc(`docs/worker/${kiran.id.toLowerCase()}/${type.toLowerCase()}.svg`, title, lines);
      await prisma.workerDocument.create({ data: { workerId: kiran.id, type, storageKey: key, createdAt: daysAgo(2) } });
    }
  }

  // --- Orders ---
  const arjun = await prisma.user.findUniqueOrThrow({ where: { phoneE164: "+919000000001" }, include: { addresses: true } });
  const priya = await prisma.user.findUniqueOrThrow({ where: { phoneE164: "+919000000002" }, include: { addresses: true } });

  const offers = await prisma.productVariant.findMany({
    where: { isActive: true },
    orderBy: { pricePaise: "asc" },
    include: { product: true, vendor: true },
  });
  const offerFor = (productName: string) => {
    const o = offers.find((v) => v.product.name === productName);
    if (!o) throw new Error(`Demo order product missing: ${productName}`);
    return o;
  };

  async function createOrder(opts: {
    user: typeof arjun;
    lines: Array<{ product: string; qty: number }>;
    status: OrderStatus;
    method: PaymentMethod;
    placedDaysAgo: number;
    trail: OrderStatus[];
    paymentStatus: "PENDING" | "CAPTURED" | "CREATED";
    cancelReason?: string;
  }) {
    const picked = opts.lines.map((l) => ({ offer: offerFor(l.product), qty: l.qty }));
    const vendor = picked[0].offer.vendor;
    const items = picked.map(({ offer, qty }) => {
      const sub = offer.pricePaise * qty;
      const tax = Math.round((sub * Number(offer.product.taxRatePercent)) / 100);
      return { offer, qty, sub, tax, total: sub + tax };
    });
    const itemsSubtotal = items.reduce((s, i) => s + i.sub, 0);
    const tax = items.reduce((s, i) => s + i.tax, 0);
    const deliveryFee = vendor.baseDeliveryFeePaise;
    const total = itemsSubtotal + tax + deliveryFee;
    const address = opts.user.addresses[0];
    const groupId = `demo-${opts.user.id}-${opts.placedDaysAgo}`;
    const placedAt = daysAgo(opts.placedDaysAgo);

    const payment = await prisma.payment.create({
      data: {
        checkoutGroupId: groupId,
        userId: opts.user.id,
        provider: opts.method === "COD" ? "cod" : "mock",
        method: opts.method,
        amountPaise: total,
        status: opts.paymentStatus,
        idempotencyKey: `demo:${groupId}`,
        providerPaymentId: opts.method === "COD" ? null : `mockpay_demo_${opts.placedDaysAgo}`,
        capturedAt: opts.paymentStatus === "CAPTURED" ? placedAt : null,
        createdAt: placedAt,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: await nextNumber(prisma, "homeall_order_seq", "HA"),
        checkoutGroupId: groupId,
        userId: opts.user.id,
        vendorId: vendor.id,
        status: opts.status,
        deliveryAddress: {
          contactName: address.contactName, contactPhone: address.contactPhone, line1: address.line1,
          line2: address.line2, landmark: address.landmark, city: address.city, state: address.state,
          pincode: address.pincode, type: address.type, gstin: address.gstin,
        },
        itemsSubtotalPaise: itemsSubtotal,
        deliveryFeePaise: deliveryFee,
        taxPaise: tax,
        totalPaise: total,
        paymentId: payment.id,
        paymentMethod: opts.method,
        placedAt,
        createdAt: placedAt,
        deliveredAt: opts.status === "DELIVERED" ? daysAgo(opts.placedDaysAgo - 2) : null,
        cancelledAt: opts.status === "CANCELLED" ? daysAgo(opts.placedDaysAgo, 14) : null,
        cancelReason: opts.cancelReason ?? null,
        items: {
          create: items.map((i) => ({
            variantId: i.offer.id,
            productId: i.offer.productId,
            productName: i.offer.product.name,
            variantLabel: i.offer.label,
            vendorName: vendor.businessName,
            unit: i.offer.unit,
            imageUrl: i.offer.product.images[0] ?? null,
            quantity: i.qty,
            unitPricePaise: i.offer.pricePaise,
            mrpPaise: i.offer.mrpPaise,
            lineSubtotalPaise: i.sub,
            lineTaxPaise: i.tax,
            lineTotalPaise: i.total,
          })),
        },
      },
    });

    let from: OrderStatus | null = null;
    for (const [index, to] of opts.trail.entries()) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id, fromStatus: from, toStatus: to,
          actorRole: index === 0 ? "CUSTOMER" : "VENDOR",
          reason: to === "CANCELLED" ? opts.cancelReason : null,
          createdAt: new Date(placedAt.getTime() + index * 6 * 3600 * 1000),
        },
      });
      from = to;
    }
    return order;
  }

  await createOrder({
    user: arjun, method: "COD", status: "DELIVERED", placedDaysAgo: 12, paymentStatus: "CAPTURED",
    lines: [{ product: "UltraTech Cement OPC 53 Grade", qty: 20 }],
    trail: ["CONFIRMED", "ACCEPTED", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"],
  });
  await createOrder({
    user: arjun, method: "COD", status: "OUT_FOR_DELIVERY", placedDaysAgo: 2, paymentStatus: "PENDING",
    lines: [{ product: "Kajaria Vitrified Floor Tile 600x600mm Glossy Ivory", qty: 12 }],
    trail: ["CONFIRMED", "ACCEPTED", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY"],
  });
  await createOrder({
    user: arjun, method: "COD", status: "CANCELLED", placedDaysAgo: 6, paymentStatus: "CREATED",
    lines: [{ product: "Wall Putty 20kg", qty: 4 }], cancelReason: "Ordered the wrong quantity",
    trail: ["CONFIRMED", "CANCELLED"],
  });
  await createOrder({
    user: priya, method: "UPI", status: "CONFIRMED", placedDaysAgo: 1, paymentStatus: "CAPTURED",
    lines: [{ product: "Asian Paints Royale Luxury Interior Emulsion", qty: 2 }],
    trail: ["PENDING_PAYMENT", "CONFIRMED"],
  });

  // --- Labour bookings ---
  const workers = await prisma.worker.findMany({
    where: { idVerificationStatus: "VERIFIED" },
    include: { rates: true, skills: true },
    take: 3,
  });

  async function createBooking(user: typeof arjun, worker: (typeof workers)[number], status: "DISPUTED" | "IN_PROGRESS", dayOffset: number, trail: Array<[string, string | null]>) {
    const rate = worker.rates.find((r) => r.rateType === "DAILY") ?? worker.rates[0];
    const labour = rate.amountPaise;
    const fee = Math.round(labour * 0.05);
    const address = user.addresses[0];
    const date = daysAgo(dayOffset, 0);
    const booking = await prisma.labourBooking.create({
      data: {
        bookingNumber: await nextNumber(prisma, "homeall_booking_seq", "HB"),
        userId: user.id,
        workerId: worker.id,
        trade: rate.trade,
        status,
        scheduledDate: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
        startMinute: 9 * 60,
        durationMinutes: 8 * 60,
        rateType: rate.rateType,
        rateAmountPaise: rate.amountPaise,
        quantity: 1,
        labourSubtotalPaise: labour,
        platformFeePaise: fee,
        estimatedTotalPaise: labour + fee,
        addressSnapshot: {
          contactName: address.contactName, contactPhone: address.contactPhone, line1: address.line1,
          city: address.city, state: address.state, pincode: address.pincode,
        },
        workDescription: status === "DISPUTED" ? "Bathroom wall tiling, approx 120 sq ft" : "Plastering of first-floor bedroom walls",
        checkedInAt: daysAgo(dayOffset, 9),
        startedAt: daysAgo(dayOffset, 9),
        completedAt: status === "DISPUTED" ? daysAgo(dayOffset, 17) : null,
        createdAt: daysAgo(dayOffset + 2),
        lines: { create: [{ kind: "LABOUR", description: `${rate.trade} — 1 day`, quantity: 1, unitAmountPaise: labour, totalAmountPaise: labour }] },
      },
    });
    let from: string | null = null;
    for (const [index, [to, reason]] of trail.entries()) {
      await prisma.labourBookingEvent.create({
        data: {
          bookingId: booking.id, fromStatus: from as never, toStatus: to as never,
          actorRole: to === "DISPUTED" ? "CUSTOMER" : index % 2 ? "WORKER" : "CUSTOMER",
          reason, createdAt: new Date(daysAgo(dayOffset + 2).getTime() + index * 8 * 3600 * 1000),
        },
      });
      from = to;
    }
    return booking;
  }

  const disputed = workers[0]
    ? await createBooking(arjun, workers[0], "DISPUTED", 3, [
        ["REQUESTED", null], ["ACCEPTED", null], ["CONFIRMED", null], ["CHECKED_IN", null], ["IN_PROGRESS", null], ["COMPLETED", null],
        ["DISPUTED", "Tiles are uneven near the shower and grout is missing in two rows. Worker left before finishing."],
      ])
    : null;
  if (workers[1]) {
    await createBooking(priya, workers[1], "IN_PROGRESS", 0, [
      ["REQUESTED", null], ["ACCEPTED", null], ["CONFIRMED", null], ["CHECKED_IN", null], ["IN_PROGRESS", null],
    ]);
  }

  // --- Support tickets ---
  const support = await prisma.user.findUniqueOrThrow({ where: { phoneE164: "+919000000008" } });
  const t1 = await prisma.supportTicket.create({
    data: {
      userId: arjun.id, bookingId: disputed?.id ?? null, category: "BOOKING", priority: "HIGH", status: "IN_PROGRESS",
      subject: "Tiling job left unfinished", assignedToId: support.id, createdAt: daysAgo(2),
      message: "The tile worker marked the job complete but two rows have no grout and the tiles near the shower are uneven. I have raised a dispute.",
    },
  });
  await prisma.ticketMessage.createMany({
    data: [
      { ticketId: t1.id, authorId: support.id, isStaff: true, body: "Sorry about this, Arjun. Could you share a photo of the affected area? We've paused the worker's payout while we review.", createdAt: daysAgo(2, 15) },
      { ticketId: t1.id, authorId: arjun.id, isStaff: false, body: "Sure — I'll upload photos tonight. The grout gaps are on the left wall.", createdAt: daysAgo(1, 9) },
    ],
  });
  await prisma.supportTicket.create({
    data: {
      userId: priya.id, category: "PAYMENT", priority: "NORMAL", status: "OPEN", createdAt: daysAgo(0, 9),
      subject: "Can I change paint shade after paying?",
      message: "I paid by UPI for two buckets of Royale in white. Can I switch to off-white, or cancel and reorder?",
    },
  });
  await prisma.supportTicket.create({
    data: {
      userId: arjun.id, category: "ORDER", priority: "LOW", status: "RESOLVED", resolvedAt: daysAgo(4), createdAt: daysAgo(6),
      subject: "Invoice for cement order",
      message: "Please share a GST invoice for my cement order.",
    },
  });

  console.log("  admin demo: 1 pending vendor, documents, 4 orders, 2 bookings (1 disputed), 3 tickets, support user +919000000008");
}
