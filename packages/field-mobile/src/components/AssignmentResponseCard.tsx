import React, { useState } from 'react';
import type { DispatchJob } from '../types/index.js';

export interface AssignmentResponseCardProps {
  job: DispatchJob;
  onAccept: (jobId: number, assignmentId: number, version: number) => void;
  onReject: (jobId: number, assignmentId: number, reason: string, version: number) => void;
}

export const AssignmentResponseCard: React.FC<AssignmentResponseCardProps> = ({
  job,
  onAccept,
  onReject,
}) => {
  const myAssignment = job.my_assignment;
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!myAssignment || myAssignment.response_status !== 'pending') {
    return null;
  }

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();

    if (!trimmed) {
      setErrorMsg('A rejection reason is required.');

      return;
    }

    setErrorMsg('');
    onReject(job.id, myAssignment.id, trimmed, job.version);
    setShowRejectInput(false);
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#e6f7ff',
        border: '1px solid #91d5ff',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
      data-testid="assignment-response-card"
    >
      <h3 style={{ margin: '0 0 8px 0', color: '#0050b3', fontSize: '16px' }}>
        📋 Assignment Response Required
      </h3>
      <p style={{ margin: '0 0 12px 0', color: '#262626', fontSize: '14px' }}>
        You have been assigned to {job.reference} ({job.title}). Please accept or reject this assignment.
      </p>

      {!showRejectInput ? (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              backgroundColor: '#52c41a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
            onClick={() => onAccept(job.id, myAssignment.id, job.version)}
            data-testid="accept-assignment-btn"
          >
            Accept Assignment
          </button>

          <button
            type="button"
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff4d4f',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
            onClick={() => setShowRejectInput(true)}
            data-testid="reject-assignment-btn"
          >
            Reject Assignment
          </button>
        </div>
      ) : (
        <form onSubmit={handleRejectSubmit} style={{ marginTop: '8px' }}>
          <div style={{ marginBottom: '8px' }}>
            <label
              htmlFor="rejection-reason-input"
              style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}
            >
              Rejection Reason (Required):
            </label>
            <input
              id="rejection-reason-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. On mandatory rest cycle or equipment conflict"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
              }}
              data-testid="rejection-reason-input"
            />
            {errorMsg ? (
              <span style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                {errorMsg}
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              style={{
                padding: '6px 14px',
                backgroundColor: '#ff4d4f',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              data-testid="submit-rejection-btn"
            >
              Confirm Rejection
            </button>

            <button
              type="button"
              style={{
                padding: '6px 14px',
                backgroundColor: '#d9d9d9',
                color: '#262626',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setShowRejectInput(false);
                setErrorMsg('');
              }}
              data-testid="cancel-rejection-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
