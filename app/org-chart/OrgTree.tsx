'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

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

interface Props {
  roots: OrgNode[];
  ancestry: OrgNode[]; // for non-admin: manager chain shown above the root
  focusEmployeeId: number | null;
  searchable: boolean;
  totalActive: number;
}

function fullName(n: OrgNode): string {
  return `${n.firstName} ${n.lastName}`;
}

type Tier = 'EXEC' | 'MANAGER' | 'LEAD' | 'IC';

interface TierStyle {
  label: string;
  className: string;
}

const TIER_STYLES: Record<Tier, TierStyle> = {
  EXEC: { label: 'Exec', className: 'bg-core-violetSoft text-core-violetFg border-core-border' },
  MANAGER: { label: 'Manager', className: 'bg-core-blueSoft text-core-blueFg border-core-border' },
  LEAD: { label: 'Lead', className: 'bg-core-green text-core-greenFg border-core-border' },
  IC: { label: 'IC', className: 'bg-core-surface2 text-core-text2 border-core-border' },
};

/**
 * Infer a seniority tier from the designation string. Used purely for
 * visual hint chips in the tree — doesn't affect permissions.
 */
function inferTier(node: OrgNode): Tier {
  const d = (node.designation || '').toLowerCase();
  // Executive level
  if (/(\b|^)(c[eo]o|ceo|cfo|cto|cmo|coo|chief|founder|president|vp|vice president|head of)/.test(d)) {
    return 'EXEC';
  }
  // Manager / director
  if (/\b(manager|director|head|controller)\b/.test(d)) {
    return 'MANAGER';
  }
  // If they have at least one direct report, treat as a manager regardless
  // of the title. Lots of senior ICs have "Engineer" titles but lead teams.
  if (node.reports.length > 0) {
    return /(\b)(lead|senior|principal|architect|sr\.?)\b/.test(d) ? 'LEAD' : 'MANAGER';
  }
  if (/\b(lead|senior|principal|architect|sr\.?)\b/.test(d)) {
    return 'LEAD';
  }
  return 'IC';
}

function matches(node: OrgNode, q: string): boolean {
  const haystack = `${fullName(node)} ${node.empCode} ${node.designation ?? ''} ${node.departmentName ?? ''}`.toLowerCase();
  return haystack.includes(q);
}

function nodeContainsMatch(node: OrgNode, q: string): boolean {
  if (!q) return true;
  if (matches(node, q)) return true;
  return node.reports.some((r) => nodeContainsMatch(r, q));
}

