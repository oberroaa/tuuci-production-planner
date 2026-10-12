import { useState } from "react";
import MetricInput from "./MetricInput";
import OperationsChart from "./OperationsChart";
import RapidResolution from "./RapidResolution";

interface Metric {
  label: string;
  target: number;
  actual: number;
}

interface DepartmentColumnProps {
  title: string;
  metrics: Metric[];
}

export default function DepartmentColumn({ title, metrics: initialMetrics }: DepartmentColumnProps) {
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics);

  const updateMetric = (index: number, field: "target" | "actual", value: number) => {
    const newMetrics = [...metrics];
    newMetrics[index][field] = value;
    setMetrics(newMetrics);
  };

  // Mock data for the chart, in a real app this would be historical data
  const chartData = [
    { day: "Mon", target: 120, actual: 110 },
    { day: "Tue", target: 125, actual: 122 },
    { day: "Wed", target: 130, actual: 135 },
    { day: "Thu", target: 135, actual: 128 },
    { day: "Fri", target: 140, actual: metrics[0]?.actual || 140 }, // Using current first metric actual as last point
  ];

  return (
    <div className="flex flex-col gap-4 w-[350px] shrink-0 border-r border-white/5 pr-6 pb-20">
      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-3 text-center">
        <h2 className="text-xl font-black text-white tracking-widest">{title}</h2>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 px-2 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
          <div className="text-left pl-1">Metric</div>
          <div>Target</div>
          <div>Actual</div>
        </div>

        {metrics.map((metric, index) => (
          <div key={index} className="grid grid-cols-3 gap-2 items-center">
            <div className="text-xs font-bold text-slate-300 bg-white/5 p-2 rounded-lg border border-white/5 h-full flex items-center shadow-inner">
              {metric.label}
            </div>
            <MetricInput
              value={metric.target}
              onChange={(val) => updateMetric(index, "target", Number(val) || 0)}
            />
            <MetricInput
              value={metric.actual}
              onChange={(val) => updateMetric(index, "actual", Number(val) || 0)}
            />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <OperationsChart data={chartData} />
      </div>

      <div className="mt-auto pt-4">
        <RapidResolution />
      </div>
    </div>
  );
}
