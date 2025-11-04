import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

const API_URL = "http://172.20.10.2:8000"; // your FastAPI backend IP

const CropDetectScreen: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Denied", "Please allow access to gallery.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: false,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setSelectedImage(result.assets[0].uri);
      setPrediction(null);
    }
  };

  const predictDisease = async () => {
    if (!selectedImage) {
      Alert.alert("No Image", "Please select an image first.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", {
        uri: selectedImage,
        name: "crop.jpg",
        type: "image/jpeg",
      } as any);

      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Server error: ${response.status} ${text}`);
      }

      const data = await response.json();
      if (data?.prediction?.disease) {
        const disease = data.prediction.disease;
        const conf = data.prediction.confidence;
        setPrediction(`${disease} (${(conf * 100).toFixed(2)}%)`);
        if (data?.recommendations?.dynamic) {
          setAiOutput(data.recommendations.dynamic);
        } else if (data?.recommendations?.static?.description) {
          setAiOutput(data.recommendations.static.description);
        } else {
          setAiOutput(null);
        }
      } else {
        setPrediction(JSON.stringify(data));
        setAiOutput(null);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to connect to backend.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.appTitle}>🌾 AgriLink 1.0.0</Text>
      <Text style={styles.subtitle}>Smart Crop Health Detection</Text>

      {selectedImage ? (
        <Image source={{ uri: selectedImage }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No image selected</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>Select Image</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonAccent} onPress={predictDisease}>
          <Text style={styles.buttonText}>Predict Disease</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <ActivityIndicator size="large" color="#D0DB97" />
        </View>
      )}

      {prediction && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌱 Prediction Result</Text>
          <Text style={styles.cardText}>{prediction}</Text>
          {aiOutput && (
            <View style={styles.recommendationBox}>
              <Text style={styles.recommendationTitle}>
                AI Recommended Action
              </Text>
              <Text style={styles.recommendationText}>{aiOutput}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default CropDetectScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#181D27", // Dark background
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#D0DB97", // Lightest green
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#69B578", // Leaf green
    marginBottom: 25,
  },
  image: {
    width: 260,
    height: 260,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: "#3A7D44", // Medium green
  },
  placeholder: {
    width: 260,
    height: 260,
    borderRadius: 15,
    backgroundColor: "#254D32", // Forest green
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  placeholderText: {
    color: "#D0DB97",
    fontWeight: "500",
  },
  buttonContainer: {
    width: "90%",
    alignItems: "center",
    gap: 12,
  },
  button: {
    backgroundColor: "#69B578", // Fresh leaf
    paddingVertical: 12,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonAccent: {
    backgroundColor: "#254D32", // Deep forest
    paddingVertical: 12,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#3A7D44",
    padding: 20,
    borderRadius: 15,
    marginTop: 30,
    width: "95%",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#D0DB97",
    marginBottom: 10,
  },
  cardText: {
    fontSize: 17,
    color: "#FFFFFF",
    marginBottom: 15,
  },
  recommendationBox: {
    backgroundColor: "#254D32",
    padding: 12,
    borderRadius: 10,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D0DB97",
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
});
