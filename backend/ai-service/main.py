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
    print(f"📥 Received analysis request")
    try:
        # Load image
        p = request.local_path
        if p and os.path.exists(p):
            img = Image.open(p).convert('RGB')
        else:
            response = requests.get(request.image_url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to download image")
            img = Image.open(BytesIO(response.content)).convert('RGB')
            
        # Optimization: Resize for lower RAM footprint
        max_size = 640 # Lowered from 800 to further save RAM
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        # Get models (Lazy Load)
        c_mod, d_mod, o_mod = get_models()
        
        # Run pipeline SEQUENTIALLY to stay under 512MB RAM
        print("⚡ Executing AI layers sequentially...")
        caption = c_mod.get_caption(img)
        objects = d_mod.detect(img)
        text = o_mod.read_text(img)
        
        # Immediate memory cleanup
        clear_memory()
        
        print("✅ Analysis complete")
        return {
            "caption": caption,
            "objects": objects,
            "text": text
        }
    except Exception as e:
        print(f"Server Error: {e}")
        clear_memory() # Ensure cleanup on failure
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    import uvicorn
    # Use 127.0.0.1 for better compatibility with local requests on Windows
    uvicorn.run(app, host="127.0.0.1", port=8000)
