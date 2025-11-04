import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../utils/api";

export default function AddResidue() {
  const [type, setType] = useState("");
  const [weight, setWeight] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = async () => {
    if (!type || !weight || !price || !location) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      await api.post("/residuals", {
        title: `${type} - ${weight}kg`,
        description: `Available ${type} weighing ${weight}kg at ₹${price}/kg`,
        quantity: Number(weight),
        unit: "kg",
        price: Number(price),
        location,
        userId: "user-123", // ✅ Replace with actual logged-in user later
        category: type.toLowerCase().replace(/\s+/g, "_"),
      });

      Alert.alert("Success", "Residual listing added successfully!");
      setType("");
      setWeight("");
      setPrice("");
      setLocation("");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to add residual");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <Text style={styles.title}>➕ Add Agricultural Residual</Text>

          <TextInput
            placeholder="Type (e.g., Rice Husk)"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={type}
            onChangeText={setType}
          />
          <TextInput
            placeholder="Weight (kg)"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
          />
          <TextInput
            placeholder="Price per kg (₹)"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
          <TextInput
            placeholder="Location"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={location}
            onChangeText={setLocation}
          />

          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Ionicons name="save-outline" color="#0a0f0a" size={18} />
            <Text style={styles.buttonText}>Save Residual</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    backgroundColor: "#0a0f0a",
    padding: 20,
  },
  formContainer: {
    width: "100%",
  },
  title: {
    color: "#22c55e",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "rgba(20, 40, 20, 0.5)",
    color: "#f0fdf4",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  buttonText: {
    color: "#0a0f0a",
    fontWeight: "700",
  },
});
