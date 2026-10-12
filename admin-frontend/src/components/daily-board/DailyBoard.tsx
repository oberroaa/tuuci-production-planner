import React, { useState, useRef } from "react";
import { Save } from "lucide-react";
import SewingColumn from "./columns/SewingColumn";
import ScreenPrintColumn from "./columns/ScreenPrintColumn";
import MaxLineColumn from "./columns/MaxLineColumn";
import M1LineColumn from "./columns/M1LineColumn";
import BasesColumn from "./columns/BasesColumn";
import SolanoxColumn from "./columns/SolanoxColumn";
import FurnitureColumn from "./columns/FurnitureColumn";
import PaintColumn from "./columns/PaintColumn";

export default function DailyBoard() {
  const [week, setWeek] = useState(32);
  const [isSaving, setIsSaving] = useState(false);
  
  // Drag to scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  const getScrollParent = () => {
    // Find the App.tsx main container explicitly by its classes
    const appMain = document.querySelector('main.overflow-y-auto.bg-slate-50');
    if (appMain) return appMain as HTMLElement;
    return document.documentElement;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    
    setIsDragging(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
    
    setScrollLeft(scrollRef.current.scrollLeft);
    setScrollTop(getScrollParent().scrollTop);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const walkX = (e.clientX - startX) * 1.5; 
    const walkY = (e.clientY - startY) * 1.5;
    
    scrollRef.current.scrollLeft = scrollLeft - walkX;
    getScrollParent().scrollTop = scrollTop - walkY;
  };

  // Touch handlers for explicit touch dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setStartY(e.touches[0].clientY);
    
    setScrollLeft(scrollRef.current.scrollLeft);
    setScrollTop(getScrollParent().scrollTop);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const walkX = (e.touches[0].clientX - startX) * 1.5; 
    const walkY = (e.touches[0].clientY - startY) * 1.5;
    
    scrollRef.current.scrollLeft = scrollLeft - walkX;
    getScrollParent().scrollTop = scrollTop - walkY;
  };

  return (
    <div className="h-full flex flex-col bg-white text-slate-800 overflow-hidden font-sans select-none">
      {/* Header - Whiteboard Style */}
      <header className="shrink-0 pt-6 px-10 pb-4 relative">
        <div className="absolute left-10 top-10 max-w-[300px] border border-slate-300 p-2 text-[10px] font-bold text-slate-600 bg-white shadow-sm z-10">
          <h2 className="text-center text-sm font-black text-slate-800 mb-1">Our Purpose</h2>
          <p className="leading-tight">
            To safely deliver the right product, with the right quality, at the right time, and the right cost using the most efficient business processes.
          </p>
        </div>



        <div className="flex justify-between items-end mt-4">
          <div className="w-[300px]"></div> {/* Spacer for layout balance */}
          
          <div className="text-center flex-1">
            <h1 className="text-2xl font-black text-slate-800">Daily Management Board</h1>
            <div className="flex items-center justify-center gap-2 font-bold text-slate-600 mt-1">
              <span>Week #:</span>
              <div className="border-b-2 border-slate-800 px-4 text-xl text-black flex items-center justify-center">
                <input 
                  type="number" 
                  value={week} 
                  onChange={(e) => setWeek(Number(e.target.value))}
                  className="w-16 text-center bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>
          
          <div className="w-[300px] flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded font-bold uppercase transition-all shadow-md active:scale-95 touch-manipulation"
            >
              {isSaving ? "Guardando..." : <><Save className="w-4 h-4" /> Guardar Datos</>}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-10 border-t-2 border-slate-400 mb-2"></div>

      {/* Main Content (Horizontal Scroll) */}
      <main 
        ref={scrollRef}
        className={`flex-1 overflow-x-auto overflow-y-auto custom-scrollbar ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex gap-0 px-10 pb-32 pt-4 w-max items-stretch relative" style={{ minHeight: '120%' }}>
          


          <SewingColumn />
          <ScreenPrintColumn />
          <MaxLineColumn />
          <M1LineColumn />
          <BasesColumn />
          <SolanoxColumn />
          <FurnitureColumn />
          <PaintColumn />

        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 12px;
          width: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        /* Remove arrows from number inputs */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
