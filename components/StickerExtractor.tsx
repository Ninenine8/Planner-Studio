import React, { useState, useRef, useEffect } from 'react';
import { Sticker } from '../types';
import { MousePointer2, Scissors, Check, Trash2, ArrowRight } from 'lucide-react';

interface StickerExtractorProps {
  imageSrc: string;
  onDone: (stickers: Sticker[]) => void;
  onBack: () => void;
  isLastImage?: boolean;
}

const StickerExtractor: React.FC<StickerExtractorProps> = ({ imageSrc, onDone, onBack, isLastImage = true }) => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset stickers when image source changes (next image in queue)
  useEffect(() => {
    setStickers([]);
    setCurrentRect(null);
  }, [imageSrc]);

  const getRelativePos = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getRelativePos(e);
    setStartPos(pos);
    setCurrentRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getRelativePos(e);
    const w = pos.x - startPos.x;
    const h = pos.y - startPos.y;
    
    setCurrentRect({
      x: w > 0 ? startPos.x : pos.x,
      y: h > 0 ? startPos.y : pos.y,
      w: Math.abs(w),
      h: Math.abs(h)
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect || !imgRef.current) {
      setIsDrawing(false);
      setCurrentRect(null);
      return;
    }

    // Only create if meaningful size
    if (currentRect.w > 20 && currentRect.h > 20) {
      createSticker(currentRect);
    }
    
    setIsDrawing(false);
    setCurrentRect(null);
  };

  const createSticker = (rect: { x: number, y: number, w: number, h: number }) => {
    const img = imgRef.current;
    if (!img) return;

    // Create a temporary canvas to crop
    const canvas = document.createElement('canvas');
    // Calculate scale factor between natural size and displayed size
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    canvas.width = rect.w * scaleX;
    canvas.height = rect.h * scaleY;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(
        img,
        rect.x * scaleX,
        rect.y * scaleY,
        rect.w * scaleX,
        rect.h * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setStickers(prev => [...prev, {
            id: Date.now().toString() + Math.random(),
            url,
            width: rect.w,
            height: rect.h
          }]);
        }
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Step 2: Create Stickers</h2>
            <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">Draw boxes around your art</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="text-slate-600 hover:text-slate-900 font-medium">
            Cancel
          </button>
          <button 
            onClick={() => onDone(stickers)} 
            // Allow finishing even with 0 stickers if they just want to skip this image
            className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${
              'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
            }`}
          >
            {isLastImage ? (
                <>Finish & Plan <Check size={18} /></>
            ) : (
                <>Next Image <ArrowRight size={18} /></>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Workspace */}
        <div className="flex-1 bg-slate-200 p-8 overflow-auto flex justify-center">
          <div 
            ref={containerRef}
            className="relative shadow-2xl bg-white select-none cursor-crosshair inline-block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img 
              ref={imgRef}
              src={imageSrc} 
              alt="Uploaded Art" 
              className="max-w-[800px] max-h-[80vh] object-contain pointer-events-none"
              draggable={false}
            />
            
            {/* Drawing Rectangle */}
            {currentRect && (
              <div 
                className="absolute border-2 border-indigo-500 bg-indigo-500/20"
                style={{
                  left: currentRect.x,
                  top: currentRect.y,
                  width: currentRect.w,
                  height: currentRect.h
                }}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto flex flex-col gap-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Scissors size={18} /> Extracted Stickers ({stickers.length})
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {stickers.map((s, idx) => (
              <div key={s.id} className="relative group border rounded-lg p-2 bg-slate-50 hover:shadow-md transition-all">
                <img src={s.url} alt={`Sticker ${idx}`} className="w-full h-24 object-contain" />
                <button 
                  onClick={() => setStickers(prev => prev.filter(st => st.id !== s.id))}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {stickers.length === 0 && (
              <div className="col-span-2 text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                <MousePointer2 className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Draw a box on your image to create a sticker!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickerExtractor;