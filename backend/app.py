from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import io
import json
import os
import logging
from dotenv import load_dotenv
import asyncio
import google.generativeai as genai
from datetime import datetime
import pickle
import numpy as np
import pandas as pd
import requests

# ============================================================
# 🧩 Setup
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Integrated Agriculture API", version="3.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 🗄️ DATABASE SETUP (Prisma + Neon PostgreSQL)
# ============================================================
from prisma import Prisma

# Global Prisma instance
db = Prisma()

# ============================================================
# 📋 Pydantic Models for API
# ============================================================

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    userType: str  # "farmer" or "business"

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Rajesh Kumar",
                "email": "rajesh@example.com",
                "userType": "farmer"
            }
        }

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    userType: str
    createdAt: datetime

class ChatCreate(BaseModel):
    user1_id: str
    user2_id: str

    class Config:
        json_schema_extra = {
            "example": {
                "user1_id": "clxxx123456789",
                "user2_id": "clxxx987654321"
            }
        }

class ChatResponse(BaseModel):
    id: str
    participants: List[UserResponse]
    createdAt: datetime
    lastMessage: Optional[str] = None

class MessageCreate(BaseModel):
    chatId: str
    senderId: str
    content: str

    class Config:
        json_schema_extra = {
            "example": {
                "chatId": "clxxx123456789",
                "senderId": "clxxx987654321",
                "content": "Hello, I need help with my wheat crop"
            }
        }

class MessageResponse(BaseModel):
    id: str
    content: str
    senderId: str
    chatId: str
    createdAt: datetime

# ============================================================
# 🌾 NEW: CROP RECOMMENDATION MODELS
# ============================================================

class CropInput(BaseModel):
    """Input features for crop prediction"""
    N: float = Field(..., description="Nitrogen content (kg/ha)", ge=0, le=200)
    P: float = Field(..., description="Phosphorous content (kg/ha)", ge=0, le=200)
    K: float = Field(..., description="Potassium content (kg/ha)", ge=0, le=300)
    temperature: float = Field(..., description="Temperature (°C)", ge=-10, le=60)
    humidity: float = Field(..., description="Relative humidity (%)", ge=0, le=100)
    ph: float = Field(..., description="Soil pH value", ge=0, le=14)
    rainfall: float = Field(..., description="Rainfall (mm)", ge=0, le=500)
    
    class Config:
        json_schema_extra = {
            "example": {
                "N": 90,
                "P": 42,
                "K": 43,
                "temperature": 20.87,
                "humidity": 82.0,
                "ph": 6.5,
                "rainfall": 202.93
            }
        }

