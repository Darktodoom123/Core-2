import React, { useState } from 'react';
import type { LocationCoordinates, LocationSharingService } from '../services/locationService.js';
import type { DispatchJob, User } from '../types/index.js';

export interface LocationSharingCardProps {
  user: User;
  job?: DispatchJob | null;
  locationService: LocationSharingService;
  getCurrentLocation?: () => Promise<LocationCoordinates>;
  onLocationQueued?: (commandId: string) => void;
}

export const LocationSharingCard: React.FC<LocationSharingCardProps> = ({
  user,
  job,
  locationService,
  getCurrentLocation,
  onLocationQueued,
}) => {
  const canShare = locationService.canShareLocation(user, job);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!canShare) {
    return null;
  }

  const handleShareNow = async () => {
    if (!getCurrentLocation) {
      setStatusMsg('Location provider is not available on this device.');

      return;
    }

    setIsLoading(true);

    try {
      const coords = await getCurrentLocation();
      const res = locationService.shareLocation(user, job ?? null, null, coords, 'Manual field check-in');

      if (res.success && res.commandId) {
        setStatusMsg(`Location queued for sync (ID: ${res.commandId.slice(0, 8)})`);

        if (onLocationQueued) {
          onLocationQueued(res.commandId);
        }
      } else {
        setStatusMsg(`Failed: ${res.reason}`);
      }
    } catch (error: unknown) {
      setStatusMsg(error instanceof Error ? error.message : 'Unable to read the device location.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#f6ffed',
        border: '1px solid #b7eb8f',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
      data-testid="location-sharing-card"
    >
      <h3 style={{ margin: '0 0 8px 0', color: '#274e13', fontSize: '16px' }}>
        📍 Own Location Sharing Active
      </h3>
      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#595959' }}>
        Location tracking is authorized for your active assignment under server policy rules.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          style={{
            padding: '8px 14px',
            backgroundColor: '#52c41a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '13px',
          }}
          disabled={isLoading || !getCurrentLocation}
          onClick={handleShareNow}
          data-testid="share-location-btn"
        >
          {isLoading ? 'Reading Device Location...' : getCurrentLocation ? 'Share Current Location Now' : 'Location Unavailable'}
        </button>

        {statusMsg ? (
          <span role="status" aria-live="polite" style={{ fontSize: '12px', color: '#389e0d' }} data-testid="location-status-msg">
            {statusMsg}
          </span>
        ) : null}
      </div>
    </div>
  );
};
