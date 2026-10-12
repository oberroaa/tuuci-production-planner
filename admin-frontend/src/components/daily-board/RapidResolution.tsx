import { useState } from "react";

export default function RapidResolution() {
  const [items, setItems] = useState([
    { id: "1", dateInitiated: "", actionItem: "", owner: "", dateCompleted: "" },
    { id: "2", dateInitiated: "", actionItem: "", owner: "", dateCompleted: "" },
    { id: "3", dateInitiated: "", actionItem: "", owner: "", dateCompleted: "" },
    { id: "4", dateInitiated: "", actionItem: "", owner: "", dateCompleted: "" },
  ]);

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  return (
    <div className="w-full border border-slate-400 bg-white">
      <div className="text-[10px] text-center bg-slate-100 border-b border-slate-400 font-bold text-slate-800 py-0.5">
        Rapid Resolution Board
      </div>
      <table className="w-full text-center text-[9px] border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-400">
            <th className="border-r border-slate-300 w-12 py-0.5 font-normal">Date<br/>Initiated</th>
            <th className="border-r border-slate-300 py-0.5 font-normal">Action Item</th>
            <th className="border-r border-slate-300 w-16 py-0.5 font-normal">Owner</th>
            <th className="py-0.5 font-normal w-12">Date<br/>Completed</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className="border-b border-slate-300 last:border-0 h-6">
              <td className="border-r border-slate-300 px-1">
                <input 
                  type="text" 
                  value={item.dateInitiated}
                  onChange={(e) => updateItem(i, "dateInitiated", e.target.value)}
                  className="w-full bg-transparent text-center focus:outline-none" 
                />
              </td>
              <td className="border-r border-slate-300 px-1 text-red-600 font-bold">
                <input 
                  type="text" 
                  value={item.actionItem}
                  onChange={(e) => updateItem(i, "actionItem", e.target.value)}
                  className="w-full bg-transparent text-left focus:outline-none" 
                />
              </td>
              <td className="border-r border-slate-300 px-1 text-indigo-700 font-bold uppercase">
                <input 
                  type="text" 
                  value={item.owner}
                  onChange={(e) => updateItem(i, "owner", e.target.value)}
                  className="w-full bg-transparent text-center focus:outline-none" 
                />
              </td>
              <td className="px-1 text-slate-600">
                <input 
                  type="text" 
                  value={item.dateCompleted}
                  onChange={(e) => updateItem(i, "dateCompleted", e.target.value)}
                  className="w-full bg-transparent text-center focus:outline-none" 
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
