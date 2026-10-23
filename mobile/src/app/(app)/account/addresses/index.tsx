import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { formatPhone } from "@/shared/phone";
import { addressApi, formatAddress } from "~/api/addresses";
import { Badge, Body, Button, Card, EmptyState, ErrorView, Loading, Muted, Row } from "~/components/ui";
import { space } from "~/theme";

export default function AddressesScreen() {
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: addressApi.list });

  if (addresses.isPending) return <Loading />;
  if (addresses.isError) return <ErrorView error={addresses.error} onRetry={addresses.refetch} />;

  return (
    <FlatList
      data={addresses.data}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
      refreshing={addresses.isRefetching}
      onRefresh={addresses.refetch}
      ListEmptyComponent={
        <EmptyState icon="location-outline" title="No saved addresses" message="Add your home or site address for deliveries and bookings." />
      }
      renderItem={({ item }) => (
        <Card onPress={() => router.push({ pathname: "/account/addresses/[id]", params: { id: item.id } })}>
          <Row style={{ gap: space.sm, marginBottom: space.xs }}>
            <Badge label={item.type} />
            {item.isDefault ? <Badge label="Default" tone="trust" /> : null}
          </Row>
          <Body style={{ fontWeight: "600" }}>
            {item.contactName} · {formatPhone(item.contactPhone)}
          </Body>
          <Muted>{formatAddress(item)}</Muted>
        </Card>
      )}
      ListFooterComponent={
        <View style={{ marginTop: space.sm }}>
          <Button
            title="Add address"
            icon="add"
            onPress={() => router.push({ pathname: "/account/addresses/[id]", params: { id: "new" } })}
          />
        </View>
      }
    />
  );
}
