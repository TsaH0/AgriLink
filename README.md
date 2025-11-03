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
flowchart TD
    A[📱 React Native App] -->|REST API| B[🚀 FastAPI Backend]
    B -->|🧠 Model Inference| C[(PyTorch CNN Model)]
    B -->|🤖 AI Explanation| D[Gemini 2.5 Flash]
    B -->|📂 Data Storage| E[(SQLite / PostgreSQL)]

