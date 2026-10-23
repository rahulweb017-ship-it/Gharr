import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "~/api/endpoints";
import { useLightStatusBar } from "~/lib/status-bar";
import { useAuth } from "~/auth/AuthProvider";
import { CartButton } from "~/components/commerce";
import { Screen, SectionTitle, type IconName } from "~/components/ui";
import { colors, font, radius, space } from "~/theme";

const ACTIONS: { title: string; subtitle: string; icon: IconName; href: Href }[] = [
  { title: "Buy materials", subtitle: "Cement, steel, tiles, paint", icon: "storefront", href: "/shop" },
  { title: "Hire labour", subtitle: "Masons, plumbers, electricians", icon: "construct", href: "/labour" },
  { title: "Estimate cost", subtitle: "Build or renovate, with a BOQ", icon: "calculator", href: "/estimate" },
];

export default function HomeScreen() {
  useLightStatusBar();
  const { user } = useAuth();
  const categories = useQuery({ queryKey: ["categories"], queryFn: catalogApi.categories });
  const firstName = user?.name?.split(" ")[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink900 }} edges={["top"]}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.brand}>Gharr</Text>
            <Text style={styles.greeting}>{firstName ? `Namaste, ${firstName}` : "Namaste"}</Text>
          </View>
          <View style={styles.cartWrap}>
            <CartButton />
          </View>
        </View>
        <Pressable style={styles.search} onPress={() => router.push("/search")}>
          <Ionicons name="search" size={18} color={colors.ink400} />
          <Text style={styles.searchText}>Search cement, tiles, pipes…</Text>
        </Pressable>
      </View>

      <Screen style={{ paddingTop: space.lg }}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.title}
            onPress={() => router.push(action.href)}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.actionIcon}>
              <Ionicons name={action.icon} size={24} color={colors.brand600} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.ink300} />
          </Pressable>
        ))}

        {categories.data?.length ? (
          <>
            <SectionTitle style={{ marginTop: space.lg }}>Shop by category</SectionTitle>
            <View style={styles.grid}>
              {categories.data.map((category) => (
                <Pressable
                  key={category.id}
                  style={styles.category}
                  onPress={() =>
                    router.push({ pathname: "/category/[slug]", params: { slug: category.slug, name: category.name } })
                  }
                >
                  <Text style={styles.categoryName} numberOfLines={2}>
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.ink900, padding: space.lg, paddingBottom: space.xl },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { color: colors.white, fontSize: font.xxl, fontWeight: "800" },
  greeting: { color: colors.ink200, fontSize: font.md, marginTop: 2 },
  cartWrap: { backgroundColor: colors.white, borderRadius: radius.pill, padding: space.sm },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.lg,
  },
  searchText: { color: colors.ink400, fontSize: font.md },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: space.lg,
    marginBottom: space.md,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontSize: font.md, fontWeight: "700", color: colors.ink900 },
  actionSubtitle: { fontSize: font.sm, color: colors.ink500, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  category: {
    width: "47%",
    flexGrow: 1,
    minHeight: 64,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: space.md,
    justifyContent: "center",
  },
  categoryName: { fontSize: font.sm, fontWeight: "600", color: colors.ink900 },
});
