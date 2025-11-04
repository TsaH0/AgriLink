import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../utils/api";

type ResidualItem = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  location: string;
  category: string;
  userId: string;
  status: string;
  createdAt: string;
};

export default function ListResidue() {
  const [residuals, setResiduals] = useState<ResidualItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchResiduals = async () => {
    try {
      console.log("Fetching residuals...");
      const response = await api.get("/residuals");

      if (response.data && Array.isArray(response.data.residuals)) {
        setResiduals(response.data.residuals);
      } else if (Array.isArray(response.data)) {
        setResiduals(response.data);
      } else {
        console.error("Unexpected response format:", response.data);
        setResiduals([]);
      }
    } catch (error: any) {
      console.error("Error fetching residuals:", error);
      Alert.alert(
        "Error",
        "Failed to fetch residuals. Please check your connection."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchResiduals();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchResiduals();
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Listing", "Are you sure you want to delete this?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/residuals/${id}`);
            setResiduals((prev) => prev.filter((item) => item.id !== id));
            Alert.alert("Success", "Listing deleted successfully");
          } catch (error) {
            console.error("Error deleting residual:", error);
            Alert.alert("Error", "Failed to delete listing");
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>🌾 Your Residual Listings</Text>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading residuals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🌾 Your Residual Listings</Text>
      <Text style={styles.subtitle}>
        Manage and track your agricultural waste
      </Text>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          residuals.length === 0 && styles.centerContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#22c55e"
            colors={["#22c55e"]}
          />
        }
      >
        {residuals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={64} color="#374151" />
            <Text style={styles.empty}>No listings found.</Text>
            <Text style={styles.emptySubtext}>
              Pull down to refresh or add a new listing
            </Text>
          </View>
        ) : (
          residuals.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.type}>{item.title}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>

              {item.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Ionicons name="scale-outline" size={16} color="#10b981" />
                  <Text style={styles.detail}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={16} color="#10b981" />
                  <Text style={styles.detail}>₹{item.price}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color="#10b981" />
                  <Text style={styles.detail}>{item.location}</Text>
                </View>
              </View>

              <Text style={styles.date}>
                Added on {formatDate(item.createdAt)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          Alert.alert("Add Listing", "Navigate to Add Residual screen")
        }
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f0a",
    padding: 20,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#22c55e",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#10b981",
    marginBottom: 20,
    textAlign: "center",
  },
  scroll: {
    paddingBottom: 80,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#9ca3af",
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  empty: {
    color: "#9ca3af",
    textAlign: "center",
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    color: "#6b7280",
    textAlign: "center",
    fontSize: 14,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#0f1f0f",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.15)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  type: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  statusBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  description: {
    color: "#d1d5db",
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  detailsContainer: {
    gap: 6,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detail: {
    color: "#f0fdf4",
    fontSize: 14,
  },
  date: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
