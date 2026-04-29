'use client';

import { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  Handle,
  Position,
  Node,
  Edge,
  NodeTypes,
  BackgroundVariant,
  NodeProps,
  useReactFlow,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export interface OrgNode {
  id: number;
  empCode: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  departmentName: string | null;
  photoUrl: string | null;
  activeAssetCount: number;
  reports: OrgNode[];
}

export interface DottedLink {
  managerId: number;
  employeeId: number;
}

interface Props {
  roots: OrgNode[];
  ancestry: OrgNode[];
  focusEmployeeId: number | null;
  searchable: boolean;
  totalActive: number;
  dottedLinks?: DottedLink[];
}

// ---------------------------------------------------------------------------
// Helpers — naming, tier inference, dept colours, search
// ---------------------------------------------------------------------------
const NODE_WIDTH = 260;
const NODE_HEIGHT = 92;

function fullName(n: OrgNode): string {
  return `${n.firstName} ${n.lastName}`.trim();
}

function initials(n: OrgNode): string {
  const f = (n.firstName || '').trim()[0] ?? '';
  const l = (n.lastName || '').trim()[0] ?? '';
  return (f + l).toUpperCase() || (n.empCode || '?').slice(0, 2).toUpperCase();
}

type Tier = 'EXEC' | 'MANAGER' | 'LEAD' | 'IC';

const TIER_BADGE: Record<Tier, { label: string; className: string }> = {
  // Saturated palette with consistent value steps — gold > indigo > emerald
  // > zinc reads as a clear hierarchy at a glance, even on the small chip.
  EXEC: { label: 'Exec', className: 'bg-amber-100 text-amber-900 ring-amber-300' },
  MANAGER: { label: 'Manager', className: 'bg-indigo-100 text-indigo-800 ring-indigo-300' },
  LEAD: { label: 'Lead', className: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
  IC: { label: 'IC', className: 'bg-zinc-100 text-zinc-700 ring-zinc-300' },
};

function inferTier(node: OrgNode): Tier {
  const d = (node.designation || '').toLowerCase();
  if (/(\b|^)(c[eo]o|ceo|cfo|cto|cmo|coo|chief|founder|chairman|president|vp|vice president|head of)/.test(d)) {
    return 'EXEC';
  }
  if (/\b(manager|director|head|controller)\b/.test(d)) {
    return 'MANAGER';
  }
  // Reports → manager-by-default. Only senior/principal/architect titles
  // bump to LEAD. We deliberately don't match the bare word "lead" here
  // because at 99 Tech it appears in sub-team labels like "Lead Gen
  // Executive" or "Team Lead" — those are roles within a department,
  // not a seniority tier. Real lead-tier ICs use senior/principal/etc.
  if (node.reports.length > 0) {
    return /\b(senior|principal|architect|sr\.?)\b/.test(d) ? 'LEAD' : 'MANAGER';
  }
  if (/\b(senior|principal|architect|sr\.?)\b/.test(d)) {
    return 'LEAD';
  }
  return 'IC';
}

// Curated palette for the 4px left-border accent. Department names are
// hashed deterministically so the same dept always lands on the same colour,
// even if you add new ones later.
const DEPT_PALETTE = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-lime-500',
  'bg-fuchsia-500',
];

function deptColor(name: string | null | undefined): string {
  const s = (name || '').trim();
  if (!s) return 'bg-zinc-300';
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return DEPT_PALETTE[Math.abs(h) % DEPT_PALETTE.length];
}

function nodeMatches(n: OrgNode, q: string): boolean {
  if (!q) return false;
  const hay = `${fullName(n)} ${n.empCode} ${n.designation ?? ''} ${n.departmentName ?? ''}`.toLowerCase();
  return hay.includes(q);
}

// ---------------------------------------------------------------------------
// Pre-processing — fold ancestry into the forest as a single chain above roots
// ---------------------------------------------------------------------------
function buildForest(roots: OrgNode[], ancestry: OrgNode[]): OrgNode[] {
  if (ancestry.length === 0) return roots;
  // Clone the ancestry chain so we don't mutate the caller's input.
  const cloned: OrgNode[] = ancestry.map((a) => ({ ...a, reports: [] }));
  for (let i = 0; i < cloned.length - 1; i++) {
    cloned[i].reports = [cloned[i + 1]];
  }
  cloned[cloned.length - 1].reports = roots;
  return [cloned[0]];
}

// ---------------------------------------------------------------------------
// Custom node component (Stitch-styled card)
// ---------------------------------------------------------------------------
interface OrgNodeData {
  node: OrgNode;
  tier: Tier;
  hasChildren: boolean;
  isExpanded: boolean;
  isMatch: boolean;
  isDimmed: boolean;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
}

const OrgCard = memo(function OrgCard({ data }: NodeProps<OrgNodeData>) {
  const { node, tier, hasChildren, isExpanded, isMatch, isDimmed, onToggle, onOpen } = data;
  const tierStyle = TIER_BADGE[tier];
  const directsCount = node.reports.length;

  return (
    <div
      // pointer-events-auto is REQUIRED — ReactFlow sets pointer-events: none
      // on .react-flow__nodes so its pane can receive pan/drag events. Without
      // re-enabling pointer-events on the card, mouse clicks pass through to
      // the pane and never fire React handlers. JS .click() works because it
      // dispatches synthetically (bypasses hit-testing).
      className={`pointer-events-auto group relative flex w-[260px] items-center gap-3 rounded-lg bg-white pl-3 pr-3 py-2.5 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] ring-1 ring-[rgba(228,228,231,0.85)] transition-all hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:ring-zinc-300 ${
        isMatch ? 'ring-2 ring-blue-400 shadow-[0_4px_16px_-2px_rgba(37,99,235,0.25)]' : ''
      } ${isDimmed ? 'opacity-30' : ''}`}
      onClick={(e) => {
        // Only the chip toggles. Everything else on the card navigates to the
        // employee profile — that's the primary action for every node.
        const target = e.target as HTMLElement;
        if (target.closest('[data-org-caret]')) return;
        onOpen(node.id);
      }}
      role="link"
      tabIndex={0}
      aria-label={`Open ${fullName(node)}'s profile`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(node.id);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* 4px department-coloured left accent */}
      <div className={`absolute left-0 top-0 h-full w-1 rounded-l-lg ${deptColor(node.departmentName)}`} />

      {/* Avatar */}
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-zinc-100">
        {node.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-zinc-600">
            {initials(node)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold leading-tight text-zinc-900">{fullName(node)}</p>
          <span
            className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tierStyle.className}`}
          >
            {tierStyle.label}
          </span>
        </div>
        <p className="truncate text-[11px] leading-tight text-zinc-500" title={node.designation ?? undefined}>
          {node.empCode} · {node.designation ?? '—'}
        </p>
      </div>

      {/* Expand chip — only on managers. Click toggles the subtree without
          triggering navigation (it stops event propagation). */}
      {hasChildren && (
        <button
          type="button"
          data-org-caret
          aria-label={isExpanded ? 'Collapse subtree' : 'Expand subtree'}
          title={isExpanded ? 'Collapse team' : `Show ${directsCount} report${directsCount === 1 ? '' : 's'}`}
          className={`flex h-8 min-w-[40px] shrink-0 items-center justify-center gap-1 rounded-md px-2 text-[12px] font-semibold tabular-nums transition-colors ${
            isExpanded
              ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
        >
          <span>{directsCount}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

      {/* React Flow handles — invisible but required for edge anchoring.
          Left = incoming from manager, Right = outgoing to reports. */}
      <Handle type="target" position={Position.Left} className="!h-0 !w-0 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-0 !w-0 !border-0 !bg-transparent" />
    </div>
  );
});

const nodeTypes: NodeTypes = { orgCard: OrgCard };

// ---------------------------------------------------------------------------
// Layout — flatten tree to nodes/edges, run dagre top-down, hand off to RF
// ---------------------------------------------------------------------------
interface FlatNode {
  node: OrgNode;
  parentId: number | null;
  depth: number;
}

function flatten(forest: OrgNode[], collapsed: Set<number>): FlatNode[] {
  const out: FlatNode[] = [];
  function walk(n: OrgNode, parentId: number | null, depth: number) {
    out.push({ node: n, parentId, depth });
    if (collapsed.has(n.id)) return;
    n.reports.forEach((r) => walk(r, n.id, depth + 1));
  }
  forest.forEach((r) => walk(r, null, 0));
  return out;
}

function layout(flat: FlatNode[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  // Left-to-right: levels flow horizontally (root on the left, descendants
  // expanding rightward). Tighter vertical spacing within a rank because
  // sibling cards stack on top of each other; generous horizontal spacing
  // between ranks so connector elbows have room to breathe.
  g.setGraph({ rankdir: 'LR', nodesep: 18, ranksep: 90, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  flat.forEach((f) => g.setNode(String(f.node.id), { width: NODE_WIDTH, height: NODE_HEIGHT }));
  flat.forEach((f) => {
    if (f.parentId != null) g.setEdge(String(f.parentId), String(f.node.id));
  });

  dagre.layout(g);

  const nodes: Node[] = flat.map((f) => {
    const pos = g.node(String(f.node.id));
    return {
      id: String(f.node.id),
      type: 'orgCard',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {} as OrgNodeData, // filled in by parent component
      draggable: false,
      selectable: false,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const edges: Edge[] = [];
  flat.forEach((f) => {
    if (f.parentId == null) return;
    edges.push({
      id: `e-${f.parentId}-${f.node.id}`,
      source: String(f.parentId),
      target: String(f.node.id),
      type: 'smoothstep',
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
    });
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------
function OrgChartInner({ roots, ancestry, focusEmployeeId, searchable, totalActive, dottedLinks = [] }: Props) {
  const router = useRouter();
  const { fitView, setCenter } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  // Track the last toggled node id so we can center the camera on it AFTER
  // the new layout commits. Avoids the "expand a 18-wide subtree → camera
  // fits everything → cards become tiny" problem.
  const lastToggledRef = useRef<number | null>(null);

  const forest = useMemo(() => buildForest(roots, ancestry), [roots, ancestry]);

  // Default expansion: top 3 levels — for 99 Tech this means Chairman → CEO
  // → COO + Hammad's 18 direct reports. User sees the full leadership
  // structure on first paint without having to click. They can drill into
  // any department head's team via the per-card chip.
  const initialExpanded = useMemo(() => {
    const set = new Set<number>();
    function walk(n: OrgNode, depth: number) {
      if (depth < 3) {
        set.add(n.id);
        n.reports.forEach((r) => walk(r, depth + 1));
      }
    }
    forest.forEach((r) => walk(r, 0));
    if (focusEmployeeId != null) set.add(focusEmployeeId);
    return set;
  }, [forest, focusEmployeeId]);

  // Walk every node in the forest — used by the toolbar's "Expand all".
  const allNodeIds = useMemo(() => {
    const set = new Set<number>();
    function walk(n: OrgNode) {
      set.add(n.id);
      n.reports.forEach(walk);
    }
    forest.forEach(walk);
    return set;
  }, [forest]);

  const [expanded, setExpanded] = useState<Set<number>>(initialExpanded);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const collapsed = useMemo(() => {
    const c = new Set<number>();
    function walk(n: OrgNode) {
      if (!expanded.has(n.id)) c.add(n.id);
      else n.reports.forEach(walk);
    }
    forest.forEach(walk);
    return c;
  }, [forest, expanded]);

  const flat = useMemo(() => flatten(forest, collapsed), [forest, collapsed]);

  const { nodes: layoutNodes, edges: solidEdges } = useMemo(() => layout(flat), [flat]);

  // Dotted-line / matrix edges. Only render when both endpoints are currently
  // visible (otherwise the edge would point to a node that isn't mounted, and
  // ReactFlow drops it). The dashed amber styling distinguishes them from the
  // solid grey reporting-line edges produced by dagre.
  const edges = useMemo(() => {
    if (dottedLinks.length === 0) return solidEdges;
    const visible = new Set(flat.map((f) => f.node.id));
    const extras: Edge[] = [];
    for (const link of dottedLinks) {
      if (!visible.has(link.managerId) || !visible.has(link.employeeId)) continue;
      extras.push({
        id: `dotted-${link.managerId}-${link.employeeId}`,
        source: String(link.managerId),
        target: String(link.employeeId),
        type: 'smoothstep',
        style: { stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '4 4' },
        label: 'dotted',
        labelStyle: { fill: '#92400e', fontSize: 9, fontWeight: 600 },
        labelBgStyle: { fill: '#fef3c7' },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      });
    }
    return [...solidEdges, ...extras];
  }, [solidEdges, dottedLinks, flat]);

  const handleToggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastToggledRef.current = id;
  }, []);

  const handleOpen = useCallback(
    (id: number) => {
      router.push(`/employees/${id}`);
    },
    [router]
  );

  // Hydrate node data with the current callbacks + match/dim state.
  const nodes: Node[] = useMemo(
    () =>
      layoutNodes.map((rfNode, i) => {
        const f = flat[i];
        const hasChildren = f.node.reports.length > 0;
        const isExpanded = !collapsed.has(f.node.id);
        const isMatch = q ? nodeMatches(f.node, q) : false;
        const isDimmed = q ? !isMatch : false;
        return {
          ...rfNode,
          data: {
            node: f.node,
            tier: inferTier(f.node),
            hasChildren,
            isExpanded,
            isMatch,
            isDimmed,
            onToggle: handleToggle,
            onOpen: handleOpen,
          },
        };
      }),
    [layoutNodes, flat, collapsed, q, handleToggle, handleOpen]
  );

  // When the user searches, refit the view so matches are visible.
  const onSearch = useCallback(
    (v: string) => {
      setQuery(v);
      requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 400 });
      });
    },
    [fitView]
  );

  // After the layout re-runs from a toggle, center the camera on the just-
  // toggled card so the user sees their action take effect (rather than a
  // fitView that shrinks the whole subtree into oblivion).
  useEffect(() => {
    const id = lastToggledRef.current;
    if (id == null) return;
    const node = layoutNodes.find((n) => n.id === String(id));
    if (!node) return;
    // Centre slightly to the RIGHT of the toggled card (LR layout) so the
    // newly-expanded children appear in view to its right, with the parent
    // still visible on the left edge.
    setCenter(
      node.position.x + NODE_WIDTH / 2 + 200,
      node.position.y + NODE_HEIGHT / 2,
      { zoom: 0.85, duration: 400 }
    );
    lastToggledRef.current = null;
  }, [layoutNodes, setCenter]);

  // Refit on container resize. ReactFlow's `fitView` prop only fires once on
  // mount, so toggling the sidebar or rotating a tablet leaves the chart
  // misaligned. ResizeObserver + rAF dedupe gives us one fit per resize burst.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let frame = 0;
    const obs = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 200, minZoom: 0.15, maxZoom: 1.0 });
      });
    });
    obs.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
  }, [fitView]);

  // Bulk actions need a delay before fitView because ReactFlow's internal
  // node store updates in its own useEffect, AFTER React commits our new
  // nodes prop. setTimeout(120) lands well past that commit on both dev
  // (with strict-mode double-renders) and prod. rAF chains weren't enough.
  const expandAll = useCallback(() => {
    setExpanded(new Set(allNodeIds));
    setTimeout(() => fitView({ padding: 0.2, duration: 400, minZoom: 0.15, maxZoom: 1.0 }), 120);
  }, [allNodeIds, fitView]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
    setTimeout(() => fitView({ padding: 0.2, duration: 400, minZoom: 0.15, maxZoom: 1.0 }), 120);
  }, [fitView]);

  return (
    <div className="relative">
      {/* Toolbar — search + expand/collapse + counts */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {searchable && (
          <input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by name, empCode, designation, department…"
            className="h-9 w-full max-w-md rounded-md bg-white px-3 text-[13px] ring-1 ring-[rgba(228,228,231,0.85)] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        )}
        <button
          type="button"
          onClick={expandAll}
          className="h-8 rounded-md bg-white px-3 text-[12px] font-medium text-zinc-700 ring-1 ring-[rgba(228,228,231,0.85)] transition-colors hover:bg-zinc-50 hover:ring-zinc-300"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="h-8 rounded-md bg-white px-3 text-[12px] font-medium text-zinc-700 ring-1 ring-[rgba(228,228,231,0.85)] transition-colors hover:bg-zinc-50 hover:ring-zinc-300"
        >
          Collapse all
        </button>
        <div className="ml-auto text-[12px] text-zinc-500 tabular-nums">
          <span className="font-semibold text-zinc-900">{totalActive}</span> active
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className="relative h-[calc(100vh-220px)] min-h-[560px] w-full overflow-hidden rounded-lg ring-1 ring-[rgba(228,228,231,0.85)] bg-zinc-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.15, maxZoom: 1.0 }}
          minZoom={0.15}
          maxZoom={1.5}
          panOnScroll
          zoomOnScroll
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#cbd5e1', strokeWidth: 1.5 } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e4e7" />
          <Controls
            position="bottom-right"
            showInteractive={false}
            className="!shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function OrgChart(props: Props) {
  return (
    <ReactFlowProvider>
      <OrgChartInner {...props} />
    </ReactFlowProvider>
  );
}
