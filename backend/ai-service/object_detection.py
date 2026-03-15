from ultralytics import YOLO
import cv2
import numpy as np

import torch

class ObjectDetector:
    def __init__(self):
        print("Initializing YOLOv8...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"YOLOv8 using device: {self.device}")
        self.model = YOLO("yolov8n.pt")

    def detect(self, pil_image):
        opencv_img = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        # Use explicit device for inference
        results = self.model(opencv_img, device=self.device)
        
        detected_objects = []
        for result in results:
            for box in result.boxes:
                detected_objects.append({
                    "label": result.names[int(box.cls[0])],
                    "confidence": float(box.conf[0]),
                    "bbox": [float(x) for x in box.xyxy[0]]
                })
        return detected_objects

