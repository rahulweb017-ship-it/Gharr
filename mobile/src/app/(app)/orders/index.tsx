import { ActivityIndicator, FlatList } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { orderApi } from "~/api/endpoints";
import { Badge, Body, Button, Card, EmptyState, ErrorView, Loading, Muted, Row } from "~/components/ui";
import { ORDER_STATUS, formatDate } from "~/lib/format";
import { colors, space } from "~/theme";

export default function OrdersScreen() {
  const orders = useInfiniteQuery({
    queryKey: ["orders"],
    queryFn: ({ pageParam }) => orderApi.list(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  if (orders.isPending) return <Loading />;
  if (orders.isError) return <ErrorView error={orders.error} onRetry={orders.refetch} />;

  const items = orders.data.pages.flatMap((p) => p.items);

  return (
    <FlatList
      data={items}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
      refreshing={orders.isRefetching && !orders.isFetchingNextPage}
      onRefresh={orders.refetch}
      onEndReached={() => orders.hasNextPage && !orders.isFetchingNextPage && orders.fetchNextPage()}
      ListFooterComponent={orders.isFetchingNextPage ? <ActivityIndicator color={colors.brand500} /> : null}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="No orders yet"
          action={<Button title="Browse materials" onPress={() => router.replace("/shop")} />}
        />
      }
      renderItem={({ item }) => {
        const status = ORDER_STATUS[item.status];
        return (
          <Card onPress={() => router.push({ pathname: "/orders/[id]", params: { id: item.id } })}>
            <Row style={{ justifyContent: "space-between", marginBottom: space.xs }}>
              <Body style={{ fontWeight: "700" }}>{item.orderNumber}</Body>
              <Badge label={status.label} tone={status.tone} />
            </Row>
            <Muted>
              {item.vendor.businessName} · {formatDate(item.placedAt)}
            </Muted>
            <Muted numberOfLines={1}>
              {item.items.map((i) => i.productName).join(", ")}
              {item.itemCount > item.items.length ? ` +${item.itemCount - item.items.length} more` : ""}
            </Muted>
            <Body style={{ fontWeight: "700", marginTop: space.xs }}>{formatINR(item.totalPaise)}</Body>
          </Card>
        );
      }}
    />
  );
}
