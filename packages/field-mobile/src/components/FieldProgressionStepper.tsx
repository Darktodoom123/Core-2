import React from 'react';
import type { DispatchJob, DispatchStatus } from '../types/index.js';

export interface FieldProgressionStepperProps {
  job: DispatchJob;
  onTransitionStatus: (jobId: number, nextStatus: DispatchStatus, version: number) => void;
}

export const FieldProgressionStepper: React.FC<FieldProgressionStepperProps> = ({
  job,
  onTransitionStatus,
}) => {
  const progression = job.progression;

  if (!progression || !job.capabilities.can_update_status) {
    return (
      <div
        style={{
          padding: '12px',
          backgroundColor: '#fafafa',
          border: '1px solid #d9d9d9',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <span style={{ fontSize: '14px', color: '#8c8c8c' }}>
          Status progression is not active for this dispatch.
        </span>
      </div>
    );
  }

  const nextStep = progression.next;

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#ffffff',
        border: '1px solid #e8e8e8',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
      data-testid="field-progression-stepper"
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#262626' }}>
        🚀 Forward-Only Field Progression
      </h3>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
        {progression.steps.map((step) => {
          let bgColor = '#f0f0f0';
          let textColor = '#595959';
          let borderColor = '#d9d9d9';

          if (step.state === 'complete') {
            bgColor = '#f6ffed';
            textColor = '#389e0d';
            borderColor = '#b7eb8f';
          } else if (step.state === 'current') {
            bgColor = '#e6f7ff';
            textColor = '#096dd9';
            borderColor = '#91d5ff';
          }

          return (
            <div
              key={step.status.value}
              style={{
                padding: '6px 12px',
                backgroundColor: bgColor,
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: step.state === 'current' ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
              }}
              data-testid={`step-pill-${step.status.value}`}
            >
              {step.state === 'complete' ? '✓ ' : ''}
              {step.status.label}
            </div>
          );
        })}
      </div>

      {nextStep ? (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f9f9f9',
            borderLeft: '4px solid #1890ff',
            borderRadius: '4px',
          }}
          data-testid="next-step-card"
        >
          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#1890ff' }}>
            Next Milestone: {nextStep.confirmation_title}
          </div>
          <div style={{ fontSize: '13px', color: '#595959', marginBottom: '12px' }}>
            {nextStep.confirmation_message}
          </div>

          <button
            type="button"
            style={{
              padding: '10px 20px',
              backgroundColor: '#1890ff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
            }}
            onClick={() => onTransitionStatus(job.id, nextStep.status.value, job.version)}
            data-testid="advance-status-btn"
          >
            {nextStep.action_label} (v{job.version})
          </button>
        </div>
      ) : (
        <div style={{ fontSize: '14px', color: '#52c41a', fontWeight: 'bold' }}>
          ✓ {progression.message}
        </div>
      )}
    </div>
  );
};
