# 🚀 VisionTalk AI – Multimodal Conversational Vision Assistant

A full-stack AI system that analyzes images, understands context, and assists visually impaired users using vision + language + voice AI.

## 🛠️ Tech Stack
- **Frontend**: React.js, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, Firebase
- **AI Service**: Python FastAPI, YOLOv8, BLIP, EasyOCR
- **LLM**: OpenRouter (GPT-3.5/4)

## 📁 Project Structure
- `/frontend`: React client
- `/backend`: Node.js API server
- `/ai-service`: Python AI microservices

## 🚀 How to Run

### 1. AI Microservice (Python)
```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

### 2. Backend (Node.js)
```bash
cd backend
npm install
npm start
```
*Make sure to add your OpenRouter key to `.env`*

### 3. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## 🎯 Features
- [x] **Image Analysis**: AI detects objects and generates captions.
- [x] **Conversational AI**: Ask follow-up questions about the image.
- [x] **OCR**: Extracts text from labels/signs.
- [x] **Premium UI**: Modern glassmorphism design.
- [x] **Voice Support**: (Planned) Speech-to-Text and TTS integration.

## 🔑 Environment Variables
Check `.env` files in `backend/` and verify the `AI_SERVICE_URL`.

---
*Built for Hackathons & Portfolio Excellence.*
