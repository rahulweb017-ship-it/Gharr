import type { BoqCartInput, EstimateInput } from "@/shared/contracts/estimate";
import { api } from "./client";
import type {
  Boq,
  BookingDetail,
  BookingListItem,
  BookingStatus,
  CartView,
  Category,
  CheckoutInput,
  CheckoutResult,
  CreateBookingInput,
  DayAvailability,
  EstimateDetail,
  EstimatePreview,
  EstimateSummary,
  OrderDetail,
  OrderListItem,
  Paginated,
  ProductDetail,
  ProductListItem,
  ProductSort,
  Trade,
  WorkerDetail,
  WorkerListItem,
  WorkerSort,
} from "./types";

/** One function per /api/v1 endpoint the app uses. Types in ./types.ts. */

export const catalogApi = {
  categories: () => api.get<Category[]>("/categories"),
  products: (query: { category?: string; q?: string; sort?: ProductSort; inStock?: boolean; page?: number; perPage?: number }) =>
    api.get<Paginated<ProductListItem>>("/products", {
      ...query,
      inStock: query.inStock ? "true" : undefined,
    }),
  product: (slug: string) => api.get<ProductDetail>(`/products/${encodeURIComponent(slug)}`),
  search: (q: string) => api.get<ProductListItem[]>("/search", { q, limit: 30 }),
};

export const cartApi = {
  get: () => api.get<CartView>("/cart"),
  clear: () => api.delete<CartView>("/cart"),
  addItem: (variantId: string, quantity: number) => api.post<CartView>("/cart/items", { variantId, quantity }),
  updateItem: (itemId: string, quantity: number) => api.patch<CartView>(`/cart/items/${itemId}`, { quantity }),
  removeItem: (itemId: string) => api.delete<CartView>(`/cart/items/${itemId}`),
  applyCoupon: (code: string) => api.post<CartView>("/cart/coupon", { code }),
  removeCoupon: () => api.delete<CartView>("/cart/coupon"),
  checkout: (input: CheckoutInput) => api.post<CheckoutResult>("/cart/checkout", input),
};

export const paymentApi = {
  /**
   * Dev-only mock gateway (PAYMENT_PROVIDER=mock). The web flow opens
   * /dev/pay/:id, whose buttons need a web session cookie; the app calls the
   * same endpoint directly with its Bearer token instead.
   */
  completeMock: (paymentId: string, outcome: "success" | "failure") =>
    api.post<{ forwarded: true; webhookStatus: number; outcome: string }>(`/payments/mock/${paymentId}/complete`, { outcome }),
};

export const orderApi = {
  list: (page = 1) => api.get<Paginated<OrderListItem>>("/orders", { page, perPage: 20 }),
  get: (id: string) => api.get<OrderDetail>(`/orders/${id}`),
  cancel: (id: string, reason: string) => api.post<{ id: string; status: "CANCELLED" }>(`/orders/${id}/cancel`, { reason }),
};

export const workerApi = {
  list: (query: { trade?: Trade; sort?: WorkerSort; verifiedOnly?: boolean; availableToday?: boolean; page?: number }) =>
    api.get<Paginated<WorkerListItem>>("/workers", {
      trade: query.trade,
      sort: query.sort,
      verifiedOnly: query.verifiedOnly ? "true" : undefined,
      availableToday: query.availableToday ? "true" : undefined,
      page: query.page,
      perPage: 20,
    }),
  get: (id: string) => api.get<WorkerDetail>(`/workers/${id}`),
  availability: (id: string, days = 14) => api.get<DayAvailability[]>(`/workers/${id}/availability`, { days }),
};

export const bookingApi = {
  create: (input: CreateBookingInput) =>
    api.post<{ id: string; bookingNumber: string; estimatedTotalPaise: number; minimumApplied: boolean }>("/bookings", input),
  list: (page = 1) => api.get<Paginated<BookingListItem>>("/bookings", { page, perPage: 20 }),
  get: (id: string) => api.get<BookingDetail>(`/bookings/${id}`),
  setStatus: (id: string, status: BookingStatus, reason?: string) =>
    api.patch<{ id: string; status: BookingStatus; cancellationFeePaise: number }>(`/bookings/${id}/status`, { status, reason }),
};

export const estimateApi = {
  cities: () => api.get<string[]>("/estimates/cities"),
  preview: (input: EstimateInput) => api.post<EstimatePreview>("/estimates/preview", input),
  list: () => api.get<EstimateSummary[]>("/estimates"),
  get: (id: string) => api.get<EstimateDetail>(`/estimates/${id}`),
  create: (input: EstimateInput) => api.post<EstimateDetail>("/estimates", input),
  update: (id: string, input: EstimateInput) => api.put<EstimateDetail>(`/estimates/${id}`, input),
  remove: (id: string) => api.delete<void>(`/estimates/${id}`),
  boq: (id: string) => api.get<Boq>(`/estimates/${id}/boq`),
  addToCart: (id: string, input: BoqCartInput) =>
    api.post<{ added: string[]; failed: { lineId: string; label: string; reason: string }[] }>(`/estimates/${id}/cart`, input),
};
