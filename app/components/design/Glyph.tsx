import React from 'react';
import {
  Grid3x3,
  Users,
  Box,
  CreditCard,
  Settings,
  Search,
  Bell,
  Plus,
  Download,
  BarChart3,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Check,
  User,
  Building2,
  Package,
  Receipt,
  type LucideIcon,
} from 'lucide-react';

/**
 * Glyph — thin wrapper around lucide-react icons so screens can name
 * icons by string (matching the design handoff's `Glyph name="..."`
 * convention) without importing each icon at every call site.
 *
 * Add new aliases as the codebase needs them — keep the name set small
 * so icon usage stays consistent across pages.
 */
const REGISTRY: Record<string, LucideIcon> = {
  grid:         Grid3x3,
  users:        Users,
  box:          Box,
  card:         CreditCard,
  settings:     Settings,
  search:       Search,
  bell:         Bell,
  plus:         Plus,
  download:     Download,
  chart:        BarChart3,
  arrowRight:   ArrowRight,
  chevronDown:  ChevronDown,
  chevronRight: ChevronRight,
  check:        Check,
  user:         User,
  building:     Building2,
  package:      Package,
  invoice:      Receipt,
};

export type GlyphName = keyof typeof REGISTRY;

interface Props {
  name: GlyphName | (string & {});
  size?: number;
  className?: string;
  /** Override stroke width; defaults to design spec (1.75). */
  strokeWidth?: number;
}

export default function Glyph({ name, size = 14, className, strokeWidth = 1.75 }: Props) {
  const Icon = REGISTRY[name as GlyphName];
  if (!Icon) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Glyph: unknown icon "${name}". Add it to the registry.`);
    }
    return null;
  }
  return <Icon size={size} className={className} strokeWidth={strokeWidth} />;
}
