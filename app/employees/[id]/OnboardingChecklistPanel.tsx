'use client';

import { useEffect, useState } from 'react';

interface OnboardingTask {
  id: number;
  employeeId: number;
  category: string;
  title: string;
  description: string | null;
  ownerRole: string;
  dueDate: string | null;
  status: 'PENDING' | 'DONE' | 'SKIPPED';
  completedAt: string | null;
  completedBy: number | null;
  sortOrder: number;
  notes: string | null;
}

interface Props {
  employeeId: number;
}

const CATEGORY_META: Record<string, { label: string; accent: string }> = {
  IT: { label: 'IT Setup', accent: 'border-core-border bg-core-blueSoft' },
  HR: { label: 'HR Documentation', accent: 'border-core-border bg-core-greenSoft' },
  FINANCE: { label: 'Finance', accent: 'border-core-border bg-core-amberSoft' },
  MANAGER: { label: 'Manager', accent: 'border-core-border bg-core-violetSoft' },
};

export default function OnboardingChecklistPanel({ employeeId }: Props) {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/employees/${employeeId}/onboarding-tasks`, {
        cache: 'no-store',
      });
      if (!r.ok) throw new Error('Failed to load onboarding tasks');
      const data = await r.json();
      setTasks(data);
    } catch (e: any) {
      setError(e.message || 'Error loading tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const updateTask = async (
    taskId: number,
    status: 'PENDING' | 'DONE' | 'SKIPPED'
  ) => {
    setUpdating(taskId);
    try {
      const r = await fetch(`/api/onboarding-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error('Update failed');
      // Optimistically update locally
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                completedAt: status === 'DONE' ? new Date().toISOString() : null,
              }
            : t
        )
      );
    } catch (e: any) {
      alert(e.message || 'Failed to update task');
    } finally {
      setUpdating(null);
    }
  };

  const seedChecklist = async () => {
    if (!confirm('Create the default onboarding checklist for this employee?')) return;
    setSeeding(true);
    try {
      const r = await fetch(`/api/employees/${employeeId}/onboarding-tasks`, {
        method: 'POST',
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error || 'Seeding failed');
      }
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to seed checklist');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-core-surface rounded-xl border border-core-border shadow-sm p-6">
        <p className="text-core-text3 text-sm">Loading onboarding checklist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-core-surface rounded-xl border border-core-border shadow-sm p-6">
        <p className="text-core-roseFg text-sm">{error}</p>
        <button onClick={load} className="btn btn-secondary mt-3">
          Retry
        </button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-core-surface rounded-xl border border-core-border shadow-sm p-6 text-center">
        <h3 className="text-lg font-semibold text-core-text mb-2">
          No onboarding checklist yet
        </h3>
        <p className="text-sm text-core-text2 mb-4">
          This employee was created before auto-seeding, or their checklist was cleared.
          Generate the default IT + HR onboarding tasks now.
        </p>
        <button
          onClick={seedChecklist}
          disabled={seeding}
          className="btn btn-primary"
        >
          {seeding ? 'Creating...' : 'Generate Default Checklist'}
        </button>
      </div>
    );
  }

  // Group by category
  const grouped = tasks.reduce<Record<string, OnboardingTask[]>>((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  const totalDone = tasks.filter((t) => t.status === 'DONE').length;
  const totalPending = tasks.filter((t) => t.status === 'PENDING').length;
  const pct = Math.round((totalDone / tasks.length) * 100);

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="bg-core-surface rounded-xl border border-core-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-core-text">Onboarding Progress</h3>
            <p className="text-sm text-core-text2">
              {totalDone} of {tasks.length} tasks complete • {totalPending} pending
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-core-text2">{pct}%</div>
          </div>
        </div>
        <div className="w-full bg-core-border rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Category sections */}
      {Object.keys(grouped)
        .sort()
        .map((cat) => {
          const meta = CATEGORY_META[cat] || { label: cat, accent: 'border-core-border bg-core-surface2' };
          const catTasks = grouped[cat];
          const catDone = catTasks.filter((t) => t.status === 'DONE').length;
          return (
            <div
              key={cat}
              className={`rounded-xl border-2 shadow-sm ${meta.accent}`}
            >
              <div className="px-6 py-4 border-b border-core-border bg-core-surface/50 rounded-t-xl flex items-center justify-between">
                <h4 className="text-base font-semibold text-core-text">{meta.label}</h4>
                <span className="text-xs text-core-text2 font-medium">
                  {catDone}/{catTasks.length} done
                </span>
              </div>
              <div className="divide-y divide-core-border bg-core-surface rounded-b-xl">
                {catTasks.map((task) => {
                  const isDone = task.status === 'DONE';
                  const isSkipped = task.status === 'SKIPPED';
                  const isOverdue =
                    !isDone &&
                    !isSkipped &&
                    task.dueDate &&
                    new Date(task.dueDate) < new Date();

                  return (
                    <div
                      key={task.id}
                      className="px-6 py-4 flex items-start gap-4 hover:bg-core-surface2"
                    >
                      <button
                        onClick={() =>
                          updateTask(task.id, isDone ? 'PENDING' : 'DONE')
                        }
                        disabled={updating === task.id}
                        className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                          isDone
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-core-border hover:border-green-400 bg-core-surface'
                        } ${updating === task.id ? 'opacity-50' : ''}`}
                        aria-label={isDone ? 'Mark pending' : 'Mark done'}
                      >
                        {isDone && (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            isDone
                              ? 'text-core-text3 line-through'
                              : isSkipped
                              ? 'text-core-text3 italic'
                              : 'text-core-text'
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-xs text-core-text3 mt-0.5">
                            {task.description}
                          </div>
                        )}
                        <div className="text-xs mt-1 flex flex-wrap gap-3">
                          <span className="text-core-text3">
                            Owner: {task.ownerRole.replace(/_/g, ' ')}
                          </span>
                          {task.dueDate && (
                            <span
                              className={
                                isOverdue
                                  ? 'text-core-roseFg font-semibold'
                                  : 'text-core-text3'
                              }
                            >
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                              {isOverdue ? ' (overdue)' : ''}
                            </span>
                          )}
                          {task.completedAt && (
                            <span className="text-core-greenFg">
                              ✓ {new Date(task.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {!isDone && !isSkipped && (
                          <button
                            onClick={() => updateTask(task.id, 'SKIPPED')}
                            disabled={updating === task.id}
                            className="text-xs text-core-text3 hover:text-core-text2 px-2"
                          >
                            Skip
                          </button>
                        )}
                        {isSkipped && (
                          <button
                            onClick={() => updateTask(task.id, 'PENDING')}
                            disabled={updating === task.id}
                            className="text-xs text-core-blueFg hover:text-core-blueFg px-2"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
