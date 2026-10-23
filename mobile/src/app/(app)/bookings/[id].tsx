import { Alert, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { TRADE_LABELS } from "@/shared/trades";
import { bookingApi } from "~/api/endpoints";
import type { BookingStatus } from "~/api/types";
import { WorkerAvatar } from "~/components/labour";
import { AmountRow, Badge, Body, Button, Card, ErrorView, Loading, Muted, Row, Screen, SectionTitle, errorMessage, styles as ui } from "~/components/ui";
import { BOOKING_STATUS, formatDateTime, formatSlot } from "~/lib/format";
import { space } from "~/theme";

/** Customer actions get a confirmation; cancelling may carry a fee the server computes. */
const DESTRUCTIVE: BookingStatus[] = ["CANCELLED_BY_CUSTOMER", "NO_SHOW", "DISPUTED"];

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const booking = useQuery({ queryKey: ["booking", id], queryFn: () => bookingApi.get(id) });

  const transition = useMutation({
    mutationFn: (status: BookingStatus) => bookingApi.setStatus(id, status, "Updated by customer from the app"),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      if (result.cancellationFeePaise > 0) {
        Alert.alert("Booking cancelled", `A cancellation fee of ${formatINR(result.cancellationFeePaise)} applies.`);
      }
    },
    onError: (err) => Alert.alert("Couldn't update booking", errorMessage(err)),
  });

  if (booking.isPending) return <Loading />;
  if (booking.isError) return <ErrorView error={booking.error} onRetry={booking.refetch} />;

  const b = booking.data;
  const status = BOOKING_STATUS[b.status];
  const actions = b.availableActions.filter((a) => a.roles.includes("CUSTOMER"));

  function run(to: BookingStatus, label: string) {
    if (!DESTRUCTIVE.includes(to)) return transition.mutate(to);
    const warning =
      to === "CANCELLED_BY_CUSTOMER"
        ? "Cancelling less than 12 hours before the start, or after the worker arrives, may carry a fee."
        : undefined;
    Alert.alert(`${label}?`, warning, [
      { text: "Back", style: "cancel" },
      { text: label, style: "destructive", onPress: () => transition.mutate(to) },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: b.bookingNumber }} />
      <Card>
        <Row style={{ gap: space.md }}>
          <WorkerAvatar uri={b.worker.photoUrl} size={52} />
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: "700" }}>{b.worker.displayName}</Body>
            <Muted>
              {TRADE_LABELS[b.trade]} · {b.worker.completedJobs} jobs
            </Muted>
          </View>
          <Badge label={status.label} tone={status.tone} />
        </Row>
        <View style={ui.divider} />
        <Body>{formatSlot(b.scheduledDate, b.startMinute, b.durationMinutes)}</Body>
        <Muted>
          {b.addressSnapshot.line1}, {b.addressSnapshot.city} {b.addressSnapshot.pincode}
        </Muted>
      </Card>

      <SectionTitle>Work</SectionTitle>
      <Card>
        <Body style={{ lineHeight: 22 }}>{b.workDescription}</Body>
      </Card>

      <SectionTitle>Price</SectionTitle>
      <Card>
        <AmountRow label={`Labour (${b.quantity} ${b.rateType === "DAILY" ? "day" : b.rateType === "HOURLY" ? "h" : "job"})`} paise={b.labourSubtotalPaise} />
        {b.extrasPaise > 0 ? <AmountRow label="Extras" paise={b.extrasPaise} /> : null}
        <AmountRow label="Platform fee" paise={b.platformFeePaise} />
        {b.discountPaise > 0 ? <AmountRow label="Discount" paise={-b.discountPaise} /> : null}
        {b.cancellationFeePaise > 0 ? <AmountRow label="Cancellation fee" paise={b.cancellationFeePaise} /> : null}
        <View style={ui.divider} />
        <AmountRow label={b.finalTotalPaise !== null ? "Total" : "Estimated total"} paise={b.finalTotalPaise ?? b.estimatedTotalPaise} bold />
      </Card>

      {b.events.length > 0 ? (
        <>
          <SectionTitle>Timeline</SectionTitle>
          <Card>
            {b.events.map((e) => (
              <Row key={e.id} style={{ justifyContent: "space-between", paddingVertical: 3 }}>
                <Body>{BOOKING_STATUS[e.toStatus].label}</Body>
                <Muted>{formatDateTime(e.createdAt)}</Muted>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      {actions.map((a) => (
        <Button
          key={a.to}
          title={a.label}
          variant={DESTRUCTIVE.includes(a.to) ? "danger" : "primary"}
          onPress={() => run(a.to, a.label)}
          loading={transition.isPending && transition.variables === a.to}
          style={{ marginBottom: space.sm }}
        />
      ))}
    </Screen>
  );
}
