import { useState } from "react";
import MetricInput from "../MetricInput";
import OperationsChart from "../OperationsChart";
import RapidResolution from "../RapidResolution";

export default function M1LineColumn() {
  const [safety, setSafety] = useState({ target: "0", actual: "0" });
  const [quality, setQuality] = useState({ target: "0", actual: "0" });

  return (
    <div className="w-[320px] shrink-0 border-r-2 border-slate-300 pb-10 flex flex-col">
      <div className="bg-slate-200 py-1 text-center font-bold text-sm mb-2">
        M1 Line
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
          <div className="grid grid-cols-2 gap-8 text-center w-full max-w-[200px]">
            <div>
              <div className="mb-1 text-[9px]">Frames</div>
              <div className="w-12 h-5 border border-slate-400 bg-white mx-auto">
                <MetricInput defaultValue="0" className="text-red-600 text-center" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[9px]">Cabanas</div>
              <div className="w-12 h-5 border border-slate-400 bg-white mx-auto">
                <MetricInput defaultValue="0" className="text-red-600 text-center" />
              </div>
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="flex flex-col border-b border-slate-300 bg-[#fbfbfb] h-[200px] min-h-[200px] shrink-0 justify-center px-2">
          <div className="grid grid-cols-[80px_6fr_5fr] gap-2">
            <div></div>
            <div className="text-center underline mb-1 pr-6">M1 Line</div>
            <div className="text-center underline mb-1">Cabanas</div>
          </div>

          <div className="grid grid-cols-[80px_6fr_5fr] gap-2 mb-1">
            <div></div>
            <div className="grid grid-cols-2 gap-1 text-center text-[8px] pr-6">
              <div>Target</div><div>Actual</div>
            </div>
            <div className="grid grid-cols-2 gap-1 text-center text-[8px] border-l border-slate-300 pl-2 pr-1">
              <div>Target</div><div>Actual</div>
            </div>
          </div>

          <div className="grid grid-cols-[80px_6fr_5fr] gap-2">
            <div className="flex items-center">Packed</div>
            <div className="grid grid-cols-2 gap-1 pr-6">
              <div className="h-6 border border-slate-400 bg-white"><MetricInput defaultValue="0" className="text-center" /></div>
              <div className="h-6 border border-slate-400 bg-white"><MetricInput defaultValue="0" className="text-red-600 text-center" /></div>
            </div>
            <div className="grid grid-cols-2 gap-1 border-l border-slate-300 pl-2 pr-1">
              <div className="h-6 border border-slate-400 bg-white"><MetricInput defaultValue="0" className="text-center" /></div>
              <div className="h-6 border border-slate-400 bg-white"><MetricInput defaultValue="0" className="text-center" /></div>
            </div>
          </div>

          <div className="grid grid-cols-[80px_6fr_5fr] gap-2 mt-2">
            <div className="flex items-center text-[9px] leading-tight">Week to<br />Date</div>
            <div className="grid grid-cols-2 gap-1 pr-6">
              <div className="h-6 border border-slate-400 bg-white"><MetricInput defaultValue="0" className="text-base text-center" /></div>
              <div className="h-6 border border-slate-400 bg-green-100"><MetricInput defaultValue="0" className="text-base text-center" /></div>
            </div>
            <div className="grid grid-cols-2 gap-1 border-l border-slate-300 pl-2 pr-1">
              <div className="h-6 border border-slate-400 bg-white"><MetricInput defaultValue="0" className="text-base text-center" /></div>
              <div className="h-6 border border-slate-400 bg-white"><MetricInput defaultValue="0" className="text-base text-center" /></div>
            </div>
          </div>

          <div className="flex justify-around mt-4 items-center">
            <div className="flex items-center gap-2">
              <span>F. Flex</span>
              <div className="w-10 h-6 border border-slate-400 bg-white"><MetricInput defaultValue="" className="text-center" /></div>
            </div>
            <div className="flex items-center gap-2">
              <span>To Paint</span>
              <div className="w-10 h-6 border border-slate-400 bg-white"><MetricInput defaultValue="" className="text-center" /></div>
            </div>
          </div>
        </div>

        {/* Released */}
        <div className="flex flex-col border-b border-slate-300 bg-white h-[90px] justify-center px-2">
          <div className="border border-slate-400 text-[10px] font-bold text-slate-700">
            <div className="grid grid-cols-[50px_repeat(5,1fr)] gap-0 text-center border-b border-slate-400 bg-slate-100">
              <div className="border-r border-slate-400 py-1">Today</div>
              <div className="border-r border-slate-400 py-1">M1</div>
              <div className="border-r border-slate-400 py-1">Crank</div>
              <div className="border-r border-slate-400 py-1">Paint</div>
              <div className="border-r border-slate-400 py-1">FF</div>
              <div className="py-1">Cab.</div>
            </div>
            <div className="grid grid-cols-[50px_repeat(5,1fr)] gap-0 text-center border-b border-slate-400 h-6">
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
            </div>
            <div className="grid grid-cols-[50px_repeat(5,1fr)] gap-0 text-center h-6">
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="border-r border-slate-400 p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
              <div className="p-0.5"><div className="border border-green-600 h-full"><MetricInput defaultValue="0" className="text-center" /></div></div>
            </div>
          </div>
        </div>

        {/* Operations Performance & Rapid Resolution */}
        <div className="flex flex-col border-b border-slate-300 bg-white h-[380px]">
          <div className="h-[250px] border-b border-slate-300 p-2">
            <OperationsChart data={[]} title="M1 Frames" />
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
        <div className="flex border-b border-slate-300 bg-[#fbfbfb] h-[90px] items-center justify-center p-2">
          <textarea className="w-full h-full resize-none outline-none text-red-600 text-sm font-bold bg-white border border-slate-800 text-center" defaultValue="-"></textarea>
        </div>

      </div>
    </div>
  );
}


