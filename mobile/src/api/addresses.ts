import type { AddressInput, AddressUpdateInput } from "@/shared/contracts/address";
import { api } from "./client";
import type { AddressType } from "./types";

/** src/server/services/address.service.ts */
export interface Address {
  id: string;
  type: AddressType;
  contactName: string;
  contactPhone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  gstin?: string | null;
  isDefault: boolean;
}

export const addressApi = {
  list: () => api.get<Address[]>("/addresses"),
  create: (input: AddressInput) => api.post<Address>("/addresses", input),
  update: (id: string, input: AddressUpdateInput) => api.patch<Address>(`/addresses/${id}`, input),
  remove: (id: string) => api.delete<void>(`/addresses/${id}`),
};

export function formatAddress(a: Pick<Address, "line1" | "line2" | "landmark" | "city" | "pincode">): string {
  return [a.line1, a.line2, a.landmark, `${a.city} ${a.pincode}`].filter(Boolean).join(", ");
}
