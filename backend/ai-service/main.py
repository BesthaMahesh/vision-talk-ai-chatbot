from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from io import BytesIO
from PIL import Image

app = FastAPI()

import gc
import torch

# Global instances for lazy loading
captioner = None
detector = None
ocr = None

def get_models():
    global captioner, detector, ocr
    # Load sequentially to monitor RAM usage better
    if captioner is None:
        from image_caption import ImageCaptioner
        captioner = ImageCaptioner()
    if detector is None:
        from object_detection import ObjectDetector
        detector = ObjectDetector()
    if ocr is None:
        from ocr_engine import OCREngine
        ocr = OCREngine()
    return captioner, detector, ocr

def clear_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

from typing import Optional

class AnalysisRequest(BaseModel):
    image_url: str
    local_path: Optional[str] = None

import os

@app.get("/")
def read_root():
    return {"status": "VisionTalk AI Microservice Active"}

@app.post("/analyze")
async def analyze_image(request: AnalysisRequest):
    print(f"📥 Received analysis request (Strict 512MB Mode)")
    try:
        # Load and resize image
        p = request.local_path
        if p and os.path.exists(p):
            img = Image.open(p).convert('RGB')
        else:
            response = requests.get(request.image_url)
            img = Image.open(BytesIO(response.content)).convert('RGB')
            
        # Downscale to 512px for maximum RAM protection during processing
        img.thumbnail((512, 512))

        # --- STEP 1: CAPTIONING ---
        from image_caption import ImageCaptioner
        caption_engine = ImageCaptioner()
        caption = caption_engine.get_caption(img)
        print("✅ Caption extracted")
        del caption_engine
        clear_memory()

        # --- STEP 2: OBJECT DETECTION ---
        from object_detection import ObjectDetector
        detector_engine = ObjectDetector()
        objects = detector_engine.detect(img)
        print(f"✅ Objects found: {len(objects)}")
        del detector_engine
        clear_memory()

        # --- STEP 3: OCR ---
        from ocr_engine import OCREngine
        ocr_engine = OCREngine()
        text = ocr_engine.read_text(img)
        print("✅ Text extracted")
        del ocr_engine
        clear_memory()
        
        return {
            "caption": caption,
            "objects": objects,
            "text": text
        }
    except Exception as e:
        print(f"❌ Critical Error during analysis: {e}")
        clear_memory()
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        print(f"Server Error: {e}")
        clear_memory() # Ensure cleanup on failure
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    import uvicorn
    # Use 127.0.0.1 for better compatibility with local requests on Windows
    uvicorn.run(app, host="127.0.0.1", port=8000)
