import easyocr
import numpy as np

class OCREngine:
    def __init__(self):
        print("Initializing EasyOCR...")
        self.reader = easyocr.Reader(['en'])

    def read_text(self, pil_image):
        # Using detail=0 significantly speeds up extraction when coordinates aren't needed
        results = self.reader.readtext(np.array(pil_image), detail=0)
        return " ".join(results)