# ============================================================
# 🌐 LANGUAGE PROMPTS CONFIGURATION (FIXED)
# ============================================================
LANGUAGE_PROMPTS = {
    "en": {
        "name": "English",
        "healthy_prompt": """You are an expert agricultural advisor for Indian farmers. 
The crop looks healthy or not clearly affected by any disease (prediction confidence: {confidence}%). 
Give short and clear advice in simple English on how to keep the crop healthy. 
Add 2-3 short tips for regular care, watering, and pest prevention. 
Keep all points under 2 lines, with more spacing and fewer words.""",
        "disease_prompt": """You are an expert agricultural advisor for Indian farmers. 
The crop is likely affected by **{disease}** (confidence: {confidence}%). 
Give short and clear advice in simple English. 
Cover only: treatment, prevention, and one organic option. 
Keep each point under 2 lines, easy to read, with more spacing and fewer words. 
Add 1 useful product link if relevant. 
Avoid heavy text or fancy symbols, just simple and to-the-point guidance."""
    },
    "hi": {
        "name": "Hindi (हिंदी)",
        "healthy_prompt": """आप भारतीय किसानों के लिए एक विशेषज्ञ कृषि सलाहकार हैं। 
फसल स्वस्थ दिखती है या किसी बीमारी से स्पष्ट रूप से प्रभावित नहीं है (पूर्वानुमान विश्वास: {confidence}%)। 
फसल को स्वस्थ रखने के लिए सरल हिंदी में छोटी और स्पष्ट सलाह दें। 
नियमित देखभाल, पानी और कीट रोकथाम के लिए 2-3 छोटे सुझाव जोड़ें। 
सभी बिंदुओं को 2 पंक्तियों के अंदर रखें, अधिक स्थान और कम शब्दों के साथ।""",
        "disease_prompt": """आप भारतीय किसानों के लिए एक विशेषज्ञ कृषि सलाहकार हैं। 
फसल संभवतः **{disease}** से प्रभावित है (विश्वास: {confidence}%)। 
सरल हिंदी में छोटी और स्पष्ट सलाह दें। 
केवल कवर करें: उपचार, रोकथाम, और एक जैविक विकल्प। 
प्रत्येक बिंदु को 2 पंक्तियों के अंदर रखें, पढ़ने में आसान, अधिक स्थान और कम शब्दों के साथ। 
यदि प्रासंगिक हो तो 1 उपयोगी उत्पाद लिंक जोड़ें। 
भारी पाठ या फैंसी प्रतीकों से बचें, बस सरल और सटीक मार्गदर्शन।"""
    },
    "te": {
        "name": "Telugu (తెలుగు)",
        "healthy_prompt": """మీరు భారతీయ రైతులకు నిపుణుడైన వ్యవసాయ సలహాదారు. 
పంట ఆరోగ్యంగా కనిపిస్తోంది లేదా ఏ వ్యాధి ద్వారా స్పష్టంగా ప్రభావితం కాలేదు (అంచనా విశ్వాసం: {confidence}%). 
పంటను ఆరోగ్యంగా ఉంచడానికి సరళమైన తెలుగులో చిన్న మరియు స్పష్టమైన సలహా ఇవ్వండి. 
రోజువారీ సంరక్షణ, నీరు మరియు పురుగుల నివారణ కోసం 2-3 చిన్న చిట్కాలు జోడించండి. 
అన్ని పాయింట్లను 2 లైన్లలోపు ఉంచండి, ఎక్కువ ఖాళీ మరియు తక్కువ పదాలతో.""",
        "disease_prompt": """మీరు భారతీయ రైతులకు నిపుణుడైన వ్యవసాయ సలహాదారు. 
పంట **{disease}** ద్వారా ప్రభావితమై ఉండవచ్చు (విశ్వాసం: {confidence}%). 
సరళమైన తెలుగులో చిన్న మరియు స్పష్టమైన సలహా ఇవ్వండి. 
మాత్రమే కవర్ చేయండి: చికిత్స, నివారణ, మరియు ఒక సేంద్రీయ ఎంపిక. 
ప్రతి పాయింట్ను 2 లైన్లలోపు ఉంచండి, చదవడానికి సులభం, ఎక్కువ ఖాళీ మరియు తక్కువ పదాలతో. 
సంబంధితంగా ఉంటే 1 ఉపయోగకరమైన ఉత్పత్తి లింక్ జోడించండి. 
భారీ వచనం లేదా ఫాన్సీ చిహ్నాలను నివారించండి, కేవలం సరళమైన మరియు పాయింట్-టు-ది-పాయింట్ మార్గదర్శకత్వం."""
    },
    "ta": {
        "name": "Tamil (தமிழ்)",
        "healthy_prompt": """நீங்கள் இந்திய விவசாயிகளுக்கான நிபுணர் விவசாய ஆலோசகர். 
பயிர் ஆரோக்கியமாக தெரிகிறது அல்லது எந்த நோயினாலும் தெளிவாக பாதிக்கப்படவில்லை (கணிப்பு நம்பிக்கை: {confidence}%). 
பயிரை ஆரோக்கியமாக வைத்திருக்க எளிய தமிழில் குறுகிய மற்றும் தெளிவான ஆலோசனை கொடுங்கள். 
வழக்கமான பராமரிப்பு, தண்ணீர் மற்றும் பூச்சி தடுப்புக்காக 2-3 குறுகிய குறிப்புகளை சேர்க்கவும். 
அனைத்து புள்ளிகளையும் 2 வரிகளுக்குள் வைக்கவும், அதிக இடைவெளி மற்றும் குறைவான வார்த்தைகளுடன்.""",
        "disease_prompt": """நீங்கள் இந்திய விவசாயிகளுக்கான நிபுணர் விவசாய ஆலோசகர். 
பயிர் **{disease}** நோயால் பாதிக்கப்பட்டிருக்கலாம் (நம்பிக்கை: {confidence}%). 
எளிய தமிழில் குறுகிய மற்றும் தெளிவான ஆலோசனை கொடுங்கள். 
மட்டும் உள்ளடக்கவும்: சிகிச்சை, தடுப்பு, மற்றும் ஒரு இயற்கை விருப்பம். 
ஒவ்வொரு புள்ளியையும் 2 வரிகளுக்குள் வைக்கவும், படிக்க எளிதானது, அதிக இடைவெளி மற்றும் குறைவான வார்த்தைகளுடன். 
தொடர்புடையதாக இருந்தால் 1 பயனுள்ள தயாரிப்பு இணைப்பை சேர்க்கவும். 
கனமான உரை அல்லது ஆடம்பரமான சின்னங்களைத் தவிர்க்கவும், வெறுமனே எளிமையான மற்றும் புள்ளிக்கு-புள்ளிக்கு வழிகாட்டுதல்."""
    },
    "mr": {
        "name": "Marathi (मराठी)",
        "healthy_prompt": """तुम्ही भारतीय शेतकऱ्यांसाठी तज्ञ कृषी सल्लागार आहात. 
पीक निरोगी दिसते किंवा कोणत्याही रोगाने स्पष्टपणे प्रभावित नाही (अंदाज विश्वास: {confidence}%). 
पीक निरोगी ठेवण्यासाठी साध्या मराठीत लहान आणि स्पष्ट सल्ला द्या. 
नियमित काळजी, पाणी आणि किडे प्रतिबंध यासाठी 2-3 लहान टिपा जोडा. 
सर्व मुद्दे 2 ओळींमध्ये ठेवा, अधिक जागा आणि कमी शब्दांसह.""",
        "disease_prompt": """तुम्ही भारतीय शेतकऱ्यांसाठी तज्ञ कृषी सल्लागार आहात. 
पीक बहुधा **{disease}** ने प्रभावित आहे (विश्वास: {confidence}%). 
साध्या मराठीत लहान आणि स्पष्ट सल्ला द्या. 
फक्त समाविष्ट करा: उपचार, प्रतिबंध, आणि एक सेंद्रिय पर्याय. 
प्रत्येक मुद्दा 2 ओळींमध्ये ठेवा, वाचण्यास सोपा, अधिक जागा आणि कमी शब्दांसह. 
संबंधित असल्यास 1 उपयुक्त उत्पादन लिंक जोडा. 
जड मजकूर किंवा फॅन्सी चिन्हे टाळा, फक्त साधा आणि बिंदू-टू-द-पॉइंट मार्गदर्शन."""
    },
    "bn": {
        "name": "Bengali (বাংলা)",
        "healthy_prompt": """আপনি ভারতীয় কৃষকদের জন্য একজন বিশেষজ্ঞ কৃষি পরামর্শদাতা। 
ফসল সুস্থ দেখাচ্ছে বা কোনো রোগ দ্বারা স্পষ্টভাবে প্রভাবিত নয় (পূর্বাভাস আস্থা: {confidence}%)। 
ফসল সুস্থ রাখার জন্য সহজ বাংলায় সংক্ষিপ্ত এবং স্পষ্ট পরামর্শ দিন। 
নিয়মিত যত্ন, জল এবং কীটপতঙ্গ প্রতিরোধের জন্য 2-3টি সংক্ষিপ্ত টিপস যোগ করুন। 
সমস্ত পয়েন্ট 2 লাইনের মধ্যে রাখুন, বেশি স্থান এবং কম শব্দের সাথে।""",
        "disease_prompt": """আপনি ভারতীয় কৃষকদের জন্য একজন বিশেষজ্ঞ কৃষি পরামর্শদাতা। 
ফসল সম্ভবত **{disease}** দ্বারা প্রভাবিত (আস্থা: {confidence}%)। 
সহজ বাংলায় সংক্ষিপ্ত এবং স্পষ্ট পরামর্শ দিন। 
শুধুমাত্র কভার করুন: চিকিৎসা, প্রতিরোধ, এবং একটি জৈব বিকল্প। 
প্রতিটি পয়েন্ট 2 লাইনের মধ্যে রাখুন, পড়তে সহজ, বেশি স্থান এবং কম শব্দের সাথে। 
প্রাসঙ্গিক হলে 1টি দরকারী পণ্য লিঙ্ক যোগ করুন। 
ভারী পাঠ্য বা অভিনব চিহ্ন এড়িয়ে চলুন, শুধু সহজ এবং পয়েন্ট-টু-দ্য-পয়েন্ট নির্দেশনা।"""
    }
}

