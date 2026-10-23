import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SCOPE_LABELS, TIER_LABELS } from "@/shared/estimate";
import { formatINR } from "@/shared/money";
import { estimateApi } from "~/api/endpoints";
import { Body, Button, Card, EmptyState, ErrorView, Loading, Muted, Row } from "~/components/ui";
import { formatDate } from "~/lib/format";
import { space } from "~/theme";

export default function EstimatesScreen() {
  const estimates = useQuery({ queryKey: ["estimates"], queryFn: estimateApi.list });

  if (estimates.isPending) return <Loading />;
  if (estimates.isError) return <ErrorView error={estimates.error} onRetry={estimates.refetch} />;

  const newButton = <Button title="New estimate" icon="add" onPress={() => router.push("/estimate/new")} />;

  return (
    <FlatList
      data={estimates.data}
      keyExtractor={(e) => e.id}
      contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
      refreshing={estimates.isRefetching}
      onRefresh={estimates.refetch}
      ListHeaderComponent={estimates.data.length ? <View style={{ marginBottom: space.lg }}>{newButton}</View> : null}
      ListEmptyComponent={
        <EmptyState
          icon="calculator-outline"
          title="What will it cost?"
          message="Estimate a new build or a renovation from today's local prices, then turn it into a shopping list."
          action={newButton}
        />
      }
      renderItem={({ item }) => (
        <Card onPress={() => router.push({ pathname: "/estimate/[id]", params: { id: item.id } })}>
          <Row style={{ justifyContent: "space-between" }}>
            <Body style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>
              {item.title}
            </Body>
            <Body style={{ fontWeight: "700" }}>{formatINR(item.totalPaise)}</Body>
          </Row>
          <Muted>
            {SCOPE_LABELS[item.scope]} · {TIER_LABELS[item.tier]} · {item.city}
          </Muted>
          <Muted>Updated {formatDate(item.updatedAt)}</Muted>
        </Card>
      )}
    />
  );
}
