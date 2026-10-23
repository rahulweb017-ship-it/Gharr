import { useEffect, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "~/api/endpoints";
import { ProductRow } from "~/components/commerce";
import { EmptyState, ErrorView, Loading, styles as ui } from "~/components/ui";
import { colors, space } from "~/theme";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function SearchScreen() {
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 300);
  // The API returns [] under 2 characters, so don't ask.
  const results = useQuery({ queryKey: ["search", q], queryFn: () => catalogApi.search(q), enabled: q.length >= 2 });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm }}>
        <View style={[ui.inputBox, ui.inputFocused, { borderColor: colors.brand500, gap: space.sm }]}>
          <Ionicons name="search" size={20} color={colors.ink400} />
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="Search cement, tiles, pipes…"
            placeholderTextColor={colors.ink300}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search materials"
            style={ui.inputText}
          />
          {text ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setText("")} hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={colors.ink300} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {q.length < 2 ? (
        <EmptyState icon="search-outline" title="What are you building?" message="Type at least 2 letters to search the catalogue." />
      ) : results.isPending ? (
        <Loading />
      ) : results.isError ? (
        <ErrorView error={results.error} onRetry={results.refetch} />
      ) : (
        <FlatList
          data={results.data}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
          renderItem={({ item }) => <ProductRow product={item} />}
          ListEmptyComponent={<EmptyState icon="search-outline" title={`No results for “${q}”`} />}
        />
      )}
    </View>
  );
}
