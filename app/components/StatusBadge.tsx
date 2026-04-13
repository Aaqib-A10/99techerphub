import { AssetCondition } from '@prisma/client';

interface StatusBadgeProps {
  condition: AssetCondition;
}

export default function StatusBadge({ condition }: StatusBadgeProps) {
  const statusConfig: Record<AssetCondition, { bg: string; text: string }> = {
    NEW: { bg: 'bg-blue-100', text: 'text-blue-800' },
    WORKING: { bg: 'bg-green-100', text: 'text-green-800' },
    DAMAGED: { bg: 'bg-red-100', text: 'text-red-800' },
    IN_REPAIR: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    LOST: { bg: 'bg-gray-100', text: 'text-gray-800' },
    RETIRED: { bg: 'bg-purple-100', text: 'text-purple-800' },
  };

  const config = statusConfig[condition];
  const label = condition
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  return (
    <span className={`badge ${config.bg} ${config.text}`}>
      {label}
    </span>
  );
}
