/**
 * Response shapes for /api/v1, traced from the services in src/server/services.
 *
 * Money is always Int paise. Dates are ISO strings. The few Prisma Decimals that
 * the services pass through unconverted arrive as strings (`DecStr`).
 * Input schemas that already live in src/shared/contracts are imported from
 * there instead of being redeclared.
 */

export type ISODate = string;
export type DecStr = string;
export type Paise = number;

export type Unit = "BAG" | "KG" | "TONNE" | "PIECE" | "BOX" | "SQFT" | "LITRE" | "BUNDLE" | "BUCKET" | "CAN" | "PACK";
export type DeliveryMode = "STANDARD" | "SCHEDULED" | "PICKUP";
export type AddressType = "HOME" | "SITE" | "OFFICE";
export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type OrderStatus =
  | "PENDING_PAYMENT" | "CONFIRMED" | "ACCEPTED" | "PACKED" | "DISPATCHED" | "OUT_FOR_DELIVERY" | "DELIVERED"
  | "DELIVERY_FAILED" | "CANCELLED" | "RETURN_REQUESTED" | "RETURNED" | "REFUNDED";
export type PaymentStatus =
  | "CREATED" | "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUND_PENDING" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type PaymentMethod = "COD" | "UPI" | "CARD" | "NETBANKING" | "WALLET" | "OFFLINE_MOCK";
export type Trade = "MASON" | "ELECTRICIAN" | "PLUMBER" | "CARPENTER" | "PAINTER" | "TILE_WORKER" | "HELPER";
export type RateType = "HOURLY" | "DAILY" | "FIXED";
export type BookingStatus =
  | "REQUESTED" | "ACCEPTED" | "REJECTED" | "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "APPROVED"
  | "PAID_OUT" | "CANCELLED_BY_CUSTOMER" | "CANCELLED_BY_WORKER" | "NO_SHOW" | "DISPUTED";
export type EstimateMode = "NEW_BUILD" | "RENOVATION";
export type EstimateScope = "WHOLE_HOUSE" | "BATHROOM" | "KITCHEN" | "FLOORING" | "PAINTING";
export type QualityTier = "BASIC" | "STANDARD" | "PREMIUM";
export type EstimateBucket = "MATERIALS" | "LABOUR" | "OTHER";

/** List endpoints put pagination inside `data` (there is no top-level meta). */
export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  slug: string;
  name: string;
  iconKey: string | null;
  imageUrl: string | null;
  _count: { products: number };
}

export type ProductSort = "popular" | "price_asc" | "price_desc" | "rating" | "newest";

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  image: string | null;
  brandName: string | null;
  categoryName: string;
  ratingAvg: number;
  ratingCount: number;
  fromPricePaise: Paise;
  mrpPaise: Paise;
  unit: Unit;
  deliveryMode: DeliveryMode;
  sellerCount: number;
  inStock: boolean;
}

export interface ProductVariant {
  id: string;
  label: string;
  sku: string;
  unit: Unit;
  packSize: number;
  mrpPaise: Paise;
  pricePaise: Paise;
  moqQuantity: number;
  stepQuantity: number;
  maxOrderQuantity: number | null;
  deliveryMode: DeliveryMode;
  leadTimeDays: number;
  weightKgPerUnit: number | null;
  inventory: { quantityAvailable: DecStr; restockEtaDays: number | null } | null;
  stockQuantity: number;
  vendor: {
    id: string;
    businessName: string;
    slug: string;
    ratingAvg: number;
    ratingCount: number;
    status: VerificationStatus;
    minOrderPaise: Paise;
    freeDeliveryAbovePaise: Paise | null;
    baseDeliveryFeePaise: Paise;
  };
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  images: string[];
  specs: Record<string, string>;
  hsnCode: string | null;
  taxRatePercent: number;
  ratingAvg: number;
  ratingCount: number;
  brand: { name: string; slug: string; logoUrl: string | null } | null;
  category: { name: string; slug: string };
  /** Active only, cheapest first. */
  variants: ProductVariant[];
}

// ─── Cart & checkout ─────────────────────────────────────────────────────────

