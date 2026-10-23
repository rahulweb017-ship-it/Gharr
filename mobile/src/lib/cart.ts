import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "~/api/endpoints";
import type { CartView } from "~/api/types";

export const CART_KEY = ["cart"] as const;

export function useCart() {
  return useQuery({ queryKey: CART_KEY, queryFn: cartApi.get });
}

/** Every cart mutation returns the full recomputed CartView; write it straight into the cache. */
export function useCartMutation<TArgs>(mutationFn: (args: TArgs) => Promise<CartView>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (cart) => queryClient.setQueryData(CART_KEY, cart),
  });
}

export function cartCount(cart: CartView | undefined): number {
  return cart?.items.length ?? 0;
}
