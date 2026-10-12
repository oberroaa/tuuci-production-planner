import { useState } from "react";
import MetricInput from "../MetricInput";
import RapidResolution from "../RapidResolution";

export default function ScreenPrintColumn() {
  const [safety, setSafety] = useState({ target: "0", actual: "0" });
  const [quality, setQuality] = useState({ target: "0", actual: "0" });
  const [late, setLate] = useState("0");
  
  return (
    <div className="w-[180px] shrink-0 border-r-2 border-slate-300 pb-10 flex flex-col">
      <div className="bg-slate-200 py-1 text-center font-bold text-sm mb-2">
        Screen Print
      </div>
      
      <div className="text-[10px] text-transparent italic mb-1">Spacer</div>

      {/* Unified Giant Table */}
      <div className="flex flex-col text-[10px] font-bold text-slate-700 border-t border-slate-300">
        
        {/* Safety */}
        <div className="flex flex-col items-center justify-center border-b border-slate-300 bg-[#fbfbfb] h-[40px]">
          <div className="flex justify-around w-full px-4 text-[9px] mb-0.5">
            <span>Target</span>
            <span>Actual</span>
          </div>
          <div className="flex gap-2">
            <div className="w-12 h-5 border border-slate-400 bg-white">
              <MetricInput value={safety.target} onChange={(v) => setSafety({...safety, target: v})} className="text-center" />
            </div>
            <div className="w-12 h-5 border border-slate-400 bg-white">
              <MetricInput value={safety.actual} onChange={(v) => setSafety({...safety, actual: v})} className="text-center" />
            </div>
          </div>
        </div>

        {/* Quality */}
        <div className="flex flex-col items-center justify-center border-b border-slate-300 bg-[#fbfbfb] h-[40px]">
          <div className="flex justify-around w-full px-4 text-[9px] mb-0.5">
            <span>Target</span>
            <span>Actual</span>
          </div>
          <div className="flex gap-2">
            <div className="w-12 h-5 border border-slate-400 bg-white">
              <MetricInput value={quality.target} onChange={(v) => setQuality({...quality, target: v})} className="text-center" />
            </div>
            <div className="w-12 h-5 border border-slate-400 bg-white">
              <MetricInput value={quality.actual} onChange={(v) => setQuality({...quality, actual: v})} className="text-center" />
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="flex flex-col items-center justify-center border-b border-slate-300 bg-white h-[60px]">
          <div className="w-16 h-8 border border-slate-400">
            <MetricInput value={late} onChange={(v) => setLate(v)} className="text-center" />
          </div>
        </div>

        {/* Delivery */}
        <div className="flex flex-col items-center justify-center border-b border-slate-300 bg-[#fbfbfb] h-[200px] min-h-[200px] shrink-0">
          <div className="flex justify-around w-full px-4 text-[9px] mb-1">
            <span>Target</span>
            <span>Actual</span>
          </div>
          <div className="flex gap-2">
            <div className="w-12 h-8 border border-slate-400 bg-white">
              <MetricInput defaultValue="0" className="text-base text-center" />
            </div>
            <div className="w-12 h-8 border border-slate-400 bg-white">
              <MetricInput defaultValue="0" className="text-base text-center" />
            </div>
          </div>
        </div>

        {/* Released/Job Tickts/Units equivalent */}
        <div className="flex flex-col items-center justify-center border-b border-slate-300 bg-white h-[90px] py-1">
          <div className="text-red-600 mb-0.5 text-[9px]">week</div>
          <div className="mb-1 text-xs">Screen Print</div>
          <div className="w-16 h-5 border border-slate-400 mb-1">
            <MetricInput defaultValue="0" className="text-center" />
          </div>
          <div className="w-16 h-5 border border-slate-400">
            <MetricInput defaultValue="0" className="text-center" />
          </div>
        </div>

        {/* Operations Performance & Rapid Resolution */}
        <div className="flex flex-col border-b border-slate-300 bg-white h-[380px]">
          {/* Empty Space for charts */}
          <div className="h-[250px] border-b border-slate-300 bg-[#f8fafc]"></div>
          
          <div className="h-[130px] p-2 flex flex-col justify-end">
            <RapidResolution />
          </div>
        </div>

        {/* Empl. Out */}
        <div className="flex border-b border-slate-300 bg-[#fbfbfb] h-[40px] items-center justify-center">
          <div className="w-24 border border-slate-800 bg-white text-center py-1">
             <MetricInput defaultValue="0" className="text-center" />
          </div>
        </div>

        {/* Worked Until */}
        <div className="flex border-b border-slate-300 bg-[#fbfbfb] h-[40px] items-center justify-center">
          <div className="w-24 border border-slate-800 bg-white text-center py-1">
             <MetricInput defaultValue="-" className="text-center" />
          </div>
        </div>

        {/* Parts Out */}
        <div className="flex border-b border-slate-300 bg-[#fbfbfb] h-[90px] p-2">
           <textarea className="w-full h-full resize-none outline-none text-xs p-1 border border-slate-800 bg-white" defaultValue="-"></textarea>
        </div>

      </div>
    </div>
  );
}

