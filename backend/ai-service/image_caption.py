import torch
from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer

class ImageCaptioner:
    def __init__(self):
        print("Initializing Lightweight Captioner (ViT-GPT2)...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # ViT-GPT2 is much smaller (~400MB) than BLIP-base (~900MB)
        model_name = "nlpconnect/vit-gpt2-image-captioning"
        self.model = VisionEncoderDecoderModel.from_pretrained(model_name).to(self.device)
        self.processor = ViTImageProcessor.from_pretrained(model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)

    def get_caption(self, pil_image):
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert(mode="RGB")

        pixel_values = self.processor(images=[pil_image], return_tensors="pt").pixel_values.to(self.device)
        output_ids = self.model.generate(pixel_values, max_length=16, num_beams=4)
        preds = self.tokenizer.batch_decode(output_ids, skip_special_tokens=True)
        return preds[0].strip()


