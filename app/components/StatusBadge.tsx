import { AssetCondition } from '@prisma/client';

interface StatusBadgeProps {
  condition: AssetCondition;
}

export default function StatusBadge({ condition }: StatusBadgeProps) {
  const statusConfig: Record<AssetCondition, { bg: string; text: string }> = {
    NEW: { bg: 'bg-core-blueSoft', text: 'text-core-blueFg' },
    WORKING: { bg: 'bg-core-greenSoft', text: 'text-core-greenFg' },
    DAMAGED: { bg: 'bg-core-roseSoft', text: 'text-core-roseFg' },
    IN_REPAIR: { bg: 'bg-core-amberSoft', text: 'text-core-amberFg' },
    LOST: { bg: 'bg-core-surface2', text: 'text-core-text' },
    RETIRED: { bg: 'bg-core-violetSoft', text: 'text-core-violetFg' },
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
