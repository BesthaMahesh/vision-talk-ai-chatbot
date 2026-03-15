@echo off
echo [1/3] Setting up Backend...
cd backend
npm install
cd ..

echo [2/3] Setting up Frontend...
cd frontend
npm install
cd ..

echo [3/3] Setting up AI Service (Python)...
cd ai-service
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
cd ..

echo 🚀 Setup Complete! Read README.md for instructions on how to start each service.
pause