class CropPrediction(BaseModel):
    """Single crop prediction result"""
    crop: str
    probability: float
    suitability_score: float
    rank: int


class CropPredictionResponse(BaseModel):
    """Response with multiple crop predictions"""
    predictions: List[CropPrediction]
    input_features: Dict[str, float]
    model_info: Dict[str, str]
    timestamp: str


class LivePredictInput(BaseModel):
    """Input for live prediction using AgroMonitoring API"""
    latitude: float = Field(..., description="Latitude", ge=-90, le=90)
    longitude: float = Field(..., description="Longitude", ge=-180, le=180)
    api_key: str = Field(..., description="AgroMonitoring API key")
    N: Optional[float] = Field(None, description="Nitrogen (if not using defaults)")
    P: Optional[float] = Field(None, description="Phosphorous (if not using defaults)")
    K: Optional[float] = Field(None, description="Potassium (if not using defaults)")
    ph: Optional[float] = Field(None, description="Soil pH (if not using defaults)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "latitude": 28.6139,
                "longitude": 77.2090,
                "api_key": "your_agro_monitoring_api_key",
                "N": 90,
                "P": 42,
                "K": 43,
                "ph": 6.5
            }
        }

# ============================================================
# 📦 Residual/Listing Models
# ============================================================

class ResidualCreate(BaseModel):
    title: str
    description: str
    quantity: float
    unit: str  # "kg", "tons", etc.
    price: Optional[float] = None
    location: str
    userId: str
    category: str  # "rice_straw", "wheat_chaff", etc.
    imageUrl: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Rice Straw",
                "description": "Fresh rice straw, good quality",
                "quantity": 500,
                "unit": "kg",
                "price": 5000,
                "location": "Punjab",
                "userId": "user-123",
                "category": "rice_straw"
            }
        }

class ResidualResponse(BaseModel):
    id: str
    title: str
    description: str
    quantity: float
    unit: str
    price: Optional[float]
    location: str
    userId: str
    category: str
    imageUrl: Optional[str]
    createdAt: datetime
    status: str  # "available", "sold", "reserved"

# ============================================================
# 🧠 Disease Detection Model Setup (ORIGINAL - UNCHANGED)
# ============================================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
disease_model = None
class_names = []

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

def load_disease_model(model_path: str = "model/plant_disease_model.pth",
                       classes_path: str = "model/classes.json",
                       num_classes: int = 38) -> bool:
    """Load trained PyTorch model and classes"""
    global disease_model, class_names
    try:
        if os.path.exists(classes_path):
            with open(classes_path, "r") as f:
                class_names = json.load(f)
            num_classes = len(class_names)
        else:
            class_names = [f"class_{i}" for i in range(num_classes)]
            logger.warning(f"Classes file not found. Using default {num_classes} classes.")

        logger.info(f"Loading disease model with {num_classes} classes")

        net = models.resnet18(pretrained=False)
        num_ftrs = net.fc.in_features
        net.fc = nn.Linear(num_ftrs, num_classes)

        checkpoint = torch.load(model_path, map_location=device)
        if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
            net.load_state_dict(checkpoint["state_dict"])
        else:
            net.load_state_dict(checkpoint)

        disease_model = net.to(device)
        disease_model.eval()

        logger.info("✅ Disease detection model loaded successfully.")
        return True

    except Exception as e:
        logger.error(f"❌ Error loading disease model: {e}")
        return False

# ============================================================
# 🌾 NEW: CROP RECOMMENDATION MODEL SETUP
# ============================================================