export default function OrgTree({
  roots,
  ancestry,
  focusEmployeeId,
  searchable,
  totalActive,
}: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Auto-expand: if searching, expand any node whose subtree contains a match.
  // Otherwise collapse all but the focused branch (if present).
  const initialExpanded = useMemo(() => {
    const set = new Set<number>();
    function walk(node: OrgNode, force: boolean) {
      const expand = force || node.id === focusEmployeeId;
      if (expand) set.add(node.id);
      node.reports.forEach((r) => walk(r, expand));
    }
    roots.forEach((r) => walk(r, true));
    ancestry.forEach((a) => set.add(a.id));
    return set;
  }, [roots, ancestry, focusEmployeeId]);

  const [expanded, setExpanded] = useState<Set<number>>(initialExpanded);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<number>();
    function walk(n: OrgNode) {
      all.add(n.id);
      n.reports.forEach(walk);
    }
    roots.forEach(walk);
    setExpanded(all);
  };

  const collapseAll = () => {
    setExpanded(new Set(focusEmployeeId ? [focusEmployeeId] : []));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {searchable && (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, empCode, designation, department…"
            className="form-input flex-1 min-w-[260px]"
          />
        )}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 rounded border border-core-border hover:border-core-text hover:bg-core-text/5"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1.5 rounded border border-core-border hover:border-core-text hover:bg-core-text/5"
          >
            Collapse all
          </button>
          <span className="ml-2 text-core-text3">{totalActive} active</span>
        </div>
      </div>

      {/* Manager chain breadcrumb (only on personal view) */}
      {ancestry.length > 0 && (
        <div className="rounded-lg p-3 bg-gradient-to-br from-slate-50 to-white border border-core-border">
          <p className="text-[10px] uppercase tracking-wider text-core-text3 mb-2">
            Reporting Line
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {ancestry.map((a, i) => (
              <span key={a.id} className="flex items-center gap-2">
                <Link
                  href={`/employees/${a.id}`}
                  className="inline-flex items-center gap-2 px-2 py-1 rounded bg-core-surface border border-core-border text-xs hover:border-core-text"
                >
                  <span className="w-5 h-5 rounded-full bg-core-surface2 text-core-text2 flex items-center justify-center text-[10px] font-bold">
                    {a.firstName[0]}
                    {a.lastName[0]}
                  </span>
                  <span>
                    <span className="font-medium">{fullName(a)}</span>
                    {a.designation ? (
                      <span className="text-core-text3"> · {a.designation}</span>
                    ) : null}
                  </span>
                </Link>
                {i < ancestry.length - 1 && <span className="text-core-text3">→</span>}
              </span>
            ))}
            <span className="text-core-text3">→</span>
            <span className="text-xs font-semibold text-core-text2">You</span>
          </div>
        </div>
      )}

      {roots.length === 0 ? (
        <div className="text-center text-core-text3 py-12">
          No tree to show.
        </div>
      ) : (
        <ul className="space-y-3">
          {roots
            .filter((r) => nodeContainsMatch(r, q))
            .map((r) => (
              <NodeView
                key={r.id}
                node={r}
                expanded={expanded}
                toggle={toggle}
                depth={0}
                query={q}
                isFocus={r.id === focusEmployeeId}
              />
            ))}
        </ul>
      )}
    </div>
  );
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-core-amberSoft text-core-text rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function NodeView({
  node,
  expanded,
  toggle,
  depth,
  query,
  isFocus,
}: {
  node: OrgNode;
  expanded: Set<number>;
  toggle: (id: number) => void;
  depth: number;
  query: string;
  isFocus: boolean;
}) {
  const hasReports = node.reports.length > 0;
  const isOpen = expanded.has(node.id);
  const visibleReports = node.reports.filter((r) => nodeContainsMatch(r, query));

  return (
    <li className="relative">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
          isFocus
            ? 'border-core-text bg-core-text/5'
            : 'border-core-border bg-core-surface hover:border-core-border'
        }`}
        style={{ marginLeft: depth > 0 ? 20 : 0 }}
      >
        <button
          type="button"
          onClick={() => toggle(node.id)}
          disabled={!hasReports}
          className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs ${
            hasReports ? 'hover:bg-core-surface2 text-core-text2' : 'opacity-30 cursor-default'
          }`}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          {hasReports ? (isOpen ? '▾' : '▸') : '·'}
        </button>

        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-core-text/20 to-core-text/5 flex items-center justify-center text-sm font-bold text-core-text2 flex-shrink-0">
          {node.firstName[0]}
          {node.lastName[0]}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/employees/${node.id}`}
              className="text-sm font-semibold text-core-text hover:text-core-text2 truncate"
            >
              {highlight(fullName(node), query)}
            </Link>
            {(() => {
              const tier = inferTier(node);
              const style = TIER_STYLES[tier];
              return (
                <span
                  className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${style.className}`}
                >
                  {style.label}
                </span>
              );
            })()}
            {isFocus && (
              <span className="text-[10px] uppercase tracking-wider text-core-text2 font-bold">
                You
              </span>
            )}
          </div>
          <p className="text-xs text-core-text3 truncate">
            <span className="mono">{highlight(node.empCode, query)}</span>
            {node.designation ? <> · {highlight(node.designation, query)}</> : null}
            {node.departmentName ? <> · {highlight(node.departmentName, query)}</> : null}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 text-xs text-core-text3">
          {node.activeAssetCount > 0 && (
            <span title="Active assets">📦 {node.activeAssetCount}</span>
          )}
          {hasReports && (
            <span title="Direct reports">👥 {node.reports.length}</span>
          )}
        </div>
      </div>

      {hasReports && isOpen && (
        <ul className="mt-2 ml-3 pl-3 border-l border-core-border space-y-2">
          {visibleReports.map((r) => (
            <NodeView
              key={r.id}
              node={r}
              expanded={expanded}
              toggle={toggle}
              depth={depth + 1}
              query={query}
              isFocus={false}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
