import React, { useState, useRef, useEffect } from 'react';
import { CalendarEvent, MonthData, PlannerData, Sticker, PlacedSticker } from '../types';
import { X, Trash2, Maximize2, Move, RotateCw } from 'lucide-react';

interface PrintableMonthProps {
  monthIndex: number;
  monthData: MonthData;
  plannerData: PlannerData;
  events: Record<number, CalendarEvent>;
  stickers: Sticker[];
  monthlyNote?: string;
  enableDailyNotes: boolean;
  onUpdateMonthlyNote: (note: string) => void;
  onCommitMonthlyNote: () => void;
  onDayClick: (day: number) => void;
  selectedStickerId: string | null;
  onUpdateSticker: (day: number, stickerInstanceId: string, updates: Partial<PlacedSticker>) => void;
  onDeleteSticker: (day: number, stickerInstanceId: string) => void;
  onUpdateNote: (day: number, note: string) => void;
  onCommitNote: () => void;
}

// Internal component for handling drag, resize, and rotate
const DraggableSticker: React.FC<{
  sticker: Sticker;
  placedSticker: PlacedSticker;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onCommit: (updates: Partial<PlacedSticker>) => void; // Called on drag end (history)
  onDelete: () => void;
  dayRef: React.RefObject<HTMLDivElement | null>;
}> = ({ sticker, placedSticker, isSelected, onSelect, onCommit, onDelete, dayRef }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  
  // Local state for smooth visual updates without spamming history
  const [localState, setLocalState] = useState({
    x: placedSticker.x,
    y: placedSticker.y,
    scale: placedSticker.scale,
    rotation: placedSticker.rotation
  });

  // Sync local state when prop changes (e.g. undo)
  useEffect(() => {
    if (!isDragging && !isResizing && !isRotating) {
        setLocalState({
            x: placedSticker.x,
            y: placedSticker.y,
            scale: placedSticker.scale,
            rotation: placedSticker.rotation
        });
    }
  }, [placedSticker, isDragging, isResizing, isRotating]);

  const stickerRef = useRef<HTMLDivElement>(null);
  
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const rotateCenter = useRef({ x: 0, y: 0 });
  const rotateStartAngle = useRef(0);
  
  const initialValues = useRef(localState);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting day
    e.preventDefault();
    if (!isSelected) {
      onSelect(e);
      return;
    }
    
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialValues.current = { ...localState };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    initialValues.current = { ...localState };
  };

  const handleRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!stickerRef.current) return;

    setIsRotating(true);
    const rect = stickerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    rotateCenter.current = { x: centerX, y: centerY };
    
    // Calculate initial angle relative to center
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    rotateStartAngle.current = startAngle;
    initialValues.current = { ...localState };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dayRef.current) return;
      const rect = dayRef.current.getBoundingClientRect();

      if (isDragging) {
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;
        
        // Convert pixel delta to percentage
        const percentX = (deltaX / rect.width) * 100;
        const percentY = (deltaY / rect.height) * 100;

        setLocalState(prev => ({
          ...prev,
          x: initialValues.current.x + percentX,
          y: initialValues.current.y + percentY
        }));
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStartPos.current.x;
        // Simple scaling: moving right increases scale
        const scaleDelta = deltaX * 0.01;
        const newScale = Math.max(0.2, initialValues.current.scale + scaleDelta);
        setLocalState(prev => ({ ...prev, scale: newScale }));
      }

      if (isRotating) {
        const currentAngle = Math.atan2(e.clientY - rotateCenter.current.y, e.clientX - rotateCenter.current.x) * (180 / Math.PI);
        const deltaRotation = currentAngle - rotateStartAngle.current;
        setLocalState(prev => ({ ...prev, rotation: initialValues.current.rotation + deltaRotation }));
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing || isRotating) {
        // Commit changes to parent (and history)
        onCommit(localState);
      }
      setIsDragging(false);
      setIsResizing(false);
      setIsRotating(false);
    };

    if (isDragging || isResizing || isRotating) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, isRotating, dayRef, localState, onCommit]);

  return (
    <div
      ref={stickerRef}
      className={`absolute transform transition-none cursor-move group select-none sticker-container pointer-events-auto`}
      style={{
        left: `${localState.x}%`,
        top: `${localState.y}%`,
        width: '60%',
        height: '60%',
        transform: `translate(-50%, -50%) rotate(${localState.rotation}deg) scale(${localState.scale})`,
        zIndex: isSelected ? 50 : 10
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      <img
        src={sticker.url}
        alt="sticker"
        className={`w-full h-full object-contain pointer-events-none ${isSelected ? 'drop-shadow-lg' : ''}`}
      />
      
      {/* Selection UI */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-indigo-500 rounded-lg no-print">
          {/* Delete Button */}
          <button
            className="absolute -top-3 -right-3 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete Sticker"
            onMouseDown={(e) => e.stopPropagation()} // Prevent dragging starting on button
          >
            <X size={12} />
          </button>

           {/* Drag hint (Center) */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 opacity-50 pointer-events-none">
             <Move size={16} />
           </div>

          {/* Rotate Handle */}
          <div
            className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white border border-indigo-500 p-1 rounded-full cursor-grab active:cursor-grabbing shadow-md text-indigo-600 hover:bg-indigo-50"
            onMouseDown={handleRotateStart}
            title="Rotate"
          >
            <RotateCw size={12} />
          </div>
          {/* Stem for rotate handle */}
          <div className="absolute -top-3 left-1/2 w-0.5 h-3 bg-indigo-500 -translate-x-1/2 pointer-events-none" />

          {/* Resize Handle */}
          <div
            className="absolute -bottom-2 -right-2 bg-white border border-indigo-500 p-1 rounded-full cursor-se-resize shadow-md text-indigo-600 hover:bg-indigo-50"
            onMouseDown={handleResizeStart}
            title="Resize"
          >
            <Maximize2 size={10} />
          </div>
        </div>
      )}
    </div>
  );
};

const PrintableMonth: React.FC<PrintableMonthProps> = ({ 
  monthIndex, 
  monthData, 
  plannerData, 
  events, 
  stickers,
  monthlyNote,
  enableDailyNotes,
  onUpdateMonthlyNote,
  onCommitMonthlyNote,
  onDayClick,
  selectedStickerId,
  onUpdateSticker,
  onDeleteSticker,
  onUpdateNote,
  onCommitNote
}) => {
  const daysArray = Array.from({ length: monthData.days }, (_, i) => i + 1);
  // Create negative IDs for empty start days so they can be interactive (e.g., -1, -2, -3...)
  const emptyStartDays = Array.from({ length: monthData.startDay }, (_, i) => -(i + 1));
  
  const [focusedStickerId, setFocusedStickerId] = useState<string | null>(null);
  const dayRefs = useRef<Record<number, HTMLDivElement | null>>({});
  
  // Dynamic styles based on Gemini palette
  const mainColor = plannerData.palette[0] || '#6366f1';
  const accentColor = plannerData.palette[1] || '#818cf8';
  const bgColor = plannerData.palette[4] || '#ffffff';
  const textColor = plannerData.palette[3] || '#1f2937';
  
  // Specific note color, or fallback to text color if not set
  const noteColor = plannerData.noteColor || textColor;

  // Font
  const activeFont = plannerData.font || 'Patrick Hand';

  // Handle clicking the background of a day
  const handleDayBackgroundClick = (day: number) => {
    // If we have a focused sticker, just deselect it
    if (focusedStickerId) {
      setFocusedStickerId(null);
      if (selectedStickerId) {
          onDayClick(day);
      }
      return;
    }
    
    // Normal placement
    onDayClick(day);
  };

  const renderDayCell = (day: number, isSpacer: boolean = false) => {
    const dayEvents = events[day] || { day, stickers: [] };

    return (
      <div 
        key={day} 
        ref={el => dayRefs.current[day] = el}
        onClick={(e) => { e.stopPropagation(); handleDayBackgroundClick(day); }}
        className={`relative border rounded-lg p-2 transition-all hover:shadow-md cursor-pointer group ${isSpacer ? 'border-dashed border-slate-200' : ''} ${selectedStickerId && !focusedStickerId ? 'hover:bg-indigo-50 hover:border-indigo-300' : ''}`}
        style={{ 
          borderColor: isSpacer ? undefined : `${mainColor}40`, 
          backgroundColor: isSpacer ? 'transparent' : 'rgba(255,255,255,0.4)' 
        }}
      >
        {!isSpacer && (
           <span className="font-bold text-lg select-none pointer-events-none relative z-10" style={{ color: textColor }}>{day}</span>
        )}
        
        {/* Note Area - Conditionally rendered */}
        {enableDailyNotes && !isSpacer && (
          <textarea
            value={dayEvents.note || ''}
            onChange={(e) => onUpdateNote(day, e.target.value)}
            onBlur={onCommitNote}
            onClick={(e) => e.stopPropagation()} 
            placeholder={selectedStickerId ? "" : "..."}
            className={`absolute inset-0 w-full h-full bg-transparent resize-none outline-none text-sm p-2 pt-8 placeholder:text-slate-400/30 focus:bg-white/60 focus:ring-2 focus:ring-inset focus:ring-indigo-100/50 transition-colors ${selectedStickerId ? 'pointer-events-none' : 'cursor-text'}`}
            style={{ color: noteColor, fontFamily: activeFont }}
          />
        )}

        {/* Render Placed Stickers */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
            <div className="w-full h-full relative">
                {dayEvents.stickers.map((placed, idx) => {
                    const originalSticker = stickers.find(s => s.id === placed.stickerId);
                    if (!originalSticker) return null;
                    
                    return (
                        <DraggableSticker
                            key={placed.id}
                            sticker={originalSticker}
                            placedSticker={placed}
                            isSelected={focusedStickerId === placed.id}
                            onSelect={() => setFocusedStickerId(placed.id)}
                            onCommit={(updates) => onUpdateSticker(day, placed.id, updates)}
                            onDelete={() => {
                              onDeleteSticker(day, placed.id);
                              setFocusedStickerId(null);
                            }}
                            dayRef={{ current: dayRefs.current[day] }}
                        />
                    );
                })}
            </div>
        </div>

        {/* Hover Hint */}
        {selectedStickerId && !focusedStickerId && (
           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 rounded-lg pointer-events-none z-20">
              <span className="text-xs bg-white px-2 py-1 rounded shadow text-indigo-600 font-bold">Place</span>
           </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="printable-page bg-white w-full h-full p-8 flex flex-col relative overflow-hidden"
      style={{ backgroundColor: bgColor }}
      onClick={() => setFocusedStickerId(null)} // Click outside days clears focus
    >
      {/* Generated Background Image Layer */}
      {plannerData.backgroundImage && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
          <img 
            src={plannerData.backgroundImage} 
            alt="Background" 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-end mb-6 border-b-4 pb-4 relative z-10" style={{ borderColor: mainColor }}>
        <div>
           <h2 className="text-6xl font-bold" style={{ color: mainColor, fontFamily: activeFont }}>
            {monthData.name}
          </h2>
          <p className="text-xl opacity-75 font-semibold mt-2" style={{ color: textColor }}>
            2026
          </p>
        </div>
        <div className="max-w-md text-right">
          <p className="text-2xl italic" style={{ color: accentColor, fontFamily: activeFont }}>
            "{plannerData.monthlyQuotes[monthIndex]}"
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 gap-2 relative z-10">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center font-bold uppercase tracking-wider text-sm mb-2" style={{ color: textColor }}>
            {d}
          </div>
        ))}

        {/* Spacer Days (Empty slots at start) - Now Interactive */}
        {emptyStartDays.map(d => renderDayCell(d, true))}

        {/* Actual Days */}
        {daysArray.map(day => renderDayCell(day))}
      </div>
      
      {/* Footer / Notes Area */}
      <div className="mt-6 pt-4 border-t border-dashed relative z-10" style={{ borderColor: mainColor }}>
         <p className="text-sm font-bold uppercase tracking-widest mb-1" style={{ color: accentColor }}>Notes</p>
         <div className="h-16 w-full rounded bg-white/30 border border-transparent hover:border-slate-200 transition-colors focus-within:bg-white/50 focus-within:border-indigo-200 focus-within:shadow-sm">
           <textarea 
             className="w-full h-full bg-transparent resize-none outline-none text-lg p-2"
             placeholder="Monthly goals, reminders, or doodles..."
             style={{ color: noteColor, fontFamily: activeFont }}
             value={monthlyNote || ''}
             onChange={(e) => onUpdateMonthlyNote(e.target.value)}
             onBlur={onCommitMonthlyNote}
           />
         </div>
      </div>
    </div>
  );
};

export default PrintableMonth;