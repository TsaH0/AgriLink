import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      {/* This points to (tabs)/_layout */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* keep modals or extras here if needed */}
    </Stack>
  );
}
