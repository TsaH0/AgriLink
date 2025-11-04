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
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Markdown from "react-native-markdown-display";

const API_URL = "http://172.20.10.2:8000";

// Language options
const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "hi", name: "हिंदी", flag: "🇮🇳" },
  { code: "te", name: "తెలుగు", flag: "🇮🇳" },
  { code: "ta", name: "தமிழ்", flag: "🇮🇳" },
  { code: "mr", name: "मराठी", flag: "🇮🇳" },
  { code: "bn", name: "বাংলা", flag: "🇮🇳" },
];

const CropDetectScreen: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const pickImageFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Denied", "Please allow access to gallery.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setSelectedImage(result.assets[0].uri);
      setPrediction(null);
      setAiOutput(null);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Denied", "Please allow access to camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setSelectedImage(result.assets[0].uri);
      setPrediction(null);
      setAiOutput(null);
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      "Select Image",
      "Choose an option",
      [
        {
          text: "Take Photo",
          onPress: takePhoto,
        },
        {
          text: "Choose from Gallery",
          onPress: pickImageFromGallery,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true }
    );
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

      // Add language to the request
      formData.append("language", selectedLanguage);

      const response = await fetch(
        `${API_URL}/predict?language=${selectedLanguage}`,
        {
          method: "POST",
          body: formData,
        }
      );

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

  const getLanguageName = () => {
    const lang = LANGUAGES.find((l) => l.code === selectedLanguage);
    return lang ? `${lang.flag} ${lang.name}` : "🇬🇧 English";
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Image
              source={require("../../assets/logo.png")} // Convert SVG to PNG
              style={styles.logo}
            />{" "}
          </View>
          <View>
            <Text style={styles.headerTitle}>AgriLink</Text>
            <Text style={styles.headerSubtitle}>Smart Crop Health Manager</Text>
          </View>
        </View>

        {/* Language Selector */}
        <TouchableOpacity
          style={styles.languageButton}
          onPress={() => setShowLanguageMenu(!showLanguageMenu)}
        >
          <Ionicons name="language" size={20} color="#22c55e" />
          <Text style={styles.languageText}>{getLanguageName()}</Text>
          <Ionicons
            name={showLanguageMenu ? "chevron-up" : "chevron-down"}
            size={16}
            color="#9ca3af"
          />
        </TouchableOpacity>
      </View>

      {/* Language Dropdown */}
      {showLanguageMenu && (
        <View style={styles.languageMenu}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                selectedLanguage === lang.code && styles.languageOptionActive,
              ]}
              onPress={() => {
                setSelectedLanguage(lang.code);
                setShowLanguageMenu(false);
              }}
            >
              <Text style={styles.languageOptionText}>
                {lang.flag} {lang.name}
              </Text>
              {selectedLanguage === lang.code && (
                <Ionicons name="checkmark" size={20} color="#22c55e" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Upload Section */}
        <View style={styles.uploadSection}>
          <View style={styles.uploadHeader}>
            <Ionicons name="cloud-upload-outline" size={24} color="#22c55e" />
            <Text style={styles.uploadTitle}>Upload Plant Image</Text>
          </View>
          <Text style={styles.uploadSubtitle}>
            Upload an image of the plant leaf to detect diseases
          </Text>

          {/* Image Display */}
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={showImagePickerOptions}
            activeOpacity={0.8}
          >
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.image} />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="cloud-upload" size={64} color="#6b7280" />
                <Text style={styles.placeholderText}>No image selected</Text>
                <Text style={styles.placeholderSubtext}>
                  Tap to upload or take a photo
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Action Buttons */}
          {selectedImage && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={showImagePickerOptions}
              >
                <Ionicons name="images-outline" size={20} color="#22c55e" />
                <Text style={styles.secondaryButtonText}>Change Image</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={predictDisease}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0a0f0d" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="analytics-outline"
                      size={20}
                      color="#0a0f0d"
                    />
                    <Text style={styles.primaryButtonText}>
                      Analyze Disease
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Results Section */}
        {prediction && (
          <View style={styles.resultsSection}>
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <Text style={styles.resultTitle}>Detection Result</Text>
              </View>
              <Text style={styles.resultText}>{prediction}</Text>
            </View>

            {aiOutput && (
              <View style={styles.recommendationCard}>
                <View style={styles.recommendationHeader}>
                  <Ionicons name="bulb-outline" size={24} color="#22c55e" />
                  <Text style={styles.recommendationTitle}>
                    AI Recommendations
                  </Text>
                </View>
                <Markdown style={markdownStyles}>{aiOutput}</Markdown>
              </View>
            )}
          </View>
        )}

        {/* Empty State */}
        {!selectedImage && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={80} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>Start Disease Detection</Text>
            <Text style={styles.emptyStateText}>
              Upload a clear image of your plant's leaf to get instant
              AI-powered disease detection and treatment recommendations.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CropDetectScreen;

const styles = StyleSheet.create({
  logo: { width: 60, height: 60, resizeMode: "contain" },
  container: {
    flex: 1,
    backgroundColor: "#0a0f0d",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 30, // ← INCREASE THIS FOR MORE HEADER SPACE
    borderBottomWidth: 1,
    borderBottomColor: "#2d3330",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0a0f0d",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1a1f1d",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3330",
  },
  languageText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  languageMenu: {
    backgroundColor: "#1a1f1d",
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2d3330",
    overflow: "hidden",
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2d3330",
  },
  languageOptionActive: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  languageOptionText: {
    fontSize: 15,
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 40, // ← INCREASE THIS SIGNIFICANTLY
    paddingBottom: 40,
  },
  uploadSection: {
    padding: 10,
    marginTop: 0, // ← ADD THIS FOR EXTRA SPACE
  },
  uploadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  uploadSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 24,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1f1d",
    borderWidth: 2,
    borderColor: "#2d3330",
    borderStyle: "dashed",
    marginBottom: 20,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9ca3af",
  },
  placeholderSubtext: {
    fontSize: 13,
    color: "#6b7280",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0f0d",
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#22c55e",
  },
  resultsSection: {
    paddingHorizontal: 20,
    gap: 16,
  },
  resultCard: {
    backgroundColor: "#1a1f1d",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2d3330",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  resultText: {
    fontSize: 16,
    color: "#22c55e",
    fontWeight: "600",
  },
  recommendationCard: {
    backgroundColor: "#1a1f1d",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2d3330",
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
    marginTop: 40, // ← ADD THIS FOR EMPTY STATE SPACING
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    color: "#f0fdf4",
    fontSize: 14,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 12,
  },
  strong: {
    color: "#22c55e",
    fontWeight: "700",
  },
  heading1: {
    color: "#22c55e",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  heading2: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  bullet_list: {
    marginBottom: 12,
  },
  bullet_list_icon: {
    color: "#22c55e",
    fontSize: 14,
  },
  link: {
    color: "#22c55e",
    textDecorationLine: "underline",
  },
});
