import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { TRADE_LABELS, TRADE_ORDER } from "@/shared/trades";
import { workerApi } from "~/api/endpoints";
import type { Trade, WorkerListItem } from "~/api/types";
import { WorkerAvatar } from "~/components/labour";
import { Badge, Card, Chip, Chips, EmptyState, ErrorView, Loading, Muted, Row } from "~/components/ui";
import { colors, font, space } from "~/theme";

export default function LabourScreen() {
  const [trade, setTrade] = useState<Trade | undefined>();
  const [availableToday, setAvailableToday] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const workers = useInfiniteQuery({
    queryKey: ["workers", trade, availableToday, verifiedOnly],
    queryFn: ({ pageParam }) => workerApi.list({ trade, availableToday, verifiedOnly, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const items = workers.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <Text style={styles.headerLink} onPress={() => router.push("/bookings")}>
              My bookings
            </Text>
          ),
        }}
      />
      <View style={{ backgroundColor: colors.white }}>
        <Chips scroll contentStyle={{ padding: space.md, paddingBottom: space.sm }}>
          <Chip label="All trades" selected={!trade} onPress={() => setTrade(undefined)} />
          {TRADE_ORDER.map((t) => (
            <Chip key={t} label={TRADE_LABELS[t]} selected={trade === t} onPress={() => setTrade(t)} />
          ))}
        </Chips>
        <Chips contentStyle={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
          <Chip label="Available today" selected={availableToday} onPress={() => setAvailableToday((v) => !v)} />
          <Chip label="ID verified" selected={verifiedOnly} onPress={() => setVerifiedOnly((v) => !v)} />
        </Chips>
      </View>
      {workers.isPending ? (
        <Loading />
      ) : workers.isError ? (
        <ErrorView error={workers.error} onRetry={workers.refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(w) => w.id}
          contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
          refreshing={workers.isRefetching && !workers.isFetchingNextPage}
          onRefresh={workers.refetch}
          onEndReached={() => workers.hasNextPage && !workers.isFetchingNextPage && workers.fetchNextPage()}
          ListFooterComponent={workers.isFetchingNextPage ? <ActivityIndicator color={colors.brand500} /> : null}
          ListEmptyComponent={<EmptyState icon="construct-outline" title="No workers match" message="Try another trade or clear the filters." />}
          renderItem={({ item }) => <WorkerCard worker={item} />}
        />
      )}
    </>
  );
}

function WorkerCard({ worker }: { worker: WorkerListItem }) {
  const rate = worker.hourlyRatePaise
    ? `${formatINR(worker.hourlyRatePaise)}/hr`
    : worker.dailyRatePaise
      ? `${formatINR(worker.dailyRatePaise)}/day`
      : null;
  return (
    <Card onPress={() => router.push({ pathname: "/worker/[id]", params: { id: worker.id } })}>
      <Row style={{ gap: space.md, alignItems: "flex-start" }}>
        <WorkerAvatar uri={worker.photoUrl} size={56} />
        <View style={{ flex: 1 }}>
          <Row style={{ gap: space.sm }}>
            <Text style={styles.name}>{worker.displayName}</Text>
            {worker.isVerified ? <Ionicons name="shield-checkmark" size={16} color={colors.trust600} /> : null}
          </Row>
          <Muted>
            {worker.trades.map((t) => TRADE_LABELS[t]).join(", ")} · {worker.yearsExperience} yrs
          </Muted>
          <Muted>
            {worker.ratingCount > 0 ? `★ ${worker.ratingAvg.toFixed(1)} (${worker.ratingCount}) · ` : ""}
            {worker.completedJobs} jobs · {worker.baseCity}
          </Muted>
          <Row style={{ justifyContent: "space-between", marginTop: space.xs }}>
            {rate ? <Text style={styles.rate}>{rate}</Text> : <View />}
            {worker.isAvailableToday ? <Badge label="Available today" tone="trust" /> : null}
          </Row>
        </View>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerLink: { color: colors.brand600, fontWeight: "700", paddingHorizontal: space.lg },
  name: { fontSize: font.md, fontWeight: "700", color: colors.ink900 },
  rate: { fontSize: font.md, fontWeight: "700", color: colors.ink900 },
});
