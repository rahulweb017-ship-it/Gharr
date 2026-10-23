import { Image, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "~/theme";

export function WorkerAvatar({ uri, size }: { uri: string | null; size: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.ink100,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="person" size={size / 2} color={colors.ink400} />
    </View>
  );
}
