import torch
from transformers import BlipProcessor, BlipForConditionalGeneration

class ImageCaptioner:
    def __init__(self):
        print("Initializing BLIP...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"BLIP using device: {self.device}")
        self.processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        self.model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base").to(self.device)

    def get_caption(self, pil_image):
        inputs = self.processor(pil_image, return_tensors="pt").to(self.device)
        out = self.model.generate(**inputs)
        return self.processor.decode(out[0], skip_special_tokens=True)

