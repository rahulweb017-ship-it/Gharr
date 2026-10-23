import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { IconName } from "~/components/ui";
import { colors } from "~/theme";

/** Mirrors the web app's mobile bottom bar (src/components/layout/BottomNav.tsx). */
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: "index", title: "Home", icon: "home-outline", iconActive: "home" },
  { name: "estimate", title: "Estimate", icon: "calculator-outline", iconActive: "calculator" },
  { name: "shop", title: "Shop", icon: "storefront-outline", iconActive: "storefront" },
  { name: "labour", title: "Labour", icon: "construct-outline", iconActive: "construct" },
  { name: "account", title: "Profile", icon: "person-outline", iconActive: "person" },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.ink400,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.ink100 },
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.ink900,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            headerShown: tab.name !== "index",
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
