'use client';

import { useState, useEffect } from 'react';
import PageHero from '@/app/components/PageHero';

interface EmailLogEntry {
  id: string;
  timestamp: string;
  to: string;
  subject: string;
  templateKey: string;
  preview: string;
}

export default function EmailLogPage() {
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEmailLog();
  }, []);

  const fetchEmailLog = async () => {
    try {
      const res = await fetch('/api/settings/email-log');
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (err) {
      console.error('Failed to fetch email log:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHero
        eyebrow="Settings / Email"
        title="Email Log"
        description="View all emails sent through the system (stub implementation)"
        actions={
          <button onClick={fetchEmailLog} className="btn btn-accent">
            Refresh
          </button>
        }
      />
      {/* Info Alert */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> This is a stub implementation. Emails are logged to the console and <code>/tmp/99tech-email-log.jsonl</code>.
          Configure SMTP settings to send actual emails.
        </p>
      </div>

      {/* Email List */}
      {loading ? (
        <div className="text-center py-12 card">
          <p className="text-gray-500">Loading email log...</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <div className="text-4xl mb-4">📧</div>
            <p className="text-gray-600 font-semibold">No emails logged yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Emails sent through the system will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <div key={email.id} className="card hover:shadow-md transition-all">
              <div className="card-body">
                <div className="flex items-start gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}>
                  <div className="text-2xl flex-shrink-0">📧</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold" style={{ color: '#0B1F3A' }}>{email.subject}</h3>
                        <p className="text-sm mt-1" style={{ color: '#44474D' }}>To: {email.to}</p>
                        <p className="text-xs mt-1" style={{ color: '#75777E' }}>
                          Template: <span className="badge badge-blue">{email.templateKey}</span>
                        </p>
                        <p className="text-xs mono mt-1" style={{ color: '#C4C6CE' }}>
                          {new Date(email.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                          expandedId === email.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </div>

                    {/* Expanded Preview */}
                    {expandedId === email.id && (
                      <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(196, 198, 206, 0.28)' }}>
                        <p className="text-sm p-3 rounded-lg" style={{ color: '#44474D', backgroundColor: '#F8F9FF' }}>
                          {email.preview}
                          {email.preview.length === 200 && '...'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