# Global variables for crop recommendation model
crop_recommendation_model = None
crop_scaler = None
crop_label_encoder = None
crop_feature_names = []
crop_model_name = ""
crop_model_accuracy = 0.0

def load_crop_recommendation_model(model_path: str = "model/crop_model.pkl") -> bool:
    """Load trained crop recommendation model"""
    global crop_recommendation_model, crop_scaler, crop_label_encoder
    global crop_feature_names, crop_model_name, crop_model_accuracy
    
    try:
        if not os.path.exists(model_path):
            logger.warning(f"⚠️ Crop recommendation model not found at {model_path}")
            return False
        
        with open(model_path, 'rb') as f:
            model_artifacts = pickle.load(f)
        
        crop_recommendation_model = model_artifacts['model']
        crop_scaler = model_artifacts['scaler']
        crop_label_encoder = model_artifacts['label_encoder']
        crop_feature_names = model_artifacts['feature_names']
        crop_model_name = model_artifacts.get('model_name', 'Unknown')
        crop_model_accuracy = model_artifacts.get('accuracy', 0.0)
        
        logger.info(f"✅ Crop recommendation model loaded successfully!")
        logger.info(f"   Type: {crop_model_name}")
        logger.info(f"   Accuracy: {crop_model_accuracy:.4f}")
        logger.info(f"   Crops: {len(crop_label_encoder.classes_)}")
        
        return True
    
    except Exception as e:
        logger.error(f"❌ Error loading crop recommendation model: {e}")
        return False


def predict_crops(input_features: Dict[str, float], top_n: int = 3) -> List[Dict]:
    """
    Predict top N most suitable crops for given conditions
    """
    if crop_recommendation_model is None:
        raise HTTPException(status_code=500, detail="Crop recommendation model not loaded")
    
    try:
        # Convert to lowercase keys to match training
        input_features = {k.lower(): v for k, v in input_features.items()}
        
        # Create dataframe with correct feature order
        input_df = pd.DataFrame([input_features])
        input_df = input_df[crop_feature_names]
        
        # Scale features
        input_scaled = crop_scaler.transform(input_df)
        
        # Get probabilities
        probabilities = crop_recommendation_model.predict_proba(input_scaled)[0]
        
        # Get top N predictions
        top_indices = np.argsort(probabilities)[-top_n:][::-1]
        
        results = []
        for rank, idx in enumerate(top_indices, 1):
            results.append({
                'crop': crop_label_encoder.classes_[idx],
                'probability': float(probabilities[idx]),
                'suitability_score': float(probabilities[idx] * 100),
                'rank': rank
            })
        
        return results
    
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")

# ============================================================
# 🌤️ NEW: AGROMONITORING API INTEGRATION
# ============================================================

def fetch_agro_monitoring_data(latitude: float, longitude: float, api_key: str) -> Dict:
    """Fetch current weather and soil data from AgroMonitoring API"""
    weather_url = "http://api.agromonitoring.com/agro/1.0/weather"
    
    params = {
        "lat": latitude,
        "lon": longitude,
        "appid": api_key
    }
    
    try:
        response = requests.get(weather_url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"AgroMonitoring API error: {str(e)}")


def kelvin_to_celsius(kelvin: float) -> float:
    """Convert temperature from Kelvin to Celsius"""
    return kelvin - 273.15


def process_agro_data(
    agro_data: Dict,
    n: Optional[float] = None,
    p: Optional[float] = None,
    k: Optional[float] = None,
    ph: Optional[float] = None
) -> Dict[str, float]:
    """Process AgroMonitoring API data into model input format"""
    # Extract weather data
    main = agro_data.get('main', {})
    rain = agro_data.get('rain', {})
    
    # Temperature (convert from Kelvin to Celsius)
    temperature = kelvin_to_celsius(main.get('temp', 298.15))  # Default: 25°C
    
    # Humidity
    humidity = main.get('humidity', 70.0)  # Default: 70%
    
    # Rainfall estimation
    rainfall = rain.get('1h', 0) * 24 * 30  # Estimate monthly from hourly
    if rainfall == 0:
        rainfall = 100.0  # Default rainfall in mm
    
    # Soil parameters - use provided values or defaults
    features = {
        'N': n if n is not None else 90.0,
        'P': p if p is not None else 42.0,
        'K': k if k is not None else 43.0,
        'temperature': round(temperature, 2),
        'humidity': round(humidity, 2),
        'ph': ph if ph is not None else 6.5,
        'rainfall': round(rainfall, 2)
    }
    
    return features

# ============================================================
# 🧾 Static Fallback Recommendations (ORIGINAL - UNCHANGED)
# ============================================================
DISEASE_RECOMMENDATIONS = {
    "Apple___Apple_scab": {
        "description": "Fungal disease causing dark, scabby lesions on leaves and fruit.",
        "treatment": [
            "Remove and destroy infected leaves and fruit.",
            "Apply fungicides containing captan or myclobutanil.",
            "Prune trees to improve air circulation."
        ],
        "prevention": [
            "Plant resistant varieties.",
            "Avoid overhead watering.",
            "Remove fallen leaves in autumn."
        ],
        "organic_solutions": [
            "Use neem oil spray.",
            "Apply copper-based fungicides."
        ],
        "severity": "moderate",
        "spread_rate": "high in wet conditions"
    }
}

