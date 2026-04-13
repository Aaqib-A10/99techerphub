interface PieChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  width?: number;
  height?: number;
  innerRadius?: number;
}

export default function PieChart({
  data,
  width = 300,
  height = 300,
  innerRadius = 0,
}: PieChartProps) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 10;

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-gray-500">
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  let currentAngle = -Math.PI / 2;
  const paths: Array<{ path: string; color: string; label: string; value: number }> = [];

  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    let path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    // If donut chart (innerRadius > 0)
    if (innerRadius > 0) {
      const ix1 = centerX + innerRadius * Math.cos(startAngle);
      const iy1 = centerY + innerRadius * Math.sin(startAngle);
      const ix2 = centerX + innerRadius * Math.cos(endAngle);
      const iy2 = centerY + innerRadius * Math.sin(endAngle);

      path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    }

    paths.push({ path, color: item.color, label: item.label, value: item.value });
    currentAngle = endAngle;
  });

  return (
    <div style={{ width, height }} className="flex flex-col items-center">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {paths.map((p, idx) => (
          <path
            key={idx}
            d={p.path}
            fill={p.color}
            stroke="white"
            strokeWidth="2"
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {paths.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: p.color }}
            ></div>
            <span className="text-gray-700">
              {p.label} ({p.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
