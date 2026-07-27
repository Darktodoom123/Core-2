import type { ErrorInfo, ReactNode} from 'react';
import React, { useState, useEffect, useCallback, Component, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { LoginScreen } from '../auth/LoginScreen.js';
import { AssignedJobsListScreen } from '../components/AssignedJobsListScreen.js';
import { JobDetailScreen } from '../components/JobDetailScreen.js';
import { CommandOutboxManager, createCommandId } from '../services/commandOutbox.js';
import { LocationSharingService } from '../services/locationService.js';
import type { DispatchJob, DispatchStatus, OutboxCommand } from '../types/index.js';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught mobile boundary error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={styles.errorContainer} role="alert">
          <h2>Mobile Application Exception</h2>
          <p>{this.state.error?.message || 'An unexpected error occurred in the native mobile shell.'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={styles.retryButton}
          >
            Reset Application Shell
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const AppNavigator: React.FC = () => {
  const { user, status, logout, isInitializing, apiClient, error: authError } = useAuth();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<DispatchJob[]>([]);
  const [outboxCommands] = useState<OutboxCommand[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const commandOutbox = useMemo(() => new CommandOutboxManager(), []);
  const locationService = useMemo(() => new LocationSharingService(commandOutbox), [commandOutbox]);

  const fetchJobs = useCallback(async () => {
    if (status !== 'authenticated') {
return;
}

    setIsLoadingJobs(true);
    setJobsError(null);

    try {
      const fetchedJobs = await apiClient.fetchAssignedJobs();
      setJobs(fetchedJobs || []);
    } catch (err: unknown) {
      setJobsError(err instanceof Error ? err.message : 'Failed to fetch assigned dispatches.');
    } finally {
      setIsLoadingJobs(false);
    }
  }, [status, apiClient]);

  useEffect(() => {
    if (status === 'authenticated') {
      queueMicrotask(() => {
        void fetchJobs();
      });
    } else {
      queueMicrotask(() => {
        setJobs([]);
        setSelectedJobId(null);
      });
    }
  }, [status, fetchJobs]);

  const handleSelectJob = useCallback((jobId: number) => {
    setSelectedJobId(jobId);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedJobId(null);
  }, []);

  const handleAcceptAssignment = useCallback(
    async (jobId: number, assignmentId: number, version: number) => {
      setIsLoadingJobs(true);

      try {
        const updated = await apiClient.respondAssignment(
          jobId,
          assignmentId,
          'accepted',
          undefined,
          version,
          createCommandId()
        );
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      } catch (err: unknown) {
        setJobsError(err instanceof Error ? err.message : 'Failed to accept assignment.');
      } finally {
        setIsLoadingJobs(false);
      }
    },
    [apiClient]
  );

  const handleRejectAssignment = useCallback(
    async (jobId: number, assignmentId: number, reason: string, version: number) => {
      setIsLoadingJobs(true);

      try {
        const updated = await apiClient.respondAssignment(
          jobId,
          assignmentId,
          'rejected',
          reason,
          version,
          createCommandId()
        );
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      } catch (err: unknown) {
        setJobsError(err instanceof Error ? err.message : 'Failed to reject assignment.');
      } finally {
        setIsLoadingJobs(false);
      }
    },
    [apiClient]
  );

  const handleTransitionStatus = useCallback(
    async (jobId: number, nextStatus: DispatchStatus, version: number) => {
      setIsLoadingJobs(true);

      try {
        const updated = await apiClient.transitionStatus(
          jobId,
          nextStatus,
          version,
          createCommandId()
        );
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      } catch (err: unknown) {
        setJobsError(err instanceof Error ? err.message : 'Failed to progress status.');
      } finally {
        setIsLoadingJobs(false);
      }
    },
    [apiClient]
  );

  const handleAcceptServerState = useCallback(
    (commandId: string) => {
      commandOutbox.resolveConflictAcceptServer(commandId);
      fetchJobs();
    },
    [commandOutbox, fetchJobs]
  );

  const handleRetryNewVersion = useCallback(
    (commandId: string, newVersion: number) => {
      void commandOutbox.resolveConflictWithNewVersion(commandId, newVersion, apiClient);
      fetchJobs();
    },
    [commandOutbox, fetchJobs, apiClient]
  );

  if (isInitializing) {
    return (
      <div style={styles.loadingContainer} role="status" aria-live="polite">
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Initializing Core 2 Field Mobile...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  if (status === 'suspended') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={{ color: '#ef4444' }}>Account Suspended</h2>
          <p>{authError || 'This account is suspended. Contact a system administrator.'}</p>
          <button onClick={logout} style={styles.actionButton}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  const activeJob = jobs.find((j) => j.id === selectedJobId) || null;

  return (
    <ErrorBoundary>
      <div style={styles.appShell}>
        {/* Top Header Navigation Bar */}
        <header style={styles.header} role="banner">
          <div style={styles.headerBrand}>
            <span style={styles.headerTitle}>Core 2 Mobile</span>
            {selectedJobId !== null && (
              <button
                onClick={handleBackToList}
                style={styles.backButton}
                aria-label="Back to assigned jobs list"
              >
                ← Back to Jobs
              </button>
            )}
          </div>

          <div style={styles.userProfile}>
            <div style={styles.userInfo}>
              <span style={styles.userName}>{user?.name}</span>
              <span style={styles.roleBadge}>{user?.role}</span>
            </div>
            <button
              onClick={logout}
              style={styles.logoutButton}
              aria-label="Sign out of field app"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main style={styles.mainContent} role="main">
          {selectedJobId === null || !activeJob || !user ? (
            <AssignedJobsListScreen
              jobs={jobs}
              outboxCommands={outboxCommands}
              isLoading={isLoadingJobs}
              error={jobsError}
              onRefresh={fetchJobs}
              onSelectJob={handleSelectJob}
            />
          ) : (
            <JobDetailScreen
              job={activeJob}
              user={user}
              outboxCommands={outboxCommands}
              locationService={locationService}
              onBackToList={handleBackToList}
              onAcceptAssignment={handleAcceptAssignment}
              onRejectAssignment={handleRejectAssignment}
              onTransitionStatus={handleTransitionStatus}
              onAcceptServerState={handleAcceptServerState}
              onRetryNewVersion={handleRetryNewVersion}
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
};

const styles: Record<string, React.CSSProperties> = {
  appShell: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #334155',
    borderTop: '4px solid #d97706',
    borderRadius: '50%',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '16px',
    color: '#94a3b8',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: '12px 20px',
    borderBottom: '1px solid #334155',
  },
  headerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f59e0b',
  },
  backButton: {
    minHeight: '44px',
    padding: '8px 14px',
    backgroundColor: '#334155',
    color: '#f8fafc',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '600',
  },
  roleBadge: {
    fontSize: '11px',
    backgroundColor: '#334155',
    color: '#cbd5e1',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    marginTop: '2px',
  },
  logoutButton: {
    minHeight: '44px',
    padding: '8px 14px',
    backgroundColor: '#b91c1c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    padding: '20px',
  },
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: '20px',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: '24px',
    borderRadius: '8px',
    maxWidth: '400px',
    textAlign: 'center',
  },
  actionButton: {
    minHeight: '44px',
    marginTop: '16px',
    padding: '10px 20px',
    backgroundColor: '#d97706',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  errorContainer: {
    padding: '40px',
    textAlign: 'center',
    backgroundColor: '#0f172a',
    color: '#ef4444',
  },
  retryButton: {
    minHeight: '44px',
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#334155',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
