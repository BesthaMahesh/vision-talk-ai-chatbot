from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from io import BytesIO
from PIL import Image
from image_caption import ImageCaptioner
from object_detection import ObjectDetector
from ocr_engine import OCREngine

app = FastAPI()

# Lazy loading or eager loading?
# For a production/hackathon service, we initialize them here.
captioner = ImageCaptioner()
detector = ObjectDetector()
ocr = OCREngine()

from typing import Optional

class AnalysisRequest(BaseModel):
    image_url: str
    local_path: Optional[str] = None

import os
import asyncio

@app.get("/")
def read_root():
    return {"status": "VisionTalk AI Microservice Active"}

@app.post("/analyze")
async def analyze_image(request: AnalysisRequest):
    print(f"📥 Received analysis request")
    try:
        # Load image (Prefer local file if available, otherwise URL)
        p = request.local_path
        if p and os.path.exists(p):
            img = Image.open(p).convert('RGB')
            print(f"📖 Loaded image from local storage: {p}")
        else:
            response = requests.get(request.image_url)
            if response.status_code != 200:
                print(f"❌ Failed to download image. Status: {response.status_code}")
                raise HTTPException(status_code=400, detail="Failed to download image from backend")
            img = Image.open(BytesIO(response.content)).convert('RGB')
            print(f"🌐 Loaded image from legacy URL")
            
        # Optimize: Resize image to max 800px width/height for faster processing & lower RAM
        max_size = 800
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            print(f"📉 Resized image for analysis: {img.size}")
        else:
            print(f"📸 Image loaded successfully: {img.size}")
        
        # Run pipeline concurrently to save time
        print("⚡ Executing multimodal AI pipeline...")
        caption_task = asyncio.to_thread(captioner.get_caption, img)
        detection_task = asyncio.to_thread(detector.detect, img)
        ocr_task = asyncio.to_thread(ocr.read_text, img)

        caption, objects, text = await asyncio.gather(caption_task, detection_task, ocr_task)
        
        print("✅ Analysis complete")
        return {
            "caption": caption,
            "objects": objects,
            "text": text
        }
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    # Use 127.0.0.1 for better compatibility with local requests on Windows
    uvicorn.run(app, host="127.0.0.1", port=8000)