DEFAULT_RECOMMENDATION = {
    "description": "Disease information not available in database.",
    "treatment": [
        "Consult a local agricultural expert.",
        "Isolate affected plants.",
        "Use balanced fertilizers and good soil management."
    ],
    "prevention": [
        "Ensure good air circulation.",
        "Water at the base of plants, not on leaves."
    ],
    "organic_solutions": [
        "Apply neem oil or compost tea spray."
    ],
    "severity": "unknown",
    "spread_rate": "unknown"
}

def get_static_recommendations(disease_name: str) -> dict:
    for key, value in DISEASE_RECOMMENDATIONS.items():
        if key.lower() in disease_name.lower():
            return value
    return DEFAULT_RECOMMENDATION

# ============================================================
# 🌾 Image Prediction Logic (ORIGINAL - UNCHANGED)
# ============================================================
def preprocess_image(image_bytes: bytes) -> torch.Tensor:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_tensor = transform(image).unsqueeze(0)
        return image_tensor.to(device)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

def predict_disease(image_tensor: torch.Tensor) -> Dict:
    if disease_model is None:
        raise RuntimeError("Disease detection model not loaded.")

    with torch.no_grad():
        outputs = disease_model(image_tensor)
        probs = torch.nn.functional.softmax(outputs, dim=1)
        confidence, idx = torch.max(probs, 1)

    disease = class_names[idx.item()]

    return {
        "disease": disease,
        "confidence": round(confidence.item(), 4),
        "is_healthy": "healthy" in disease.lower()
    }

# ============================================================
# 🌤️ Gemini Integration (FIXED - Language Support)
# ============================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables.")

genai.configure(api_key=GEMINI_API_KEY)

async def get_dynamic_recommendation(
    disease_name: str, 
    confidence: float, 
    language: str = "en"
) -> str:
    """Ask Gemini Flash for contextual advice in selected language"""
    
    # Get language prompts, fallback to English if not found
    lang_config = LANGUAGE_PROMPTS.get(language, LANGUAGE_PROMPTS["en"])
    
    # Format confidence as percentage
    confidence_pct = f"{confidence*100:.1f}"
    
    # Choose appropriate prompt based on confidence
    if confidence * 100 < 70:
        prompt = lang_config["healthy_prompt"].format(
            confidence=confidence_pct
        )
    else:
        prompt = lang_config["disease_prompt"].format(
            disease=disease_name,
            confidence=confidence_pct
        )

    try:
        model = genai.GenerativeModel("gemini-2.0-flash-exp")

        # Run blocking Gemini call in executor safely
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: model.generate_content(prompt))

        # Handle valid response
        if hasattr(response, "text") and response.text:
            return response.text.strip()

        # Fallback messages if no AI response
        fallback_messages = {
            "en": "No AI recommendation available currently.",
            "hi": "वर्तमान में कोई AI सिफारिश उपलब्ध नहीं है।",
            "te": "ప్రస్తుతం AI సిఫార్సు అందుబాటులో లేదు.",
            "ta": "தற்போது AI பரிந்துரை கிடைக்கவில்லை.",
            "mr": "सध्या कोणतीही AI शिफारस उपलब्ध नाही.",
            "bn": "বর্তমানে কোনো AI সুপারিশ উপলব্ধ নেই।",
        }
        return fallback_messages.get(language, fallback_messages["en"])

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        fallback_messages = {
            "en": "Error while fetching AI recommendation.",
            "hi": "AI सिफारिश प्राप्त करते समय त्रुटि।",
            "te": "AI సిఫార్సును పొందడంలో లోపం.",
            "ta": "AI பரிந்துரையைப் பெறும்போது பிழை.",
            "mr": "AI शिफारस मिळवताना त्रुटी.",
            "bn": "AI সুপারিশ পাওয়ার সময় ত্রুটি।",
        }
        return fallback_messages.get(language, fallback_messages["en"])

# ============================================================
# 💬 WebSocket Chat Manager (ENHANCED WITH DB STORAGE)
# ============================================================
class ConnectionManager:
    """Handles active WebSocket connections grouped by room_id."""
    def __init__(self):
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        logger.info(f"✅ {websocket.client.host} joined room {room_id}")

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            logger.info(f"❌ {websocket.client.host} left room {room_id}")

    async def broadcast(self, room_id: str, message: str):
        """Send message to all users in a specific chat room."""
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to client: {e}")

manager = ConnectionManager()

# In-memory storage for residuals (replace with database in production)
residuals_storage = []

# ============================================================
# 🚀 FastAPI Routes - STARTUP/SHUTDOWN
# ============================================================

@app.on_event("startup")
async def startup_event():
    """Initialize database connection and load ML models"""
    # Connect to Prisma database
    try:
        await db.connect()
        logger.info("✅ Database connected successfully")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
    
    # Load disease detection model
    if not load_disease_model():
        logger.warning("⚠️ Disease detection model not loaded on startup.")
    
    # Load crop recommendation model (NEW)
    if not load_crop_recommendation_model():
        logger.warning("⚠️ Crop recommendation model not loaded on startup.")

@app.on_event("shutdown")
async def shutdown_event():
    """Disconnect from database"""
    try:
        await db.disconnect()
        logger.info("✅ Database disconnected")
    except Exception as e:
        logger.error(f"❌ Error disconnecting database: {e}")

@app.get("/")
async def root():
    return {
        "message": "🌾 Integrated Agriculture API - Disease Detection + Crop Recommendation + Chat",
        "status": "running",
        "version": "3.0.0",
        "endpoints": {
            "disease_detection": "/predict",
            "crop_recommendation": "/crop/predict",
            "live_crop_recommendation": "/crop/live-predict",
            "supported_crops": "/crop/list",
            "users": "/users",
            "chats": "/chats",
            "messages": "/messages",
            "residuals": "/residuals",
            "websocket": "/ws/chat/{room_id}"
        }
    }

