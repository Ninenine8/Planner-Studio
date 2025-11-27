import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Printer, Download, Sparkles, ChevronLeft, ChevronRight, Layout, RotateCw, Plus, Palette, Shapes, PaintBucket, Undo2, Redo2, Type, ToggleLeft, ToggleRight, Wand2, PenTool, Globe, Share2, Save, X, Layers, Smartphone, Smile, Quote, Shuffle } from 'lucide-react';
import StickerExtractor from './components/StickerExtractor';
import PrintableMonth from './components/PrintableMonth';
import { analyzeDrawings, generatePlannerBackground } from './services/geminiService';
import { Sticker, PlannerData, MONTHS_2026, CalendarEvent, PlacedSticker } from './types';
import { SUPPORTED_COUNTRIES, getHolidaysForMonth } from './holidays';

const QUOTES_POOL = [
  "Creativity takes courage.",
  "Every artist was first an amateur.",
  "Draw your own path.",
  "Life is the art of drawing without an eraser.",
  "Keep going, you're growing.",
  "Dream big, start small.",
  "Stay wild, moon child.",
  "Collect moments, not things.",
  "Choose joy.",
  "Focus on the good.",
  "Believe you can.",
  "Make today amazing.",
  "Do more of what makes you happy.",
  "Good vibes only.",
  "Life is tough but so are you.",
  "Stay positive.",
  "You are enough.",
  "Progress over perfection.",
  "Radiate positivity.",
  "Embrace the journey.",
  "Stay curious.",
  "Create your own sunshine.",
  "Be the energy you want to attract.",
  "Every day is a fresh start.",
  "Turning dreams into plans.",
  "Small steps every day.",
  "Make it happen.",
  "You got this.",
  "Stars can't shine without darkness.",
  "Grow through what you go through.",
  "Your potential is endless.",
  "Enjoy the little things.",
  "Best year ever.",
  "Simplicity is the ultimate sophistication.",
  "Be yourself; everyone else is already taken."
];

const getRandomQuotes = () => {
    // Simple shuffle
    const shuffled = [...QUOTES_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 12);
};

// Mock/Default Data
const DEFAULT_PLANNER_DATA: PlannerData = {
  palette: ["#6366f1", "#818cf8", "#c7d2fe", "#1f2937", "#f8fafc"],
  mood: "Artistic",
  monthlyQuotes: getRandomQuotes(),
  font: "Patrick Hand",
  noteColor: "#1f2937",
  country: "NONE"
};

const THEMES = [
  { name: "Sunset", palette: ["#be123c", "#fb7185", "#ffe4e6", "#881337", "#fff1f2"] },
  { name: "Ocean", palette: ["#0369a1", "#38bdf8", "#e0f2fe", "#0c4a6e", "#f0f9ff"] },
  { name: "Forest", palette: ["#15803d", "#4ade80", "#dcfce7", "#14532d", "#f0fdf4"] },
  { name: "Lavender", palette: ["#7c3aed", "#a78bfa", "#ede9fe", "#4c1d95", "#f5f3ff"] },
  { name: "Vintage", palette: ["#b45309", "#f59e0b", "#fef3c7", "#78350f", "#fffbeb"] },
  { name: "Midnight", palette: ["#334155", "#94a3b8", "#f1f5f9", "#0f172a", "#f8fafc"] },
  { name: "Classic", palette: ["#1f2937", "#94a3b8", "#f3f4f6", "#000000", "#ffffff"] },
];

const FONTS = [
  { name: "Default Hand", value: "Patrick Hand" },
  { name: "Playful", value: "Indie Flower" },
  { name: "Natural", value: "Caveat" },
  { name: "Marker", value: "Gloria Hallelujah" },
  { name: "Elegant", value: "Dancing Script" },
];

// Helper to load html2canvas dynamically if missing
const loadHtml2Canvas = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).html2canvas) {
      resolve((window as any).html2canvas);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.onload = () => resolve((window as any).html2canvas);
    script.onerror = () => reject(new Error("Failed to load html2canvas"));
    document.head.appendChild(script);
  });
};

