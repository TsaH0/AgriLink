from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import io
import json
import os
import logging
from typing import Dict
from dotenv import load_dotenv
import asyncio
import google.generativeai as genai

# ============================================================
# 🧩 Setup
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Crop Disease Detection API", version="2.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 🧠 Model Setup
# ============================================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = None
class_names = []

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

def load_model(model_path: str = "model/plant_disease_model.pth",
               classes_path: str = "model/classes.json",
               num_classes: int = 38) -> bool:
    """Load trained PyTorch model and classes"""
    global model, class_names
    try:
        if os.path.exists(classes_path):
            with open(classes_path, "r") as f:
                class_names = json.load(f)
            num_classes = len(class_names)
        else:
            class_names = [f"class_{i}" for i in range(num_classes)]
            logger.warning(f"Classes file not found. Using default {num_classes} classes.")

        logger.info(f"Loading model with {num_classes} classes")
        net = models.resnet18(pretrained=False)
        num_ftrs = net.fc.in_features
        net.fc = nn.Linear(num_ftrs, num_classes)

        checkpoint = torch.load(model_path, map_location=device)
        if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
            net.load_state_dict(checkpoint["state_dict"])
        else:
            net.load_state_dict(checkpoint)

        model = net.to(device)
        model.eval()
        logger.info("✅ Model loaded successfully.")
        return True
    except Exception as e:
        logger.error(f"❌ Error loading model: {e}")
        return False

# ============================================================
# 🧾 Static Fallback Recommendations
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
# 🌾 Image Prediction Logic
# ============================================================
def preprocess_image(image_bytes: bytes) -> torch.Tensor:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_tensor = transform(image).unsqueeze(0)
        return image_tensor.to(device)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

def predict_disease(image_tensor: torch.Tensor) -> Dict:
    if model is None:
        raise RuntimeError("Model not loaded.")
    with torch.no_grad():
        outputs = model(image_tensor)
        probs = torch.nn.functional.softmax(outputs, dim=1)
        confidence, idx = torch.max(probs, 1)
        disease = class_names[idx.item()]
        return {
            "disease": disease,
            "confidence": round(confidence.item(), 4),
            "is_healthy": "healthy" in disease.lower()
        }

# ============================================================
# 🌤️ Gemini Integration (Flash)
# ============================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables.")
genai.configure(api_key=GEMINI_API_KEY)

async def get_dynamic_recommendation(disease_name: str, confidence: float) -> str:
    """Ask Gemini Flash for contextual advice"""
    prompt = (
        f"You are an expert agricultural advisor for Indian farmers. "
        f"A crop has been predicted to have **{disease_name}** with confidence {confidence*100:.1f}%. "
        f"Provide detailed treatment, prevention, and organic solutions in simple English language, "
        f"focusing on practical local steps farmers can take. Make the tips concise and properly formatted. Very less text heavy and more spaces and to the point.Do not use many symbols and no paragraph should be more than a couple of lines. "
    )
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        print("Gemini model initialized.")
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, model.generate_content, prompt)
        print("Gemini raw response:", response)
        if hasattr(response, "text") and response.text:
            print("Gemini response.text:", response.text)
            return response.text.strip()
        print("Gemini response has no text attribute or is empty.")
        return "No AI recommendation available currently."
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        import traceback
        print("Gemini Exception Traceback:")
        traceback.print_exc()
        return "Error while fetching AI-based recommendation."

# ============================================================
# 🚀 FastAPI Routes
# ============================================================
@app.on_event("startup")
async def startup_event():
    if not load_model():
        logger.warning("⚠️ Model not loaded on startup.")

@app.get("/")
async def root():
    return {"message": "🌾 Crop Disease Detection API", "status": "running"}

@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image (JPEG/PNG).")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Max 10MB.")

    image_tensor = preprocess_image(contents)
    prediction = predict_disease(image_tensor)

    static_rec = get_static_recommendations(prediction["disease"])
    dynamic_text = await get_dynamic_recommendation(prediction["disease"], prediction["confidence"])

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
            "device": str(device)
        }
    })

@app.get("/classes")
async def get_classes():
    if not class_names:
        raise HTTPException(status_code=503, detail="Model classes not loaded.")
    return {"classes": class_names, "count": len(class_names)}

# ============================================================
# 🧩 Run Server
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
