import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { perUnitLabel } from "@/shared/units";
import type { ProductListItem } from "~/api/types";
import { useCart, cartCount } from "~/lib/cart";
import { colors, font, radius, space } from "~/theme";
import { Badge, Price } from "./ui";

/** Header button with the live cart line count. */
export function CartButton() {
  const cart = useCart();
  const count = cartCount(cart.data);
  return (
    <Pressable accessibilityLabel="Cart" onPress={() => router.push("/cart")} style={styles.cartButton} hitSlop={8}>
      <Ionicons name="cart-outline" size={24} color={colors.ink900} />
      {count > 0 ? (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ProductImage({ uri, size }: { uri: string | null | undefined; size: number }) {
  if (!uri) {
    return (
      <View style={[styles.imagePlaceholder, { width: size, height: size }]}>
        <Ionicons name="cube-outline" size={size / 2.5} color={colors.ink300} />
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: colors.ink50 }} />;
}

export function ProductRow({ product }: { product: ProductListItem }) {
  const discount = product.mrpPaise > product.fromPricePaise;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      <ProductImage uri={product.image} size={84} />
      <View style={{ flex: 1 }}>
        {product.brandName ? <Text style={styles.brand}>{product.brandName}</Text> : null}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.from}>from </Text>
          <Price paise={product.fromPricePaise} />
          <Text style={styles.unit}>{perUnitLabel(product.unit)}</Text>
          {discount ? <Price paise={product.mrpPaise} strike style={{ marginLeft: space.sm }} /> : null}
        </View>
        <View style={styles.metaRow}>
          {product.ratingCount > 0 ? (
            <Text style={styles.meta}>
              ★ {product.ratingAvg.toFixed(1)} ({product.ratingCount})
            </Text>
          ) : null}
          <Text style={styles.meta}>
            {product.sellerCount} seller{product.sellerCount === 1 ? "" : "s"}
          </Text>
          {!product.inStock ? <Badge label="Out of stock" tone="danger" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cartButton: { paddingHorizontal: space.sm },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  imagePlaceholder: { borderRadius: radius.md, backgroundColor: colors.ink50, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: space.md,
    marginBottom: space.md,
  },
  brand: { fontSize: font.xs, color: colors.ink500, fontWeight: "600", textTransform: "uppercase" },
  name: { fontSize: font.md, color: colors.ink900, fontWeight: "600", marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: space.xs },
  from: { fontSize: font.xs, color: colors.ink500 },
  unit: { fontSize: font.xs, color: colors.ink500, marginLeft: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
  meta: { fontSize: font.xs, color: colors.ink500 },
});
