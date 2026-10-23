import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "~/api/endpoints";
import { CartButton } from "~/components/commerce";
import { EmptyState, ErrorView, Loading } from "~/components/ui";
import { colors, font, radius, space } from "~/theme";

export default function ShopScreen() {
  const categories = useQuery({ queryKey: ["categories"], queryFn: catalogApi.categories });

  return (
    <>
      <Tabs.Screen options={{ headerRight: () => <CartButton /> }} />
      {categories.isPending ? (
        <Loading />
      ) : categories.isError ? (
        <ErrorView error={categories.error} onRetry={categories.refetch} />
      ) : (
        <FlatList
          data={categories.data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: space.lg }}
          refreshing={categories.isRefetching}
          onRefresh={categories.refetch}
          ListHeaderComponent={
            <Pressable style={styles.search} onPress={() => router.push("/search")}>
              <Ionicons name="search" size={18} color={colors.ink400} />
              <Text style={styles.searchText}>Search all materials</Text>
            </Pressable>
          }
          ListEmptyComponent={<EmptyState title="No categories yet" />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.category, pressed && { opacity: 0.9 }]}
              onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: item.slug, name: item.name } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.count}>{item._count.products} products</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.ink300} />
            </Pressable>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: space.md,
    marginBottom: space.lg,
  },
  searchText: { color: colors.ink400, fontSize: font.md },
  category: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: space.lg,
    marginBottom: space.md,
  },
  name: { fontSize: font.md, fontWeight: "700", color: colors.ink900 },
  count: { fontSize: font.sm, color: colors.ink500, marginTop: 2 },
});
