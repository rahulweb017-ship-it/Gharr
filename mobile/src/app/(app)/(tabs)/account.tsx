import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { formatPhone } from "@/shared/phone";
import { authApi } from "~/api/auth";
import { useAuth } from "~/auth/AuthProvider";
import { Button, Card, Muted, Screen, type IconName } from "~/components/ui";
import { colors, font, space } from "~/theme";

const LINKS: { label: string; icon: IconName; href: Href }[] = [
  { label: "My orders", icon: "receipt-outline", href: "/orders" },
  { label: "My bookings", icon: "calendar-outline", href: "/bookings" },
  { label: "Saved estimates", icon: "calculator-outline", href: "/estimate" },
  { label: "Addresses", icon: "location-outline", href: "/account/addresses" },
  { label: "Edit profile", icon: "person-circle-outline", href: "/account/profile" },
];

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const me = useQuery({ queryKey: ["me"], queryFn: authApi.me, initialData: user ?? undefined });
  const profile = me.data;

  function confirmSignOut() {
    Alert.alert("Sign out?", "You'll need an OTP to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen>
      <Card style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.name ?? "H").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile?.name ?? "Gharr customer"}</Text>
          <Muted>{profile ? formatPhone(profile.phone) : " "}</Muted>
          {profile ? (
            <Muted style={{ marginTop: 2 }}>
              {profile.orderCount} orders · {profile.bookingCount} bookings
            </Muted>
          ) : null}
        </View>
      </Card>

      <Card style={{ padding: 0 }}>
        {LINKS.map((link, index) => (
          <Pressable
            key={link.label}
            onPress={() => router.push(link.href)}
            style={({ pressed }) => [styles.link, index > 0 && styles.linkBorder, pressed && { backgroundColor: colors.ink50 }]}
          >
            <Ionicons name={link.icon} size={22} color={colors.ink700} />
            <Text style={styles.linkText}>{link.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
          </Pressable>
        ))}
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} style={{ marginTop: space.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ink900,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: font.xl, fontWeight: "700" },
  name: { fontSize: font.lg, fontWeight: "700", color: colors.ink900 },
  link: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  linkBorder: { borderTopWidth: 1, borderTopColor: colors.ink100 },
  linkText: { flex: 1, fontSize: font.md, color: colors.ink900 },
});
