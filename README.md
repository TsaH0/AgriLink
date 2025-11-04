# 🌾 AgriLink — Smart Crop Health & Resource Management

> A unified AI-powered system that helps farmers detect crop diseases, manage residuals, and get intelligent recommendations — built using **FastAPI**, **PyTorch**, and **React Native**.

---

## 🧠 Overview

**AgriLink** is an end-to-end agricultural assistance platform that uses deep learning and generative AI to help farmers:

- 🌱 **Detect crop diseases** from leaf images in real time  
- 🧩 **Get AI-based recommendations** on treatment and prevention using Gemini  
- 🚜 **Manage agricultural residuals and resources** (optional module)  
- 📱 **Access everything through a mobile-friendly app**

---

## 🏗️ System Architecture

```mermaid
graph LR
    %% === Users ===
    classDef user fill:#64B5F6,stroke:#2196F3,stroke-width:2px,color:#000;
    A[👨‍🌾 Farmer]:::user

    %% === Frontend ===
    classDef frontend fill:#A5D6A7,stroke:#4CAF50,stroke-width:2px,color:#000;
    C[📱 React Native Mobile App]:::frontend

    %% === Backend & Core ===
    classDef backend fill:#FFCC80,stroke:#FF9800,stroke-width:2px,color:#000;
    E[🐍 FastAPI Backend]:::backend
    F[💬 WebSocket Chat Service]:::backend
    G[(💾 PostgreSQL Database)]:::backend

    %% === AI Modules ===
    classDef ai fill:#BBDEFB,stroke:#42A5F5,stroke-width:2px,color:#000;
    H[👁️ Crop Disease Detection Model]:::ai
    I[🌿 Crop Recommendation Engine]:::ai

    %% === External API ===
    classDef external fill:#F8BBD0,stroke:#E91E63,stroke-width:2px,color:#000;
    J[☁️ Weather & Soil Data API]:::external

    %% === Grouping the Platform ===
    subgraph AgriLink_Platform
        E
        F
        G
        H
        I
    end

    %% === Connections ===
    %% User → Frontend
    A --> C

    %% Frontend → Backend
    C -->|API Calls| E
    C -->|Chat| F

    %% Backend → Database
    E -->|Read/Write| G
    F -->|Store Messages| G

    %% Backend → AI Modules
    E -->|Send Images| H
    E -->|Send Location| I

    %% AI → Backend
    H -->|Prediction Result| E
    I -->|Recommendation| E

    %% AI → External Data
    I -->|Fetch Weather/Soil Data| J



