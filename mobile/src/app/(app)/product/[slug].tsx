import { useState } from "react";
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { formatQuantity, perUnitLabel, snapQuantity } from "@/shared/units";
import { cartApi, catalogApi } from "~/api/endpoints";
import type { ProductDetail, ProductVariant } from "~/api/types";
import { CartButton, ProductImage } from "~/components/commerce";
import { Badge, Body, Button, Card, ErrorView, Loading, Muted, Price, Row, SectionTitle, Stepper, errorMessage } from "~/components/ui";
import { useCartMutation } from "~/lib/cart";
import { colors, font, radius, space } from "~/theme";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const product = useQuery({ queryKey: ["product", slug], queryFn: () => catalogApi.product(slug) });

  if (product.isPending) return <Loading />;
  if (product.isError) return <ErrorView error={product.error} onRetry={product.refetch} />;
  return <ProductView key={product.data.id} product={product.data} />;
}

const rulesOf = (v: ProductVariant) => ({ moq: v.moqQuantity, step: v.stepQuantity, max: v.maxOrderQuantity, unit: v.unit });

function ProductView({ product }: { product: ProductDetail }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const variant = product.variants.find((v) => v.id === variantId);
  const [quantity, setQuantity] = useState(variant?.moqQuantity ?? 1);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const width = Dimensions.get("window").width;

  const add = useCartMutation((args: { variantId: string; quantity: number }) => cartApi.addItem(args.variantId, args.quantity));

  function pickVariant(v: ProductVariant) {
    setVariantId(v.id);
    setQuantity(snapQuantity(quantity, rulesOf(v)));
    setMessage(null);
  }

  function addToCart() {
    if (!variant) return;
    add.mutate(
      { variantId: variant.id, quantity },
      {
        onSuccess: () => setMessage({ text: `Added ${formatQuantity(quantity, variant.unit)} to cart`, error: false }),
        onError: (err) => setMessage({ text: errorMessage(err), error: true }),
      },
    );
  }

  const outOfStock = !variant || variant.stockQuantity <= 0;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "", headerRight: () => <CartButton /> }} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ backgroundColor: colors.white }}>
          {product.images.length ? (
            product.images.map((uri) => <Image key={uri} source={{ uri }} style={{ width, height: width * 0.75 }} resizeMode="contain" />)
          ) : (
            <View style={{ width, alignItems: "center", padding: space.xl }}>
              <ProductImage uri={null} size={width * 0.5} />
            </View>
          )}
        </ScrollView>

        <View style={{ padding: space.lg }}>
          {product.brand ? <Text style={styles.brand}>{product.brand.name}</Text> : null}
          <Text style={styles.name}>{product.name}</Text>
          {product.ratingCount > 0 ? (
            <Muted>
              ★ {product.ratingAvg.toFixed(1)} · {product.ratingCount} ratings
            </Muted>
          ) : null}

          {variant ? (
            <Row style={{ alignItems: "baseline", marginTop: space.md, gap: space.sm }}>
              <Price paise={variant.pricePaise} style={{ fontSize: font.xl }} />
              <Muted>{perUnitLabel(variant.unit)}</Muted>
              {variant.mrpPaise > variant.pricePaise ? <Price paise={variant.mrpPaise} strike /> : null}
            </Row>
          ) : (
            <Badge label="Currently unavailable" tone="danger" />
          )}
          <Muted style={{ marginTop: 2 }}>+{product.taxRatePercent}% GST, delivery charged per seller</Muted>

          {product.variants.length > 0 ? (
            <>
              <SectionTitle style={{ marginTop: space.xl }}>
                {product.variants.length > 1 ? `Choose from ${product.variants.length} offers` : "Sold by"}
              </SectionTitle>
              {product.variants.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => pickVariant(v)}
                  style={[styles.offer, v.id === variantId && styles.offerSelected]}
                >
                  <Row style={{ justifyContent: "space-between" }}>
                    <Body style={{ fontWeight: "600", flex: 1 }}>{v.label}</Body>
                    <Price paise={v.pricePaise} />
                  </Row>
                  <Muted>
                    {v.vendor.businessName}
                    {v.vendor.status === "VERIFIED" ? " · Verified" : ""}
                    {v.vendor.ratingCount > 0 ? ` · ★ ${v.vendor.ratingAvg.toFixed(1)}` : ""}
                  </Muted>
                  <Muted>
                    Min {formatQuantity(v.moqQuantity, v.unit)} · {v.leadTimeDays > 0 ? `Delivers in ${v.leadTimeDays} days` : "Quick delivery"}
                    {v.stockQuantity <= 0 ? " · Out of stock" : ""}
                  </Muted>
                  {v.vendor.freeDeliveryAbovePaise ? (
                    <Muted>Free delivery above {formatINR(v.vendor.freeDeliveryAbovePaise)}</Muted>
                  ) : null}
                </Pressable>
              ))}
            </>
          ) : null}

          {product.shortDescription || product.description ? (
            <>
              <SectionTitle style={{ marginTop: space.xl }}>About</SectionTitle>
              <Body style={{ lineHeight: 22 }}>{product.description || product.shortDescription}</Body>
            </>
          ) : null}

          {Object.keys(product.specs ?? {}).length > 0 ? (
            <Card style={{ marginTop: space.lg }}>
              {Object.entries(product.specs).map(([key, value]) => (
                <Row key={key} style={{ justifyContent: "space-between", paddingVertical: space.xs }}>
                  <Muted>{key}</Muted>
                  <Body style={{ flexShrink: 1, textAlign: "right", marginLeft: space.md }}>{String(value)}</Body>
                </Row>
              ))}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {variant ? (
        <SafeAreaView edges={["bottom"]} style={styles.bar}>
          {message ? (
            <Text style={[styles.message, message.error && { color: colors.danger600 }]}>
              {message.text}
              {!message.error ? (
                <Text style={{ color: colors.brand600, fontWeight: "700" }} onPress={() => router.push("/cart")}>
                  {"  View cart"}
                </Text>
              ) : null}
            </Text>
          ) : null}
          <Row style={{ gap: space.md }}>
            <Stepper
              value={quantity}
              onChange={(n) => setQuantity(snapQuantity(n, rulesOf(variant)))}
              step={variant.stepQuantity}
              min={variant.moqQuantity}
              format={(n) => formatQuantity(n, variant.unit)}
            />
            <Button
              title={outOfStock ? "Out of stock" : `Add · ${formatINR(Math.round(variant.pricePaise * quantity))}`}
              onPress={addToCart}
              loading={add.isPending}
              disabled={outOfStock}
              style={{ flex: 1 }}
            />
          </Row>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: font.xs, color: colors.ink500, fontWeight: "700", textTransform: "uppercase" },
  name: { fontSize: font.xl, fontWeight: "700", color: colors.ink900, marginVertical: space.xs },
  offer: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    backgroundColor: colors.white,
    gap: 2,
  },
  offerSelected: { borderColor: colors.brand500, backgroundColor: colors.brand50 },
  bar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.ink100,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  message: { fontSize: font.sm, color: colors.trust600, marginBottom: space.sm },
});