# ============================================================
# 👤 USER ENDPOINTS (ORIGINAL - UNCHANGED)
# ============================================================

@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    """Register a new user (farmer or business)"""
    try:
        existing_user = await db.user.find_unique(where={"email": user.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        if user.userType not in ["farmer", "business"]:
            raise HTTPException(status_code=400, detail="userType must be 'farmer' or 'business'")
        
        new_user = await db.user.create(
            data={
                "name": user.name,
                "email": user.email,
                "userType": user.userType
            }
        )
        
        logger.info(f"✅ User created: {new_user.email}")
        return new_user
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")

@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    """Get user details by ID"""
    user = await db.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users")
async def list_users(userType: Optional[str] = None):
    """List all users, optionally filtered by userType"""
    if userType:
        if userType not in ["farmer", "business"]:
            raise HTTPException(status_code=400, detail="userType must be 'farmer' or 'business'")
        users = await db.user.find_many(where={"userType": userType})
    else:
        users = await db.user.find_many()
    
    return {"users": users, "count": len(users)}

# ============================================================
# 💬 CHAT ENDPOINTS (ORIGINAL - UNCHANGED)
# ============================================================

@app.post("/chats", response_model=ChatResponse)
async def create_chat(chat_data: ChatCreate):
    """Create a new chat between two users"""
    try:
        user1 = await db.user.find_unique(where={"id": chat_data.user1_id})
        user2 = await db.user.find_unique(where={"id": chat_data.user2_id})
        
        if not user1 or not user2:
            raise HTTPException(status_code=404, detail="One or both users not found")
        
        existing_chats = await db.chat.find_many(
            where={
                "participants": {
                    "some": {"id": chat_data.user1_id}
                }
            },
            include={"participants": True}
        )
        
        for chat in existing_chats:
            participant_ids = {p.id for p in chat.participants}
            if chat_data.user2_id in participant_ids:
                logger.info(f"Chat already exists: {chat.id}")
                return ChatResponse(
                    id=chat.id,
                    participants=[UserResponse(**p.dict()) for p in chat.participants],
                    createdAt=chat.createdAt
                )
        
        new_chat = await db.chat.create(
            data={
                "participants": {
                    "connect": [
                        {"id": chat_data.user1_id},
                        {"id": chat_data.user2_id}
                    ]
                }
            },
            include={"participants": True}
        )
        
        logger.info(f"✅ Chat created: {new_chat.id}")
        return ChatResponse(
            id=new_chat.id,
            participants=[UserResponse(**p.dict()) for p in new_chat.participants],
            createdAt=new_chat.createdAt
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating chat: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating chat: {str(e)}")

@app.get("/chats/{user_id}")
async def get_user_chats(user_id: str):
    """Get all chats for a specific user"""
    try:
        user = await db.user.find_unique(where={"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        chats = await db.chat.find_many(
            where={
                "participants": {
                    "some": {"id": user_id}
                }
            },
            include={
                "participants": True,
                "messages": {
                    "take": 1,
                    "order_by": {"createdAt": "desc"}
                }
            }
        )
        
        chat_list = []
        for chat in chats:
            last_message = chat.messages[0].content if chat.messages else None
            chat_list.append({
                "id": chat.id,
                "participants": [UserResponse(**p.dict()) for p in chat.participants],
                "createdAt": chat.createdAt,
                "lastMessage": last_message
            })
        
        return {"chats": chat_list, "count": len(chat_list)}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chats: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching chats: {str(e)}")

# ============================================================
# 📨 MESSAGE ENDPOINTS (ORIGINAL - UNCHANGED)
# ============================================================

@app.post("/messages", response_model=MessageResponse)
async def send_message(message: MessageCreate):
    """Send a message in a chat"""
    try:
        chat = await db.chat.find_unique(
            where={"id": message.chatId},
            include={"participants": True}
        )
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        sender = await db.user.find_unique(where={"id": message.senderId})
        if not sender:
            raise HTTPException(status_code=404, detail="Sender not found")
        
        participant_ids = {p.id for p in chat.participants}
        if message.senderId not in participant_ids:
            raise HTTPException(status_code=403, detail="Sender is not a participant in this chat")
        
        new_message = await db.message.create(
            data={
                "content": message.content,
                "senderId": message.senderId,
                "chatId": message.chatId
            }
        )
        
        logger.info(f"✅ Message sent in chat {message.chatId}")
        
        ws_message = json.dumps({
            "id": new_message.id,
            "content": new_message.content,
            "senderId": new_message.senderId,
            "chatId": new_message.chatId,
            "createdAt": new_message.createdAt.isoformat()
        })
        await manager.broadcast(message.chatId, ws_message)
        
        return new_message
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")

@app.get("/messages/{chat_id}")
async def get_chat_messages(chat_id: str, limit: int = 50, skip: int = 0):
    """Get message history for a chat"""
    try:
        chat = await db.chat.find_unique(where={"id": chat_id})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        messages = await db.message.find_many(
            where={"chatId": chat_id},
            order_by={"createdAt": "desc"},
            take=limit,
            skip=skip,
            include={"sender": True}
        )
        
        total = await db.message.count(where={"chatId": chat_id})
        
        return {
            "messages": messages,
            "count": len(messages),
            "total": total,
            "hasMore": (skip + len(messages)) < total
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching messages: {str(e)}")

# ============================================================
# 🔌 WEBSOCKET ENDPOINT (ORIGINAL - UNCHANGED)
# ============================================================

@app.websocket("/ws/chat/{room_id}")
async def websocket_chat(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for real-time chat"""
    await manager.connect(room_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message_data = json.loads(data)
                sender_id = message_data.get("senderId")
                content = message_data.get("content")
                
                if not sender_id or not content:
                    await websocket.send_text(json.dumps({
                        "error": "senderId and content are required"
                    }))
                    continue
                
                new_message = await db.message.create(
                    data={
                        "content": content,
                        "senderId": sender_id,
                        "chatId": room_id
                    }
                )
                
                broadcast_data = json.dumps({
                    "id": new_message.id,
                    "content": new_message.content,
                    "senderId": new_message.senderId,
                    "chatId": new_message.chatId,
                    "createdAt": new_message.createdAt.isoformat()
                })
                
                await manager.broadcast(room_id, broadcast_data)
                
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "error": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                await websocket.send_text(json.dumps({
                    "error": "Error processing message"
                }))
    
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)

# ============================================================
# 🌾 CROP DISEASE DETECTION ENDPOINTS (FIXED - Language Support)
# ============================================================

@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...), language: str = "en"):
    """Predict crop disease from uploaded image with language support"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image (JPEG/PNG).")

    # Validate language parameter
    if language not in LANGUAGE_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unsupported language. Supported: {list(LANGUAGE_PROMPTS.keys())}")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Max 10MB.")

    image_tensor = preprocess_image(contents)
    prediction = predict_disease(image_tensor)

    static_rec = get_static_recommendations(prediction["disease"])
    dynamic_text = await get_dynamic_recommendation(
        prediction["disease"], 
        prediction["confidence"],
        language
    )

    return JSONResponse(content={
        "success": True,
        "prediction": prediction,
        "recommendations": {
            "static": static_rec,
            "dynamic": dynamic_text
        },
        "model_info": {
            "architecture": "ResNet18",
            "num_classes": len(class_names),
            "device": str(device),
            "language": language
        }
    })

@app.get("/classes")
async def get_classes():
    """Get list of disease classes"""
    if not class_names:
        raise HTTPException(status_code=503, detail="Model classes not loaded.")
    return {"classes": class_names, "count": len(class_names)}

# ============================================================
# 🌾 NEW: CROP RECOMMENDATION ENDPOINTS
# ============================================================

@app.post("/crop/predict", response_model=CropPredictionResponse)
async def predict_crop(input_data: CropInput, top_n: int = 3):
    """
    🌾 Predict most suitable crops based on environmental conditions
    
    This endpoint uses a trained ML model to recommend crops based on:
    - Soil nutrients (N, P, K, pH)
    - Weather conditions (temperature, humidity, rainfall)
    
    Example:
    ```
    POST /crop/predict?top_n=5
    {
        "N": 90,
        "P": 42,
        "K": 43,
        "temperature": 20.87,
        "humidity": 82.0,
        "ph": 6.5,
        "rainfall": 202.93
    }
    ```
    
    Returns top N crops with suitability scores
    """
    if crop_recommendation_model is None:
        raise HTTPException(status_code=500, detail="Crop recommendation model not loaded")
    
    # Convert input to dict
    features = input_data.model_dump()
    
    # Get predictions
    predictions = predict_crops(features, top_n=min(top_n, 10))
    
    return CropPredictionResponse(
        predictions=[CropPrediction(**pred) for pred in predictions],
        input_features=features,
        model_info={
            "model_type": crop_model_name,
            "accuracy": f"{crop_model_accuracy:.4f}",
            "total_crops": str(len(crop_label_encoder.classes_))
        },
        timestamp=datetime.utcnow().isoformat()
    )


@app.post("/crop/live-predict", response_model=CropPredictionResponse)
async def live_predict_crop(input_data: LivePredictInput, top_n: int = 3):
    """
    🌤️ Predict crops using LIVE weather data from AgroMonitoring API
    
    This endpoint:
    1. Fetches real-time weather data (temperature, humidity, rainfall)
    2. Combines it with your soil parameters (N, P, K, pH)
    3. Returns crop recommendations
    
    Example:
    ```
    POST /crop/live-predict?top_n=5
    {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "api_key": "your_agro_monitoring_api_key",
        "N": 90,
        "P": 42,
        "K": 43,
        "ph": 6.5
    }
    ```
    
    Note: You need an AgroMonitoring API key (free at https://agromonitoring.com/api)
    """
    if crop_recommendation_model is None:
        raise HTTPException(status_code=500, detail="Crop recommendation model not loaded")
    
    try:
        agro_data = fetch_agro_monitoring_data(
            input_data.latitude,
            input_data.longitude,
            input_data.api_key
        )
        
        features = process_agro_data(
            agro_data,
            n=input_data.N,
            p=input_data.P,
            k=input_data.K,
            ph=input_data.ph
        )
        
        predictions = predict_crops(features, top_n=min(top_n, 10))
        
        return CropPredictionResponse(
            predictions=[CropPrediction(**pred) for pred in predictions],
            input_features=features,
            model_info={
                "model_type": crop_model_name,
                "accuracy": f"{crop_model_accuracy:.4f}",
                "total_crops": str(len(crop_label_encoder.classes_)),
                "data_source": "AgroMonitoring API (live)",
                "location": f"Lat: {input_data.latitude}, Lon: {input_data.longitude}"
            },
            timestamp=datetime.utcnow().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error in live prediction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching live data: {str(e)}"
        )


@app.get("/crop/list")
async def get_supported_crops():
    """
    📋 Get list of all crops supported by the recommendation model
    
    Returns: List of crop names that the model can recommend
    """
    if crop_recommendation_model is None:
        raise HTTPException(status_code=500, detail="Crop recommendation model not loaded")
    
    return {
        "crops": crop_label_encoder.classes_.tolist(),
        "count": len(crop_label_encoder.classes_),
        "model_info": {
            "type": crop_model_name,
            "accuracy": f"{crop_model_accuracy:.4f}"
        }
    }


@app.get("/crop/health")
async def crop_model_health():
    """
    ❤️ Health check for crop recommendation system
    
    Returns status of crop recommendation model and disease detection model
    """
    return {
        "crop_recommendation": {
            "loaded": crop_recommendation_model is not None,
            "model_type": crop_model_name if crop_recommendation_model else None,
            "accuracy": crop_model_accuracy if crop_recommendation_model else None,
            "supported_crops": len(crop_label_encoder.classes_) if crop_recommendation_model else 0
        },
        "disease_detection": {
            "loaded": disease_model is not None,
            "classes": len(class_names) if disease_model else 0
        },
        "timestamp": datetime.utcnow().isoformat()
    }



@app.post("/residuals", response_model=ResidualResponse)
async def create_residual(residual: ResidualCreate):
    """Create a new residual listing"""
    try:
        import uuid
        residual_id = f"res_{uuid.uuid4().hex[:8]}"
        
        new_residual = {
            "id": residual_id,
            **residual.dict(),
            "createdAt": datetime.now(),
            "status": "available"
        }
        
        residuals_storage.append(new_residual)
        
        logger.info(f"✅ Residual created: {residual_id}")
        return new_residual
    
    except Exception as e:
        logger.error(f"Error creating residual: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating residual: {str(e)}")

@app.get("/residuals")
async def get_residuals(
    category: Optional[str] = None,
    location: Optional[str] = None,
    status: Optional[str] = "available",
    limit: int = 50,
    skip: int = 0
):
    """Get all residuals/listings with optional filters"""
    try:
        filtered_residuals = residuals_storage.copy()
        
        if category:
            filtered_residuals = [r for r in filtered_residuals if r["category"] == category]
        
        if location:
            filtered_residuals = [r for r in filtered_residuals if location.lower() in r["location"].lower()]
        
        if status:
            filtered_residuals = [r for r in filtered_residuals if r["status"] == status]
        
        filtered_residuals.sort(key=lambda x: x["createdAt"], reverse=True)
        
        total = len(filtered_residuals)
        paginated = filtered_residuals[skip:skip + limit]
        
        return {
            "residuals": paginated,
            "count": len(paginated),
            "total": total,
            "hasMore": (skip + len(paginated)) < total
        }
    
    except Exception as e:
        logger.error(f"Error fetching residuals: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching residuals: {str(e)}")

@app.get("/residuals/{residual_id}", response_model=ResidualResponse)
async def get_residual(residual_id: str):
    """Get a specific residual by ID"""
    residual = next((r for r in residuals_storage if r["id"] == residual_id), None)
    
    if not residual:
        raise HTTPException(status_code=404, detail="Residual not found")
    
    return residual

@app.put("/residuals/{residual_id}", response_model=ResidualResponse)
async def update_residual(residual_id: str, updates: dict):
    """Update a residual listing"""
    residual = next((r for r in residuals_storage if r["id"] == residual_id), None)
    
    if not residual:
        raise HTTPException(status_code=404, detail="Residual not found")
    
    for key, value in updates.items():
        if key in residual and key != "id" and key != "createdAt":
            residual[key] = value
    
    logger.info(f"✅ Residual updated: {residual_id}")
    return residual

@app.delete("/residuals/{residual_id}")
async def delete_residual(residual_id: str):
    """Delete a residual listing"""
    global residuals_storage
    
    residual = next((r for r in residuals_storage if r["id"] == residual_id), None)
    
    if not residual:
        raise HTTPException(status_code=404, detail="Residual not found")
    
    residuals_storage = [r for r in residuals_storage if r["id"] != residual_id]
    
    logger.info(f"✅ Residual deleted: {residual_id}")
    return {"success": True, "message": "Residual deleted successfully"}

@app.get("/residuals/user/{user_id}")
async def get_user_residuals(user_id: str):
    """Get all residuals created by a specific user"""
    user_residuals = [r for r in residuals_storage if r["userId"] == user_id]
    user_residuals.sort(key=lambda x: x["createdAt"], reverse=True)
    
    return {
        "residuals": user_residuals,
        "count": len(user_residuals)
    }



@app.get("/languages")
async def get_supported_languages():
    """Get list of all supported languages"""
    return {
        "languages": [
            {
                "code": code,
                "name": config["name"]
            }
            for code, config in LANGUAGE_PROMPTS.items()
        ],
        "count": len(LANGUAGE_PROMPTS)
    }

@app.get("/languages/{language_code}")
async def get_language_info(language_code: str):
    """Get information about a specific language"""
    if language_code not in LANGUAGE_PROMPTS:
        raise HTTPException(status_code=404, detail="Language not supported")
    
    return {
        "code": language_code,
        "name": LANGUAGE_PROMPTS[language_code]["name"],
        "prompts": {
            "healthy": LANGUAGE_PROMPTS[language_code]["healthy_prompt"],
            "disease": LANGUAGE_PROMPTS[language_code]["disease_prompt"]
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)