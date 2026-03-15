// VisionTalk AI Chatbot - Professional Edition
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Camera, 
  Image as ImageIcon, 
  Send, 
  User, 
  Bot, 
  Loader2, 
  Mic, 
  Volume2, 
  LogOut, 
  MessageSquare, 
  Sun, 
  Moon, 
  Zap, 
  Maximize2, 
  Share2, 
  Info, 
  ChevronDown,
  LayoutDashboard,
  History,
  Settings as SettingsIcon,
  Video,
  BarChart3,
  Search,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  HelpCircle,
  Copy,
  FileJson,
  FileText,
  Download,
  Maximize,
  Languages,
  Terminal,
  Bell,
  Layout,
  GraduationCap,
  BookOpen,
  Lightbulb,
  AlignLeft,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SignIn from './components/SignIn';
import { auth, app } from './firebase.config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';


const db = getFirestore(app);

// Compress image to a small base64 thumbnail for free Firestore storage
const compressImageToBase64 = (file, maxSize = 300, quality = 0.6) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

const App = () => {
  // --- UI State ---
  const [activeView, setActiveView] = useState('analyzer'); // analyzer, dashboard, history, settings, chat, camera
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLightMode, setIsLightMode] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // --- Auth State ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // --- Data State ---
  const [history, setHistory] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // --- Functional State ---
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [firestoreError, setFirestoreError] = useState('');
  const [uploadError, setUploadError] = useState('');
  
  // --- Professional Features State ---
  const [ocrText, setOcrText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('Telugu');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [modelType, setModelType] = useState('VisionTalk-Pro');
  const [inferenceLogs, setInferenceLogs] = useState([]);
  const [smartAnalysis, setSmartAnalysis] = useState({ explanation: '', summary: '', keyPoints: [], questions: [], formatted: '' });
  const [isAnalyzingText, setIsAnalyzingText] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState('explanation');

  const suggestions = [
    "Describe this image",
    "What objects are visible?",
    "Tell me about the colors",
    "Is there any text in the image?",
    "Summarize the scene"
  ];

  const chatEndRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
    if (isLightMode) document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
  }, [isLightMode]);

  useEffect(() => {
    let unsubscribeHistory;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        unsubscribeHistory = fetchHistory(currentUser.uid);
      }
    });
    return () => {
        unsubscribeAuth();
        if (unsubscribeHistory) unsubscribeHistory();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Helpers ---
  const fetchHistory = (uid) => {
    // Try with orderBy first; if composite index is missing, fall back to simple query
    const tryQuery = (withOrder) => {
      const q = withOrder
        ? query(collection(db, "images"), where("userId", "==", uid), orderBy("uploadedAt", "desc"))
        : query(collection(db, "images"), where("userId", "==", uid));

      return onSnapshot(q,
        (snapshot) => {
          setFirestoreError('');
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          // Sort client-side if no orderBy
          if (!withOrder) docs.sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
          setHistory(docs);
        },
        (err) => {
          if (withOrder && err.code === 'failed-precondition') {
            // Missing composite index — retry without orderBy
            console.warn('Firestore index missing, falling back to client-side sort');
            tryQuery(false);
          } else {
            console.error('Firestore read error:', err.code, err.message);
            setFirestoreError(`Firestore read error: ${err.message}`);
          }
        }
      );
    };
    return tryQuery(true);
  };

  const saveToHistory = async (uid, data, imgUrl) => {
    try {
      await addDoc(collection(db, "images"), {
        userId: uid,
        imageUrl: imgUrl,
        caption: data.caption || '',
        objects: (data.objects || []).slice(0, 20), // cap array size
        text: data.text || '',
        uploadedAt: serverTimestamp()
      });
      setFirestoreError('');
      console.log('✅ Saved to Firestore history successfully');
    } catch (err) {
      console.error('❌ Save history error:', err.code, err.message);
      setFirestoreError(`Could not save to history: ${err.message}`);
    }
  };

  const deleteFromHistory = async (id) => {
    try {
      await deleteDoc(doc(db, "images", id));
    } catch (err) {
      console.error("Delete history error:", err);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setSelectedImage(file);
    setImagePreview(localUrl);
    setLoading(true);
    setLoadingStep('Uploading neural segment...');
    setUploadProgress(10);
    setUploadError('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadProgress(30);
      setLoadingStep('Analyzing image (Multimodal AI pipeline)...');
      
      // Dynamic progress increment while waiting for high-compute AI tasks
      const progressTimer = setInterval(() => {
        setUploadProgress(prev => (prev < 58 ? prev + 0.5 : prev));
      }, 800);

      const res = await axios.post('http://127.0.0.1:5000/api/upload', formData, {
        timeout: 120000, 
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Only update if physical upload is still happening (usually fast locally)
          if (percentCompleted < 100) {
            setUploadProgress(10 + (percentCompleted * 0.2));
          }
        }
      });
      clearInterval(progressTimer);
      
      setUploadProgress(60);

      setLoadingStep('Storing image in archive...');

      // Compress image to base64 thumbnail and store directly in Firestore (free, no Storage plan needed)
      let thumbnailUrl = localUrl;
      try {
        thumbnailUrl = await compressImageToBase64(file);
      } catch (compressErr) {
        console.warn('Image compression failed, using local URL:', compressErr);
      }

      setUploadProgress(80);
      setLoadingStep('Contextualizing scene...');
      console.log("📁 Analysis Data Received:", res.data);
      setAnalysis(res.data);
      
      setUploadProgress(90);
      setLoadingStep('Synthesizing report...');
      setMessages([{
        role: 'assistant',
        content: `Analysis complete. ${res.data.synthesis}. How shall we proceed?`
      }]);
      
      if (user) saveToHistory(user.uid, res.data, thumbnailUrl);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      console.error("Upload Error:", err.message);
      
      const serverMsg = err.response?.data?.error;
      setUploadError(serverMsg || err.message || "Failed to analyze image");
      
      setMessages([{ role: 'assistant', content: "Protocol error: Failed to analyze sensor data." }]);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleTranslate = async () => {
    if (!analysis?.text || isTranslating) return;
    setIsTranslating(true);
    addLog(`Initiating translation to ${targetLang}...`);
    
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/chat', {
        message: `Translate the following extracted text into ${targetLang}. Only provide the translation, no extra commentary. Text: "${analysis.text}"`,
        imageContext: {},
        history: []
      });
      setTranslatedText(res.data.answer);
      addNotification(`Translation complete: ${targetLang}`, 'success');
    } catch (err) {
      addNotification("Translation failed", 'error');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSmartAnalysis = async (task) => {
    if (!analysis?.text || isAnalyzingText) return;
    setIsAnalyzingText(true);
    setActiveAnalysisTab(task === 'study-mode' ? 'questions' : task);
    addLog(`Running smart ${task} protocol...`);

    const prompts = {
      explain: `Acting as an expert teacher, explain this text clearly and simply. Text: "${analysis.text}"`,
      summarize: `Summarize this text in one or two concise sentences. Text: "${analysis.text}"`,
      'study-mode': `Analyze this text as educational content. Provide: 1. A summary. 2. Three key points. 3. Three possible study questions. Text: "${analysis.text}"`,
      format: `Clean and format this text for clarity. Use headers and bullet points. Text: "${analysis.text}"`,
      keywords: `Identify the 5 most important keywords or entities from this text. List them separated by commas. Text: "${analysis.text}"`
    };

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/chat', {
        message: prompts[task],
        imageContext: {},
        history: []
      });

      const responseText = res.data.answer;
      
      if (task === 'study-mode') {
        // Simple parsing for study mode (expecting AI to follow some structure)
        const parts = responseText.split('\n\n');
        setSmartAnalysis(prev => ({
          ...prev,
          summary: parts[0] || '',
          keyPoints: parts[1]?.split('\n').map(p => p.replace(/^\d\. |• |- /, '')) || [],
          questions: parts[2]?.split('\n').map(p => p.replace(/^\d\. |• |- /, '')) || []
        }));
      } else if (task === 'keywords') {
        setSmartAnalysis(prev => ({ ...prev, keyPoints: responseText.split(',').map(k => k.trim()) }));
        setActiveAnalysisTab('keyPoints');
      } else {
        setSmartAnalysis(prev => ({
          ...prev,
          [task === 'format' ? 'formatted' : task]: responseText
        }));
      }

      addNotification(`Analysis complete: ${task}`, 'success');
    } catch (err) {
      addNotification(`Analysis failed: ${task}`, 'error');
    } finally {
      setIsAnalyzingText(false);
    }
  };

  const addNotification = (msg, type = 'info') => {
    const newNote = { id: Date.now(), msg, type, time: new Date().toLocaleTimeString() };
    setNotifications(prev => [newNote, ...prev].slice(0, 5));
    if (type === 'success') {
       // Auto-hide in some cases?
    }
  };

  const addLog = (msg) => {
    setInferenceLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addNotification("Copied to clipboard", 'success');
  };

  const downloadReport = (format) => {
     if (!analysis) return;
     const reportData = {
        scanId: Date.now(),
        timestamp: new Date().toISOString(),
        model: modelType,
        results: analysis
     };
     
     const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `VisionTalk_Report_${reportData.scanId}.json`;
     a.click();
     addNotification("Report generated", 'success');
  };

  const handleSendMessage = async (e, customMessage = null, shouldSpeak = false) => {
    if (e) e.preventDefault();
    const messageToSend = customMessage || input;
    if (!messageToSend.trim()) return;

    const userMessage = { role: 'user', content: messageToSend, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/chat', {
        message: messageToSend,
        imageContext: analysis || {},
        history: messages.slice(-5)
      });

      const aiResponse = { 
        role: 'assistant', 
        content: res.data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiResponse]);
      if (shouldSpeak) speak(res.data.answer);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Neural link timeout. Please retransmit." }]);
    } finally {
      setLoading(false);
    }
  };

  const getScaledBbox = (bbox) => {
    if (!imageRef.current) return { left: 0, top: 0, width: 0, height: 0 };
    const { clientWidth, clientHeight } = imageRef.current;
    return {
      left: bbox[0] * clientWidth,
      top: bbox[1] * clientHeight,
      width: (bbox[2] - bbox[0]) * clientWidth,
      height: (bbox[3] - bbox[1]) * clientHeight
    };
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Sensor unavailable.");
    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSendMessage(null, transcript, true);
    };
    recognition.start();
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleCamera = async () => {
    if (isCameraOpen) {
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      setIsCameraOpen(false);
    } else {
      try {
        // Get stream first, THEN mount so videoRef is ready
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setIsCameraOpen(true);
        // Wait one tick for React to render the <video> element before assigning srcObject
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }, 50);
      } catch (err) {
        console.error('Camera access denied:', err);
        setIsCameraOpen(false);
      }
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      handleImageUpload(file);
      toggleCamera();
      setActiveView('analyzer');
    }, 'image/jpeg');
  };

  const handleLogout = () => signOut(auth);

  if (authLoading) return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center flex-col gap-6">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
        <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary-500" />
      </div>
      <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Initializing VisionTalk Core...</p>
    </div>
  );

  if (!user) return <SignIn />;

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'analyzer', icon: ImageIcon, label: 'Image Analyzer' },
    { id: 'chat', icon: MessageSquare, label: 'AI Chat' },
    { id: 'camera', icon: Video, label: 'Camera Mode' },
    { id: 'insights', icon: BarChart3, label: 'Insights' },
    { id: 'history', icon: History, label: 'History' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="flex bg-[var(--bg-main)] text-[var(--text-primary)] min-h-screen font-sans selection:bg-primary-500/30">
      
      {/* --- Sidebar --- */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-20'} border-r border-[var(--border)] bg-[var(--bg-side)] transition-all duration-300 flex flex-col h-screen fixed z-[100]`}>
        <div className="p-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          {isSidebarOpen && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl font-bold tracking-tight">VisionTalk</motion.span>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                if (item.id === 'camera' && !isCameraOpen) toggleCamera();
              }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                activeView === item.id 
                ? 'bg-primary-600/10 text-primary-400 border border-primary-600/20' 
                : 'hover:bg-white/5 text-slate-400'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeView === item.id ? 'stroke-[2.5px]' : ''}`} />
              {isSidebarOpen && <span className="font-semibold text-sm">{item.label}</span>}
              {activeView === item.id && isSidebarOpen && (
                <motion.div layoutId="active" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(108,99,255,0.6)]" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--border)]">
             <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="w-full h-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-colors text-slate-500"
             >
                <ChevronDown className={`w-5 h-5 transition-transform ${isSidebarOpen ? 'rotate-90' : '-rotate-90'}`} />
             </button>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className={`flex-1 ${isSidebarOpen ? 'ml-72' : 'ml-20'} transition-all duration-300 flex flex-col h-screen relative scrollbar-hide overflow-y-auto`}>
        
        {/* --- Top Bar --- */}
        <header className="h-20 border-b border-[var(--border)] flex items-center justify-between px-8 bg-[var(--bg-main)]/80 backdrop-blur-md sticky top-0 z-[90]">
          <div>
            <h2 className="font-bold text-lg capitalize">{activeView.replace('-', ' ')}</h2>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">System Active</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-2 gap-3 w-80">
                <Search className="w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Search insights..." className="bg-transparent border-none outline-none text-xs w-full" />
            </div>

            <button onClick={() => setIsLightMode(!isLightMode)} className="p-2.5 rounded-xl hover:bg-white/5 transition-colors text-slate-400">
               {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <div className="relative">
               <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 rounded-xl hover:bg-white/5 transition-colors text-slate-400 relative">
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full border-2 border-[var(--bg-main)]" />}
               </button>
               <AnimatePresence>
                  {showNotifications && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-14 right-0 w-80 bg-[var(--card-bg)] border border-[var(--border)] rounded-3xl p-4 shadow-2xl z-[110] backdrop-blur-xl">
                       <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 px-2">Notifications</h5>
                       <div className="space-y-2">
                          {notifications.map(n => (
                            <div key={n.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex gap-3 items-start">
                               <div className={`w-2 h-2 rounded-full mt-1.5 ${n.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                               <div>
                                  <p className="text-xs font-medium">{n.msg}</p>
                                  <p className="text-[10px] text-slate-500 mt-1">{n.time}</p>
                               </div>
                            </div>
                          ))}
                          {notifications.length === 0 && <p className="text-center py-8 text-xs text-slate-500">No new alerts</p>}
                       </div>
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 p-1.5 rounded-full border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary-600/20 flex items-center justify-center overflow-hidden">
                  {user.photoURL ? <img src={user.photoURL} alt="" /> : <span className="font-bold text-sm">{user.email[0].toUpperCase()}</span>}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-14 right-0 w-60 bg-[var(--card-bg)] border border-[var(--border)] rounded-3xl p-3 shadow-2xl z-[101] backdrop-blur-xl"
                  >
                    <div className="p-3 border-b border-[var(--border)] mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Connected Account</p>
                        <p className="text-sm font-bold truncate">{user.email}</p>
                    </div>
                    <div className="space-y-1">
                      <button 
                        onClick={() => { setActiveView('settings'); setShowProfileMenu(false); }}
                        className="w-full p-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors text-sm font-medium"
                      >
                        <User className="w-4 h-4 text-primary-400" /> System Settings
                      </button>
                      <button 
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full p-2.5 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors text-sm font-medium"
                      >
                        <Sparkles className="w-4 h-4 text-yellow-500" /> Upgrade Plan
                      </button>
                      <button onClick={handleLogout} className="w-full p-2.5 hover:bg-red-500/10 rounded-xl flex items-center gap-3 transition-colors text-sm font-bold text-red-400">
                        <LogOut className="w-4 h-4" /> Disconnect
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* --- Dynamic Body --- */}
        <div className="p-8 pb-20">
           <AnimatePresence mode="wait">
             
             {/* --- VIEW: Dashboard --- */}
             {activeView === 'dashboard' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: 'Scans Performed', val: history.length, icon: ImageIcon, color: 'text-primary-500' },
                        { label: 'Objects Identified', val: history.reduce((acc, h) => acc + (h.objects?.length || 0), 0), icon: Zap, color: 'text-yellow-500' },
                        { label: 'AI Queries', val: '1.2k', icon: Sparkles, color: 'text-green-500' },
                        { label: 'Active Sessions', val: 1, icon: User, color: 'text-indigo-500' },
                      ].map((stat, i) => (
                        <div key={i} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                              <stat.icon className="w-16 h-16" />
                           </div>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                           <h3 className="text-3xl font-black">{stat.val}</h3>
                           <div className="mt-4 flex items-center gap-2">
                              <div className={`px-1.5 py-0.5 rounded-lg bg-green-500/10 text-green-500 text-[10px] font-bold`}>+12.5%</div>
                              <span className="text-[10px] text-slate-600 font-bold">vs last week</span>
                           </div>
                        </div>
                      ))}
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[2.5rem] p-8 h-96 flex flex-col">
                         <div className="flex justify-between items-center mb-10">
                            <h4 className="font-bold flex items-center gap-3"><BarChart3 className="w-5 h-5 text-primary-500" /> System Processing Load</h4>
                            <select className="bg-white/5 border border-white/10 rounded-xl text-xs px-3 py-1.5 outline-none font-bold">
                               <option>Last 30 Days</option>
                               <option>Last 7 Days</option>
                            </select>
                         </div>
                         <div className="flex-1 flex items-end justify-between gap-4">
                            {[40, 70, 45, 90, 65, 80, 50, 85, 95, 100, 75, 40].map((h, i) => (
                               <motion.div 
                                 key={i} 
                                 initial={{ height: 0 }} 
                                 animate={{ height: `${h}%` }} 
                                 className="flex-1 bg-gradient-to-t from-primary-600/20 to-primary-500 rounded-t-lg relative group"
                               >
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">{h}%</div>
                               </motion.div>
                            ))}
                         </div>
                      </div>

                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[2.5rem] p-8 h-96 overflow-hidden flex flex-col">
                         <h4 className="font-bold mb-6 flex items-center gap-3"><Clock className="w-5 h-5 text-indigo-500" /> Recent Activity</h4>
                         <div className="space-y-4 overflow-y-auto no-scrollbar">
                           {history.slice(0, 5).map((h, i) => (
                             <div key={i} className="flex items-center gap-4 p-4 rounded-3xl bg-white/5 hover:bg-white/[0.08] transition-all cursor-pointer group">
                                <img src={h.imageUrl} className="w-12 h-12 rounded-2xl object-cover" alt="" />
                                <div className="flex-1">
                                   <p className="font-bold text-sm truncate">{h.caption}</p>
                                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Detected {h.objects?.length || 0} Entities</p>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-700 -rotate-90 group-hover:text-primary-500" />
                             </div>
                           ))}
                         </div>
                      </div>
                   </div>
                </motion.div>
             )}

             {/* --- VIEW: Analyzer --- */}
             {activeView === 'analyzer' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
                   <div className="space-y-8">
                      {/* Drag & Drop Area */}
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleImageUpload(e.dataTransfer.files[0]);
                        }}
                        className={`bg-[var(--card-bg)] border-2 border-dashed ${selectedImage ? 'border-primary-500/50' : 'border-[var(--border)]'} rounded-[3rem] min-h-[550px] flex flex-col items-center justify-center p-8 transition-all relative overflow-hidden group`}
                      >
                         <AnimatePresence mode="wait">
                          {isCameraOpen ? (
                             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full absolute inset-0">
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10">
                                   <button onClick={toggleCamera} className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500 transition-colors">
                                      <Trash2 className="w-5 h-5" />
                                   </button>
                                   <button onClick={captureImage} className="w-20 h-20 rounded-full border-[6px] border-white/20 p-1 group">
                                      <div className="w-full h-full rounded-full bg-white transition-transform group-active:scale-95" />
                                   </button>
                                   <div className="w-12 h-12 invisible" />
                                </div>
                             </motion.div>
                          ) : imagePreview ? (
                             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full relative flex flex-col items-center justify-center">
                                {uploadError && (
                                    <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-2 rounded-xl mb-4 text-xs font-bold text-center">
                                      Upload Failed: {uploadError}
                                    </div>
                                 )}
                                <img ref={imageRef} src={imagePreview} className="max-w-full max-h-[500px] rounded-3xl shadow-2xl" alt="Analysis Preview" />
                                {analysis?.objects?.map((obj, i) => {
                                  const s = getScaledBbox(obj.bbox);
                                  return (
                                    <motion.div 
                                      key={i} 
                                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                                      className="absolute border-2 border-primary-500 bg-primary-500/10 rounded flex items-end justify-center group/box hover:bg-primary-500/30 transition-all pointer-events-none"
                                      style={{ left: `calc(50% - ${(imageRef.current?.clientWidth || 0)/2}px + ${s.left}px)`, top: `calc(50% - ${(imageRef.current?.clientHeight || 0)/2}px + ${s.top}px)`, width: s.width, height: s.height }}
                                    >
                                      <div className="bg-primary-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-t translate-y-full opacity-0 group-hover/box:opacity-100 transition-opacity">
                                        {obj.label} {(obj.confidence*100).toFixed(0)}%
                                      </div>
                                    </motion.div>
                                  )
                                })}
                                <button onClick={() => { setImagePreview(null); setSelectedImage(null); setAnalysis(null); }} className="absolute top-4 right-4 p-3 bg-red-500/80 backdrop-blur-md rounded-2xl text-white opacity-0 group-hover:opacity-100 transition-all">
                                   <Trash2 className="w-5 h-5" />
                                </button>
                             </motion.div>
                           ) : (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center group-hover:scale-105 transition-transform">
                                <div className="w-24 h-24 bg-primary-600/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-primary-600/20 rotate-12 group-hover:rotate-0 transition-all">
                                   <ImageIcon className="w-10 h-10 text-primary-500" />
                                </div>
                                <h3 className="text-2xl font-black mb-3 text-[var(--text-primary)]">Image Analysis Hub</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto mb-10 leading-relaxed font-medium">Drag & drop your visual data here or browse local folders.</p>
                                <div className="flex gap-4 justify-center">
                                  <label className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl shadow-primary-600/40 cursor-pointer transition-all flex items-center gap-3">
                                     <Plus className="w-5 h-5" /> Browse Files
                                     <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e.target.files[0])} />
                                  </label>
                                  <button onClick={toggleCamera} className="bg-white/5 hover:bg-white/10 text-[var(--text-primary)] px-8 py-4 rounded-2xl font-bold border border-[var(--border)] transition-all">
                                     Live Capture
                                  </button>
                                </div>
                                 <p className="mt-8 text-[10px] text-slate-700 font-bold uppercase tracking-widest">VisionTalk-AI-Engine Optimized (Max 10MB)</p>
                              </motion.div>
                           )}
                        </AnimatePresence>

                        {/* AI Model Status Overlays */}
                        {!imagePreview && !isCameraOpen && (
                           <div className="absolute top-10 right-10 flex flex-col gap-3">
                              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-green-500" />
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">AI Inference Engine</p>
                                    <p className="text-xs font-black">Online / 42ms Latency</p>
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* Improved Control Bar */}
                        {imagePreview && !loadingStep && (
                           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 z-10 transition-all hover:bg-black/80">
                              <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 3))} className="p-3 hover:bg-white/10 rounded-xl text-white transition-all"><Maximize className="w-4 h-4" /></button>
                              <div className="h-4 w-[1px] bg-white/10 mx-1" />
                              <div className="flex items-center bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                                 <Languages className="w-4 h-4 text-primary-400 mr-2" />
                                 <select 
                                   value={targetLang}
                                   onChange={(e) => setTargetLang(e.target.value)}
                                   className="bg-transparent text-xs font-bold outline-none text-white cursor-pointer"
                                 >
                                   <option className="bg-slate-900" value="Telugu">Telugu</option>
                                   <option className="bg-slate-900" value="Hindi">Hindi</option>
                                   <option className="bg-slate-900" value="Spanish">Spanish</option>
                                   <option className="bg-slate-900" value="French">French</option>
                                 </select>
                              </div>
                              <button 
                                onClick={handleTranslate} 
                                disabled={isTranslating}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                              >
                                {isTranslating ? 'Translating...' : 'Translate OCR'}
                              </button>
                              <div className="h-4 w-[1px] bg-white/10 mx-1" />
                              <button onClick={() => downloadReport('json')} className="p-3 hover:bg-white/10 rounded-xl text-white transition-all"><Download className="w-4 h-4" /></button>
                           </div>
                        ) }

                         {loadingStep && (
                            <div className="absolute inset-0 bg-[var(--bg-main)]/90 backdrop-blur-xl flex flex-col items-center justify-center z-[200]">
                               <div className="w-64 bg-white/5 h-1.5 rounded-full mb-8 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} className="h-full bg-primary-500 shadow-[0_0_15px_rgba(108,99,255,0.8)]" />
                               </div>
                               <p className="text-white font-bold text-lg tracking-tight mb-2 animate-pulse">{loadingStep}</p>
                               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{uploadProgress.toFixed(0)}% Complete</p>
                            </div>
                         )}
                      </div>

                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[2.5rem] p-8">
                         <h4 className="font-bold flex items-center gap-3 mb-8"><Sparkles className="w-5 h-5 text-yellow-500" /> AI Insights Dashboard</h4>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div>
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Analysis Confidence</p>
                               <div className="relative w-32 h-32 mx-auto">
                                  <svg className="w-full h-full" viewBox="0 0 36 36">
                                    <path className="text-white/5 stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <motion.path 
                                      initial={{ strokeDasharray: "0, 100" }} 
                                      animate={{ strokeDasharray: `${analysis ? 92 : 0}, 100` }} 
                                      className="text-primary-500 stroke-current text-primary-500" 
                                      strokeWidth="3" 
                                      strokeLinecap="round" 
                                      fill="none" 
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                                     <span className="text-2xl font-black">{analysis ? '92%' : '0%'}</span>
                                     <span className="text-[8px] font-bold text-slate-500 uppercase">Optimized</span>
                                  </div>
                               </div>
                            </div>
                            <div className="md:col-span-2 space-y-6">
                               <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
                                  <div className="flex justify-between items-center mb-3">
                                     <span className="text-xs font-bold text-slate-400">Context Identification</span>
                                     <span className="text-xs font-black text-primary-500">{analysis ? 'Office/Workspace' : 'N/A'}</span>
                                  </div>
                                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                     <div className="w-[85%] h-full bg-primary-500" />
                                  </div>
                               </div>
                               <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
                                  <div className="flex justify-between items-center mb-3">
                                     <span className="text-xs font-bold text-slate-400">Semantic Parsing</span>
                                     <span className="text-xs font-black text-green-500">Success</span>
                                  </div>
                                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                     <div className="w-[98%] h-full bg-green-500" />
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Right Side Info */}
                   <aside className="space-y-8">
                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[2.5rem] p-8">
                        <h4 className="font-bold flex items-center gap-3 mb-8"><Search className="w-5 h-5 text-primary-500" /> Identified Entities</h4>
                        {analysis?.objects?.length > 0 ? (
                           <div className="space-y-3">
                              {analysis.objects.slice(0, 6).map((obj, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 group hover:bg-primary-500/10 hover:border-primary-500/20 transition-all">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-500 font-bold text-[10px]">#{i+1}</div>
                                      <span className="font-bold text-sm uppercase tracking-tight">{obj.label}</span>
                                   </div>
                                   <span className="text-xs font-black text-green-500">{(obj.confidence*100).toFixed(0)}%</span>
                                </div>
                              ))}
                              {analysis.objects.length > 6 && (
                                <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-4">+{analysis.objects.length - 6} more detections</p>
                              )}
                           </div>
                        ) : (
                           <div className="py-20 text-center opacity-30">
                              <Bot className="w-12 h-12 mx-auto mb-4" />
                              <p className="text-xs font-bold uppercase tracking-widest">No Active Scan</p>
                           </div>
                        )}
                      </div>

                       <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[2.5rem] p-8 relative overflow-hidden">
                          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl" />
                          <h4 className="font-bold mb-6 flex items-center gap-3"><FileText className="w-5 h-5 text-indigo-500" /> Smart Text Analysis</h4>
                          
                          {analysis?.text ? (
                             <div className="space-y-6">
                                {/* Ground Truth Text */}
                                <div className="p-5 bg-black/20 rounded-3xl border border-white/5 relative group">
                                   <div className="flex justify-between items-center mb-2">
                                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detected Text</p>
                                      <div className="flex gap-2">
                                         <button onClick={() => copyToClipboard(analysis.text)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500"><Copy className="w-3.5 h-3.5" /></button>
                                      </div>
                                   </div>
                                   <div className="max-h-60 overflow-y-auto no-scrollbar">
                                      <p className="text-xs leading-relaxed text-slate-300 font-medium whitespace-pre-line">{analysis.text}</p>
                                   </div>
                                </div>

                                {/* Quick AI Actions */}
                                <div className="grid grid-cols-2 gap-2">
                                   {[
                                      { id: 'explain', label: 'Explain', icon: GraduationCap, color: 'text-blue-400' },
                                      { id: 'summarize', label: 'Summarize', icon: AlignLeft, color: 'text-green-400' },
                                      { id: 'study-mode', label: 'Study Mode', icon: BookOpen, color: 'text-purple-400' },
                                      { id: 'keywords', label: 'Highlight', icon: Lightbulb, color: 'text-yellow-400' }
                                   ].map(btn => (
                                      <button 
                                        key={btn.id}
                                        onClick={() => handleSmartAnalysis(btn.id)}
                                        disabled={isAnalyzingText}
                                        className="flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-primary-600/10 border border-white/5 rounded-xl text-[10px] font-bold transition-all hover:border-primary-500/30 group"
                                      >
                                         <btn.icon className={`w-3.5 h-3.5 ${btn.color} group-hover:scale-110 transition-transform`} />
                                         {btn.label}
                                      </button>
                                   ))}
                                </div>

                                {/* AI Output Panel */}
                                {(isAnalyzingText || smartAnalysis.explanation || smartAnalysis.summary || smartAnalysis.questions.length > 0) && (
                                   <div className="pt-4 border-t border-white/5">
                                      {isAnalyzingText ? (
                                         <div className="py-8 flex flex-col items-center justify-center gap-4">
                                            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] animate-pulse">Processing Neural Context...</p>
                                         </div>
                                      ) : (
                                         <div className="space-y-4">
                                            {/* Tabs */}
                                            <div className="flex gap-4 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
                                               {['explanation', 'summary', 'questions', 'keyPoints', 'translation'].map(tab => (
                                                  (tab === 'explanation' && smartAnalysis.explanation) || 
                                                  (tab === 'summary' && smartAnalysis.summary) || 
                                                  (tab === 'questions' && smartAnalysis.questions.length > 0) ||
                                                  (tab === 'keyPoints' && smartAnalysis.keyPoints.length > 0) ||
                                                  (tab === 'translation' && translatedText) ? (
                                                     <button 
                                                       key={tab}
                                                       onClick={() => setActiveAnalysisTab(tab)}
                                                       className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap pb-1 transition-all ${activeAnalysisTab === tab ? 'text-primary-500 border-b border-primary-500' : 'text-slate-600'}`}
                                                     >
                                                        {tab}
                                                     </button>
                                                  ) : null
                                               ))}
                                            </div>

                                            {/* Tab Content */}
                                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="min-h-[100px]">
                                               {activeAnalysisTab === 'explanation' && <p className="text-xs leading-relaxed text-slate-300 italic">"{smartAnalysis.explanation}"</p>}
                                               {activeAnalysisTab === 'summary' && <p className="text-xs leading-relaxed text-slate-300 font-bold border-l-2 border-green-500 pl-4 bg-green-500/5 py-2 rounded-r-xl">{smartAnalysis.summary}</p>}
                                               {activeAnalysisTab === 'questions' && (
                                                  <div className="space-y-2">
                                                     {smartAnalysis.questions.map((q, i) => (
                                                        <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 text-[10px] font-medium flex gap-3">
                                                           <span className="text-primary-500 font-bold">Q{i+1}:</span> {q}
                                                        </div>
                                                     ))}
                                                  </div>
                                               )}
                                               {activeAnalysisTab === 'keyPoints' && (
                                                  <div className="flex flex-wrap gap-2">
                                                     {smartAnalysis.keyPoints.map((p, i) => (
                                                        <div key={i} className="px-3 py-1.5 bg-primary-500/10 border border-primary-500/20 rounded-lg text-[9px] font-bold text-primary-400">
                                                           {p}
                                                        </div>
                                                     ))}
                                                  </div>
                                               )}
                                               {activeAnalysisTab === 'translation' && (
                                                  <div className="p-4 bg-primary-500/5 rounded-2xl border border-primary-500/10">
                                                     <div className="flex justify-between mb-2">
                                                        <p className="text-[10px] font-black text-primary-400 uppercase tracking-tighter">{targetLang} Version</p>
                                                     </div>
                                                     <p className="text-xs leading-relaxed text-slate-200">{translatedText}</p>
                                                  </div>
                                               )}
                                            </motion.div>
                                         </div>
                                      )}
                                   </div>
                                )}
                             </div>
                          ) : (
                             <div className="py-12 text-center opacity-30 border-2 border-dashed border-white/10 rounded-[2rem]">
                                <Terminal className="w-10 h-10 mx-auto mb-3" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">No Text Detected</p>
                             </div>
                          )}
                       </div>

                       <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[2.5rem] p-8">
                          <h4 className="font-bold mb-6 flex items-center gap-3"><Terminal className="w-5 h-5 text-green-500" /> Inference Console</h4>
                          <div className="bg-black/40 rounded-3xl p-5 border border-white/5 font-mono">
                             <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                {inferenceLogs.length > 0 ? inferenceLogs.map((log, i) => (
                                   <p key={i} className="text-[10px] text-green-400 opacity-80 animate-in fade-in slide-in-from-left-2">{log}</p>
                                )) : (
                                   <p className="text-[10px] text-slate-600">Waiting for sensor input...</p>
                                )}
                             </div>
                          </div>
                       </div>
                   </aside>
                </motion.div>
             )}

             {/* --- VIEW: Chat --- */}
             {activeView === 'chat' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-5xl mx-auto h-[calc(100vh-200px)] flex flex-col bg-[var(--card-bg)] rounded-[3rem] border border-[var(--border)] shadow-2xl overflow-hidden overflow-y-auto">
                    <div className="p-6 border-b border-[var(--border)] bg-white/[0.02] flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center shadow-2xl relative">
                             <Bot className="w-6 h-6 text-white" />
                             <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-[#1B2235] rounded-full" />
                          </div>
                          <div>
                             <h4 className="font-black">VisionTalk AI</h4>
                             <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">System Online</p>
                          </div>
                       </div>
                       <button className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                          <Share2 className="w-5 h-5" />
                       </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar scroll-smooth">
                       {messages.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto opacity-30">
                             <MessageSquare className="w-16 h-16 mb-6" />
                             <h3 className="text-xl font-bold mb-3">Begin AI Analysis</h3>
                             <p className="text-sm">Initiate a query regarding visual data or environmental context for analysis.</p>
                          </div>
                       )}
                       {messages.map((msg, i) => (
                          <motion.div 
                            key={i} 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                          >
                             <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-primary-600'}`}>
                                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                             </div>
                             <div className="space-y-2 max-w-[80%]">
                                <div className={`p-5 rounded-[2rem] text-sm leading-relaxed ${
                                  msg.role === 'user' 
                                  ? 'bg-indigo-600 text-white rounded-tr-none shadow-xl' 
                                  : 'bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-none shadow-inner'
                                }`}>
                                   {msg.content}
                                </div>
                                <p className={`text-[8px] font-bold text-slate-600 uppercase tracking-widest ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                   {msg.timestamp || 'Just now'} • {msg.role === 'user' ? user.email?.split('@')[0] : 'VISIONTALK-AI'}
                                </p>
                             </div>
                          </motion.div>
                       ))}
                       {loading && (
                          <div className="flex gap-4">
                             <div className="w-10 h-10 rounded-2xl bg-primary-600 flex items-center justify-center animate-pulse">
                                <Bot className="w-5 h-5 text-white" />
                             </div>
                             <div className="p-5 rounded-[2rem] rounded-tl-none bg-[var(--card-bg)] border border-[var(--border)] flex items-center gap-3">
                                <div className="flex gap-1.5">
                                   <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                   <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                   <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" />
                                </div>
                             </div>
                          </div>
                       )}
                       <div ref={chatEndRef} />
                    </div>

                    <div className="p-8 border-t border-[var(--border)] bg-white/[0.01]">
                       {!loading && messages.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
                             {suggestions.map((s, i) => (
                               <button key={i} onClick={() => handleSendMessage(null, s)} className="whitespace-nowrap px-4 py-2 rounded-full border border-white/10 hover:border-primary-500/50 hover:bg-primary-500/10 text-xs font-bold text-slate-400 hover:text-primary-400 transition-all active:scale-95">
                                  {s}
                               </button>
                             ))}
                          </div>
                       )}
                       <form onSubmit={handleSendMessage} className="flex gap-4">
                          <button 
                             type="button" 
                             onClick={startListening} 
                             className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400'}`}
                          >
                             <Mic className={`w-6 h-6 ${isListening ? 'animate-pulse' : ''}`} />
                          </button>
                          <div className="flex-1 relative">
                             <input 
                               value={input} 
                               onChange={(e) => setInput(e.target.value)} 
                               placeholder="Inquire visual data..." 
                               className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm shadow-inner" 
                             />
                          </div>
                          <button type="submit" disabled={!input.trim() || loading} className="w-14 h-14 bg-primary-600 hover:bg-primary-500 rounded-2xl text-white shadow-2xl flex items-center justify-center disabled:opacity-50 transition-all active:scale-95">
                             <Send className="w-6 h-6" />
                          </button>
                       </form>
                    </div>
                </motion.div>
             )}

             {/* --- VIEW: History --- */}
             {activeView === 'history' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                   <div className="flex justify-between items-center bg-[var(--card-bg)] p-8 rounded-[2.5rem] border border-[var(--border)]">
                      <div>
                         <h3 className="text-2xl font-black">Analysis History</h3>
                         <p className="text-sm text-slate-500 font-medium">Accessing previously analyzed images and data files.</p>
                      </div>
                      <div className="flex gap-4">
                         <div className="bg-white/5 rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-3">
                            <Clock className="w-4 h-4 text-primary-500" />
                            <span className="text-xs font-bold">{history.length} Saved States</span>
                         </div>
                      </div>
                   </div>

                   {firestoreError && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center gap-4 text-red-500"
                      >
                         <Info className="w-6 h-6 shrink-0" />
                         <div>
                            <p className="font-bold text-sm">System Protocol Alert</p>
                            <p className="text-xs opacity-80">{firestoreError}</p>
                         </div>
                         <button 
                            onClick={() => fetchHistory(user.uid)} 
                            className="ml-auto px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-colors"
                         >
                            Retry Sync
                         </button>
                      </motion.div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {history.map((h, i) => (
                        <motion.div 
                          key={h.id} 
                          initial={{ opacity: 0, scale: 0.9 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          transition={{ delay: i * 0.05 }}
                          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[2rem] overflow-hidden group hover:border-primary-500/30 transition-all hover:scale-[1.02]"
                        >
                           <div className="h-48 relative overflow-hidden">
                              <img src={h.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" alt="" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                 <button onClick={() => { setImagePreview(h.imageUrl); setAnalysis(h); setActiveView('analyzer'); }} className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold shadow-2xl">
                                    Restore Query
                                 </button>
                              </div>
                              <button onClick={() => deleteFromHistory(h.id)} className="absolute top-3 right-3 p-2 bg-red-500/80 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                           <div className="p-6">
                              <p className="font-bold text-sm truncate mb-2">{h.caption}</p>
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    <span className="text-[10px] font-black uppercase text-slate-500">Processed</span>
                                 </div>
                                 <span className="text-[10px] font-bold text-slate-600">{new Date(h.uploadedAt?.seconds * 1000).toLocaleDateString()}</span>
                              </div>
                           </div>
                        </motion.div>
                      ))}
                      {history.length === 0 && (
                        <div className="col-span-full py-20 text-center opacity-30">
                           <History className="w-20 h-20 mx-auto mb-6" />
                           <h3 className="text-xl font-bold">No Records Found</h3>
                        </div>
                      )}
                   </div>
                </motion.div>
             )}

             {/* --- VIEW: Insights --- */}
             {activeView === 'insights' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                   <div className="bg-[var(--card-bg)] p-10 rounded-[3rem] border border-[var(--border)] relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 via-indigo-400 to-green-400" />
                      <div className="flex justify-between items-start mb-16">
                         <div className="space-y-2">
                             <h3 className="text-3xl font-black">AI Performance Metrics</h3>
                             <p className="text-slate-500 font-medium">Detailed analysis of system interactions and object identification accuracy.</p>
                         </div>
                         <button className="px-6 py-3 bg-primary-600 text-white rounded-2xl font-bold shadow-2xl shadow-primary-600/30">Download PDF Report</button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                         <div className="space-y-8">
                             <div>
                                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 border-l-2 border-primary-500 pl-4">Identification Accuracy</h5>
                                <div className="space-y-6">
                                   {[
                                      { label: 'YOLOv8 Engine', val: 94 },
                                      { label: 'DeepCaption V4', val: 88 },
                                      { label: 'OCR Extraction', val: 97 },
                                   ].map((item, i) => (
                                      <div key={i} className="space-y-2">
                                         <div className="flex justify-between text-xs font-bold">
                                            <span>{item.label}</span>
                                            <span className="text-primary-400">{item.val}%</span>
                                         </div>
                                         <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${item.val}%` }} className="h-full bg-primary-500" />
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                         </div>

                         <div className="md:col-span-2">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-10 text-center">Entity Frequency Heatmap</h5>
                            <div className="flex items-end justify-center gap-4 h-64 border-b border-[var(--border)] px-10">
                               {[10, 20, 30, 15, 45, 60, 55, 80, 40, 25].map((v, i) => (
                                  <div key={i} className="flex-1 space-y-3 flex flex-col items-center">
                                     <motion.div 
                                       initial={{ height: 0 }} 
                                       animate={{ height: `${v}%` }} 
                                       className={`w-full rounded-t-xl transition-all ${v > 50 ? 'bg-primary-500' : 'bg-white/10'}`} 
                                     />
                                     <span className="text-[8px] font-bold text-slate-600 uppercase">Seg-{i}</span>
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                </motion.div>
             )}

              {/* --- VIEW: Camera --- */}
              {activeView === 'camera' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-[80vh]">
                  <div className="w-full max-w-4xl bg-[var(--card-bg)] border border-[var(--border)] rounded-[3rem] overflow-hidden shadow-2xl relative">
                    <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-bold uppercase tracking-widest text-xs">Live Camera Feed</span>
                      </div>
                      <button
                        onClick={() => { toggleCamera(); setActiveView('analyzer'); }}
                        className="px-5 py-2 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-all"
                      >
                        Close Camera
                      </button>
                    </div>

                    <div className="relative w-full bg-black" style={{ minHeight: '500px' }}>
                      {isCameraOpen ? (
                        <>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-auto object-contain"
                            style={{ display: 'block', minHeight: '500px', maxHeight: '600px' }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70 pointer-events-none" />
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10">
                            <button
                              onClick={captureImage}
                              className="w-20 h-20 rounded-full border-[6px] border-white/30 p-1 group hover:border-white/60 transition-all"
                            >
                              <div className="w-full h-full rounded-full bg-white transition-transform group-active:scale-90" />
                            </button>
                          </div>
                          <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500/80 backdrop-blur-md rounded-xl flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-white text-[10px] font-bold uppercase tracking-widest">REC</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center" style={{ minHeight: '500px' }}>
                          <div className="w-24 h-24 bg-primary-600/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-primary-600/20">
                            <Camera className="w-10 h-10 text-primary-500" />
                          </div>
                          <p className="text-slate-400 font-bold mb-6">Camera is initializing...</p>
                          <button
                            onClick={toggleCamera}
                            className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl shadow-primary-600/40 transition-all"
                          >
                            Start Camera
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-6 border-t border-[var(--border)] flex items-center justify-between">
                      <p className="text-xs text-slate-500 font-medium">Click the white circle to capture and analyze the image.</p>
                      <button
                        onClick={captureImage}
                        disabled={!isCameraOpen}
                        className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl font-bold shadow-xl disabled:opacity-30 transition-all"
                      >
                        Capture &amp; Analyze
                      </button>
                    </div>
                  </div>
                </motion.div>
             )}

             {/* --- VIEW: Settings --- */}
             {activeView === 'settings' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-8">
                   <div className="bg-[var(--card-bg)] rounded-[3rem] border border-[var(--border)] overflow-hidden">
                      <div className="p-10 border-b border-[var(--border)] flex gap-8 items-center">
                        <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center text-4xl font-black relative group">
                           {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover rounded-[2.5rem]" alt="" /> : user.email[0].toUpperCase()}
                           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2.5rem] cursor-pointer">
                              <Camera className="w-8 h-8 text-white" />
                           </div>
                        </div>
                        <div className="space-y-1">
                           <h3 className="text-3xl font-black">{user.displayName || 'Authorized User'}</h3>
                           <p className="text-slate-500 font-medium">{user.email}</p>
                           <div className="pt-4 flex gap-3">
                              <span className="px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-[10px] font-bold text-primary-400 uppercase tracking-widest">Premium Entity</span>
                              <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-500 uppercase tracking-widest">Active</span>
                           </div>
                        </div>
                      </div>

                      <div className="p-10 space-y-12">
                         <section>
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">System Configuration</h4>
                            <div className="space-y-4">
                               {[
                                 { label: 'Real-time Object Detection', desc: 'Run AI analysis on every uploaded image.', active: true, toggle: null },
                                 { label: 'Voice Feedback Synthesis', desc: 'AI responses will be processed into audio streams.', active: isSpeaking, toggle: () => setIsSpeaking(!isSpeaking) },
                                 { label: 'History Archival', desc: 'Automatically store all results in the analysis history.', active: true, toggle: null },
                               ].map((cfg, i) => (
                                 <div key={i} className="flex justify-between items-center p-5 rounded-3xl bg-white/5 border border-[var(--border)]">
                                    <div>
                                       <p className="font-bold text-sm">{cfg.label}</p>
                                       <p className="text-xs text-slate-500">{cfg.desc}</p>
                                    </div>
                                    <div 
                                      onClick={() => cfg.toggle && cfg.toggle()}
                                      className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${cfg.active ? 'bg-primary-500' : 'bg-white/10'}`}
                                    >
                                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${cfg.active ? 'right-1' : 'left-1'}`} />
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </section>

                          <section className="pt-8 border-t border-[var(--border)]">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">Security & Access</h4>
                            <div className="flex gap-4">
                               <button className="flex-1 py-4 rounded-2xl bg-white/5 border border-[var(--border)] font-bold hover:bg-white/10 transition-colors">Change Access Key</button>
                               <button onClick={handleLogout} className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold shadow-2xl shadow-red-500/20 hover:bg-red-600 transition-colors">Disconnect Account</button>
                            </div>
                         </section>
                      </div>
                   </div>
                </motion.div>
             )}

           </AnimatePresence>
        </div>

        {/* Global Floating Camera FAB */}
        {activeView !== 'camera' && (
           <motion.button 
             whileHover={{ scale: 1.1 }} 
             whileTap={{ scale: 0.9 }} 
             onClick={() => { setActiveView('camera'); if(!isCameraOpen) toggleCamera(); }}
             className="fixed bottom-10 right-10 w-16 h-16 rounded-full bg-primary-600 text-white shadow-2xl shadow-primary-600/40 flex items-center justify-center z-[150] floating-anim"
           >
              <Camera className="w-6 h-6" />
           </motion.button>
        )}
      </main>
    </div>
  );
};

export default App;
