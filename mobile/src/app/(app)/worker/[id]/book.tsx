import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { formatMinute } from "@/shared/time";
import { TRADE_LABELS } from "@/shared/trades";
import { addressApi, formatAddress } from "~/api/addresses";
import { bookingApi, workerApi } from "~/api/endpoints";
import type { DayAvailability, RateType, Trade } from "~/api/types";
import { Body, Button, Card, Chip, Chips, ErrorView, Loading, Muted, Row, Screen, SectionTitle, TextField, errorMessage } from "~/components/ui";
import { colors, space } from "~/theme";

const HOURS = [1, 2, 3, 4, 6, 8];
const DAY_MINUTES = 8 * 60;

/** Start times on the hour where the whole job fits inside one free window. */
function startTimes(day: DayAvailability | undefined, durationMinutes: number): number[] {
  if (!day) return [];
  const starts: number[] = [];
  for (const range of day.ranges) {
    for (let m = Math.ceil(range.startMinute / 60) * 60; m + durationMinutes <= range.endMinute; m += 60) starts.push(m);
  }
  return starts;
}

export default function BookWorkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const worker = useQuery({ queryKey: ["worker", id], queryFn: () => workerApi.get(id) });
  const availability = useQuery({ queryKey: ["worker", id, "availability"], queryFn: () => workerApi.availability(id) });
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: addressApi.list });

  // Each choice is the user's explicit pick; the effective value falls back to
  // a sensible default whenever the pick is unset or no longer valid.
  const [tradeChoice, setTrade] = useState<Trade | undefined>();
  const [rateTypeChoice, setRateType] = useState<RateType | undefined>();
  const [hours, setHours] = useState(2);
  const [dateChoice, setDate] = useState<string | undefined>();
  const [startChoice, setStartMinute] = useState<number | undefined>();
  const [addressChoice, setAddressId] = useState<string | undefined>();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fixed-price jobs have no UI on the web yet either; offer hourly and daily.
  const rates = useMemo(() => worker.data?.rates.filter((r) => r.rateType !== "FIXED") ?? [], [worker.data]);
  const trades = [...new Set(rates.map((r) => r.trade))];
  const primary = worker.data?.primaryTrade;
  const trade =
    tradeChoice && trades.includes(tradeChoice) ? tradeChoice : primary && trades.includes(primary) ? primary : trades[0];
  const rateTypes = rates.filter((r) => r.trade === trade);
  const rateType = rateTypes.some((r) => r.rateType === rateTypeChoice) ? rateTypeChoice : rateTypes[0]?.rateType;
  const rate = rateTypes.find((r) => r.rateType === rateType);
  const durationMinutes = rateType === "DAILY" ? DAY_MINUTES : hours * 60;
  const date = dateChoice ?? availability.data?.find((d) => d.ranges.length > 0)?.date;
  const day = availability.data?.find((d) => d.date === date);
  const starts = startTimes(day, durationMinutes);
  const startMinute = startChoice !== undefined && starts.includes(startChoice) ? startChoice : undefined;
  const addressId = addresses.data?.some((a) => a.id === addressChoice) ? addressChoice : addresses.data?.[0]?.id;

  const book = useMutation({
    mutationFn: () =>
      bookingApi.create({
        workerId: id,
        trade: trade!,
        rateType: rateType!,
        scheduledDate: date!,
        startMinute: startMinute!,
        durationMinutes,
        addressId: addressId!,
        workDescription: description.trim(),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["worker", id, "availability"] });
      router.replace({ pathname: "/bookings/[id]", params: { id: result.id } });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (worker.isPending || availability.isPending || addresses.isPending) return <Loading />;
  if (worker.isError) return <ErrorView error={worker.error} onRetry={worker.refetch} />;
  if (availability.isError) return <ErrorView error={availability.error} onRetry={availability.refetch} />;
  if (addresses.isError) return <ErrorView error={addresses.error} onRetry={addresses.refetch} />;

  const units = rateType === "DAILY" ? 1 : hours;
  const billable = rate ? Math.max(units, rate.minUnits) : units;
  const descriptionOk = description.trim().length >= 10;
  const ready = trade && rateType && date && startMinute !== undefined && addressId && descriptionOk;

  return (
    <Screen>
      <Stack.Screen options={{ title: `Book ${worker.data.displayName}` }} />

      {trades.length > 1 ? (
        <>
          <SectionTitle>Work type</SectionTitle>
          <Row style={{ flexWrap: "wrap", gap: space.sm, marginBottom: space.lg }}>
            {trades.map((t) => (
              <Chip key={t} label={TRADE_LABELS[t]} selected={trade === t} onPress={() => setTrade(t)} />
            ))}
          </Row>
        </>
      ) : null}

      <SectionTitle>How long?</SectionTitle>
      <Row style={{ flexWrap: "wrap", gap: space.sm, marginBottom: space.lg }}>
        {rateTypes.map((r) => (
          <Chip
            key={r.rateType}
            label={r.rateType === "HOURLY" ? `Hourly · ${formatINR(r.amountPaise)}/hr` : `Full day · ${formatINR(r.amountPaise)}`}
            selected={rateType === r.rateType}
            onPress={() => setRateType(r.rateType)}
          />
        ))}
      </Row>
      {rateType === "HOURLY" ? (
        <Chips scroll style={{ marginBottom: space.lg }}>
          {HOURS.map((h) => (
            <Chip key={h} label={`${h} h`} selected={hours === h} onPress={() => setHours(h)} />
          ))}
        </Chips>
      ) : null}

      <SectionTitle>Date</SectionTitle>
      <Chips scroll style={{ marginBottom: space.lg }}>
        {availability.data.map((d) => {
          const free = d.ranges.length > 0 && !d.isFullyBooked && !d.isOnLeave;
          return (
            <Chip
              key={d.date}
              label={free ? d.label : `${d.label} · ${d.isOnLeave ? "off" : "full"}`}
              selected={date === d.date}
              onPress={free ? () => setDate(d.date) : undefined}
            />
          );
        })}
      </Chips>

      <SectionTitle>Start time</SectionTitle>
      {starts.length ? (
        <Row style={{ flexWrap: "wrap", gap: space.sm, marginBottom: space.lg }}>
          {starts.map((m) => (
            <Chip key={m} label={formatMinute(m)} selected={startMinute === m} onPress={() => setStartMinute(m)} />
          ))}
        </Row>
      ) : (
        <Muted style={{ marginBottom: space.lg }}>No free slot that day for this duration. Try a shorter job or another date.</Muted>
      )}

      <SectionTitle>Where?</SectionTitle>
      {addresses.data.map((a) => (
        <Card key={a.id} onPress={() => setAddressId(a.id)} style={a.id === addressId && { borderColor: colors.brand500, backgroundColor: colors.brand50 }}>
          <Body style={{ fontWeight: "600" }}>{a.contactName}</Body>
          <Muted>{formatAddress(a)}</Muted>
        </Card>
      ))}
      <Button
        title="Add an address"
        variant="ghost"
        icon="add"
        onPress={() => router.push({ pathname: "/account/addresses/[id]", params: { id: "new" } })}
        style={{ marginBottom: space.lg }}
      />

      <TextField
        label="Describe the work"
        placeholder="e.g. Fix a leaking kitchen tap and replace the bathroom mixer"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={1000}
        hint={descriptionOk ? undefined : "At least 10 characters"}
      />

      {rate ? (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Body>
              Labour ({billable} {rateType === "DAILY" ? "day" : "h"} × {formatINR(rate.amountPaise)})
            </Body>
            <Body style={{ fontWeight: "700" }}>{formatINR(rate.amountPaise * billable)}</Body>
          </Row>
          {billable > units ? <Muted>Includes this worker’s minimum of {rate.minUnits}.</Muted> : null}
          <Muted style={{ marginTop: space.xs }}>A platform fee is added; the full estimate is shown on the booking.</Muted>
        </Card>
      ) : null}

      {error ? <Text style={{ color: colors.danger600, marginBottom: space.md }}>{error}</Text> : null}
      <View>
        <Button title="Request booking" onPress={() => book.mutate()} loading={book.isPending} disabled={!ready} />
      </View>
    </Screen>
  );
}