export interface PricedVendorGroup {
  vendorId: string;
  itemsSubtotalPaise: Paise;
  deliveryFeePaise: Paise;
  discountPaise: Paise;
  taxPaise: Paise;
  totalPaise: Paise;
  belowMinimum: { minOrderPaise: Paise; shortfallPaise: Paise } | null;
  freeDeliveryApplied: boolean;
}

export interface PricedCart {
  groups: PricedVendorGroup[];
  itemsSubtotalPaise: Paise;
  deliveryFeePaise: Paise;
  discountPaise: Paise;
  taxPaise: Paise;
  totalPaise: Paise;
  totalSavingsPaise: Paise;
  couponCode: string | null;
  couponError: string | null;
}

export interface CartItem {
  id: string;
  quantity: number;
  variantId: string;
  variantLabel: string;
  unit: Unit;
  packSize: number;
  pricePaise: Paise;
  mrpPaise: Paise;
  moqQuantity: number;
  stepQuantity: number;
  maxOrderQuantity: number | null;
  stockQuantity: number;
  deliveryMode: DeliveryMode;
  leadTimeDays: number;
  isAvailable: boolean;
  product: { id: string; name: string; slug: string; images: string[] };
  vendor: { id: string; businessName: string; slug: string; minOrderPaise: Paise; freeDeliveryAbovePaise: Paise | null };
}

export interface CartView {
  id: string | null;
  items: CartItem[];
  pricing: PricedCart;
  vendors: { id: string; businessName: string; slug: string; minOrderPaise: Paise; freeDeliveryAbovePaise: Paise | null }[];
  issues: { itemId: string; message: string }[];
}

export interface CheckoutInput {
  addressId: string;
  paymentMethod: PaymentMethod;
  customerNote?: string;
  idempotencyKey?: string;
}

export interface CheckoutResult {
  checkoutGroupId: string;
  paymentId: string;
  orders: { id: string; orderNumber: string; vendorName: string; totalPaise: Paise }[];
  totalPaise: Paise;
  paymentMethod: PaymentMethod;
  clientPayload:
    | { method: "COD"; collectOnDelivery: Paise }
    | { redirectUrl: string; providerOrderId: string; amountPaise: Paise }
    | Record<string, never>;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalPaise: Paise;
  placedAt: ISODate;
  deliveredAt: ISODate | null;
  paymentMethod: PaymentMethod;
  vendor: { businessName: string };
  items: { productName: string; imageUrl: string | null; quantity: number; unit: Unit }[];
  itemCount: number;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  deliveryAddress: {
    contactName: string;
    contactPhone: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  deliveryMode: DeliveryMode;
  customerNote: string | null;
  itemsSubtotalPaise: Paise;
  deliveryFeePaise: Paise;
  discountPaise: Paise;
  taxPaise: Paise;
  totalPaise: Paise;
  paymentMethod: PaymentMethod;
  placedAt: ISODate;
  deliveredAt: ISODate | null;
  cancelledAt: ISODate | null;
  cancelReason: string | null;
  vendor: { id: string; businessName: string; slug: string; phoneE164: string };
  payment: { id: string; status: PaymentStatus; method: PaymentMethod; provider: string } | null;
  items: {
    id: string;
    productName: string;
    variantLabel: string;
    unit: Unit;
    imageUrl: string | null;
    quantity: number;
    unitPricePaise: Paise;
    lineTotalPaise: Paise;
  }[];
  events: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; reason: string | null; createdAt: ISODate }[];
  availableActions: { to: OrderStatus; roles: string[]; label: string }[];
}

// ─── Labour ──────────────────────────────────────────────────────────────────

export type WorkerSort = "rating" | "distance" | "experience" | "price_asc";

export interface WorkerListItem {
  id: string;
  displayName: string;
  photoUrl: string | null;
  primaryTrade: Trade | null;
  trades: Trade[];
  yearsExperience: number;
  completedJobs: number;
  ratingAvg: number;
  ratingCount: number;
  isVerified: boolean;
  isAvailableToday: boolean;
  baseCity: string;
  serviceRadiusKm: number;
  distanceKm: number | null;
  hourlyRatePaise: Paise | null;
  dailyRatePaise: Paise | null;
  acceptsFixedPrice: boolean;
}

