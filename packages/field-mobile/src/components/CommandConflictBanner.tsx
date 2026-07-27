import React from 'react';
import type { OutboxCommand } from '../types/index.js';

export interface CommandConflictBannerProps {
  conflictedCommands: OutboxCommand[];
  onAcceptServerState: (commandId: string) => void;
  onRetryNewVersion: (commandId: string, newVersion: number) => void;
}

export const CommandConflictBanner: React.FC<CommandConflictBannerProps> = ({
  conflictedCommands,
  onAcceptServerState,
  onRetryNewVersion,
}) => {
  if (conflictedCommands.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#fff1f0',
        border: '1px solid #ffa39e',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
      data-testid="conflict-banner-container"
    >
      <h3 style={{ margin: '0 0 8px 0', color: '#cf1322', fontSize: '16px' }}>
        ⚠️ Action Required: Version Conflict Detected
      </h3>
      <p style={{ margin: '0 0 12px 0', color: '#434343', fontSize: '14px' }}>
        One or more actions could not be saved because the dispatch job was updated on another device.
      </p>

      {conflictedCommands.map((cmd) => {
        const currentVer = cmd.error?.currentVersion ?? (cmd.expectedVersion ? cmd.expectedVersion + 1 : 1);

        return (
          <div
            key={cmd.id}
            style={{
              padding: '12px',
              backgroundColor: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #ffd591',
              marginBottom: '8px',
            }}
            data-testid={`conflict-item-${cmd.id}`}
          >
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
              Action: {cmd.type.replace('_', ' ')}
            </div>
            <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px' }}>
              Submitted Version: v{cmd.expectedVersion ?? '?'}, Current Server Version: v{currentVer}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#1890ff',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onClick={() => onAcceptServerState(cmd.id)}
                data-testid={`accept-server-btn-${cmd.id}`}
              >
                Accept Server State (v{currentVer})
              </button>

              <button
                type="button"
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#52c41a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onClick={() => onRetryNewVersion(cmd.id, currentVer)}
                data-testid={`retry-version-btn-${cmd.id}`}
              >
                Retry Command with v{currentVer}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
