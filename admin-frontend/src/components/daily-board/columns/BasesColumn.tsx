import { useState } from "react";
import MetricInput from "../MetricInput";
import OperationsChart from "../OperationsChart";
import RapidResolution from "../RapidResolution";

export default function BasesColumn() {
  const [safety, setSafety] = useState({ target: "0", actual: "0" });
  const [quality, setQuality] = useState({ target: "0", actual: "0" });

  return (
    <div className="w-[320px] shrink-0 border-r-2 border-slate-300 pb-10 flex flex-col">
      <div className="bg-slate-200 py-1 text-center font-bold text-sm mb-2">
        Bases
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
                <MetricInput value={safety.target} onChange={(v) => setSafety({ ...safety, target: v })} className="text-center" />
              </div>
              <div className="w-12 h-5 border border-slate-400 bg-white">
                <MetricInput value={safety.actual} onChange={(v) => setSafety({ ...safety, actual: v })} className="text-center" />
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
                <MetricInput value={quality.target} onChange={(v) => setQuality({ ...quality, target: v })} className="text-center" />
              </div>
              <div className="w-12 h-5 border border-slate-400 bg-white">
                <MetricInput value={quality.actual} onChange={(v) => setQuality({ ...quality, actual: v })} className="text-center" />
              </div>
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="flex flex-col items-center justify-center border-b border-slate-300 bg-white h-[60px]">
          <div className="grid grid-cols-3 gap-8 text-center w-full max-w-[250px]">
            <div>
              <div className="mb-1 text-[9px]">ACF</div>
              <div className="w-12 h-5 border border-slate-400 bg-white mx-auto">
                <MetricInput defaultValue="0" className="text-red-600 text-center" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[9px]">AGB</div>
              <div className="w-12 h-5 border border-slate-400 bg-white mx-auto">
                <MetricInput defaultValue="0" className="text-red-600 text-center" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[9px]">GVS</div>
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
            <div className="text-center underline mb-1">ACF</div>
            <div className="text-center underline mb-1">AGB</div>
            <div className="text-center underline mb-1">GVS</div>
          </div>

          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-0 mb-1 pl-2 pr-8">
            <div></div>
            <div className="grid grid-cols-2 text-center text-[8px] leading-tight pr-2">
              <div>Targ.</div><div>Act.</div>
            </div>
            <div className="grid grid-cols-2 text-center text-[8px] leading-tight border-l border-slate-300 pl-2 pr-2">
              <div>Targ.</div><div>Act.</div>
            </div>
            <div className="grid grid-cols-2 text-center text-[8px] leading-tight border-l border-slate-300 pl-2">
              <div>Targ.</div><div>Act.</div>
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-0 pl-2 pr-8">
            <div className="flex items-center">Packed</div>
            <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white mr-2">
              <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div>
              <div><MetricInput defaultValue="0" className="text-center" /></div>
            </div>
            <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white border-l-slate-400 ml-0 pl-0 relative before:content-[''] before:absolute before:-left-2.5 before:top-0 before:h-full before:w-px before:bg-slate-300">
              <div className="border-r border-slate-400"><MetricInput defaultValue="-" className="text-center" /></div>
              <div><MetricInput defaultValue="0" className="text-center" /></div>
            </div>
            <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white ml-2 relative before:content-[''] before:absolute before:-left-3 before:top-0 before:h-full before:w-px before:bg-slate-300">
              <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div>
              <div><MetricInput defaultValue="0" className="text-center" /></div>
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-0 mt-2 pl-2 pr-8">
            <div className="flex items-center text-[9px] leading-tight">Week to<br />Date</div>
            <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white mr-2">
              <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div>
              <div><MetricInput defaultValue="0" className="text-center" /></div>
            </div>
            <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white relative before:content-[''] before:absolute before:-left-2.5 before:top-0 before:h-full before:w-px before:bg-slate-300">
              <div className="border-r border-slate-400"><MetricInput defaultValue="-" className="text-center" /></div>
              <div><MetricInput defaultValue="0" className="text-center" /></div>
            </div>
            <div className="grid grid-cols-2 border border-slate-400 h-6 bg-white ml-2 relative before:content-[''] before:absolute before:-left-3 before:top-0 before:h-full before:w-px before:bg-slate-300">
              <div className="border-r border-slate-400"><MetricInput defaultValue="0" className="text-center" /></div>
              <div><MetricInput defaultValue="0" className="text-center" /></div>
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-0 mt-2 pl-2 pr-8">
            <div></div>
            <div className="flex items-center justify-end pr-4">Concrete</div>
            <div className="border border-slate-400 h-6 bg-white relative before:content-[''] before:absolute before:-left-2.5 before:top-0 before:h-full before:w-px before:bg-slate-300">
              <MetricInput defaultValue="0" className="text-center" />
            </div>
            <div className="flex items-center h-6 ml-2 relative before:content-[''] before:absolute before:-left-3 before:top-0 before:h-full before:w-px before:bg-slate-300">
              <MetricInput defaultValue="-" className="pl-2 bg-transparent w-full" />
            </div>
          </div>
        </div>

        {/* Released */}
        <div className="flex border-b border-slate-300 bg-white h-[90px] justify-center px-2 flex-col">
          <div className="border border-slate-400 text-[10px] font-bold text-slate-700">
            <div className="grid grid-cols-3 gap-0 text-center bg-slate-100 border-b border-slate-400">
              <div className="border-r border-slate-400 py-1">ACF</div>
              <div className="border-r border-slate-400 py-1">AGB</div>
              <div className="py-1">GVS</div>
            </div>
            <div className="grid grid-cols-3 gap-0 text-center border-b border-slate-400 h-6">
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
            </div>
            <div className="grid grid-cols-3 gap-0 text-center h-6">
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
            </div>
          </div>
        </div>

        {/* Operations Performance & Rapid Resolution */}
        <div className="flex flex-col border-b border-slate-300 bg-white h-[380px]">
          <div className="h-[250px] border-b border-slate-300 p-1 flex flex-col overflow-hidden">
            <div className="text-[10px] font-bold text-center text-slate-700 shrink-0 mb-1">Bases Daily Performance Tracker</div>
            <OperationsChart data={[]} title="" />
            <OperationsChart data={[]} title="" />
            <OperationsChart data={[]} title="" />
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
          <div className="w-24 border border-slate-400 bg-white text-center py-1 h-[36px]">
            <MetricInput defaultValue="" className="text-center" />
          </div>
        </div>

        {/* Parts Out */}
        <div className="flex border-b border-slate-300 bg-[#fbfbfb] h-[90px] items-center justify-center p-2">
           <textarea className="w-full h-full resize-none outline-none text-red-600 text-sm font-bold bg-white border border-slate-800 text-center" defaultValue="-"></textarea>
        </div>

      </div>
    </div>
  );
}