export interface WorkerDetail extends WorkerListItem {
  bio: string | null;
  basePincode: string;
  isPhoneVerified: boolean;
  lastActiveAt: ISODate | null;
  skills: { trade: Trade; isPrimary: boolean; yearsExperience: number }[];
  rates: { trade: Trade; rateType: RateType; amountPaise: Paise; minUnits: number }[];
  availability: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  reviews: { id: string; rating: number; title: string | null; body: string | null; createdAt: ISODate; authorName: string }[];
}

export interface DayAvailability {
  /** "YYYY-MM-DD" in IST. */
  date: string;
  label: string;
  dayOfWeek: number;
  ranges: { startMinute: number; endMinute: number }[];
  isFullyBooked: boolean;
  isOnLeave: boolean;
}

export interface CreateBookingInput {
  workerId: string;
  trade: Trade;
  rateType: RateType;
  scheduledDate: string;
  startMinute: number;
  durationMinutes: number;
  addressId: string;
  workDescription: string;
}

export interface BookingListItem {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  trade: Trade;
  scheduledDate: ISODate;
  startMinute: number;
  durationMinutes: number;
  rateType: RateType;
  estimatedTotalPaise: Paise;
  finalTotalPaise: Paise | null;
  worker: { id: string; displayName: string; photoUrl: string | null; ratingAvg: number };
}

export interface BookingDetail {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  trade: Trade;
  scheduledDate: ISODate;
  startMinute: number;
  durationMinutes: number;
  rateType: RateType;
  rateAmountPaise: Paise;
  quantity: number;
  labourSubtotalPaise: Paise;
  extrasPaise: Paise;
  platformFeePaise: Paise;
  discountPaise: Paise;
  estimatedTotalPaise: Paise;
  finalTotalPaise: Paise | null;
  cancellationFeePaise: Paise;
  addressSnapshot: { contactName: string; line1: string; line2: string | null; city: string; pincode: string };
  workDescription: string;
  cancelReason: string | null;
  createdAt: ISODate;
  worker: { id: string; displayName: string; photoUrl: string | null; ratingAvg: number; completedJobs: number };
  events: { id: string; fromStatus: BookingStatus | null; toStatus: BookingStatus; reason: string | null; createdAt: ISODate }[];
  availableActions: { to: BookingStatus; roles: string[]; label: string }[];
}

// ─── Estimates ───────────────────────────────────────────────────────────────

export interface EstimateLine {
  id?: string;
  itemKey: string;
  label: string;
  bucket: EstimateBucket;
  quantity: number;
  unit: Unit | null;
  unitPricePaise: Paise;
  amountPaise: Paise;
  productId: string | null;
}

export interface EstimateTotals {
  materialsPaise: Paise;
  labourPaise: Paise;
  otherPaise: Paise;
  totalPaise: Paise;
}

export interface EstimateSummary {
  id: string;
  title: string;
  mode: EstimateMode;
  scope: EstimateScope;
  tier: QualityTier;
  city: string;
  totalPaise: Paise;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface EstimateDetail extends EstimateSummary, EstimateTotals {
  /** The stored EstimateInput. */
  inputs: Record<string, unknown> & { mode: EstimateMode };
  lines: EstimateLine[];
}

export interface EstimatePreview extends EstimateTotals {
  lines: EstimateLine[];
}

export type BoqItem =
  | { lineId: string; label: string; estimatedQuantity: number; unit: Unit | null; estimatedPaise: Paise; available: false }
  | {
      lineId: string;
      label: string;
      estimatedQuantity: number;
      unit: Unit | null;
      estimatedPaise: Paise;
      available: true;
      packsNeeded: number;
      packs: number;
      roundedUp: boolean;
      livePaise: Paise;
      offer: {
        variantId: string;
        productName: string;
        productSlug: string;
        imageUrl: string | null;
        packLabel: string;
        vendorName: string;
        pricePaise: Paise;
        moq: number;
        step: number;
        max: number | null;
        unit: Unit;
      };
    };

export interface Boq {
  estimateId: string;
  title: string;
  city: string;
  items: BoqItem[];
}
