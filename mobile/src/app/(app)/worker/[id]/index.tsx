import { View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { formatRange } from "@/shared/time";
import { TRADE_LABELS } from "@/shared/trades";
import { workerApi } from "~/api/endpoints";
import { Badge, Body, Button, Card, ErrorView, Loading, Muted, Row, Screen, SectionTitle, Title } from "~/components/ui";
import { colors, space } from "~/theme";
import { WorkerAvatar } from "~/components/labour";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RATE_SUFFIX = { HOURLY: "/hr", DAILY: "/day", FIXED: " fixed" } as const;

export default function WorkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const worker = useQuery({ queryKey: ["worker", id], queryFn: () => workerApi.get(id) });

  if (worker.isPending) return <Loading />;
  if (worker.isError) return <ErrorView error={worker.error} onRetry={worker.refetch} />;
  const w = worker.data;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: w.displayName }} />
      <Screen>
        <Card>
          <Row style={{ gap: space.lg }}>
            <WorkerAvatar uri={w.photoUrl} size={72} />
            <View style={{ flex: 1 }}>
              <Title style={{ marginBottom: 2 }}>{w.displayName}</Title>
              <Muted>
                {w.baseCity} · serves within {w.serviceRadiusKm} km
              </Muted>
              <Row style={{ gap: space.sm, marginTop: space.xs, flexWrap: "wrap" }}>
                {w.isVerified ? <Badge label="ID verified" tone="trust" /> : null}
                {w.isAvailableToday ? <Badge label="Available today" tone="brand" /> : null}
              </Row>
            </View>
          </Row>
          <Row style={{ justifyContent: "space-around", marginTop: space.lg }}>
            <Stat value={w.ratingCount > 0 ? `★ ${w.ratingAvg.toFixed(1)}` : "New"} label={`${w.ratingCount} reviews`} />
            <Stat value={String(w.completedJobs)} label="jobs done" />
            <Stat value={`${w.yearsExperience} yrs`} label="experience" />
          </Row>
        </Card>

        {w.bio ? (
          <Card>
            <Body style={{ lineHeight: 22 }}>{w.bio}</Body>
          </Card>
        ) : null}

        <SectionTitle>Rates</SectionTitle>
        <Card>
          {w.rates.map((r) => (
            <Row key={`${r.trade}-${r.rateType}`} style={{ justifyContent: "space-between", paddingVertical: 3 }}>
              <Body>{TRADE_LABELS[r.trade]}</Body>
              <Body style={{ fontWeight: "700" }}>
                {formatINR(r.amountPaise)}
                {RATE_SUFFIX[r.rateType]}
                {r.minUnits > 1 ? <Muted> (min {r.minUnits})</Muted> : null}
              </Body>
            </Row>
          ))}
        </Card>

        {w.availability.length > 0 ? (
          <>
            <SectionTitle>Working hours</SectionTitle>
            <Card>
              {w.availability.map((a, i) => (
                <Row key={i} style={{ justifyContent: "space-between", paddingVertical: 2 }}>
                  <Body>{DAYS[a.dayOfWeek]}</Body>
                  <Muted>{formatRange({ startMinute: a.startMinute, endMinute: a.endMinute })}</Muted>
                </Row>
              ))}
            </Card>
          </>
        ) : null}

        {w.reviews.length > 0 ? (
          <>
            <SectionTitle>Reviews</SectionTitle>
            {w.reviews.map((r) => (
              <Card key={r.id}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Body style={{ fontWeight: "600" }}>{r.authorName}</Body>
                  <Body style={{ color: colors.brand600 }}>{"★".repeat(r.rating)}</Body>
                </Row>
                {r.title ? <Body style={{ fontWeight: "600", marginTop: space.xs }}>{r.title}</Body> : null}
                {r.body ? <Muted style={{ marginTop: 2 }}>{r.body}</Muted> : null}
              </Card>
            ))}
          </>
        ) : null}
      </Screen>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.white, padding: space.lg, paddingBottom: space.md }}>
        <Button
          title="Book this worker"
          onPress={() => router.push({ pathname: "/worker/[id]/book", params: { id: w.id } })}
          disabled={w.rates.length === 0}
        />
      </SafeAreaView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Body style={{ fontWeight: "700" }}>{value}</Body>
      <Muted>{label}</Muted>
    </View>
  );
}
