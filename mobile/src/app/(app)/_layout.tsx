import { Stack } from "expo-router";
import { colors } from "~/theme";

/** Signed-in navigator: the tab bar plus every detail screen pushed over it. */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.ink900,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="cart" options={{ title: "Cart" }} />
      <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
      <Stack.Screen name="search" options={{ title: "Search" }} />
      <Stack.Screen name="orders/index" options={{ title: "My orders" }} />
      <Stack.Screen name="orders/[id]" options={{ title: "Order" }} />
      <Stack.Screen name="bookings/index" options={{ title: "My bookings" }} />
      <Stack.Screen name="bookings/[id]" options={{ title: "Booking" }} />
      <Stack.Screen name="account/profile" options={{ title: "Profile" }} />
      <Stack.Screen name="account/addresses/index" options={{ title: "Addresses" }} />
      <Stack.Screen name="account/addresses/[id]" options={{ title: "Address" }} />
      <Stack.Screen name="estimate/new" options={{ title: "New estimate" }} />
      <Stack.Screen name="estimate/[id]/index" options={{ title: "Estimate" }} />
      <Stack.Screen name="estimate/[id]/edit" options={{ title: "Edit estimate" }} />
      <Stack.Screen name="estimate/[id]/boq" options={{ title: "Bill of quantities" }} />
    </Stack>
  );
}
