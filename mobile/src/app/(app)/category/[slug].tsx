import { useState } from "react";
import { ActivityIndicator, FlatList } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { catalogApi } from "~/api/endpoints";
import type { ProductSort } from "~/api/types";
import { CartButton, ProductRow } from "~/components/commerce";
import { Chip, Chips, EmptyState, ErrorView, Loading } from "~/components/ui";
import { colors, space } from "~/theme";

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
];

export default function CategoryScreen() {
  const { slug, name } = useLocalSearchParams<{ slug: string; name?: string }>();
  const [sort, setSort] = useState<ProductSort>("popular");
  const [inStock, setInStock] = useState(false);

  const products = useInfiniteQuery({
    queryKey: ["products", slug, sort, inStock],
    queryFn: ({ pageParam }) => catalogApi.products({ category: slug, sort, inStock, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const items = products.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <Stack.Screen options={{ title: name ?? "Products", headerRight: () => <CartButton /> }} />
      <Chips scroll style={{ backgroundColor: colors.white }} contentStyle={{ padding: space.md }}>
        <Chip label="In stock" selected={inStock} onPress={() => setInStock((v) => !v)} />
        {SORTS.map((s) => (
          <Chip key={s.value} label={s.label} selected={sort === s.value} onPress={() => setSort(s.value)} />
        ))}
      </Chips>
      {products.isPending ? (
        <Loading />
      ) : products.isError ? (
        <ErrorView error={products.error} onRetry={products.refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
          renderItem={({ item }) => <ProductRow product={item} />}
          onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshing={products.isRefetching && !products.isFetchingNextPage}
          onRefresh={products.refetch}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="No products here yet" />}
          ListFooterComponent={products.isFetchingNextPage ? <ActivityIndicator color={colors.brand500} /> : null}
        />
      )}
    </>
  );
}
