import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, 
  Moon, 
  Utensils, 
  Dumbbell, 
  Settings, 
  LineChart, 
  ChevronRight, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Clock,
  Smartphone,
  Sparkles,
  Send,
  Loader2,
  Volume2,
  BrainCircuit,
  PieChart,
  Camera,
  MapPin,
  Image as ImageIcon,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modality } from "@google/genai";
import { 
  ai,
  callGemini, 
  analyzeMealAI, 
  generateHealthAudio, 
  analyzeFoodImage, 
  searchNearbyLongevityCenters, 
  generateLongevityImage,
  generatePersonalizedRecipe
} from './services/gemini';

// --- TYPES ---
interface Biomarker {
  date: string;
  glucose: number;
  weight: number;
  sleep: number;
  hrv: number;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userBio] = useState({
    chronologicalAge: 45,
    biologicalAge: 38,
    agingRate: 0.78,
    projectedLongevity: 112,
    score: 85
  });

  const [isLive, setIsLive] = useState(true);
  const [biomarkers] = useState<Biomarker[]>([
    { date: '2026-01-15', glucose: 95, weight: 78, sleep: 7.5, hrv: 45 },
    { date: '2026-02-01', glucose: 92, weight: 77, sleep: 7.8, hrv: 48 },
    { date: '2026-02-15', glucose: 88, weight: 76, sleep: 8.1, hrv: 52 },
  ]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Sincronización LONERGY completada. Todos los sistemas biológicos están en línea. ¿Iniciamos el protocolo de optimización hoy?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [dietInput, setDietInput] = useState('');
  const [dietAnalysis, setDietAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [personalizedRecipe, setPersonalizedRecipe] = useState('');
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [isScanningFood, setIsScanningFood] = useState(false);
  const [isSearchingCenters, setIsSearchingCenters] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [nearbyCenters, setNearbyCenters] = useState<any[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  // --- LIVE VOICE AGENT ---
  const toggleLiveSession = async () => {
    if (isLiveSession) {
      stopLiveSession();
    } else {
      await startLiveSession();
    }
  };

  const startLiveSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "Eres LONERGY AI en modo conversación fluida. Responde de forma breve, científica y motivadora. Mantén un tono de experto en optimización biológica.",
        },
        callbacks: {
          onopen: () => {
            setIsLiveSession(true);
            setChatMessages(prev => [...prev, { role: 'assistant', text: '[Sesión Live Iniciada]' }]);
          },
          onmessage: async (message) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              playLiveAudioChunk(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              // Handle interruption if needed
            }
          },
          onclose: () => {
            stopLiveSession();
          },
          onerror: (err) => {
            console.error("Live Error:", err);
            stopLiveSession();
          }
        }
      });

      liveSessionRef.current = session;

      processor.onaudioprocess = (e) => {
        if (!isLiveSession) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        session.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (err) {
      console.error("Error starting live session:", err);
      alert("No se pudo acceder al micrófono o conectar con el servidor.");
    }
  };

  const stopLiveSession = () => {
    setIsLiveSession(false);
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setChatMessages(prev => [...prev, { role: 'assistant', text: '[Sesión Live Finalizada]' }]);
  };

  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  };

  const playLiveAudioChunk = (base64: string) => {
    if (!audioContextRef.current) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 0x8000;

    const buffer = audioContextRef.current.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  // --- VOICE AGENT UTILS ---
  const simulateTranscription = (text: string) => {
    setSpokenText('');
    let current = '';
    const words = text.split(' ');
    let i = 0;
    const interval = setInterval(() => {
      if (i < words.length) {
        current += words[i] + ' ';
        setSpokenText(current);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 150); // Adjust speed to match speech roughly
  };

  // --- AUDIO UTILS ---
  const pcmToWav = (base64Pcm: string, sampleRate: number) => {
    const pcm = Uint8Array.from(atob(base64Pcm), c => c.charCodeAt(0));
    const buffer = new ArrayBuffer(44 + pcm.length);
    const view = new DataView(buffer);
    const writeString = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    writeString(0, 'RIFF'); view.setUint32(4, 36 + pcm.length, true);
    writeString(8, 'WAVE'); writeString(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeString(36, 'data'); view.setUint32(40, pcm.length, true);
    new Uint8Array(buffer, 44).set(pcm);
    return buffer;
  };

  // --- HANDLERS ---
  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    const newMsgs: ChatMessage[] = [...chatMessages, { role: 'user', text: userInput }];
    setChatMessages(newMsgs);
    setUserInput('');
    setIsTyping(true);

    const systemPrompt = "Eres LONERGY AI, el cerebro de optimización biológica más avanzado. Responde de forma técnica pero accesible sobre biohacking y longevidad basándote en protocolos de vanguardia (ayuno, hormesis, densidad nutricional, suplementación avanzada). Eres multilingüe y te adaptas al idioma del usuario.";
    
    try {
      const text = await callGemini(userInput, systemPrompt);
      setChatMessages([...newMsgs, { role: 'assistant', text }]);
      
      if (isVoiceMode) {
        handleVoiceResponse(text);
      }
    } catch (e) {
      setChatMessages([...newMsgs, { role: 'assistant', text: "Error de conexión con el núcleo LONERGY." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVoiceResponse = async (text: string) => {
    setIsSpeaking(true);
    simulateTranscription(text);
    try {
      const result = await generateHealthAudio(text);
      if (result) {
        const wavBuffer = pcmToWav(result.data, result.sampleRate);
        const audio = new Audio(URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' })));
        audio.play();
        audio.onended = () => {
          setIsSpeaking(false);
          setSpokenText('');
        };
      }
    } catch (e) {
      setIsSpeaking(false);
      setSpokenText('');
    }
  };

  const analyzeMeal = async () => {
    if (!dietInput.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeMealAI(dietInput);
      setDietAnalysis(result);
    } catch (e) {
      setDietAnalysis("Error al analizar la comida.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    try {
      const img = await generateLongevityImage(imagePrompt, imageSize);
      if (img) setGeneratedImage(img);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleFoodScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningFood(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await analyzeFoodImage(base64, file.type);
        setChatMessages(prev => [...prev, { role: 'assistant', text: `Análisis de Escáner LONERGY:\n\n${result}` }]);
        setActiveTab('assistant');
      } catch (e) {
        console.error(e);
      } finally {
        setIsScanningFood(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateRecipe = async () => {
    setIsGeneratingRecipe(true);
    try {
      const recipe = await generatePersonalizedRecipe(biomarkers);
      setPersonalizedRecipe(recipe);
      setActiveTab('assistant');
      setChatMessages(prev => [...prev, { role: 'assistant', text: `He generado una receta personalizada basada en tus últimos biomarcadores:\n\n${recipe}` }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  const handleSearchCenters = () => {
    setIsSearchingCenters(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const result = await searchNearbyLongevityCenters(pos.coords.latitude, pos.coords.longitude);
        setNearbyCenters(result.chunks);
        setChatMessages(prev => [...prev, { role: 'assistant', text: `He encontrado centros de longevidad y biohacking cerca de ti:\n\n${result.text}` }]);
        setActiveTab('assistant');
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearchingCenters(false);
      }
    }, (err) => {
      console.error(err);
      setIsSearchingCenters(false);
    });
  };

  const speakHealthSummary = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    const summary = `Juan, tu edad biológica actual es de 38 años. Tu glucosa ha bajado un 7% este mes, lo que indica una excelente sensibilidad a la insulina. Tu HRV está en 52 milisegundos, sugiriendo una buena recuperación del sistema nervioso. Hoy te recomiendo 20 minutos de sauna para activar las proteínas de choque térmico.`;
    
    simulateTranscription(summary);
    try {
      const result = await generateHealthAudio(summary);
      if (result) {
        const wavBuffer = pcmToWav(result.data, result.sampleRate);
        const audio = new Audio(URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' })));
        audio.play();
        audio.onended = () => {
          setIsSpeaking(false);
          setSpokenText('');
        };
      } else {
        setIsSpeaking(false);
        setSpokenText('');
      }
    } catch (e) {
      console.error(e);
      setIsSpeaking(false);
      setSpokenText('');
    }
  };

  // --- UI COMPONENTS ---
  const Sidebar = () => (
    <div className="w-64 h-screen bg-slate-900 text-white fixed left-0 top-0 p-6 flex flex-col border-r border-slate-800 z-50">
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-emerald-600 p-2 rounded-lg shadow-lg shadow-emerald-600/20"><Zap size={24} /></div>
        <h1 className="text-xl font-bold tracking-tight">LONERGY</h1>
      </div>
      <nav className="flex-1 space-y-2">
        <NavItem id="dashboard" icon={<LineChart size={20} />} label="Dashboard" />
        <NavItem id="masterplan" icon={<ShieldCheck size={20} />} label="Master Plan" />
        <NavItem id="roadmap" icon={<Zap size={20} />} label="Ruta Vital" />
        <NavItem id="assistant" icon={<BrainCircuit size={20} />} label="Agente Voz IA ✨" />
        <NavItem id="lab" icon={<Camera size={20} />} label="Laboratorio IA" />
        <NavItem id="database" icon={<Settings size={20} />} label="Control Central" />
      </nav>
      <div className="mt-auto pt-6 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-emerald-400 border border-emerald-500/30">JD</div>
          <div><p className="text-sm font-medium">Juan Dueñas</p><p className="text-xs text-slate-400">Vitality Master</p></div>
        </div>
      </div>
    </div>
  );

  const NavItem = ({ id, icon, label }: { id: string, icon: React.ReactNode, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
    >
      {icon} <span className="font-medium">{label}</span>
    </button>
  );

  const Dashboard = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-100">Estado Vital</h2>
            <p className="text-slate-400">Sincronización LONERGY v3.0</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live Sync</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={speakHealthSummary}
            disabled={isSpeaking}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all shadow-lg ${isSpeaking ? 'bg-emerald-600 animate-pulse text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'}`}
          >
            {isSpeaking ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
            Auditoría de Voz ✨
          </button>
          <AnimatePresence>
            {spokenText && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-slate-800/80 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/30 text-xs text-emerald-400 max-w-xs text-right"
              >
                {spokenText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Cronos vs Bios Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-800/50 relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all duration-700" />
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold text-white">Cronos</h3>
              <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Edad Cronológica</p>
            </div>
            <Clock className="text-slate-700" size={32} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-bold text-slate-300">{userBio.chronologicalAge}</span>
            <span className="text-xl text-slate-500 font-medium">Años</span>
          </div>
          <div className="mt-8 flex items-center gap-2 text-slate-500 text-sm">
            <div className="w-2 h-2 rounded-full bg-slate-700" />
            <span>Tiempo lineal irreversible</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600/20 to-teal-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-emerald-500/20 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl animate-pulse" />
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold text-white">Bios</h3>
              <p className="text-emerald-400/80 text-xs uppercase tracking-widest font-bold">Edad Biológica</p>
            </div>
            <Activity className="text-emerald-400" size={32} />
          </div>
          <div className="flex items-baseline gap-2">
            <motion.span 
              key={userBio.biologicalAge}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-7xl font-bold text-white"
            >
              {userBio.biologicalAge}
            </motion.span>
            <span className="text-xl text-emerald-200/60 font-medium">Años</span>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              REVERSIÓN ACTIVA: -7 AÑOS
            </div>
            <div className="flex gap-1">
              {[38, 37, 36].map((age, i) => (
                <span key={i} className="text-[10px] text-emerald-500/40 font-mono">
                  {age}{i < 2 ? ',' : '...'}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/30 backdrop-blur-sm p-6 rounded-3xl border border-slate-700/30 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 uppercase text-[10px] font-bold mb-1 tracking-widest">Tasa de Envejecimiento</p>
            <h4 className="text-3xl font-bold text-white">{userBio.agingRate}x</h4>
          </div>
          <div className="mt-4 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${userBio.agingRate * 100}%` }}
              className="h-full bg-emerald-500"
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Objetivo: &lt; 0.80x para longevidad extrema</p>
        </div>

        <div className="bg-slate-800/30 backdrop-blur-sm p-6 rounded-3xl border border-slate-700/30 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 uppercase text-[10px] font-bold mb-1 tracking-widest">Longevidad Proyectada</p>
            <h4 className="text-3xl font-bold text-emerald-400">{userBio.projectedLongevity} <small className="text-sm font-normal text-slate-500">Años</small></h4>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Target size={14} className="text-emerald-500" />
            <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-tighter">Fase de Velocidad de Escape</span>
          </div>
        </div>

        <div className="bg-slate-800/30 backdrop-blur-sm p-6 rounded-3xl border border-slate-700/30 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 uppercase text-[10px] font-bold mb-1 tracking-widest">Eficiencia Epigenética</p>
            <h4 className="text-3xl font-bold text-white">{userBio.score}%</h4>
          </div>
          <div className="flex items-center gap-1 mt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < 4 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <Utensils className="text-orange-400" />
            <h3 className="text-xl font-bold">Analizador de Comida IA ✨</h3>
          </div>
          <div className="flex gap-4 mb-4">
            <input 
              type="text" 
              value={dietInput} 
              onChange={(e) => setDietInput(e.target.value)}
              placeholder="Ej: Salmón con espárragos, aguacate y aceite de oliva..." 
              className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:border-blue-500 outline-none transition-colors"
            />
            <button 
              onClick={analyzeMeal}
              disabled={isAnalyzing}
              className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 text-white disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} Analizar
            </button>
          </div>
          <AnimatePresence>
            {dietAnalysis && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-slate-900/50 rounded-2xl border border-blue-500/30 text-sm text-slate-300 leading-relaxed italic"
              >
                <p className="font-bold text-blue-400 mb-1">Análisis BIOS:</p>
                {dietAnalysis}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 flex flex-col justify-center items-center text-center">
          <div className="bg-indigo-500/10 p-4 rounded-full mb-4">
            <BrainCircuit className="text-indigo-400" size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Nutrición Personalizada</h3>
          <p className="text-slate-400 text-sm mb-6">Genera una receta optimizada basada en tus últimos biomarcadores.</p>
          <button 
            onClick={handleGenerateRecipe}
            disabled={isGeneratingRecipe}
            className="w-full bg-emerald-600 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50"
          >
            {isGeneratingRecipe ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} 
            Generar Receta LONERGY
          </button>
        </div>
      </div>
    </motion.div>
  );

  const RoadmapView = () => (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-3xl font-bold text-slate-100">La Ruta de Rejuvenecimiento</h2>
        <p className="text-slate-400">Fases para alcanzar la Velocidad de Escape de la Longevidad</p>
      </div>
      <div className="space-y-6">
        <RoadmapPhase 
          phase="1" 
          title="Fundamentos Bio-Químicos" 
          status="Completado" 
          items={["Eliminar Azúcares y Procesados", "Ayuno Intermitente 16:8", "Higiene de Sueño Profundo"]}
          color="bg-green-500"
        />
        <RoadmapPhase 
          phase="2" 
          title="Optimización Epigenética" 
          status="En Progreso" 
          items={["Suplementación NMN/NAD+", "Entrenamiento Zona 2 y HIIT", "Exposición Térmica (Sauna/Frío)"]}
          color="bg-blue-500"
          isActive={true}
        />
        <RoadmapPhase 
          phase="3" 
          title="Biotecnología Avanzada" 
          status="Bloqueado" 
          items={["Análisis de Metilación de ADN", "Recambio Plasmático", "Células Madre y Exosomas"]}
          color="bg-slate-600"
        />
      </div>
    </motion.div>
  );

  const RoadmapPhase = ({ phase, title, status, items, color, isActive }: any) => (
    <div className={`p-6 rounded-3xl border transition-all ${isActive ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-slate-800/40 border-slate-700 opacity-70'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center font-bold text-white shadow-lg`}>{phase}</div>
          <div>
            <h4 className="text-xl font-bold">{title}</h4>
            <p className="text-sm text-slate-400 font-medium">{status}</p>
          </div>
        </div>
        {isActive && <div className="bg-blue-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest text-white">FASE ACTUAL</div>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {items.map((item: string, i: number) => (
          <div key={i} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
            <CheckCircle2 size={16} className={status === 'Completado' ? "text-green-500" : "text-slate-600"} />
            {item}
          </div>
        ))}
      </div>
    </div>
  );

  const MasterPlanView = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h2 className="text-3xl font-bold">Master Plan de Longevidad</h2>
        <p className="text-slate-400">Arquitectura de ingeniería para la reversión biológica total.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
            <Utensils className="text-emerald-400" size={32} />
          </div>
          <h4 className="text-xl font-bold mb-2">Pilar 1: Insumos</h4>
          <p className="text-sm text-slate-400">Nutrición como código, Hormesis y Cronobiología avanzada.</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
            <LineChart className="text-blue-400" size={32} />
          </div>
          <h4 className="text-xl font-bold mb-2">Pilar 2: Datos</h4>
          <p className="text-sm text-slate-400">Biomarcadores y glucosa. Detección temprana y monitoreo continuo.</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20">
            <Activity className="text-indigo-400" size={32} />
          </div>
          <h4 className="text-xl font-bold mb-2">Pilar 3: Comunidad</h4>
          <p className="text-sm text-slate-400">Conexión social y propósito (MTP) para la salud mental y celular.</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-emerald-600/10 to-transparent p-8 rounded-[2.5rem] border border-emerald-500/20">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-4">Ingeniería de Rejuvenecimiento</h3>
            <p className="text-slate-400 leading-relaxed mb-6">
              El Master Plan de LONERGY no solo busca extender la vida, sino optimizar cada proceso celular. 
              Utilizamos inteligencia artificial para cruzar tus datos de MRI, glucosa y wearables, 
              creando un bucle de retroalimentación en tiempo real.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={16} /> Fase 0: Detección
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={16} /> Fase 1: Optimización
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-4 h-4 rounded-full border border-slate-700" /> Fase 2: Reversión
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-4 h-4 rounded-full border border-slate-700" /> Fase 3: Escape
              </div>
            </div>
          </div>
          <div className="w-full md:w-64 aspect-square bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1)_0%,transparent_70%)]" />
            <BrainCircuit size={80} className="text-emerald-500/20" />
            <div className="absolute bottom-4 text-[10px] font-mono text-emerald-500/40 uppercase tracking-widest">Core BIOS Active</div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const ProtocolCard = ({ icon, title, content, tips }: any) => (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-3xl border border-slate-700/50 hover:border-blue-500/50 transition-all group">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-slate-900 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
        <h4 className="text-lg font-bold">{title}</h4>
      </div>
      <p className="text-slate-400 text-sm mb-4 leading-relaxed">{content}</p>
      <div className="space-y-2">
        {tips.map((tip: string, i: number) => (
          <div key={i} className="text-xs bg-slate-900/80 px-3 py-2 rounded-lg text-slate-300 border border-slate-700/50 flex items-center gap-2">
            <ChevronRight size={12} className="text-blue-500" /> {tip}
          </div>
        ))}
      </div>
    </div>
  );

  const AssistantView = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-[calc(100vh-120px)]"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Agente de Voz LONERGY</h3>
        <div className="flex gap-2">
          <button 
            onClick={toggleLiveSession}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isLiveSession ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}
          >
            <Volume2 size={16} />
            {isLiveSession ? 'Live: ON' : 'Iniciar Live'}
          </button>
          <button 
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isVoiceMode ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-800 text-slate-400'}`}
          >
            {isVoiceMode ? <Volume2 size={16} /> : <Volume2 size={16} className="opacity-50" />}
            Modo Voz: {isVoiceMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar relative">
        {chatMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none shadow-lg' : 'bg-slate-800 border border-slate-700 rounded-tl-none text-slate-200'}`}>
              <p className="text-sm leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="text-xs text-slate-500 flex items-center gap-2 p-2">
            <Loader2 size={12} className="animate-spin text-emerald-500" /> 
            Procesando inteligencia vital...
          </div>
        )}
        <AnimatePresence>
          {spokenText && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="sticky bottom-0 left-0 right-0 bg-emerald-600/90 backdrop-blur-md p-4 rounded-2xl border border-emerald-400/30 text-white text-sm shadow-2xl z-10"
            >
              <div className="flex items-center gap-3">
                <Volume2 size={18} className="animate-pulse" />
                <p>{spokenText}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-6 flex gap-3">
        <input 
          type="text" 
          value={userInput} 
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Consulta a LONERGY AI..." 
          className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 text-slate-200 transition-all"
        />
        <button 
          onClick={handleSendMessage} 
          disabled={isTyping}
          className="bg-emerald-600 p-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg text-white disabled:opacity-50"
        >
          <Send size={24} />
        </button>
      </div>
    </motion.div>
  );

  const GearView = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-3xl font-bold">Ecosistema de Medición</h2>
        <p className="text-slate-400">Lo que no se mide, no se puede optimizar.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GearItem title="Monitor Glucosa (CGM)" brand="Nivel LONERGY" reason="Mide picos de insulina en tiempo real. Crucial para prevenir la glicación de proteínas." price="$$" />
        <GearItem title="Anillo Biométrico" brand="Vitality Ring" reason="Monitorea HRV y sueño profundo. Indica si el cuerpo está listo para estrés hormético." price="$$$" />
        <GearItem title="Escáner Corporal" brand="Smart Scan" reason="Análisis de grasa visceral y masa muscular. Detecta inflamación subclínica." price="$" />
        <GearItem title="Test de Metilación" brand="DNA Core" reason="Test de reloj biológico real para medir la edad celular LONERGY." price="$$$$" />
        <GearItem title="Panel de Sangre" brand="Bio-Optimizer" reason="Análisis de biomarcadores de sangre optimizado para longevidad." price="$$" />
        <GearItem title="Banda de Recuperación" brand="Vitality Band" reason="Seguimiento de recuperación y tensión diaria para optimizar el ejercicio." price="$$" />
      </div>
    </motion.div>
  );

  const GearItem = ({ title, brand, reason, price }: any) => (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-3xl border border-slate-700/50 hover:border-blue-500 transition-all group cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-lg font-bold group-hover:text-blue-400">{title}</h4>
        <span className="text-[10px] text-blue-500 font-mono font-bold bg-blue-500/10 px-2 py-1 rounded-md">{price}</span>
      </div>
      <p className="text-sm text-slate-500 font-medium mb-3">{brand}</p>
      <p className="text-xs text-slate-400 leading-relaxed italic">"{reason}"</p>
    </div>
  );

  const LabView = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      <header>
        <h2 className="text-3xl font-bold">Laboratorio LONERGY</h2>
        <p className="text-slate-400">Herramientas avanzadas de visión y generación biológica.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <Camera className="text-emerald-400" />
            <h3 className="text-xl font-bold">Escáner de Alimentos</h3>
          </div>
          <p className="text-slate-400 text-sm mb-6">Sube una foto de tu plato para detectar lectinas, impacto glucémico y densidad nutricional.</p>
          <label className="w-full bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-all group">
            <input type="file" accept="image/*" onChange={handleFoodScan} className="hidden" />
            {isScanningFood ? (
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            ) : (
              <>
                <Camera size={32} className="text-slate-500 group-hover:text-emerald-400 mb-2" />
                <span className="text-sm font-medium text-slate-400">Subir Imagen del Plato</span>
              </>
            )}
          </label>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <ImageIcon className="text-indigo-400" />
            <h3 className="text-xl font-bold">Generador Visual Vital</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Visualiza platos óptimos o conceptos de longevidad con Nano Banana Pro.</p>
          <div className="space-y-4">
            <input 
              type="text" 
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Ej: Ensalada de kale con salmón salvaje y nueces..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2">
              {(['1K', '2K', '4K'] as const).map(size => (
                <button 
                  key={size}
                  onClick={() => setImageSize(size)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${imageSize === size ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                >
                  {size}
                </button>
              ))}
            </div>
            <button 
              onClick={handleGenerateImage}
              disabled={isGeneratingImage}
              className="w-full bg-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50"
            >
              {isGeneratingImage ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} 
              Generar Imagen
            </button>
          </div>
          {generatedImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 rounded-2xl overflow-hidden border border-slate-700"
            >
              <img src={generatedImage} alt="Generated" className="w-full h-auto" referrerPolicy="no-referrer" />
            </motion.div>
          )}
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="text-red-400" />
          <h3 className="text-xl font-bold">Localizador de Centros Vitales</h3>
        </div>
        <p className="text-slate-400 text-sm mb-6">Encuentra centros de crioterapia, saunas o restaurantes bio-optimizados cerca de tu ubicación actual.</p>
        <button 
          onClick={handleSearchCenters}
          disabled={isSearchingCenters}
          className="w-full bg-red-600 py-4 rounded-2xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50 shadow-lg shadow-red-600/20"
        >
          {isSearchingCenters ? <Loader2 className="animate-spin" /> : <MapPin size={20} />} 
          Buscar Centros Cercanos
        </button>
      </div>
    </motion.div>
  );

  const DatabaseView = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Registro de Biomarcadores</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleGenerateRecipe}
            disabled={isGeneratingRecipe}
            className="bg-emerald-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 text-white transition-all shadow-lg disabled:opacity-50"
          >
            {isGeneratingRecipe ? <Loader2 size={16} className="animate-spin" /> : <Utensils size={16} />} 
            Receta Personalizada ✨
          </button>
          <button className="bg-emerald-600/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600/30 transition-all border border-emerald-500/30">
            <PieChart size={16} /> Insight Vital ✨
          </button>
        </div>
      </div>
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Glucosa (mg/dL)</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peso (kg)</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sueño (h)</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">HRV (ms)</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {biomarkers.map((b, i) => (
                <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                  <td className="p-4 text-sm font-medium">{b.date}</td>
                  <td className="p-4 text-sm text-blue-400 font-mono">{b.glucose}</td>
                  <td className="p-4 text-sm">{b.weight}</td>
                  <td className="p-4 text-sm">{b.sleep}</td>
                  <td className="p-4 text-sm text-green-400 font-mono">{b.hrv}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-lg text-[10px] font-bold">ÓPTIMO</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="p-6 bg-slate-900/50 rounded-3xl border border-blue-500/20">
        <p className="text-sm text-slate-400 italic">
          <Sparkles size={16} className="inline mr-2 text-blue-400" />
          IA BIOS dice: "Tu tendencia de glucosa basal indica que has entrado en una fase de optimización metabólica profunda. Sugerimos mantener el ayuno de 24h este domingo."
        </p>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-10 max-w-6xl mx-auto overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dashboard" />}
          {activeTab === 'masterplan' && <MasterPlanView key="masterplan" />}
          {activeTab === 'roadmap' && <RoadmapView key="roadmap" />}
          {activeTab === 'assistant' && <AssistantView key="assistant" />}
          {activeTab === 'lab' && <LabView key="lab" />}
          {activeTab === 'database' && <DatabaseView key="database" />}
        </AnimatePresence>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
};

export default App;
