import { ActivityIndicator, FlatList, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { TRADE_LABELS } from "@/shared/trades";
import { bookingApi } from "~/api/endpoints";
import { WorkerAvatar } from "~/components/labour";
import { Badge, Body, Button, Card, EmptyState, ErrorView, Loading, Muted, Row } from "~/components/ui";
import { BOOKING_STATUS, formatSlot } from "~/lib/format";
import { colors, space } from "~/theme";

export default function BookingsScreen() {
  const bookings = useInfiniteQuery({
    queryKey: ["bookings"],
    queryFn: ({ pageParam }) => bookingApi.list(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  if (bookings.isPending) return <Loading />;
  if (bookings.isError) return <ErrorView error={bookings.error} onRetry={bookings.refetch} />;
  const items = bookings.data.pages.flatMap((p) => p.items);

  return (
    <FlatList
      data={items}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
      refreshing={bookings.isRefetching && !bookings.isFetchingNextPage}
      onRefresh={bookings.refetch}
      onEndReached={() => bookings.hasNextPage && !bookings.isFetchingNextPage && bookings.fetchNextPage()}
      ListFooterComponent={bookings.isFetchingNextPage ? <ActivityIndicator color={colors.brand500} /> : null}
      ListEmptyComponent={
        <EmptyState
          icon="calendar-outline"
          title="No bookings yet"
          action={<Button title="Find a worker" onPress={() => router.replace("/labour")} />}
        />
      }
      renderItem={({ item }) => {
        const status = BOOKING_STATUS[item.status];
        return (
          <Card onPress={() => router.push({ pathname: "/bookings/[id]", params: { id: item.id } })}>
            <Row style={{ gap: space.md }}>
              <WorkerAvatar uri={item.worker.photoUrl} size={44} />
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Body style={{ fontWeight: "700" }}>{item.worker.displayName}</Body>
                  <Badge label={status.label} tone={status.tone} />
                </Row>
                <Muted>
                  {TRADE_LABELS[item.trade]} · {formatSlot(item.scheduledDate, item.startMinute, item.durationMinutes)}
                </Muted>
                <Body style={{ fontWeight: "600", marginTop: 2 }}>
                  {formatINR(item.finalTotalPaise ?? item.estimatedTotalPaise)}
                  {item.finalTotalPaise === null ? <Muted> est.</Muted> : null}
                </Body>
              </View>
            </Row>
          </Card>
        );
      }}
    />
  );
}
