import React from 'react';
import type { DispatchJob, OutboxCommand } from '../types/index.js';

export interface AssignedJobsListScreenProps {
  jobs: DispatchJob[];
  outboxCommands: OutboxCommand[];
  isLoading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onSelectJob: (jobId: number) => void;
}

export const AssignedJobsListScreen: React.FC<AssignedJobsListScreenProps> = ({
  jobs,
  outboxCommands,
  isLoading,
  error,
  onRefresh,
  onSelectJob,
}) => {
  const queuedCount = outboxCommands.filter((c) => c.state === 'queued').length;
  const syncingCount = outboxCommands.filter((c) => c.state === 'syncing').length;
  const failedCount = outboxCommands.filter((c) => c.state === 'failed').length;
  const conflictCount = outboxCommands.filter((c) => c.state === 'conflict').length;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#1f1f1f' }}>📱 Active Field Assignments</h1>
          <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Server-Authoritative Field Operations</span>
        </div>

        <button
          type="button"
          style={{
            padding: '8px 14px',
            backgroundColor: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
          onClick={onRefresh}
          disabled={isLoading}
          data-testid="refresh-jobs-btn"
        >
          {isLoading ? 'Syncing...' : '↻ Refresh'}
        </button>
      </header>

      {/* Outbox Status Bar */}
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          gap: '12px',
          padding: '10px 14px',
          backgroundColor: conflictCount > 0 ? '#fff1f0' : '#f5f5f5',
          border: `1px solid ${conflictCount > 0 ? '#ffa39e' : '#d9d9d9'}`,
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px',
        }}
        data-testid="outbox-status-bar"
      >
        <span style={{ fontWeight: 'bold' }}>Outbox Status:</span>
        <span style={{ color: '#1890ff' }}>Queued: {queuedCount}</span>
        <span style={{ color: '#fa8c16' }}>Syncing: {syncingCount}</span>
        <span style={{ color: '#ff4d4f' }}>Failed: {failedCount}</span>
        <span style={{ color: '#cf1322', fontWeight: conflictCount > 0 ? 'bold' : 'normal' }}>
          Conflicts: {conflictCount}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            padding: '12px',
            backgroundColor: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '6px',
            color: '#ff4d4f',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      ) : null}

      {jobs.length === 0 && !isLoading ? (
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            backgroundColor: '#fafafa',
            borderRadius: '8px',
            color: '#8c8c8c',
          }}
          data-testid="empty-assignments-msg"
        >
          No active assignments found for your account.
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {jobs.map((job) => {
          const isPending = job.my_assignment?.response_status === 'pending';
          const priorityColor =
            job.priority.value === 'emergency'
              ? '#ff4d4f'
              : job.priority.value === 'priority'
              ? '#fa8c16'
              : '#52c41a';

          return (
            <div
              key={job.id}
              onClick={() => onSelectJob(job.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectJob(job.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Open assignment ${job.reference}`}
              style={{
                padding: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e8e8e8',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                transition: 'border-color 0.2s',
              }}
              data-testid={`job-card-${job.id}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1890ff' }}>
                  {job.reference}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: `${priorityColor}15`,
                      color: priorityColor,
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}
                  >
                    {job.priority.label}
                  </span>

                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: '#e6f7ff',
                      color: '#1890ff',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  >
                    {job.status.label} (v{job.version})
                  </span>
                </div>
              </div>

              <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                {job.title} — {job.client}
              </div>

              <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px' }}>
                📍 Site: {job.site}
              </div>

              {isPending ? (
                <div
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: '4px',
                    color: '#d48806',
                    fontSize: '12px',
                    display: 'inline-block',
                  }}
                  data-testid={`pending-badge-${job.id}`}
                >
                  ⚠️ Response Pending
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
