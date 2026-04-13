interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  width?: number;
  height?: number;
  horizontal?: boolean;
}

export default function BarChart({
  data,
  color = '#00C853',
  width = 400,
  height = 250,
  horizontal = false,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-gray-500">
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const padding = { top: 20, right: 20, bottom: 60, left: 60 };

  if (horizontal) {
    // Horizontal bar chart
    const barHeight = (height - padding.top - padding.bottom) / data.length;
    const chartWidth = width - padding.left - padding.right;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Y-axis labels */}
        {data.map((item, idx) => (
          <text
            key={`label-${idx}`}
            x={padding.left - 10}
            y={padding.top + idx * barHeight + barHeight / 2}
            textAnchor="end"
            fontSize="12"
            fill="#666"
            dy="0.3em"
          >
            {item.label}
          </text>
        ))}

        {/* Bars */}
        {data.map((item, idx) => {
          const barWidth = (item.value / maxValue) * chartWidth;
          const barY = padding.top + idx * barHeight + barHeight * 0.15;
          const barActualHeight = barHeight * 0.7;

          return (
            <g key={`bar-${idx}`}>
              <rect
                x={padding.left}
                y={barY}
                width={barWidth}
                height={barActualHeight}
                fill={color}
                rx="4"
              />
              <text
                x={padding.left + barWidth + 5}
                y={barY + barActualHeight / 2}
                textAnchor="start"
                fontSize="12"
                fill="#333"
                dy="0.3em"
                fontWeight="600"
              >
                {item.value}
              </text>
            </g>
          );
        })}

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
  } else {
    // Vertical bar chart
    const barWidth = (width - padding.left - padding.right) / data.length;
    const chartHeight = height - padding.top - padding.bottom;

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
                {(maxValue * ratio).toFixed(0)}
              </text>
            )}
          </g>
        ))}

        {/* Bars */}
        {data.map((item, idx) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const barX = padding.left + idx * barWidth + barWidth * 0.1;
          const barActualWidth = barWidth * 0.8;
          const barY = padding.top + chartHeight - barHeight;

          return (
            <g key={`bar-${idx}`}>
              <rect
                x={barX}
                y={barY}
                width={barActualWidth}
                height={barHeight}
                fill={color}
                rx="4"
              />
              <text
                x={padding.left + idx * barWidth + barWidth / 2}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                fontSize="12"
                fill="#666"
              >
                {item.label}
              </text>
              <text
                x={barX + barActualWidth / 2}
                y={barY - 5}
                textAnchor="middle"
                fontSize="11"
                fill="#333"
                fontWeight="600"
              >
                {item.value}
              </text>
            </g>
          );
        })}

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
}
