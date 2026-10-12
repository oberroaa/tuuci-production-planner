import { useState } from "react";
import MetricInput from "../MetricInput";
import RapidResolution from "../RapidResolution";

export default function PaintColumn() {
  const [safety, setSafety] = useState({ target: "0", actual: "0" });
  const [quality, setQuality] = useState({ target: "0", actual: "0" });
  
  return (
    <div className="w-[420px] shrink-0 pb-10 flex flex-col relative">
      <div className="bg-slate-300 flex items-center justify-center h-[28px] mb-2">
        <div className="bg-white border border-slate-400 w-[150px] text-center font-bold text-black text-[13px] leading-tight shadow-sm">
          Paint
        </div>
      </div>
      
      <div className="h-[18px]"></div>

      {/* Unified Giant Table */}
      <div className="flex flex-col flex-1 text-[10px] font-bold text-slate-700 border-t border-slate-300">
        
        {/* Safety */}
        <div className="flex justify-center gap-8 border-b border-slate-300 bg-[#fbfbfb] h-[40px] items-center">
          <div className="flex flex-col items-center">
            <div className="flex justify-around w-full px-2 mb-0.5 text-[9px]">
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
        </div>
        
        {/* Quality */}
        <div className="flex justify-center gap-8 border-b border-slate-300 bg-[#fbfbfb] h-[40px] items-center">
          <div className="flex flex-col items-center">
            <div className="flex justify-around w-full px-2 mb-0.5 text-[9px]">
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
        </div>

        {/* Released 1 */}
        <div className="flex border-b border-slate-300 bg-white h-[60px] items-center justify-center px-2 gap-4">
          <div className="border border-slate-400 text-center w-[100px]">
            <div className="border-b border-slate-400 bg-slate-100 py-0.5 px-1 text-[9px] font-bold">Aluma-Teak</div>
            <div className="h-6 flex items-center justify-center gap-1">
              <div className="w-8 h-4 border border-slate-400"><MetricInput defaultValue="" className="text-center" /></div>
              <div className="w-8 h-4 border border-slate-400"><MetricInput defaultValue="" className="text-center" /></div>
            </div>
          </div>
          
          <div className="border border-slate-400 text-center flex-1">
            <div className="grid grid-cols-4 gap-0 border-b border-slate-400 bg-slate-100">
              <div className="border-r border-slate-400 py-0.5 px-1 font-bold text-[9px]">ACF</div>
              <div className="border-r border-slate-400 py-0.5 px-1 font-bold text-[9px]">Skin-Cov</div>
              <div className="border-r border-slate-400 py-0.5 px-1 font-bold text-[9px]">AGB-Cov</div>
              <div className="py-0.5 px-1 font-bold text-[9px]">Furniture</div>
            </div>
            <div className="grid grid-cols-4 gap-0 h-6">
              <div className="border-r border-slate-400 flex items-center justify-center gap-1"><div className="w-5 h-4 border border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div><div className="w-5 h-4 border border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 flex items-center justify-center gap-1"><div className="w-5 h-4 border border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div><div className="w-5 h-4 border border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 flex items-center justify-center gap-1"><div className="w-5 h-4 border border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div><div className="w-5 h-4 border border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="flex items-center justify-center gap-1"><div className="w-5 h-4 border border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div><div className="w-5 h-4 border border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div></div>
            </div>
          </div>
        </div>

        {/* Released 2 */}
        <div className="flex flex-col bg-[#fbfbfb] justify-center px-1 mt-6 pb-2">
          <div className="bg-slate-300 text-center text-[10px] font-bold py-0.5 border border-slate-400 mb-1">
            Released
          </div>
          <div className="flex gap-2 justify-center items-end bg-[#fbfbfb] pb-1">
             {/* Left Labels */}
             <div className="flex flex-col gap-1.5 w-[50px]">
                <div className="text-[9px] text-right font-bold pr-1 h-[18px] flex items-center justify-end">Job Tkts.</div>
                <div className="text-[9px] text-right font-bold pr-1 h-[18px] flex items-center justify-end">Units</div>
             </div>

             {/* Column Boxes */}
             {[
               { title: "Aluma-Teak", val1: "", val2: "" },
               { title: "ACF", val1: "", val2: "" },
               { title: "S. Covrs.", val1: "", val2: "" },
               { title: "AGB-Co.", val1: "", val2: "" },
               { title: "Furnit.", val1: "3", val2: "21", color: "text-green-600" },
             ].map((col, i) => (
                <div key={i} className="flex flex-col border border-slate-400 bg-white w-[54px]">
                   <div className="h-7 border-b border-slate-400 bg-slate-100 text-[8px] flex items-center justify-center text-center px-0.5 leading-tight font-bold">
                     {col.title}
                   </div>
                   <div className="p-1 flex flex-col gap-1.5 items-center">
                     <div className="w-full h-[18px] border border-slate-500"><MetricInput value={col.val1} onChange={()=>{}} className={`text-center font-bold ${col.color || ''}`} /></div>
                     <div className="w-full h-[18px] border border-slate-500"><MetricInput value={col.val2} onChange={()=>{}} className={`text-center font-bold ${col.color || ''}`} /></div>
                   </div>
                </div>
             ))}
          </div>
        </div>

        {/* Delivery */}
        <div className="flex flex-col border-b border-slate-300 bg-white flex-none px-1 py-1 mt-6">
          
          <div className="flex flex-col">
            {/* Delivery Title & Headers */}
            <div className="border border-slate-400 flex flex-col mb-1 ml-[20px]">
              <div className="bg-slate-300 text-center text-[10px] font-bold py-0.5 border-b border-slate-400">
                Delivery
              </div>
              <div className="grid grid-cols-7 gap-0 bg-slate-100">
                <div className="border-r border-slate-400 py-0.5 flex flex-col justify-center text-center">
                   <span>Frames</span>
                </div>
                <div className="border-r border-slate-400 py-0.5 flex flex-col text-center">
                   <span className="border-b border-slate-300 w-full">Bases</span>
                   <div className="flex w-full text-[8px]">
                     <span className="flex-1 border-r border-slate-300">ACF</span>
                     <span className="flex-1">S. Cov</span>
                   </div>
                </div>
                <div className="border-r border-slate-400 py-0.5 flex items-center justify-center text-[8px] text-center">Aluma-Teak</div>
                <div className="border-r border-slate-400 py-0.5 flex items-center justify-center text-center">Solanox</div>
                <div className="border-r border-slate-400 py-0.5 flex items-center justify-center text-center">Planters</div>
                <div className="border-r border-slate-400 py-0.5 flex items-center justify-center text-center">Furniture</div>
                <div className="py-0.5 flex items-center justify-center leading-tight text-center">QC<br/>Reject.</div>
              </div>
            </div>

            <div className="h-2"></div>

            {/* Days rows with floating letters */}
            <div className="flex flex-1">
              {/* Letters Column */}
              <div className="w-[20px] flex flex-col">
                {["M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="flex-1 flex items-center justify-center font-bold text-[11px] min-h-[35px]">
                    {d}
                  </div>
                ))}
              </div>
              
              {/* Data Table */}
              <div className="flex-1 border border-slate-400 flex flex-col">
                {[
                  { day: "M", vals: ["0", "0", "0", "0", "0", "0", "0", "0"] },
                  { day: "T", vals: ["0", "0", "0", "0", "0", "0", "0", "0"] },
                  { day: "W", vals: ["0", "0", "0", "0", "0", "0", "0", "0"] },
                  { day: "T", vals: ["0", "0", "0", "0", "0", "0", "0", "0"] },
                  { day: "F", vals: ["0", "0", "0", "0", "0", "0", "0", "0"] },
                  { day: "S", vals: ["0", "0", "0", "0", "0", "0", "0", "0"] },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-7 gap-0 border-b border-slate-400 flex-1 min-h-[35px] last:border-0">
                    <div className="border-r border-slate-400 flex items-center"><MetricInput defaultValue={row.vals[0]} onChange={()=>{}} className="text-center"/></div>
                    <div className="border-r border-slate-400 flex w-full h-full">
                       <div className="flex-1 border-r border-slate-300 flex items-center"><MetricInput defaultValue={row.vals[1]} onChange={()=>{}} className="text-center"/></div>
                       <div className="flex-1 flex items-center"><MetricInput defaultValue={row.vals[2]} onChange={()=>{}} className="text-center"/></div>
                    </div>
                    <div className="border-r border-slate-400 flex items-center"><MetricInput defaultValue={row.vals[3]} onChange={()=>{}} className="text-center"/></div>
                    <div className="border-r border-slate-400 flex items-center"><MetricInput defaultValue={row.vals[4]} onChange={()=>{}} className="text-center"/></div>
                    <div className="border-r border-slate-400 flex items-center"><MetricInput defaultValue={row.vals[5]} onChange={()=>{}} className="text-center"/></div>
                    <div className="border-r border-slate-400 flex items-center"><MetricInput defaultValue={row.vals[6]} onChange={()=>{}} className="text-center"/></div>
                    <div className="flex items-center"><MetricInput defaultValue={row.vals[7]} onChange={()=>{}} className="text-red-600 text-center"/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Spacer to push bottom section down */}
        <div className="flex-1 min-h-4"></div>

        {/* Rapid Resolution */}
        <div className="flex flex-col border-b border-slate-300 bg-[#fbfbfb] p-2 shrink-0">
          <RapidResolution />
        </div>

        {/* Empl. Out */}
        <div className="flex border-b border-slate-300 bg-[#fbfbfb] h-[40px] items-center justify-center shrink-0">
          <div className="w-24 border border-slate-800 bg-white text-center py-1">
             <MetricInput defaultValue="0" className="text-center" />
          </div>
        </div>

        {/* Worked Until */}
        <div className="flex border-b border-slate-300 bg-[#fbfbfb] h-[40px] items-center justify-center shrink-0">
          <div className="w-24 border border-slate-800 bg-white text-center py-1">
             <MetricInput defaultValue="-" className="text-center" />
          </div>
        </div>

        {/* Parts Out */}
        <div className="flex flex-col border-b border-slate-300 bg-[#fbfbfb] h-[90px] justify-center p-2 shrink-0">
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="-" />
          </div>
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="" />
          </div>
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="" />
          </div>
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="" />
          </div>
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="" />
          </div>
        </div>
      </div>
    </div>
  );
}

