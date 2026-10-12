import { useState } from "react";
import MetricInput from "../MetricInput";
import OperationsChart from "../OperationsChart";
import RapidResolution from "../RapidResolution";

function InteractiveCheckbox() {
  const [checked, setChecked] = useState(false);
  return (
    <div 
      className={`w-3 h-3 border border-slate-700 cursor-pointer transition-colors duration-150 ${checked ? 'bg-red-600/80' : 'bg-transparent'}`}
      onClick={() => setChecked(!checked)}
    />
  );
}

export default function SolanoxColumn() {
  const [safety, setSafety] = useState({ target: "0", actual: "0" });
  const [quality, setQuality] = useState({ target: "0", actual: "0" });
  
  return (
    <div className="w-[300px] shrink-0 border-r-2 border-slate-300 pb-10 flex flex-col">
      <div className="bg-slate-200 py-1 text-center font-bold text-sm mb-2">
        Solanox
      </div>
      
      <div className="h-[18px]"></div>

      {/* Unified Giant Table */}
      <div className="flex flex-col text-[10px] font-bold text-slate-700 border-t border-slate-300">
        
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

        {/* Late */}
        <div className="flex flex-col items-center justify-center border-b border-slate-300 bg-white h-[60px]">
          <div className="grid grid-cols-3 gap-8 text-center w-full max-w-[250px]">
            <div>
              <div className="mb-1 text-[9px]">M1</div>
              <div className="w-12 h-5 border border-slate-400 bg-white mx-auto">
                <MetricInput defaultValue="0" className="text-red-600 text-center" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[9px]">Max</div>
              <div className="w-12 h-5 border border-slate-400 bg-white mx-auto">
                <MetricInput defaultValue="0" className="text-red-600 text-center" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[9px]">Planters</div>
              <div className="w-12 h-5 border border-slate-400 bg-white mx-auto">
                <MetricInput defaultValue="0" className="text-red-600 text-center" />
              </div>
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="flex flex-col border-b border-slate-300 bg-[#fbfbfb] h-[200px] min-h-[200px] shrink-0 justify-center px-2">
          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2">
            <div></div>
            <div className="text-center underline mb-1">M1</div>
            <div className="text-center underline mb-1">Max</div>
            <div className="text-center underline mb-1">Planters</div>
          </div>
          
          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 mb-1">
            <div></div>
            <div className="text-center text-[8px] leading-tight">Targ. Act.</div>
            <div className="text-center text-[8px] leading-tight">Targ. Act.</div>
            <div className="text-center text-[8px] leading-tight">Targ. Act.</div>
          </div>
          
          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2">
            <div className="flex items-center">Packed</div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="0" className="text-center"/></div>
               </div>
            </div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="0" className="text-center"/></div>
               </div>
            </div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="0" className="text-center"/></div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 mt-1">
            <div className="flex items-center">Paint/Hold</div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="" className="text-center"/></div>
               </div>
            </div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="" className="text-center"/></div>
               </div>
            </div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="" className="text-center"/></div>
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 mt-1">
            <div className="flex items-center text-[9px] leading-tight">Week to<br/>Date</div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="0" className="text-center"/></div>
               </div>
            </div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="0" className="text-center"/></div>
               </div>
            </div>
            <div className="px-1 flex items-center w-full">
               <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white w-full">
                  <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center"/></div>
                  <div><MetricInput defaultValue="0" className="text-center"/></div>
               </div>
            </div>
          </div>
        </div>

        {/* Released */}
        <div className="flex flex-col border-b border-slate-300 bg-white h-[90px] justify-center px-2">
          <div className="border border-slate-400 text-[10px] font-bold text-slate-700">
            <div className="grid grid-cols-[repeat(4,1fr)] gap-0 text-center border-b border-slate-400 bg-slate-100">
              <div className="border-r border-slate-400 py-1">M1</div>
              <div className="border-r border-slate-400 py-1">Max</div>
              <div className="border-r border-slate-400 py-1">Water Jet</div>
              <div className="py-1">Planters</div>
            </div>
            <div className="grid grid-cols-[repeat(4,1fr)] gap-0 text-center border-b border-slate-400 h-6">
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center"/></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center"/></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center"/></div></div>
              <div className="p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center"/></div></div>
            </div>
            <div className="grid grid-cols-[repeat(4,1fr)] gap-0 text-center h-6">
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center"/></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center"/></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center"/></div></div>
              <div className="p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center"/></div></div>
            </div>
          </div>
        </div>

        {/* Operations Performance & Rapid Resolution */}
        <div className="flex flex-col border-b border-slate-300 bg-white h-[380px]">
          <div className="h-[250px] border-b border-slate-300 p-2 flex flex-col gap-1 overflow-hidden">
            <OperationsChart data={[]} title="Solanox" />
            <OperationsChart data={[]} title="Planters" />
          </div>
          <div className="h-[130px] p-2 flex flex-col justify-end">
            <RapidResolution />
          </div>
        </div>

        {/* Empl. Out */}
        <div className="flex border-b border-slate-300 bg-[#fbfbfb] h-[40px] items-center justify-center">
          <div className="w-24 border border-green-600 bg-white text-center py-1">
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
        <div className="flex flex-col border-b border-slate-300 bg-[#fbfbfb] h-[90px] justify-center p-2">
          <div className="flex justify-end pr-[2px] mb-0.5">
            <div className="flex gap-1 text-[8px] font-bold text-center leading-none">
              <span className="w-3">M.S.</span>
              <span className="w-3">S.C.</span>
            </div>
          </div>
          
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="-" />
            <div className="flex gap-1 ml-2 shrink-0">
              <InteractiveCheckbox />
              <InteractiveCheckbox />
            </div>
          </div>
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="-" />
            <div className="flex gap-1 ml-2 shrink-0">
              <InteractiveCheckbox />
              <InteractiveCheckbox />
            </div>
          </div>
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="-" />
            <div className="flex gap-1 ml-2 shrink-0">
              <InteractiveCheckbox />
              <InteractiveCheckbox />
            </div>
          </div>
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="0" />
            <div className="flex gap-1 ml-2 shrink-0">
              <InteractiveCheckbox />
              <InteractiveCheckbox />
            </div>
          </div>
          <div className="flex items-center mb-0.5 h-3">
            <input type="text" className="flex-1 bg-transparent border-b border-slate-300 outline-none text-red-600 text-[10px] font-bold h-full" defaultValue="" />
            <div className="flex gap-1 ml-2 shrink-0">
              <InteractiveCheckbox />
              <InteractiveCheckbox />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

