import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#69B578", // active green
        tabBarStyle: {
          backgroundColor: "#181D27", // dark theme
          borderTopWidth: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Disease Detection",
          tabBarIcon: ({ color }) => (
            <Ionicons name="leaf-outline" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="AddResidue"
        options={{
          title: "Add Residuals",
          tabBarIcon: ({ color }) => (
            <Ionicons name="add-circle-outline" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="ListResidue"
        options={{
          title: "View Listings",
          tabBarIcon: ({ color }) => (
            <Ionicons name="list-outline" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="Crops"
        options={{
          title: "Crops",
          tabBarIcon: ({ color }) => (
            <Ionicons name="leaf" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="Chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubbles-outline" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
