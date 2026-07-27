import React, { useState } from 'react';
import { useAuth } from './AuthContext.js';

export interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { login, error, clearError, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('Field Mobile Device');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
return;
}

    setIsSubmitting(true);

    try {
      await login(email.trim(), password, deviceName);

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container} role="region" aria-label="Field Mobile Login">
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.badge}>Core 2 Field App</div>
          <h1 style={styles.title}>Sign in to your account</h1>
          <p style={styles.subtitle}>
            Enter your credentials to access assigned field jobs and equipment dispatches.
          </p>
        </div>

        {error && (
          <div
            style={styles.errorBanner}
            role="alert"
            aria-live="assertive"
          >
            <span style={styles.errorIcon}>⚠️</span>
            <span style={styles.errorText}>{error}</span>
            <button
              type="button"
              onClick={clearError}
              style={styles.closeErrorButton}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {status === 'suspended' && (
          <div style={styles.suspendedBanner} role="alert">
            <strong>Account Suspended:</strong> This account has been suspended by a system administrator. Access to field mobile operations is disabled.
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label htmlFor="field-email" style={styles.label}>
              Email Address
            </label>
            <input
              id="field-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="worker@example.com"
              required
              disabled={isSubmitting}
              style={styles.input}
              aria-required="true"
              aria-invalid={!!error}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="field-password" style={styles.label}>
              Password
            </label>
            <input
              id="field-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isSubmitting}
              style={styles.input}
              aria-required="true"
              aria-invalid={!!error}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="field-device-name" style={styles.label}>
              Device Identification
            </label>
            <input
              id="field-device-name"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Field Tablet #4"
              disabled={isSubmitting}
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password.trim()}
            style={{
              ...styles.submitButton,
              opacity: isSubmitting || !email.trim() || !password.trim() ? 0.6 : 1,
            }}
            aria-label="Sign in to field app"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#f8fafc',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    border: '1px solid #334155',
  },
  header: {
    marginBottom: '24px',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '9999px',
    backgroundColor: '#d97706',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.4',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#7f1d1d',
    border: '1px solid #b91c1c',
    color: '#fecaca',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  errorIcon: {
    fontSize: '16px',
  },
  errorText: {
    flex: 1,
  },
  closeErrorButton: {
    background: 'none',
    border: 'none',
    color: '#fecaca',
    cursor: 'pointer',
    fontSize: '16px',
    minHeight: '44px',
    minWidth: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suspendedBanner: {
    backgroundColor: '#991b1b',
    color: '#ffffff',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  input: {
    minHeight: '44px',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #475569',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '16px',
    outline: 'none',
  },
  submitButton: {
    minHeight: '44px',
    backgroundColor: '#d97706',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
