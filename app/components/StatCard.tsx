interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  description,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="stat-label">{title}</p>
          <p className="stat-value">{value}</p>
          {description && <p className="stat-change">{description}</p>}
        </div>
        <div className="ml-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-core-surface2 text-core-text3">
          <span className="text-[15px] leading-none opacity-70">{icon}</span>
        </div>
      </div>
    </div>
  );
}
