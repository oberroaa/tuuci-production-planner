import { useState } from "react";
import MetricInput from "../MetricInput";
import OperationsChart from "../OperationsChart";
import RapidResolution from "../RapidResolution";

export default function SewingColumn() {
  const [safety, setSafety] = useState({ target: "0", actual: "0" });
  const [quality, setQuality] = useState({ target: "0", actual: "0" });
  
  const [late, setLate] = useState({ "Max": "0", "M1": "0", "Logo": "0", "Solnx": "0", "Cab": "0", "MMax": "0", "Cov": "0", "Upl": "0" });

  return (
    <div className="w-[450px] shrink-0 border-r-2 border-slate-300 pb-10 flex flex-col">
      <div className="bg-slate-200 py-1 text-center font-bold text-sm mb-2">
        Sewing
      </div>
      
      <div className="text-[10px] text-slate-500 italic mb-1">Updated 9:00AM Daily</div>

      {/* Unified Giant Table */}
      <div className="flex flex-col text-[10px] font-bold text-slate-700 border-t border-l border-slate-300">
        
        {/* Safety */}
        <div className="flex border-b border-slate-300 bg-white h-[40px]">
          <div className="w-[80px] bg-slate-200 text-center flex items-center justify-center border-r border-slate-300 py-1">Safety</div>
          <div className="flex-1 flex justify-around items-center py-1 border-r border-slate-300">
            <span>Target</span>
            <div className="w-10 h-6 border border-slate-400">
              <MetricInput value={safety.target} onChange={(v) => setSafety({...safety, target: v})} />
            </div>
            <span>Actual</span>
            <div className="w-10 h-6 border border-slate-400">
              <MetricInput value={safety.actual} onChange={(v) => setSafety({...safety, actual: v})} className="" />
            </div>
          </div>
        </div>
        
        {/* Quality */}
        <div className="flex border-b border-slate-300 bg-white h-[40px]">
          <div className="w-[80px] bg-slate-200 text-center flex items-center justify-center border-r border-slate-300 py-1">Quality</div>
          <div className="flex-1 flex justify-around items-center py-1 border-r border-slate-300">
            <span>Target</span>
            <div className="w-10 h-6 border border-slate-400">
              <MetricInput value={quality.target} onChange={(v) => setQuality({...quality, target: v})} />
            </div>
            <span>Actual</span>
            <div className="w-10 h-6 border border-slate-400">
              <MetricInput value={quality.actual} onChange={(v) => setQuality({...quality, actual: v})} className="text-red-600" />
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="flex border-b border-slate-300 bg-white h-[60px]">
          <div className="w-[80px] bg-slate-200 text-center flex items-center justify-center border-r border-slate-300 py-1">Late</div>
          <div className="flex-1 grid grid-cols-8 gap-0 text-center border-r border-slate-300">
            {Object.keys(late).map((key, i) => (
              <div key={key} className={`flex flex-col border-slate-300 ${i < 7 ? "border-r" : ""}`}>
                <div className="bg-slate-100 border-b border-slate-300 py-0.5 truncate px-1 flex-1 flex items-center justify-center">{key}</div>
                <div className="h-6 flex items-center justify-center">
                  <MetricInput 
                    value={late[key as keyof typeof late]} 
                    onChange={(v) => setLate({...late, [key]: v})} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery */}
        <div className="flex border-b border-slate-300 bg-white items-stretch h-[200px] min-h-[200px] shrink-0">
          <div className="w-[80px] bg-slate-200 text-center flex items-center justify-center border-r border-slate-300 py-1">Delivery</div>
          <div className="flex-1 flex flex-col border-r border-slate-300">
            <table className="w-full text-center border-collapse h-full">
              <thead>
                <tr className="text-[10px] leading-tight h-[20px]">
                  <th className="w-16"></th>
                  <th className="border-l border-b border-slate-300 px-1 font-normal">Target</th>
                  <th className="border-l border-b border-slate-300 px-1 font-normal">Actual</th>
                  <th className="border-l border-b border-slate-300 px-1 font-normal">Can.<br/>Only</th>
                  <th colSpan={2} className="border-l border-b border-slate-300 px-1 font-normal bg-slate-100">Week to Date<br/><span className="flex justify-between px-2"><span>Target</span><span>Actual</span></span></th>
                </tr>
              </thead>
              <tbody className="text-[11px] font-bold">
                <tr className="h-[23px]">
                  <td className="text-right pr-2">Max</td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" className="" /></td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" className="" /></td>
                  <td className="border-l border-b border-slate-400 w-12"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-r border-slate-400 w-12"><MetricInput defaultValue="" /></td>
                </tr>
                <tr className="h-[23px]">
                  <td className="text-right pr-2">M-Max</td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" className="text-red-600" /></td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" className="text-red-600" /></td>
                  <td className="border-l border-b border-slate-400 w-12"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-r border-slate-400 w-12"><MetricInput defaultValue="" /></td>
                </tr>
                <tr className="h-[23px]">
                  <td className="text-right pr-2">M1</td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" className="text-red-600" /></td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" className="text-red-600" /></td>
                  <td className="border-l border-b border-slate-400 w-12"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-r border-slate-400 w-12"><MetricInput defaultValue="" /></td>
                </tr>
                <tr className="h-[23px]">
                  <td className="text-right pr-2">Cab</td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" className="text-red-600" /></td>
                  <td className="border-l border-b border-r border-slate-400 w-10"><MetricInput defaultValue="0" className="text-red-600" /></td>
                  <td colSpan={2}></td>
                </tr>
                <tr className="h-[23px]">
                  <td className="text-right pr-2">Solanox</td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-r border-slate-400 w-10"><MetricInput defaultValue="0" className="" /></td>
                  <td colSpan={3}></td>
                </tr>
                <tr className="h-[23px]">
                  <td className="text-right pr-2">Covers</td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-r border-slate-400 w-10"><MetricInput defaultValue="0" className="text-red-600" /></td>
                  <td colSpan={3}></td>
                </tr>
                <tr className="h-[23px]">
                  <td className="text-right pr-2">Uphlstry.</td>
                  <td className="border-l border-b border-slate-400 w-10"><MetricInput defaultValue="0" /></td>
                  <td className="border-l border-b border-r border-slate-400 w-10"><MetricInput defaultValue="0" className="text-red-600" /></td>
                  <td colSpan={3}></td>
                </tr>
                <tr className="h-full">
                  <td colSpan={6}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Released Headers */}
        <div className="flex border-b border-slate-300 bg-slate-100 h-[30px]">
          <div className="w-[80px] bg-slate-200 text-center flex items-center justify-center border-r border-slate-300 py-1">Released</div>
          <div className="flex-1 grid grid-cols-8 gap-0 text-center border-r border-slate-300">
            {["Max", "MMax", "M1", "Logo", "Solnx", "Cab", "Cov", "Uphol"].map((h, i) => (
              <div key={h} className={`border-slate-300 flex items-center justify-center ${i < 7 ? "border-r" : ""}`}>{h}</div>
            ))}
          </div>
        </div>

        {/* Job Tickts */}
        <div className="flex border-b border-slate-300 bg-white h-[30px]">
          <div className="w-[80px] bg-slate-100 text-center flex items-center justify-center border-r border-slate-300 py-1">Job Tickts</div>
          <div className="flex-1 grid grid-cols-8 gap-0 text-center border-r border-slate-300">
            {["0", "0", "0", "0", "0", "0", "0", "0"].map((v,i) => (
              <div key={i} className={`border-slate-300 p-0.5 flex items-center justify-center ${i < 7 ? "border-r" : ""}`}>
                <MetricInput defaultValue={v} className="text-red-600" />
              </div>
            ))}
          </div>
        </div>

        {/* Units */}
        <div className="flex border-b border-slate-300 bg-white h-[30px]">
          <div className="w-[80px] bg-slate-100 text-center flex items-center justify-center border-r border-slate-300 py-1">Units</div>
          <div className="flex-1 grid grid-cols-8 gap-0 text-center border-r border-slate-300">
            {["0", "0", "0", "0", "0", "0", "0", "0"].map((v,i) => (
              <div key={i} className={`border-slate-300 p-0.5 flex items-center justify-center ${i < 7 ? "border-r" : ""}`}>
                <MetricInput defaultValue={v} className="text-red-600" />
              </div>
            ))}
          </div>
        </div>

        {/* Operations Performance & Rapid Resolution */}
        <div className="flex border-b border-slate-300 bg-white h-[380px]">
          <div className="w-[80px] bg-slate-300 border-r border-slate-300 flex items-center justify-center relative">
            <div className="-rotate-90 whitespace-nowrap text-slate-700 font-bold tracking-wider text-sm">
              Operations Performance
            </div>
          </div>
          <div className="flex-1 flex flex-col border-r border-slate-300">
            <div className="flex gap-1 px-1 pb-1 pt-0 border-b border-slate-300 h-[250px]">
               <OperationsChart data={[]} title="Sewing M1 Line Canopies" />
               <OperationsChart data={[]} title="Sewing Max Line Canopies" />
            </div>
            <div className="h-[130px] p-2 flex flex-col justify-end border-r-0">
              <RapidResolution />
            </div>
          </div>
        </div>

        {/* Empl. Out */}
        <div className="flex border-b border-slate-300 bg-white h-[40px]">
          <div className="w-[80px] bg-slate-200 text-center flex items-center justify-center border-r border-slate-300 py-2">Empl.<br/>Out</div>
          <div className="flex-1 p-1 border-r border-slate-300 flex items-center justify-center">
             <div className="w-24 h-5 border border-slate-800 bg-white flex items-center">
                 <MetricInput defaultValue="0" className="text-center" />
             </div>
          </div>
        </div>

        {/* Worked Until */}
        <div className="flex border-b border-slate-300 bg-white h-[40px]">
          <div className="w-[80px] bg-slate-200 text-center flex items-center justify-center border-r border-slate-300 py-2">Worked<br/>Until</div>
          <div className="flex-1 p-1 border-r border-slate-300 flex items-center justify-center">
             <div className="w-24 h-5 border border-slate-800 bg-white flex items-center">
                 <MetricInput defaultValue="-" className="text-center" />
             </div>
          </div>
        </div>

        {/* Parts Out */}
        <div className="flex border-b border-slate-300 bg-white h-[90px]">
          <div className="w-[80px] bg-slate-200 text-center flex items-center justify-center border-r border-slate-300 py-2">Parts<br/>Out</div>
          <div className="flex-1 p-2 border-r border-slate-300">
             <textarea className="w-full h-full resize-none outline-none text-red-600 text-xs p-2 font-bold border border-slate-800 bg-white" defaultValue="-"></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}

