const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("📁 Created 'uploads/' directory");
}

const app = express();
const PORT = process.env.PORT || 5000;

// Import database
const { db } = require('./database/firebase_config');

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Storage configuration for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// AI Service URL (FastAPI)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Routes
app.get('/', (req, res) => {
    res.send('VisionTalk AI Backend Running');
});

// Upload image and get initial analysis
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        // Replace spaces with %20 safely instead of full encodeURIComponent which breaks Python requests
        const fileName = req.file.filename;
        const safeFileName = fileName.replace(/ /g, '%20');
        const imageUrl = `http://127.0.0.1:${PORT}/uploads/${safeFileName}`;
        const localPath = path.join(__dirname, 'uploads', fileName);
        
        console.log(`📤 Sending analysis request: ${fileName}`);

        // --- RETRY LOGIC FOR AI SERVICE ---
        let aiResponse;
        let maxRetries = 40; // Increased to 40 for slow model downloads (~2 mins total)
        let retryDelay = 3000; // 3 seconds
        let success = false;

        for (let i = 0; i < maxRetries; i++) {
            try {
                aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, {
                    image_url: imageUrl,
                    local_path: localPath
                });
                success = true;
                break;
            } catch (error) {
                if ((error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') && i < maxRetries - 1) {
                    console.warn(`⏳ AI Service is booting up or model downloading... Retrying in ${retryDelay/1000}s (${i + 1}/${maxRetries})`);
                    if (error.response) console.log(`Status: ${error.response.status}`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    console.error("❌ AI Service Connection Error:", error.message);
                    throw error;
                }
            }
        }

        if (!success) {
            throw new Error("AI Service failed to respond after multiple attempts.");
        }

        console.log(`✅ AI Service response received:`, JSON.stringify(aiResponse.data).slice(0, 100) + "...");
        
        // --- COGNITIVE SYNTHESIS STEP ---
        // Use Gemini to merge raw data (Caption + OCR + Objects) into a perfect human summary
        let synthesis = aiResponse.data.caption;
        try {
            const synthResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: 'google/gemini-2.0-flash-lite-001',
                messages: [
                    { 
                        role: 'system', 
                        content: `You are a visual data synthesizer. Combine raw sensor data into a 1-sentence elite summary.
                        TASK: Provide a raw, direct description of what is in the image.
                        NEGATIVE CONSTRAINT: NEVER use the words "resume", "template", "job", or "cv". 
                        If there is text about robotics/ROS/actuators/programming, say: "Technical data regarding [specific topic found in text]".
                        Focus purely on the literal meaning of the words and the physical objects.
                        Output format: "Subject: [Topic]. Insight: [Detail found in data]." (Keep it under 15 words)`
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            synthesis = synthResponse.data.choices[0].message.content;
        } catch (sErr) {
            console.warn("⚠️ Synthesis failed, falling back to raw caption:", sErr.message);
        }

        res.json({
            ...aiResponse.data,
            synthesis: synthesis
        });
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            const connectMsg = `AI Service connection persistent failure. Please check if the Python microservice is running.`;
            console.error(`❌ AI Service not ready:`, connectMsg);
            return res.status(503).json({ error: connectMsg });
        }
        console.error('❌ Error in /api/upload:', error.message);
        res.status(500).json({ error: 'Failed to analyze image' });
    }
});

// Chat with AI about the image
app.post('/api/chat', async (req, res) => {
    const { message, imageContext, history, userId = 'anonymous' } = req.body;

    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'google/gemini-2.0-flash-lite-001',
            messages: [
                { 
                    role: 'system', 
                    content: `You are VisionTalk AI, an elite visual intelligence assistant. 
                    You are analyzing an image using high-precision computer vision data.
                    
                    DATA CONTEXT:
                    - Caption Synthesis: ${imageContext.caption || 'None'}
                    - Identified Entities: ${JSON.stringify(imageContext.objects || [])}
                    - Extracted Text (OCR): ${imageContext.text || 'None'}
                    
                    OPERATIONAL PROTOCOLS:
                    1. Data Integration: The Visual Caption is an approximate visual guess. The OCR Text is the objective truth of what is written. If OCR contains technical terms (e.g., 'ROS 2', 'Actuators'), prioritize identifying the image as a document/article rather than a generic scene or resume.
                    2. Accuracy: Base all answers strictly on the DATA CONTEXT provided. Do not hallucinate objects.
                    3. Professionalism: Maintain a sophisticated, helpful, and concise technical tone.
                    4. Spatial Reasoning: Use object coordinates where available to describe positions.
                    5. Uncertainty: If information is missing, state: "My current scan does not provide data on [item]."
                    
                    EXAMPLE_RESPONSE_TEMPLATES:
                    User: "What's in the image?"
                    AI: "My sensors have processed the scene. Primary identification: [Cognitive Synthesis Result]. I have detected [Count] entities. [Key detail from OCR or Object list]."
                    
                    User: "Is there any text?"
                    AI: "Executing OCR protocol... I have extracted the following text: '[Text]'. No further text detected."

                    Current System Mode: Real-time Analysis.` 
                },
                ...history,
                { role: 'user', content: message }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const answer = response.data.choices[0].message.content;
        
        // Return response immediately
        res.json({ answer });

        // Database archival temporarily disabled
        /*
        if (db) {
            setImmediate(async () => {
                try {
                    await db.collection('chats').add({
                        userId,
                        question: message,
                        answer,
                        timestamp: new Date(),
                        imageContext: {
                            caption: imageContext.caption,
                            objectsCount: imageContext.objects?.length || 0
                        }
                    });
                } catch (dbErr) {
                    console.warn('⚠️ Archival Error:', dbErr.message);
                }
            });
        }
        */
    } catch (error) {
        console.error('❌ Chat Error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Failed' });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('💥 Uncaught Exception:', err);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Critical System Error' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
