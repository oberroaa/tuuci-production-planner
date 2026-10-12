import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface OperationsChartProps {
  data: any[];
  title?: string;
}

export default function OperationsChart({ data, title = "Operations Performance" }: OperationsChartProps) {
  // Mock data mimicking the hand-drawn dots
  const mockData = [
    { day: "M", val: 50 },
    { day: "T", val: 20 },
    { day: "W", val: 40 },
    { day: "T", val: null },
    { day: "F", val: null },
  ];

  return (
    <div className="flex-1 border border-slate-400 bg-white flex flex-col h-full min-h-[70px]">
      {title && (
        <div className="text-[8px] text-center bg-slate-100 border-b border-slate-300 font-bold text-slate-700 py-0.5">
          {title} Daily Performance Tracker
        </div>
      )}
      <div className="flex-1 w-full relative min-h-[55px]">
        {/* Paper grid effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(to right, #ccc 1px, transparent 1px), linear-gradient(to bottom, #ccc 1px, transparent 1px)`,
            backgroundSize: '10px 10px'
          }}
        />
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={50}>
            <LineChart data={data.length ? data : mockData} margin={{ top: 10, right: 10, left: -15, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={8} tickMargin={4} />
              <YAxis stroke="#94a3b8" fontSize={8} domain={[0, 150]} ticks={[0, 50, 100, 150]} />
              <Line
                type="linear"
                dataKey="val"
                stroke="#15803d"
                strokeWidth={2}
                dot={{ r: 2, fill: "#15803d" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
