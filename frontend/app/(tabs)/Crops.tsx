import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

interface CropPrediction {
  crop: string;
  probability: number;
  suitability_score: number;
  rank: number;
}

interface CropPredictionResponse {
  predictions: CropPrediction[];
  input_features: {
    N: number;
    P: number;
    K: number;
    temperature: number;
    humidity: number;
    ph: number;
    rainfall: number;
  };
  model_info: {
    model_type: string;
    accuracy: string;
    total_crops: string;
  };
  timestamp: string;
}

// ============================================================================
// Component
// ============================================================================

const Crops: React.FC = () => {
  const [nitrogen, setNitrogen] = useState("90");
  const [phosphorous, setPhosphorous] = useState("42");
  const [potassium, setPotassium] = useState("43");
  const [temperature, setTemperature] = useState("25");
  const [humidity, setHumidity] = useState("75");
  const [ph, setPh] = useState("6.5");
  const [rainfall, setRainfall] = useState("150");

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationName, setLocationName] = useState("");

  // UI state
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<CropPrediction[]>([]);
  const [modelInfo, setModelInfo] = useState<any>(null);

  // API configuration
  const API_BASE_URL = "http://172.20.10.2:8000"; // Replace with your actual API URL
  const AGRO_API_KEY = ""; // Replace with actual key

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please enable location access to use live weather data."
        );
        return;
      }

      setLoading(true);
      const userLocation = await Location.getCurrentPositionAsync({});

      setLocation({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      });

      // Reverse geocode to get location name
      const address = await Location.reverseGeocodeAsync({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      });

      if (address.length > 0) {
        const place = address[0];
        setLocationName(
          `${place.city || place.region || "Unknown"}, ${place.country || ""}`
        );
      }

      setLoading(false);
    } catch (error) {
      setLoading(false);
      Alert.alert("Error", "Failed to get your location. Please try again.");
      console.error(error);
    }
  };

  const getManualRecommendations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/crop/predict?top_n=5`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          N: parseFloat(nitrogen),
          P: parseFloat(phosphorous),
          K: parseFloat(potassium),
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          ph: parseFloat(ph),
          rainfall: parseFloat(rainfall),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get recommendations");
      }

      const data: CropPredictionResponse = await response.json();
      setPredictions(data.predictions);
      setModelInfo(data.model_info);
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to get crop recommendations. Please check your inputs."
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getLiveRecommendations = async () => {
    if (!location) {
      Alert.alert("Location Required", "Please enable location access first.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/crop/live-predict?top_n=5`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latitude: location.latitude,
            longitude: location.longitude,
            api_key: AGRO_API_KEY,
            N: parseFloat(nitrogen),
            P: parseFloat(phosphorous),
            K: parseFloat(potassium),
            ph: parseFloat(ph),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get live recommendations");
      }

      const data: CropPredictionResponse = await response.json();
      setPredictions(data.predictions);
      setModelInfo(data.model_info);

      // Update manual inputs with live weather data
      setTemperature(data.input_features.temperature.toString());
      setHumidity(data.input_features.humidity.toString());
      setRainfall(data.input_features.rainfall.toString());
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to get live recommendations. Please check your API key."
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (probability: number): string => {
    if (probability > 0.7) return "#10b981"; // Green
    if (probability > 0.4) return "#f59e0b"; // Orange
    return "#ef4444"; // Red
  };

  const getConfidenceText = (probability: number): string => {
    if (probability > 0.7) return "High";
    if (probability > 0.4) return "Medium";
    return "Low";
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="leaf" size={32} color="#10b981" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Crop Recommendation System</Text>
          <Text style={styles.headerSubtitle}>
            Get AI-powered crop recommendations based on your location, season,
            and soil type
          </Text>
        </View>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, !isLiveMode && styles.modeButtonActive]}
          onPress={() => setIsLiveMode(false)}
        >
          <Ionicons
            name="create-outline"
            size={20}
            color={!isLiveMode ? "#10b981" : "#6b7280"}
          />
          <Text
            style={[
              styles.modeButtonText,
              !isLiveMode && styles.modeButtonTextActive,
            ]}
          >
            Manual Input
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, isLiveMode && styles.modeButtonActive]}
          onPress={() => {
            setIsLiveMode(true);
            if (!location) {
              getUserLocation();
            }
          }}
        >
          <Ionicons
            name="location-outline"
            size={20}
            color={isLiveMode ? "#10b981" : "#6b7280"}
          />
          <Text
            style={[
              styles.modeButtonText,
              isLiveMode && styles.modeButtonTextActive,
            ]}
          >
            Live Weather
          </Text>
        </TouchableOpacity>
      </View>

      {/* Location Display (Live Mode) */}
      {isLiveMode && location && (
        <View style={styles.locationCard}>
          <Ionicons name="location" size={20} color="#10b981" />
          <Text style={styles.locationText}>
            {locationName || "Location detected"}
          </Text>
          <TouchableOpacity onPress={getUserLocation}>
            <Ionicons name="refresh" size={20} color="#10b981" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Form */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="flask-outline" size={18} color="#10b981" /> Soil
          Parameters
        </Text>

        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nitrogen (N)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={nitrogen}
                onChangeText={setNitrogen}
                keyboardType="numeric"
                placeholder="90"
                placeholderTextColor="#6b7280"
              />
              <Text style={styles.inputUnit}>kg/ha</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phosphorous (P)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={phosphorous}
                onChangeText={setPhosphorous}
                keyboardType="numeric"
                placeholder="42"
                placeholderTextColor="#6b7280"
              />
              <Text style={styles.inputUnit}>kg/ha</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Potassium (K)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={potassium}
                onChangeText={setPotassium}
                keyboardType="numeric"
                placeholder="43"
                placeholderTextColor="#6b7280"
              />
              <Text style={styles.inputUnit}>kg/ha</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>pH Level</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={ph}
                onChangeText={setPh}
                keyboardType="numeric"
                placeholder="6.5"
                placeholderTextColor="#6b7280"
              />
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          <Ionicons name="cloud-outline" size={18} color="#10b981" /> Weather
          Conditions
        </Text>

        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Temperature</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, isLiveMode && styles.inputDisabled]}
                value={temperature}
                onChangeText={setTemperature}
                keyboardType="numeric"
                placeholder="25"
                placeholderTextColor="#6b7280"
                editable={!isLiveMode}
              />
              <Text style={styles.inputUnit}>°C</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Humidity</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, isLiveMode && styles.inputDisabled]}
                value={humidity}
                onChangeText={setHumidity}
                keyboardType="numeric"
                placeholder="75"
                placeholderTextColor="#6b7280"
                editable={!isLiveMode}
              />
              <Text style={styles.inputUnit}>%</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Rainfall</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isLiveMode && styles.inputDisabled]}
              value={rainfall}
              onChangeText={setRainfall}
              keyboardType="numeric"
              placeholder="150"
              placeholderTextColor="#6b7280"
              editable={!isLiveMode}
            />
            <Text style={styles.inputUnit}>mm</Text>
          </View>
        </View>
      </View>

      {/* Get Recommendations Button */}
      <TouchableOpacity
        style={styles.recommendButton}
        onPress={isLiveMode ? getLiveRecommendations : getManualRecommendations}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="leaf" size={20} color="#fff" />
            <Text style={styles.recommendButtonText}>Get Recommendations</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Results */}
      {predictions.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsTitle}>
            🌾 Top {predictions.length} Recommended Crops
          </Text>

          {predictions.map((prediction) => (
            <View key={prediction.rank} style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <View style={styles.predictionRank}>
                  <Text style={styles.predictionRankText}>
                    #{prediction.rank}
                  </Text>
                </View>
                <View style={styles.predictionInfo}>
                  <Text style={styles.predictionCrop}>
                    {prediction.crop.toUpperCase()}
                  </Text>
                  <View style={styles.predictionMeta}>
                    <View
                      style={[
                        styles.confidenceBadge,
                        {
                          backgroundColor: getConfidenceColor(
                            prediction.probability
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.confidenceBadgeText}>
                        {getConfidenceText(prediction.probability)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.scoreContainer}>
                <Text style={styles.scoreLabel}>Suitability Score</Text>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: `${prediction.suitability_score}%`,
                        backgroundColor: getConfidenceColor(
                          prediction.probability
                        ),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.scoreValue}>
                  {prediction.suitability_score.toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}

          {/* Model Info */}
          {modelInfo && (
            <View style={styles.modelInfoCard}>
              <Text style={styles.modelInfoTitle}>📊 Model Information</Text>
              <View style={styles.modelInfoRow}>
                <Text style={styles.modelInfoLabel}>Model Type:</Text>
                <Text style={styles.modelInfoValue}>
                  {modelInfo.model_type}
                </Text>
              </View>
              <View style={styles.modelInfoRow}>
                <Text style={styles.modelInfoLabel}>Accuracy:</Text>
                <Text style={styles.modelInfoValue}>
                  {(parseFloat(modelInfo.accuracy) * 100).toFixed(2)}%
                </Text>
              </View>
              <View style={styles.modelInfoRow}>
                <Text style={styles.modelInfoLabel}>Total Crops:</Text>
                <Text style={styles.modelInfoValue}>
                  {modelInfo.total_crops}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Empty State */}
      {predictions.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={64} color="#6b7280" />
          <Text style={styles.emptyStateTitle}>
            Get Personalized Recommendations
          </Text>
          <Text style={styles.emptyStateText}>
            Enter your location, season, and soil type to receive AI-powered
            crop recommendations based on weather forecasts and soil conditions.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: "#0a0f0d",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    lineHeight: 20,
    maxWidth: 280,
  },
  modeToggle: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#1a1f1d",
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  modeButtonTextActive: {
    color: "#10b981",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    gap: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#10b981",
  },
  inputSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9ca3af",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1f1d",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3330",
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#fff",
  },
  inputDisabled: {
    color: "#6b7280",
  },
  inputUnit: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 8,
  },
  recommendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 32,
    padding: 16,
    backgroundColor: "#10b981",
    borderRadius: 12,
    gap: 8,
  },
  recommendButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  resultsSection: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  predictionCard: {
    backgroundColor: "#1a1f1d",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2d3330",
  },
  predictionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  predictionRank: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  predictionRankText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10b981",
  },
  predictionInfo: {
    flex: 1,
  },
  predictionCrop: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  predictionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  scoreContainer: {
    gap: 8,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9ca3af",
  },
  scoreBar: {
    height: 8,
    backgroundColor: "#2d3330",
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    textAlign: "right",
  },
  modelInfoCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.1)",
  },
  modelInfoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  modelInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modelInfoLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  modelInfoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10b981",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
});

export default Crops;