const App: React.FC = () => {
  // State Machine
  const [step, setStep] = useState<'upload' | 'extract' | 'plan'>('upload');
  
  // Data
  const [processingImages, setProcessingImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [plannerData, setPlannerData] = useState<PlannerData>(DEFAULT_PLANNER_DATA);
  const [originalAiPalette, setOriginalAiPalette] = useState<string[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAddingMore, setIsAddingMore] = useState(false);
  const [enableDailyNotes, setEnableDailyNotes] = useState(true);
  
  // Planning State
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [events, setEvents] = useState<Record<string, Record<number, CalendarEvent>>>({}); // Key: "monthIndex", Value: { day: event }
  const [monthlyNotes, setMonthlyNotes] = useState<Record<number, string>>({});
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  
  // Undo/Redo History
  const [history, setHistory] = useState<{
    events: Record<string, Record<number, CalendarEvent>>;
    monthlyNotes: Record<number, string>;
  }[]>([{ events: {}, monthlyNotes: {} }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // UI State
  const [activeTab, setActiveTab] = useState<'stickers' | 'style'>('stickers');
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
  const [isProcessingDownload, setIsProcessingDownload] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Derived State
  const currentMonthHolidays = getHolidaysForMonth(plannerData.country, currentMonthIndex);

  // --- Effects ---
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024); // Treat anything under 1024px as needing responsive adjustments
    handleResize(); // Init
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Undo / Redo Logic ---
  const saveToHistory = (
    newEvents: Record<string, Record<number, CalendarEvent>>, 
    newMonthlyNotes: Record<number, string>
  ) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ 
      events: JSON.parse(JSON.stringify(newEvents)), // Deep copy to prevent ref issues
      monthlyNotes: { ...newMonthlyNotes } 
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setEvents(history[prevIndex].events);
      setMonthlyNotes(history[prevIndex].monthlyNotes);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setEvents(history[nextIndex].events);
      setMonthlyNotes(history[nextIndex].monthlyNotes);
    }
  };

  // --- Handlers ---

  const createStickersFromImages = (images: string[]): Promise<Sticker[]> => {
    return Promise.all(images.map(src => new Promise<Sticker>((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({
                id: Date.now().toString() + Math.random(),
                url: src,
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };
        img.src = src;
    })));
  };

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileReaders: Promise<string>[] = [];
      Array.from(files).forEach((file) => {
          fileReaders.push(new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file as Blob);
          }));
      });

      Promise.all(fileReaders).then(async (images) => {
          // If in plan mode
          if (step === 'plan') {
              if (isMobile) {
                  // On mobile, skip extraction when adding more pics
                  const newStickers = await createStickersFromImages(images);
                  setStickers(prev => [...prev, ...newStickers]);
                  alert(`Added ${newStickers.length} new stickers!`);
              } else {
                  setProcessingImages(images);
                  setCurrentImageIndex(0);
                  setIsAddingMore(true);
                  setStep('extract');
              }
          } else {
              // In upload mode, append to list
              setProcessingImages(prev => [...prev, ...images]);
          }
          // Reset file input
          e.target.value = '';
      });
    }
  };

  const removeImage = (index: number) => {
      setProcessingImages(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (processingImages.length === 0) return;
    setIsAnalyzing(true);
    
    // UI Feedback immediately
    if (!isMobile) {
       setStep('extract'); 
       setCurrentImageIndex(0);
    }
    
    try {
      // Analyze the first image for mood/palette
      const data = await analyzeDrawings(processingImages[0]);
      setPlannerData(prev => ({
          ...data,
          font: prev.font, // Preserve existing font if set
          noteColor: prev.noteColor || data.palette[3], // Default note color to text color
          country: prev.country // Preserve country
      }));
      setOriginalAiPalette(data.palette);

      // On mobile, skip extraction and go straight to plan with full images
      if (isMobile) {
          const newStickers = await createStickersFromImages(processingImages);
          setStickers(prev => [...prev, ...newStickers]);
          setStep('plan');
      }

    } catch (e) {
      console.error(e);
      // Alert user about specific API errors so they know why it failed
      const msg = (e as Error).message;
      if (msg.includes("API Key") || msg.includes("Gemini")) {
          alert("AI Analysis Error: " + msg);
      }

      // Fallback if analysis fails, still proceed
      if (isMobile) {
          const newStickers = await createStickersFromImages(processingImages);
          setStickers(prev => [...prev, ...newStickers]);
          setStep('plan');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExtractionDone = (extractedStickers: Sticker[]) => {
    setStickers(prev => [...prev, ...extractedStickers]);
    
    if (currentImageIndex < processingImages.length - 1) {
        // Move to next image
        setCurrentImageIndex(prev => prev + 1);
    } else {
        // Done with all images
        setStep('plan');
        setIsAddingMore(false);
        setCurrentImageIndex(0);
    }
  };

  const handleExtractionBack = () => {
    if (isAddingMore) {
      setStep('plan');
      setIsAddingMore(false);
      setProcessingImages([]); // Clear because we cancelled the add-more operation
    } else {
      setStep('upload');
      setCurrentImageIndex(0);
    }
  };

  const handleDayClick = (day: number) => {
    if (!selectedStickerId) return;

    const monthKey = currentMonthIndex.toString();
    const nextEvents = { ...events };
    const nextMonthEvents = { ...(nextEvents[monthKey] || {}) };
    const nextDayEvent = { ...(nextMonthEvents[day] || { day, stickers: [] }) };

    const newSticker: PlacedSticker = {
      id: Date.now().toString(),
      stickerId: selectedStickerId,
      x: 50 + (Math.random() * 20 - 10), // slight random offset
      y: 50 + (Math.random() * 20 - 10),
      scale: 1,
      rotation: (Math.random() * 20 - 10) // slight tilt
    };

    nextDayEvent.stickers = [...nextDayEvent.stickers, newSticker];
    nextMonthEvents[day] = nextDayEvent;
    nextEvents[monthKey] = nextMonthEvents;

    setEvents(nextEvents);
    saveToHistory(nextEvents, monthlyNotes);
  };

  const handleStickerUpdate = (day: number, stickerInstanceId: string, updates: Partial<PlacedSticker>) => {
    const monthKey = currentMonthIndex.toString();
    const nextEvents = { ...events };
    const nextMonthEvents = { ...(nextEvents[monthKey] || {}) };
    const currentDayEvent = nextMonthEvents[day];
    
    if (!currentDayEvent) return;

    const updatedStickers = currentDayEvent.stickers.map(s => 
      s.id === stickerInstanceId ? { ...s, ...updates } : s
    );

    nextMonthEvents[day] = { ...currentDayEvent, stickers: updatedStickers };
    nextEvents[monthKey] = nextMonthEvents;

    setEvents(nextEvents);
    saveToHistory(nextEvents, monthlyNotes);
  };

  const handleStickerDelete = (day: number, stickerInstanceId: string) => {
    const monthKey = currentMonthIndex.toString();
    const nextEvents = { ...events };
    const nextMonthEvents = { ...(nextEvents[monthKey] || {}) };
    const currentDayEvent = nextMonthEvents[day];
    
    if (!currentDayEvent) return;

    const updatedStickers = currentDayEvent.stickers.filter(s => s.id !== stickerInstanceId);

    nextMonthEvents[day] = { ...currentDayEvent, stickers: updatedStickers };
    nextEvents[monthKey] = nextMonthEvents;

    setEvents(nextEvents);
    saveToHistory(nextEvents, monthlyNotes);
  };

  // Only updates visual state, does not push history
  const handleNoteUpdate = (day: number, note: string) => {
    const monthKey = currentMonthIndex.toString();
    const nextEvents = { ...events };
    const nextMonthEvents = { ...(nextEvents[monthKey] || {}) };
    const nextDayEvent = { ...(nextMonthEvents[day] || { day, stickers: [] }) };
    
    nextDayEvent.note = note;
    nextMonthEvents[day] = nextDayEvent;
    nextEvents[monthKey] = nextMonthEvents;

    setEvents(nextEvents);
  };

  // Called on blur
  const handleNoteCommit = () => {
    saveToHistory(events, monthlyNotes);
  };

  const handleMonthlyNoteUpdate = (note: string) => {
    setMonthlyNotes(prev => ({
      ...prev,
      [currentMonthIndex]: note
    }));
  };

  const handleMonthlyNoteCommit = () => {
    saveToHistory(events, monthlyNotes);
  };

  const clearMonthEvents = () => {
    const nextEvents = { ...events };
    nextEvents[currentMonthIndex.toString()] = {};
    
    const nextMonthlyNotes = { ...monthlyNotes };
    nextMonthlyNotes[currentMonthIndex] = '';

    setEvents(nextEvents);
    setMonthlyNotes(nextMonthlyNotes);
    saveToHistory(nextEvents, nextMonthlyNotes);
  }

  const applyTheme = (palette: string[]) => {
    // Also reset note color to the text color of the theme (index 3)
    setPlannerData(prev => ({ ...prev, palette, noteColor: palette[3] }));
  };

  const updatePaletteColor = (index: number, color: string) => {
     setPlannerData(prev => {
         const newPalette = [...prev.palette];
         // Ensure palette has enough items
         while (newPalette.length <= index) {
             newPalette.push('#000000');
         }
         newPalette[index] = color;
         return { ...prev, palette: newPalette };
     });
  };

  const updateNoteColor = (color: string) => {
    setPlannerData(prev => ({ ...prev, noteColor: color }));
  };

  const updateFont = (font: string) => {
    setPlannerData(prev => ({ ...prev, font }));
  };
  
  const updateCountry = (code: string) => {
    setPlannerData(prev => ({ ...prev, country: code }));
  }

  const handleShuffleQuotes = () => {
      setPlannerData(prev => ({
          ...prev,
          monthlyQuotes: getRandomQuotes()
      }));
  };
  
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPlannerData(prev => ({ ...prev, backgroundImage: result }));
      };
      reader.readAsDataURL(file);
    }
    // clear input
    e.target.value = '';
  };

  // --- Export / Print Handlers ---

  const getCanvas = async () => {
    try {
        const html2canvas = await loadHtml2Canvas();
        
        // Capture the visible month container
        const element = document.querySelector('.printable-page') as HTMLElement;
        if (!element) return null;

        // Deselect sticker before capture
        setSelectedStickerId(null);
        
        return await html2canvas(element, { 
            scale: 2, // High res for printing/viewing
            useCORS: true,
            backgroundColor: plannerData.palette[4] || '#ffffff',
            logging: false
        });
    } catch (e) {
        console.error(e);
        alert("Image generation library failed to load. Please check your internet connection.");
        return null;
    }
  };

  const handlePrint = () => {
    // Simply print - let CSS Media queries handle the view
    // Fallback to manual print if strict mode blocks it? No, usually works.
    try {
        window.print();
    } catch (e) {
        alert("Print command blocked by browser. Please use your browser's Print menu.");
    }
  };

  const handleDownload = async () => {
    setIsProcessingDownload(true);
    try {
        const canvas = await getCanvas();
        if (canvas) {
            const data = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = data;
            link.download = `DoodlePlanner-${MONTHS_2026[currentMonthIndex].name}-2026.png`;
            link.click();
        }
    } catch (e) {
        console.error("Download failed", e);
        alert("Could not generate image. Please try again.");
    } finally {
        setIsProcessingDownload(false);
    }
  };

  const handleShare = async () => {
    setIsProcessingDownload(true);
    try {
        const canvas = await getCanvas();
        if (canvas) {
            canvas.toBlob(async (blob: Blob | null) => {
                if (blob) {
                    const file = new File([blob], `planner-${MONTHS_2026[currentMonthIndex].name}.png`, { type: 'image/png' });
                    
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: 'My Doodle Planner',
                                text: `Check out my custom planner for ${MONTHS_2026[currentMonthIndex].name} 2026!`
                            });
                        } catch (err) {
                            if ((err as Error).name !== 'AbortError') {
                                console.error("Share failed", err);
                            }
                        }
                    } else {
                        // Fallback to download if sharing not supported
                        const data = canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.href = data;
                        link.download = `DoodlePlanner-${MONTHS_2026[currentMonthIndex].name}-2026.png`;
                        link.click();
                        alert("Sharing is not supported on this device/browser. Image downloaded instead.");
                    }
                }
            }, 'image/png');
        }
    } catch (e) {
        console.error("Share gen failed", e);
    } finally {
        setIsProcessingDownload(false);
    }
  };

  // --- Render Steps ---

  // 1. Upload Screen
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="p-10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full mb-6">
               <Sparkles size={40} />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4 handwritten">DoodlePlanner 2026</h1>
            <p className="text-lg text-slate-600 mb-8">
              Transform your sketches and drawings into a personalized 2026 planner. <br/>
              Upload one or more photos of your art to get started.
            </p>

            {processingImages.length === 0 ? (
              <label className="block w-full border-3 border-dashed border-slate-300 rounded-2xl p-12 hover:bg-slate-50 hover:border-indigo-400 transition-colors cursor-pointer group">
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                <div className="flex flex-col items-center">
                  <Upload className="w-12 h-12 text-slate-400 group-hover:text-indigo-500 mb-4" />
                  <span className="text-xl font-semibold text-slate-700 group-hover:text-indigo-600">Click to upload photos</span>
                  <span className="text-sm text-slate-400 mt-2">Select multiple files supported</span>
                </div>
              </label>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-64 overflow-y-auto p-2 border rounded-xl bg-slate-50">
                   {processingImages.map((img, idx) => (
                       <div key={idx} className="relative group">
                           <img src={img} alt={`Upload ${idx}`} className="w-full h-24 object-cover rounded-lg border-2 border-white shadow-sm" />
                           <button 
                             onClick={() => removeImage(idx)}
                             className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                             <X size={12} />
                           </button>
                       </div>
                   ))}
                   <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-300 rounded-lg hover:bg-white hover:border-indigo-400 cursor-pointer transition-colors text-slate-400 hover:text-indigo-500">
                        <Plus size={24} />
                        <span className="text-xs font-bold mt-1">Add More</span>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                   </label>
                </div>
                
                <button 
                  onClick={startAnalysis}
                  disabled={isAnalyzing}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-full text-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-3 mx-auto"
                >
                   {isAnalyzing ? "Analyzing Art..." : `Start with ${processingImages.length} Image${processingImages.length > 1 ? 's' : ''}`} <ChevronRight />
                </button>
                {isMobile && (
                     <p className="text-xs text-indigo-500 font-medium animate-pulse">
                        <Smartphone size={12} className="inline mr-1"/> Mobile mode: Auto-converting images to stickers
                     </p>
                )}
              </div>
            )}
          </div>
          <div className="bg-indigo-50 p-6 text-center text-indigo-800 text-sm">
             Powered by Google Gemini 2.5 Flash • Designs by You
          </div>
        </div>
      </div>
    );
  }

  // 2. Extraction Screen
  if (step === 'extract' && processingImages[currentImageIndex]) {
    return (
      <StickerExtractor 
        imageSrc={processingImages[currentImageIndex]} 
        onBack={handleExtractionBack}
        onDone={handleExtractionDone}
        isLastImage={currentImageIndex === processingImages.length - 1}
      />
    );
  }

  // 3. Planner Screen (Screen & Print Views)
  return (
    <>
        {/* === SCREEN VIEW === */}
        <div className="min-h-screen bg-slate-100 flex flex-col no-print h-screen overflow-hidden">
            {/* Top Bar (No Print) */}
            <header className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm z-50 shrink-0">
                <div className="flex items-center gap-2">
                <div className="bg-indigo-600 text-white p-2 rounded-lg shrink-0">
                    <Layout size={20} />
                </div>
                <h1 className="font-bold text-slate-800 text-lg hidden md:block">Planner Studio</h1>
                
                {/* Undo/Redo Controls */}
                <div className="flex items-center gap-1 ml-2 md:ml-4 border-l pl-2 md:pl-4 border-slate-200">
                    <button 
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-1.5 md:p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Undo"
                    >
                    <Undo2 size={18} />
                    </button>
                    <button 
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-1.5 md:p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Redo"
                    >
                    <Redo2 size={18} />
                    </button>
                </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4 bg-slate-100 rounded-full px-2 py-1">
                <button 
                    type="button"
                    onClick={() => setCurrentMonthIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentMonthIndex === 0}
                    className="p-1.5 md:p-2 hover:bg-white rounded-full transition-colors disabled:opacity-30"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="font-bold w-24 md:w-32 text-center text-slate-700 select-none text-sm md:text-base truncate">
                    {MONTHS_2026[currentMonthIndex].name}
                </span>
                <button 
                    type="button"
                    onClick={() => setCurrentMonthIndex(prev => Math.min(11, prev + 1))}
                    disabled={currentMonthIndex === 11}
                    className="p-1.5 md:p-2 hover:bg-white rounded-full transition-colors disabled:opacity-30"
                >
                    <ChevronRight size={18} />
                </button>
                </div>

                <div className="flex gap-1 md:gap-2">
                <button 
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Print"
                    >
                    <Printer size={18} /> <span className="hidden xl:inline">Print</span>
                </button>
                <button 
                    type="button"
                    onClick={handleDownload} 
                    disabled={isProcessingDownload}
                    className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Download Image"
                >
                    {isProcessingDownload ? <Sparkles size={18} className="animate-spin" /> : <Download size={18} />}
                    <span className="hidden xl:inline">Save</span>
                </button>
                <button 
                    type="button"
                    onClick={handleShare}
                    disabled={isProcessingDownload}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    title="Share / Forward"
                >
                    <Share2 size={18} /> <span className="hidden sm:inline">Forward</span>
                </button>
                </div>
            </header>

            <div className={`flex flex-1 overflow-hidden relative ${isMobile ? 'flex-col' : 'flex-row'}`}>
                {/* Main Canvas Area */}
                <main className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-slate-200/50">
                     {/* 
                       Scaled Container for Mobile:
                       A4 is ~210mm wide. Screen widths vary. 
                       We apply a transform scale to fit the A4 page into the viewport.
                     */}
                    <div 
                      className="origin-top transition-transform duration-300"
                      style={{ 
                        transform: isMobile 
                            ? `scale(${Math.min(1, (window.innerWidth - 32) / 1122)})` // 1122px is approx width of 297mm @ 96dpi
                            : 'scale(1)',
                        // On mobile we might want portrait mode scaling if user rotates, but let's stick to width fit
                        marginBottom: isMobile ? '-50%' : '0' // Negative margin to reduce whitespace from scaling down
                      }}
                    >
                        <div className="w-[297mm] h-[210mm] shadow-2xl bg-white transition-colors duration-500">
                        <PrintableMonth 
                            monthIndex={currentMonthIndex}
                            monthData={MONTHS_2026[currentMonthIndex]}
                            plannerData={plannerData}
                            events={events[currentMonthIndex.toString()] || {}}
                            stickers={stickers}
                            monthlyNote={monthlyNotes[currentMonthIndex]}
                            enableDailyNotes={enableDailyNotes}
                            onUpdateMonthlyNote={handleMonthlyNoteUpdate}
                            onCommitMonthlyNote={handleMonthlyNoteCommit}
                            onDayClick={handleDayClick}
                            selectedStickerId={selectedStickerId}
                            onUpdateSticker={handleStickerUpdate}
                            onDeleteSticker={handleStickerDelete}
                            onUpdateNote={handleNoteUpdate}
                            onCommitNote={handleNoteCommit}
                            holidays={currentMonthHolidays}
                        />
                        </div>
                    </div>
                </main>

                {/* Sidebar */}
                <aside className={`bg-white border-l border-slate-200 flex flex-col z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-lg ${isMobile ? 'w-full h-1/3 min-h-[250px]' : 'w-80 h-full border-l'}`}>
                {/* Sidebar Tabs */}
                <div className="flex border-b border-slate-200 shrink-0">
                    <button 
                    type="button"
                    onClick={() => setActiveTab('stickers')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'stickers' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                    <Shapes size={16} /> Stickers
                    </button>
                    <button 
                    type="button"
                    onClick={() => setActiveTab('style')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'style' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                    <Palette size={16} /> Style
                    </button>
                </div>

                {/* Tab Content: Stickers */}
                {activeTab === 'stickers' && (
                    <>
                    <div className="p-3 md:p-4 border-b space-y-3 shrink-0">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm md:text-base">Your Collection</h3>
                                <p className="text-xs text-slate-500">Select to place.</p>
                            </div>
                            <label className="flex items-center justify-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-700 shadow-md transition-all text-xs md:text-sm font-bold">
                                <Plus size={14} /> Add {isMobile ? "Photos" : "Drawings"}
                                <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                            </label>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 grid grid-cols-3 md:grid-cols-2 gap-2 md:gap-3 auto-rows-max bg-slate-50">
                        {stickers.map((s) => (
                            <button
                            type="button"
                            key={s.id}
                            onClick={() => setSelectedStickerId(selectedStickerId === s.id ? null : s.id)}
                            className={`relative border-2 rounded-xl p-2 h-20 md:h-24 flex items-center justify-center transition-all bg-white shadow-sm ${
                                selectedStickerId === s.id 
                                ? 'border-indigo-600 ring-2 ring-indigo-200' 
                                : 'border-transparent hover:border-slate-300'
                            }`}
                            >
                            <img src={s.url} alt="Sticker" className="max-w-full max-h-full object-contain" />
                            {selectedStickerId === s.id && (
                                <div className="absolute top-1 right-1 w-3 h-3 bg-indigo-600 rounded-full animate-pulse" />
                            )}
                            </button>
                        ))}
                        {stickers.length === 0 && (
                            <div className="col-span-3 md:col-span-2 text-center text-slate-400 py-8 text-sm border-2 border-dashed rounded-xl">
                                No stickers yet.
                            </div>
                        )}
                    </div>
                    </>
                )}

                {/* Tab Content: Style */}
                {activeTab === 'style' && (
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 bg-slate-50">
                        
                        {/* Quotes Settings */}
                        <div>
                        <h4 className="font-bold text-slate-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                            <Quote size={16} className="text-indigo-500"/> Motivational Quotes
                        </h4>
                         <button 
                            type="button"
                            onClick={handleShuffleQuotes}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 py-2 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                        >
                            <Shuffle size={14} /> Shuffle Quotes
                        </button>
                        </div>

                        {/* Typography Settings */}
                        <div>
                        <h4 className="font-bold text-slate-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                            <Type size={16} className="text-indigo-500"/> Typography
                        </h4>
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                {FONTS.map(font => (
                                    <button
                                    type="button"
                                    key={font.value}
                                    onClick={() => updateFont(font.value)}
                                    className={`px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm border rounded-lg hover:shadow-sm transition-all text-left ${plannerData.font === font.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold' : 'border-slate-200 text-slate-600'}`}
                                    style={{ fontFamily: font.value }}
                                    >
                                    {font.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        </div>

                        {/* Country Holiday Settings */}
                        <div>
                        <h4 className="font-bold text-slate-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                            <Globe size={16} className="text-indigo-500"/> Public Holidays
                        </h4>
                        <div className="space-y-2">
                            <select 
                                value={plannerData.country || 'NONE'}
                                onChange={(e) => updateCountry(e.target.value)}
                                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                            >
                                {SUPPORTED_COUNTRIES.map(country => (
                                <option key={country.code} value={country.code}>{country.name}</option>
                                ))}
                            </select>
                        </div>
                        </div>

                        {/* Daily Notes Toggle */}
                        <div>
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
                                {enableDailyNotes ? <ToggleRight size={18} className="text-indigo-500"/> : <ToggleLeft size={18} className="text-slate-400"/>} 
                                Daily Notes
                            </h4>
                            <button 
                                type="button"
                                onClick={() => setEnableDailyNotes(!enableDailyNotes)}
                                className={`text-xs px-2 py-1 rounded-full border transition-colors ${enableDailyNotes ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                            >
                                {enableDailyNotes ? 'On' : 'Off'}
                            </button>
                        </div>
                        </div>

                        {/* Color Themes Presets */}
                        <div>
                        <h4 className="font-bold text-slate-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                            <Layout size={16} className="text-indigo-500"/> Color Themes
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {THEMES.map((theme) => (
                                <button
                                    key={theme.name}
                                    onClick={() => applyTheme(theme.palette)}
                                    className="flex items-center gap-2 p-2 border rounded-lg hover:shadow-sm hover:border-indigo-300 transition-all text-left"
                                >
                                    <div className="flex -space-x-1">
                                        {theme.palette.slice(0, 3).map((c, i) => (
                                            <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                    <span className="text-xs font-medium text-slate-700">{theme.name}</span>
                                </button>
                            ))}
                        </div>
                        </div>

                        {/* Colors Settings */}
                        <div>
                        <h4 className="font-bold text-slate-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                            <PaintBucket size={16} className="text-indigo-500"/> Colors
                        </h4>
                        
                        {/* Background Upload */}
                        <div className="mb-4 space-y-2">
                            <div className="flex gap-2">
                                <label className="flex-1 bg-slate-200 text-slate-700 p-2 md:p-3 rounded-lg shadow-sm hover:bg-slate-300 transition-all flex items-center justify-center gap-2 text-xs md:text-sm font-bold cursor-pointer">
                                    <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                                    <ImageIcon size={14} /> Upload Custom Background
                                </label>
                            </div>
                            
                            {plannerData.backgroundImage && (
                                <button
                                    type="button"
                                    onClick={() => setPlannerData(prev => ({ ...prev, backgroundImage: undefined }))}
                                    className="w-full py-1 text-xs text-red-500 hover:text-red-700 font-medium flex items-center justify-center gap-1"
                                >
                                    <X size={12} /> Remove Background Image
                                </button>
                            )}
                        </div>

                            <div className="space-y-3">
                                {/* Title Color (Index 0) */}
                                <div className="flex items-center gap-3 border rounded-lg p-1.5 md:p-2 bg-white shadow-sm">
                                    <div className="relative w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden border border-slate-200 shadow-inner shrink-0">
                                        <input 
                                            type="color" 
                                            value={plannerData.palette[0] || '#6366f1'}
                                            onChange={(e) => updatePaletteColor(0, e.target.value)}
                                            className="absolute -top-2 -left-2 w-10 h-10 md:w-12 md:h-12 cursor-pointer p-0 border-0"
                                        />
                                    </div>
                                    <div className="flex-1 text-xs md:text-sm font-semibold text-slate-700">Primary Title</div>
                                </div>

                                {/* Handwriting Ink Color (New) */}
                                <div className="flex items-center gap-3 border rounded-lg p-1.5 md:p-2 bg-white shadow-sm">
                                    <div className="relative w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden border border-slate-200 shadow-inner shrink-0">
                                        <input 
                                            type="color" 
                                            value={plannerData.noteColor || '#1f2937'}
                                            onChange={(e) => updateNoteColor(e.target.value)}
                                            className="absolute -top-2 -left-2 w-10 h-10 md:w-12 md:h-12 cursor-pointer p-0 border-0"
                                        />
                                    </div>
                                    <div className="flex-1 text-xs md:text-sm font-semibold text-slate-700">Ink Color</div>
                                </div>

                                {/* Background Color (Index 4) */}
                                <div className="flex items-center gap-3 border rounded-lg p-1.5 md:p-2 bg-white shadow-sm">
                                    <div className="relative w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden border border-slate-200 shadow-inner shrink-0">
                                        <input 
                                            type="color" 
                                            value={plannerData.palette[4] || '#ffffff'}
                                            onChange={(e) => updatePaletteColor(4, e.target.value)}
                                            className="absolute -top-2 -left-2 w-10 h-10 md:w-12 md:h-12 cursor-pointer p-0 border-0"
                                        />
                                    </div>
                                    <div className="flex-1 text-xs md:text-sm font-semibold text-slate-700">Paper Color</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Action */}
                <div className="p-3 md:p-4 border-t bg-white shrink-0">
                    <button 
                        type="button"
                        onClick={clearMonthEvents}
                        className="w-full text-xs md:text-sm font-bold text-red-500 hover:bg-red-50 py-2 md:py-3 rounded-lg transition-colors border border-red-100"
                    >
                        Reset {MONTHS_2026[currentMonthIndex].name}
                    </button>
                </div>
                </aside>
            </div>
        </div>

        {/* === DEDICATED PRINT VIEW === */}
        {/* This div only shows up when printing due to @media print CSS rules in index.html */}
        <div className="print-only">
            <PrintableMonth 
                monthIndex={currentMonthIndex}
                monthData={MONTHS_2026[currentMonthIndex]}
                plannerData={plannerData}
                events={events[currentMonthIndex.toString()] || {}}
                stickers={stickers}
                monthlyNote={monthlyNotes[currentMonthIndex]}
                enableDailyNotes={enableDailyNotes}
                onUpdateMonthlyNote={() => {}} // Read only in print view
                onCommitMonthlyNote={() => {}}
                onDayClick={() => {}} // No interaction
                selectedStickerId={null} // Ensure no selection UI/borders
                onUpdateSticker={() => {}}
                onDeleteSticker={() => {}}
                onUpdateNote={() => {}}
                onCommitNote={() => {}}
                holidays={currentMonthHolidays}
            />
        </div>
    </>
  );
};

export default App;