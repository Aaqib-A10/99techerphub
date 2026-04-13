interface LineChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  width?: number;
  height?: number;
}

export default function LineChart({
  data,
  color = '#00C853',
  width = 400,
  height = 250,
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-gray-500">
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;

  const padding = { top: 20, right: 20, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((item, idx) => {
    const x = padding.left + (idx / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((item.value - minValue) / range) * chartHeight;
    return { x, y, ...item };
  });

  const pathD = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
        <g key={`grid-${idx}`}>
          <line
            x1={padding.left}
            y1={padding.top + chartHeight * (1 - ratio)}
            x2={width - padding.right}
            y2={padding.top + chartHeight * (1 - ratio)}
            stroke="#eee"
            strokeWidth="1"
            strokeDasharray={idx === 0 ? undefined : '4'}
          />
          {idx > 0 && (
            <text
              x={padding.left - 10}
              y={padding.top + chartHeight * (1 - ratio)}
              textAnchor="end"
              fontSize="11"
              fill="#999"
              dy="0.3em"
            >
              {(minValue + range * ratio).toFixed(0)}
            </text>
          )}
        </g>
      ))}

      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Area under curve (optional gradient effect) */}
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d={`${pathD} L ${width - padding.right} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`}
        fill="url(#areaGradient)"
      />

      {/* Points */}
      {points.map((p, idx) => (
        <g key={`point-${idx}`}>
          <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" />
          <text
            x={p.x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize="12"
            fill="#666"
          >
            {p.label}
          </text>
          <text
            x={p.x}
            y={p.y - 10}
            textAnchor="middle"
            fontSize="11"
            fill="#333"
            fontWeight="600"
          >
            {p.value}
          </text>
        </g>
      ))}

      {/* Y-axis */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="#ddd"
        strokeWidth="1"
      />

      {/* X-axis */}
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="#ddd"
        strokeWidth="1"
      />
    </svg>
  );
}
