import React from 'react';
import type { LocationCoordinates, LocationSharingService } from '../services/locationService.js';
import type { DispatchJob, DispatchStatus, OutboxCommand, User } from '../types/index.js';
import { AssignmentResponseCard } from './AssignmentResponseCard.js';
import { CommandConflictBanner } from './CommandConflictBanner.js';
import { FieldProgressionStepper } from './FieldProgressionStepper.js';
import { LocationSharingCard } from './LocationSharingCard.js';

export interface JobDetailScreenProps {
  job: DispatchJob;
  user: User;
  outboxCommands: OutboxCommand[];
  locationService: LocationSharingService;
  getCurrentLocation?: () => Promise<LocationCoordinates>;
  onBackToList: () => void;
  onAcceptAssignment: (jobId: number, assignmentId: number, version: number) => void;
  onRejectAssignment: (jobId: number, assignmentId: number, reason: string, version: number) => void;
  onTransitionStatus: (jobId: number, nextStatus: DispatchStatus, version: number) => void;
  onAcceptServerState: (commandId: string) => void;
  onRetryNewVersion: (commandId: string, newVersion: number) => void;
}

export const JobDetailScreen: React.FC<JobDetailScreenProps> = ({
  job,
  user,
  outboxCommands,
  locationService,
  getCurrentLocation,
  onBackToList,
  onAcceptAssignment,
  onRejectAssignment,
  onTransitionStatus,
  onAcceptServerState,
  onRetryNewVersion,
}) => {
  const jobConflicts = outboxCommands.filter(
    (c) => c.jobId === job.id && c.state === 'conflict'
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif' }}>
      <button
        type="button"
        style={{
          padding: '6px 12px',
          backgroundColor: '#f0f0f0',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '16px',
          fontSize: '13px',
        }}
        onClick={onBackToList}
        data-testid="back-to-list-btn"
      >
        ← Back to Assignments
      </button>

      {/* Version Conflict Banner */}
      <CommandConflictBanner
        conflictedCommands={jobConflicts}
        onAcceptServerState={onAcceptServerState}
        onRetryNewVersion={onRetryNewVersion}
      />

      {/* Header Info */}
      <div
        style={{
          padding: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#1890ff' }}>{job.reference}</h2>
          <span
            style={{
              padding: '4px 10px',
              backgroundColor: '#e6f7ff',
              color: '#1890ff',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '12px',
            }}
          >
            {job.status.label} (Version {job.version})
          </span>
        </div>

        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#262626' }}>
          {job.title} — {job.client}
        </h3>

        <div style={{ fontSize: '14px', color: '#434343', marginBottom: '4px' }}>
          <strong>📍 Site Location:</strong> {job.site}
        </div>
        {job.site_notes ? (
          <div style={{ fontSize: '13px', color: '#595959', fontStyle: 'italic', marginBottom: '8px' }}>
            Site Notes: {job.site_notes}
          </div>
        ) : null}

        {job.scheduled_start ? (
          <div style={{ fontSize: '13px', color: '#595959' }}>
            📅 Scheduled Start: {new Date(job.scheduled_start).toLocaleString()}
          </div>
        ) : null}
      </div>

      {/* Assignment Accept / Reject Card */}
      <AssignmentResponseCard
        job={job}
        onAccept={onAcceptAssignment}
        onReject={onRejectAssignment}
      />

      {/* Forward-Only Field Progression Stepper */}
      <FieldProgressionStepper job={job} onTransitionStatus={onTransitionStatus} />

      {/* Own Location Sharing Card */}
      <LocationSharingCard
        user={user}
        job={job}
        locationService={locationService}
        getCurrentLocation={getCurrentLocation}
      />

      {/* Team & Asset Assignments */}
      <div
        style={{
          padding: '16px',
          backgroundColor: '#ffffff',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
        }}
      >
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>Team & Asset Assignments</h4>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>Assigned Assets:</div>
          {job.asset_assignments && job.asset_assignments.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
              {job.asset_assignments.map((asset) => (
                <li key={asset.id}>
                  [{asset.asset_code}] {asset.asset_name} ({asset.asset_kind})
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: '13px', color: '#8c8c8c' }}>None assigned</span>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>Assigned Personnel:</div>
          {job.personnel_assignments && job.personnel_assignments.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
              {job.personnel_assignments.map((person) => (
                <li key={person.id}>
                  {person.user_name} — Status: {person.response_status_label}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: '13px', color: '#8c8c8c' }}>None assigned</span>
          )}
        </div>
      </div>
    </div>
  );
};
