import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Eye,
    EyeOff,
    Globe,
    KeyRound,
    Laptop,
    Loader2,
    Lock,
    LogIn,
    LogOut,
    Mail,
    MapPin,
    Moon,
    Network,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    Sun,
    Tablet,
    User as UserIcon,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { DevUserSwitcher } from '@/components/dev-user-switcher';
import { Button, Input, Label, Modal } from '@/components/ui';
import { useTheme } from '@/lib/use-theme';
import { cn } from '@/lib/utils';

export interface ActiveSession {
    id: string;
    is_current: boolean;
    ip_address: string;
    browser: string;
    platform: string;
    device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    device_label: string;
    location: string;
    last_active_at: string;
    last_active_human: string;
}

export interface SecurityActivityEvent {
    id: number;
    action: string;
    event_label: string;
    outcome: string;
    ip_address: string;
    device_label: string;
    location: string;
    occurred_at: string;
    occurred_at_human: string;
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface TrustedDeviceItem {
    id: string;
    device_label: string;
    platform: string;
    ip_address: string;
    location: string;
    is_current: boolean;
    last_used_at: string | null;
    last_used_human: string;
    expires_at: string;
    expires_human: string;
}

export interface AccountPageProps {
    profile: {
        name: string;
        username: string;
        email: string;
        email_verified: boolean;
        phone: string | null;
        role?: string | null;
        role_label?: string;
        account_status: 'active' | 'suspended' | 'inactive';
        account_status_label: string;
        permissions?: string[];
    };
    security: {
        email_otp_enabled: boolean;
        has_verified_email: boolean;
    };
    trusted_devices?: TrustedDeviceItem[];
    sessions: ActiveSession[];
    recent_activity: {
        data: SecurityActivityEvent[];
        current_page: number;
        last_page: number;
        prev_page_url: string | null;
        next_page_url: string | null;
        links: PaginationLink[];
        total: number;
    };
    current_tab?: 'profile' | 'security' | 'activity';
    status?: string;
}

/**
 * Renders an understated inline indicator for resolved network or geographic location.
 */
export function LocationBadge({
    location,
    ip,
    className,
}: {
    location?: string | null;
    ip: string;
    className?: string;
}) {
    const trimmed = (location || '').trim();
    const locLower = trimmed.toLowerCase();
    const isLocal =
        locLower.includes('local') ||
        locLower.includes('private') ||
        locLower.includes('loopback') ||
        locLower.includes('link-local');
    const isUnavailable =
        !trimmed ||
        locLower.includes('unavailable') ||
        locLower.includes('unknown');

    if (isLocal) {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1.5 text-xs text-ink-soft select-none',
                    className,
                )}
                title={`Internal/Private Network address: ${ip}`}
            >
                <Network
                    className="h-3.5 w-3.5 shrink-0 text-ink-soft/70"
                    aria-hidden="true"
                />
                <span className="truncate">{trimmed}</span>
            </span>
        );
    }

    if (isUnavailable) {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1.5 text-xs text-ink-soft/60 select-none',
                    className,
                )}
                title={`Approximate location could not be determined for IP ${ip}`}
            >
                <Globe
                    className="h-3.5 w-3.5 shrink-0 text-ink-soft/50"
                    aria-hidden="true"
                />
                <span className="truncate">
                    {trimmed || 'Unknown Location'}
                </span>
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 text-xs text-ink-soft select-none',
                className,
            )}
            title={`Approximate geographic location for IP ${ip}`}
        >
            <MapPin
                className="h-3.5 w-3.5 shrink-0 text-ink-soft/80"
                aria-hidden="true"
            />
            <span className="truncate text-ink">{trimmed}</span>
        </span>
    );
}

function DeviceIcon({
    deviceType,
    className,
}: {
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    className?: string;
}) {
    switch (deviceType) {
        case 'mobile':
            return <Smartphone className={className} aria-hidden="true" />;
        case 'tablet':
            return <Tablet className={className} aria-hidden="true" />;
        case 'desktop':
        default:
            return <Laptop className={className} aria-hidden="true" />;
    }
}

function ActivityEventIcon({
    action,
    className,
}: {
    action: string;
    className?: string;
}) {
    switch (action) {
        case 'user.login':
            return <LogIn className={className} aria-hidden="true" />;
        case 'user.logout':
            return <LogOut className={className} aria-hidden="true" />;
        case 'user.password_changed':
            return <KeyRound className={className} aria-hidden="true" />;
        case 'user.email_otp_enabled':
        case 'user.email_otp_disabled':
            return <ShieldCheck className={className} aria-hidden="true" />;
        case 'user.session_revoked':
        case 'user.other_sessions_revoked':
            return <ShieldAlert className={className} aria-hidden="true" />;
        case 'user.email_updated':
            return <Mail className={className} aria-hidden="true" />;
        case 'user.profile_updated':
            return <UserIcon className={className} aria-hidden="true" />;
        default:
            return <Shield className={className} aria-hidden="true" />;
    }
}

export default function AccountSettings({
    profile,
    security,
    trusted_devices = [],
    sessions,
    recent_activity,
    current_tab = 'profile',
    status,
}: AccountPageProps) {
    const { resolvedTheme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<
        'profile' | 'security' | 'activity'
    >(current_tab);

    // Trusted Devices Management
    const [deviceToRevoke, setDeviceToRevoke] =
        useState<TrustedDeviceItem | null>(null);
    const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(
        null,
    );
    const [deviceToReportLost, setDeviceToReportLost] =
        useState<TrustedDeviceItem | null>(null);
    const [reportingLostDeviceId, setReportingLostDeviceId] = useState<
        string | null
    >(null);
    const [revokeAllDevicesModalOpen, setRevokeAllDevicesModalOpen] =
        useState(false);
    const [isRevokingAllDevices, setIsRevokingAllDevices] = useState(false);

    // Profile Phone Form with prop synchronization
    const phoneForm = useForm({
        phone: profile.phone ?? '',
    });
    const prevPhoneRef = useRef(profile.phone);

    useEffect(() => {
        if (prevPhoneRef.current !== profile.phone) {
            prevPhoneRef.current = profile.phone;
            phoneForm.setData('phone', profile.phone ?? '');
        }
    }, [profile.phone, phoneForm]);

    // Password Update Form
    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Email Change Modal State
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailStep, setEmailStep] = useState<'request' | 'verify'>('request');
    const [emailChallengeId, setEmailChallengeId] = useState('');
    const [emailCooldown, setEmailCooldown] = useState(0);
    const emailRequestForm = useForm({
        current_password: '',
        email: '',
    });
    const emailVerifyForm = useForm({
        challenge_id: '',
        code: '',
    });

    // OTP Enable / Disable Modal State
    const [otpModalOpen, setOtpModalOpen] = useState(false);
    const [otpAction, setOtpAction] = useState<'enable' | 'disable'>('enable');
    const [otpStep, setOtpStep] = useState<'password' | 'code'>('password');
    const [otpChallengeId, setOtpChallengeId] = useState('');
    const [otpCooldown, setOtpCooldown] = useState(0);
    const otpPasswordForm = useForm({
        current_password: '',
    });
    const otpCodeForm = useForm({
        challenge_id: '',
        code: '',
    });

    // Revoke Other Sessions Modal State
    const [revokeOthersModalOpen, setRevokeOthersModalOpen] = useState(false);
    const revokeOthersForm = useForm({
        current_password: '',
    });

    // Single Session Revocation State
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
        null,
    );
    const [sessionToRevoke, setSessionToRevoke] =
        useState<ActiveSession | null>(null);

    // Feedback message management
    const [dismissedStatus, setDismissedStatus] = useState<string | null>(null);
    const [localFeedback, setLocalFeedback] = useState<string | null>(null);
    const feedbackMessage =
        localFeedback ?? (status && status !== dismissedStatus ? status : null);
    const setFeedbackMessage = (msg: string | null) => {
        setLocalFeedback(msg);

        if (!msg && status) {
            setDismissedStatus(status);
        }
    };

    // Cooldown timers
    useEffect(() => {
        if (emailCooldown <= 0) {
            return;
        }

        const timer = setInterval(
            () => setEmailCooldown((p) => Math.max(0, p - 1)),
            1000,
        );

        return () => clearInterval(timer);
    }, [emailCooldown]);

    useEffect(() => {
        if (otpCooldown <= 0) {
            return;
        }

        const timer = setInterval(
            () => setOtpCooldown((p) => Math.max(0, p - 1)),
            1000,
        );

        return () => clearInterval(timer);
    }, [otpCooldown]);

    // Synchronize active tab with URL search parameter
    const handleTabChange = (
        targetTab: 'profile' | 'security' | 'activity',
    ) => {
        setActiveTab(targetTab);

        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', targetTab);
            window.history.replaceState(null, '', url.toString());
        }
    };

    // Keyboard tab navigation (WAI-ARIA accessibility standard: ArrowDown/ArrowRight, ArrowUp/ArrowLeft, Home, End)
    const handleTabKeyDown = (
        e: KeyboardEvent<HTMLButtonElement>,
        targetTab: 'profile' | 'security' | 'activity',
    ) => {
        const tabs: Array<'profile' | 'security' | 'activity'> = [
            'profile',
            'security',
            'activity',
        ];
        const currentIndex = tabs.indexOf(targetTab);

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextTab = tabs[(currentIndex + 1) % tabs.length];
            handleTabChange(nextTab);
            document.getElementById(`tab-${nextTab}`)?.focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prevTab =
                tabs[(currentIndex - 1 + tabs.length) % tabs.length];
            handleTabChange(prevTab);
            document.getElementById(`tab-${prevTab}`)?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            const firstTab = tabs[0];
            handleTabChange(firstTab);
            document.getElementById(`tab-${firstTab}`)?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            const lastTab = tabs[tabs.length - 1];
            handleTabChange(lastTab);
            document.getElementById(`tab-${lastTab}`)?.focus();
        }
    };

    // Handle Phone Update
    const handlePhoneSubmit = (e: FormEvent) => {
        e.preventDefault();
        phoneForm.patch('/account/profile', {
            preserveScroll: true,
            onSuccess: () => {
                setFeedbackMessage('Phone number updated.');
            },
        });
    };

    // Handle Password Update
    const handlePasswordSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (passwordForm.processing) {
            return;
        }

        passwordForm.post('/account/password', {
            preserveScroll: true,
            onSuccess: () => {
                passwordForm.reset();
                setFeedbackMessage(
                    'Password updated. Other sessions have been signed out.',
                );
            },
            onError: (errors) => {
                if (errors.current_password) {
                    passwordForm.reset(
                        'current_password',
                        'password',
                        'password_confirmation',
                    );
                } else {
                    passwordForm.reset('password', 'password_confirmation');
                }
            },
        });
    };

    // Handle Email Change Step 1: Request
    const handleEmailRequest = (e: FormEvent) => {
        e.preventDefault();
        emailRequestForm.post('/account/email/request', {
            preserveScroll: true,
            onSuccess: (page) => {
                const challenge = (page.props as any).challenge_id;

                if (challenge) {
                    setEmailChallengeId(challenge);
                    emailVerifyForm.setData('challenge_id', challenge);
                }

                setEmailStep('verify');
                setEmailCooldown(45);
            },
        });
    };

    // Handle Resend Email Code
    const handleResendEmailOtp = () => {
        if (emailCooldown > 0 || !emailChallengeId) {
            return;
        }

        router.post(
            '/account/security/otp/resend',
            {
                challenge_id: emailChallengeId,
                purpose: 'email_change',
            },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const challenge = (page.props as any).challenge_id;

                    if (challenge) {
                        setEmailChallengeId(challenge);
                        emailVerifyForm.setData('challenge_id', challenge);
                    }

                    setEmailCooldown(45);
                },
            },
        );
    };

    // Handle Email Change Step 2: Verify Code
    const handleEmailVerify = (e: FormEvent) => {
        e.preventDefault();

        if (emailVerifyForm.data.code.length !== 6) {
            return;
        }

        emailVerifyForm.post('/account/email/verify', {
            preserveScroll: true,
            onSuccess: () => {
                setEmailModalOpen(false);
                setEmailStep('request');
                emailRequestForm.reset();
                emailVerifyForm.reset();
                setFeedbackMessage('Email address updated.');
            },
        });
    };

    // Handle OTP Flow Step 1: Password Confirmation
    const handleOtpPasswordSubmit = (e: FormEvent) => {
        e.preventDefault();
        const endpoint =
            otpAction === 'enable'
                ? '/account/security/otp/request-enable'
                : '/account/security/otp/request-disable';

        otpPasswordForm.post(endpoint, {
            preserveScroll: true,
            onSuccess: (page) => {
                const challenge = (page.props as any).otp_challenge_id;

                if (challenge) {
                    setOtpChallengeId(challenge);
                    otpCodeForm.setData('challenge_id', challenge);
                }

                setOtpStep('code');
                setOtpCooldown(45);
            },
        });
    };

    // Handle OTP Flow Step 2: Code Verification
    const handleOtpCodeSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (otpCodeForm.data.code.length !== 6) {
            return;
        }

        const endpoint =
            otpAction === 'enable'
                ? '/account/security/otp/confirm-enable'
                : '/account/security/otp/confirm-disable';

        otpCodeForm.post(endpoint, {
            preserveScroll: true,
            onSuccess: () => {
                setOtpModalOpen(false);
                setOtpStep('password');
                otpPasswordForm.reset();
                otpCodeForm.reset();
                setFeedbackMessage(
                    otpAction === 'enable'
                        ? 'Two-factor authentication enabled.'
                        : 'Two-factor authentication disabled.',
                );
            },
        });
    };

    // Handle Resend OTP Code
    const handleResendOtp = () => {
        if (otpCooldown > 0) {
            return;
        }

        router.post(
            '/account/security/otp/resend',
            {
                challenge_id: otpChallengeId,
                purpose:
                    otpAction === 'enable'
                        ? 'enable_email_otp'
                        : 'disable_email_otp',
            },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const challenge = (page.props as any).otp_challenge_id;

                    if (challenge) {
                        setOtpChallengeId(challenge);
                        otpCodeForm.setData('challenge_id', challenge);
                    }

                    setOtpCooldown(45);
                },
            },
        );
    };

    // Handle Revoking a Single Session via Confirmation Modal
    const confirmRevokeSession = () => {
        if (!sessionToRevoke) {
            return;
        }

        const sessionId = sessionToRevoke.id;
        setRevokingSessionId(sessionId);
        router.delete(`/account/sessions/${sessionId}`, {
            preserveScroll: true,
            onFinish: () => {
                setRevokingSessionId(null);
                setSessionToRevoke(null);
            },
            onSuccess: () => {
                setFeedbackMessage('Session signed out.');
            },
        });
    };

    // Handle Revoking a Single Trusted Device
    const confirmRevokeDevice = () => {
        if (!deviceToRevoke) {
            return;
        }

        const deviceId = deviceToRevoke.id;
        setRevokingDeviceId(deviceId);
        router.delete(`/account/trusted-devices/${deviceId}`, {
            preserveScroll: true,
            onFinish: () => {
                setRevokingDeviceId(null);
                setDeviceToRevoke(null);
            },
            onSuccess: () => {
                setFeedbackMessage(
                    'Trusted device revoked. An email verification code will be required on next sign-in.',
                );
            },
        });
    };

    // Handle Revoking All Trusted Devices
    const handleRevokeAllDevices = (e: FormEvent) => {
        e.preventDefault();
        setIsRevokingAllDevices(true);
        router.post(
            '/account/trusted-devices/revoke-all',
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setIsRevokingAllDevices(false);
                    setRevokeAllDevicesModalOpen(false);
                },
                onSuccess: () => {
                    setFeedbackMessage(
                        'All trusted devices revoked. An email verification code will be required on next sign-in.',
                    );
                },
            },
        );
    };

    // Handle Reporting a Device Lost
    const confirmReportLost = () => {
        if (!deviceToReportLost) {
            return;
        }

        const deviceId = deviceToReportLost.id;
        setReportingLostDeviceId(deviceId);
        router.post(
            `/account/trusted-devices/${deviceId}/lost`,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setReportingLostDeviceId(null);
                    setDeviceToReportLost(null);
                },
                onSuccess: () => {
                    setFeedbackMessage(
                        'Device reported lost. Device trust and all associated active sessions and tokens have been revoked.',
                    );
                },
            },
        );
    };

    // Handle Revoking All Other Sessions
    const handleRevokeOtherSessions = (e: FormEvent) => {
        e.preventDefault();
        revokeOthersForm.post('/account/sessions/revoke-others', {
            preserveScroll: true,
            onSuccess: () => {
                setRevokeOthersModalOpen(false);
                revokeOthersForm.reset();
                setFeedbackMessage('All other sessions signed out.');
            },
        });
    };

    // Helper to ensure pagination keeps tab=activity
    const getTabUrl = (url: string | null) => {
        if (!url) {
            return null;
        }

        return url.includes('tab=')
            ? url
            : url.includes('?')
              ? `${url}&tab=activity`
              : `${url}?tab=activity`;
    };

    // User Initials for Monogram Avatar
    const userInitials =
        profile.name
            ?.trim()
            .split(/\s+/)
            .map((p) => p[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'U';

    const currentSession = sessions.find((s) => s.is_current) ?? sessions[0];
    const otherSessions = currentSession
        ? sessions.filter((s) => s.id !== currentSession.id)
        : [];

    return (
        <div className="min-h-screen bg-canvas font-sans text-ink">
            <Head title="My Account - Settings" />

            {/* Top Bar */}
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
                        title="Back to Operations Workspace"
                        aria-label="Back to Operations Workspace"
                    >
                        <ArrowLeft
                            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
                            aria-hidden="true"
                        />
                        <span>Workspace</span>
                    </Link>

                    <div className="h-4 w-px bg-line" aria-hidden="true" />

                    <h1 className="text-sm font-semibold text-ink">
                        My Account
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        size="icon"
                        variant="quiet"
                        onClick={toggleTheme}
                        aria-label={
                            resolvedTheme === 'dark'
                                ? 'Switch to light mode'
                                : 'Switch to dark mode'
                        }
                        title={
                            resolvedTheme === 'dark'
                                ? 'Switch to light mode'
                                : 'Switch to dark mode'
                        }
                        className="text-ink-soft hover:text-ink"
                    >
                        {resolvedTheme === 'dark' ? (
                            <Sun
                                className="h-4 w-4 text-brand-strong"
                                aria-hidden="true"
                            />
                        ) : (
                            <Moon
                                className="h-4 w-4 text-ink-soft"
                                aria-hidden="true"
                            />
                        )}
                    </Button>

                    <div className="hidden text-right sm:block">
                        <span className="max-w-48 truncate text-xs font-medium text-ink">
                            {profile.name}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content Layout */}
            <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Status Feedback Notification */}
                {feedbackMessage && (
                    <div
                        role="status"
                        className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-xs text-ink sm:text-sm"
                    >
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2
                                className="h-4 w-4 shrink-0 text-success"
                                aria-hidden="true"
                            />
                            <span>{feedbackMessage}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFeedbackMessage(null)}
                            className="rounded p-1 text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
                            aria-label="Dismiss feedback"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                    </div>
                )}

                {/* Two Columns on Desktop (Rail + Content) */}
                <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
                    {/* Navigation & Identity Rail */}
                    <aside className="space-y-4 lg:sticky lg:top-20">
                        {/* Profile Summary Card */}
                        <div className="rounded-xl border border-line bg-surface p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-subtle text-xs font-semibold text-ink">
                                    {userInitials}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate text-sm font-semibold text-ink">
                                        {profile.name}
                                    </h2>
                                    <p className="truncate text-xs text-ink-soft">
                                        @{profile.username}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-soft">
                                <span>Account status</span>
                                <span className="font-medium text-ink capitalize">
                                    {profile.account_status_label}
                                </span>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <nav
                            className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1 lg:flex-col lg:border-0 lg:bg-transparent lg:p-0"
                            aria-label="Account settings tabs"
                            role="tablist"
                        >
                            <button
                                type="button"
                                role="tab"
                                id="tab-profile"
                                tabIndex={activeTab === 'profile' ? 0 : -1}
                                aria-selected={activeTab === 'profile'}
                                aria-controls="panel-profile"
                                onClick={() => handleTabChange('profile')}
                                onKeyDown={(e) =>
                                    handleTabKeyDown(e, 'profile')
                                }
                                className={cn(
                                    'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand sm:text-sm lg:w-full',
                                    activeTab === 'profile'
                                        ? 'bg-surface-subtle font-semibold text-ink'
                                        : 'text-ink-soft hover:bg-surface-subtle/60 hover:text-ink',
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    <UserIcon
                                        className={cn(
                                            'h-4 w-4',
                                            activeTab === 'profile'
                                                ? 'text-ink'
                                                : 'text-ink-soft',
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span>Profile</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                role="tab"
                                id="tab-security"
                                tabIndex={activeTab === 'security' ? 0 : -1}
                                aria-selected={activeTab === 'security'}
                                aria-controls="panel-security"
                                onClick={() => handleTabChange('security')}
                                onKeyDown={(e) =>
                                    handleTabKeyDown(e, 'security')
                                }
                                className={cn(
                                    'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand sm:text-sm lg:w-full',
                                    activeTab === 'security'
                                        ? 'bg-surface-subtle font-semibold text-ink'
                                        : 'text-ink-soft hover:bg-surface-subtle/60 hover:text-ink',
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Shield
                                        className={cn(
                                            'h-4 w-4',
                                            activeTab === 'security'
                                                ? 'text-ink'
                                                : 'text-ink-soft',
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span>Security</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                role="tab"
                                id="tab-activity"
                                tabIndex={activeTab === 'activity' ? 0 : -1}
                                aria-selected={activeTab === 'activity'}
                                aria-controls="panel-activity"
                                onClick={() => handleTabChange('activity')}
                                onKeyDown={(e) =>
                                    handleTabKeyDown(e, 'activity')
                                }
                                className={cn(
                                    'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand sm:text-sm lg:w-full',
                                    activeTab === 'activity'
                                        ? 'bg-surface-subtle font-semibold text-ink'
                                        : 'text-ink-soft hover:bg-surface-subtle/60 hover:text-ink',
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Laptop
                                        className={cn(
                                            'h-4 w-4',
                                            activeTab === 'activity'
                                                ? 'text-ink'
                                                : 'text-ink-soft',
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span>Sign-in Activity</span>
                                </div>
                                <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-soft tabular-nums">
                                    {sessions.length}
                                </span>
                            </button>
                        </nav>
                    </aside>

                    {/* Main Content Area */}
                    <div className="min-w-0 flex-1 space-y-6">
                        {/* TAB 1: PROFILE */}
                        {activeTab === 'profile' && (
                            <div
                                id="panel-profile"
                                role="tabpanel"
                                tabIndex={0}
                                aria-labelledby="tab-profile"
                                className="space-y-6 focus:outline-none"
                            >
                                <div className="border-b border-line pb-3">
                                    <h3 className="text-base font-semibold text-ink sm:text-lg">
                                        Profile
                                    </h3>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        Personal information and contact
                                        methods.
                                    </p>
                                </div>

                                {/* Managed Account Notice */}
                                <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-subtle/40 p-3.5 text-xs text-ink-soft">
                                    <Lock
                                        className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft"
                                        aria-hidden="true"
                                    />
                                    <div className="leading-relaxed">
                                        <p>
                                            <strong className="font-semibold text-ink">
                                                Managed account:
                                            </strong>{' '}
                                            Name and username are managed by
                                            your administrator.
                                        </p>
                                    </div>
                                </div>

                                {/* Account Details */}
                                <div className="rounded-xl border border-line bg-surface">
                                    <div className="border-b border-line px-5 py-4">
                                        <h4 className="text-sm font-semibold text-ink">
                                            Account Details
                                        </h4>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            Organization identity credentials.
                                        </p>
                                    </div>
                                    <div className="divide-y divide-line text-xs sm:text-sm">
                                        <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="text-xs font-medium text-ink-soft sm:w-1/3">
                                                Full Name
                                            </span>
                                            <span className="font-medium text-ink sm:w-2/3">
                                                {profile.name}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="text-xs font-medium text-ink-soft sm:w-1/3">
                                                Username
                                            </span>
                                            <span className="text-ink sm:w-2/3">
                                                {profile.username}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="text-xs font-medium text-ink-soft sm:w-1/3">
                                                Account Status
                                            </span>
                                            <div className="flex items-center gap-2 sm:w-2/3">
                                                <span className="font-medium text-ink capitalize">
                                                    {
                                                        profile.account_status_label
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div className="rounded-xl border border-line bg-surface">
                                    <div className="border-b border-line px-5 py-4">
                                        <h4 className="text-sm font-semibold text-ink">
                                            Contact Information
                                        </h4>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            Your phone number and verified email
                                            address.
                                        </p>
                                    </div>
                                    <div className="divide-y divide-line text-xs sm:text-sm">
                                        {/* Email Row */}
                                        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="space-y-1 sm:w-2/3">
                                                <span className="block text-xs font-medium text-ink-soft">
                                                    Email Address
                                                </span>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium text-ink">
                                                        {profile.email}
                                                    </span>
                                                    {profile.email_verified ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-success">
                                                            <CheckCircle2
                                                                className="h-3.5 w-3.5"
                                                                aria-hidden="true"
                                                            />
                                                            <span>
                                                                Verified
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-xs text-warning-strong">
                                                            <span>
                                                                Unverified
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    setEmailStep('request');
                                                    emailRequestForm.reset();
                                                    emailRequestForm.clearErrors();
                                                    emailVerifyForm.reset();
                                                    emailVerifyForm.clearErrors();
                                                    setEmailModalOpen(true);
                                                }}
                                                className="self-start sm:self-auto"
                                            >
                                                Change email
                                            </Button>
                                        </div>

                                        {/* Phone Form */}
                                        <form
                                            onSubmit={handlePhoneSubmit}
                                            className="space-y-4 px-5 py-4"
                                        >
                                            <div className="space-y-1.5">
                                                <Label htmlFor="account_phone">
                                                    Phone Number
                                                </Label>
                                                <div className="max-w-sm">
                                                    <Input
                                                        id="account_phone"
                                                        type="tel"
                                                        placeholder="+1 (555) 000-0000"
                                                        value={
                                                            phoneForm.data.phone
                                                        }
                                                        onChange={(e) =>
                                                            phoneForm.setData(
                                                                'phone',
                                                                e.target.value,
                                                            )
                                                        }
                                                        maxLength={32}
                                                        error={
                                                            phoneForm.errors
                                                                .phone
                                                        }
                                                    />
                                                </div>
                                                {phoneForm.errors.phone ? (
                                                    <p
                                                        className="text-xs font-medium text-danger"
                                                        role="alert"
                                                    >
                                                        {phoneForm.errors.phone}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-ink-soft">
                                                        Used for dispatch
                                                        updates and shift
                                                        notifications.
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <Button
                                                    type="submit"
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={
                                                        phoneForm.processing ||
                                                        phoneForm.data.phone ===
                                                            (profile.phone ??
                                                                '')
                                                    }
                                                >
                                                    {phoneForm.processing ? (
                                                        <>
                                                            <Loader2
                                                                className="mr-1.5 h-3.5 w-3.5 animate-spin"
                                                                aria-hidden="true"
                                                            />
                                                            Saving…
                                                        </>
                                                    ) : (
                                                        'Save changes'
                                                    )}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: SECURITY */}
                        {activeTab === 'security' && (
                            <div
                                id="panel-security"
                                role="tabpanel"
                                tabIndex={0}
                                aria-labelledby="tab-security"
                                className="space-y-6 focus:outline-none"
                            >
                                <div className="border-b border-line pb-3">
                                    <h3 className="text-base font-semibold text-ink sm:text-lg">
                                        Security & Authentication
                                    </h3>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        Manage multi-factor authentication and
                                        credentials.
                                    </p>
                                </div>

                                {/* 2FA Card */}
                                <div className="rounded-xl border border-line bg-surface">
                                    <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-ink">
                                                Two-Factor Authentication (2FA)
                                            </h4>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                Add an extra layer of security
                                                to your account with email
                                                verification codes.
                                            </p>
                                        </div>
                                        {security.email_otp_enabled ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                                                <CheckCircle2
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                />
                                                <span>Enabled</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-ink-soft">
                                                Disabled
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-4 px-5 py-4">
                                        {!security.has_verified_email ? (
                                            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-warning-strong">
                                                <AlertTriangle
                                                    className="mt-0.5 h-4 w-4 shrink-0"
                                                    aria-hidden="true"
                                                />
                                                <p>
                                                    Verify your email address
                                                    before enabling two-factor
                                                    authentication.
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-ink-soft">
                                                {security.email_otp_enabled
                                                    ? 'Verification codes are sent to your email at sign-in.'
                                                    : 'A single-use verification code will be required when signing in.'}{' '}
                                                Delivered to{' '}
                                                <span className="font-medium text-ink">
                                                    {profile.email}
                                                </span>
                                                .
                                            </p>
                                        )}

                                        <div className="flex items-center gap-3">
                                            {security.email_otp_enabled ? (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        disabled={
                                                            profile.role ===
                                                            'system_administrator'
                                                        }
                                                        title={
                                                            profile.role ===
                                                            'system_administrator'
                                                                ? 'Email verification is mandatory for System Administrators by organizational policy.'
                                                                : undefined
                                                        }
                                                        onClick={() => {
                                                            if (
                                                                profile.role ===
                                                                'system_administrator'
                                                            ) {
                                                                return;
                                                            }

                                                            setOtpAction(
                                                                'disable',
                                                            );
                                                            setOtpStep(
                                                                'password',
                                                            );
                                                            otpPasswordForm.reset();
                                                            otpPasswordForm.clearErrors();
                                                            otpCodeForm.reset();
                                                            otpCodeForm.clearErrors();
                                                            setOtpModalOpen(
                                                                true,
                                                            );
                                                        }}
                                                    >
                                                        {profile.role ===
                                                        'system_administrator'
                                                            ? 'Enforced'
                                                            : 'Disable 2FA'}
                                                    </Button>
                                                    {profile.role ===
                                                        'system_administrator' && (
                                                        <span className="text-xs text-ink-soft">
                                                            Mandatory for System
                                                            Administrators by
                                                            organizational
                                                            policy.
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={
                                                        !security.has_verified_email
                                                    }
                                                    onClick={() => {
                                                        setOtpAction('enable');
                                                        setOtpStep('password');
                                                        otpPasswordForm.reset();
                                                        otpPasswordForm.clearErrors();
                                                        otpCodeForm.reset();
                                                        otpCodeForm.clearErrors();
                                                        setOtpModalOpen(true);
                                                    }}
                                                >
                                                    Enable 2FA
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Trusted Devices Card */}
                                <div className="rounded-xl border border-line bg-surface">
                                    <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-ink">
                                                Trusted Devices
                                            </h4>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                Browsers and mobile devices you
                                                trust bypass email verification
                                                codes for 30 days. Revoking
                                                trust requires an email code on
                                                your next sign-in, but leaves
                                                active sessions open. To
                                                immediately terminate access,
                                                use Sign-in Activity or report a
                                                lost device.
                                            </p>
                                        </div>
                                        {trusted_devices.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() =>
                                                    setRevokeAllDevicesModalOpen(
                                                        true,
                                                    )
                                                }
                                                className="shrink-0 self-start sm:self-auto"
                                            >
                                                Revoke all trusted devices
                                            </Button>
                                        )}
                                    </div>

                                    <div className="divide-y divide-line">
                                        {trusted_devices.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-ink-soft">
                                                No trusted devices registered.
                                                You will be prompted for an
                                                email verification code each
                                                time you sign in from a new
                                                browser or device.
                                            </div>
                                        ) : (
                                            trusted_devices.map((device) => {
                                                const isMobilePlatform =
                                                    device.platform
                                                        .toLowerCase()
                                                        .includes('ios') ||
                                                    device.platform
                                                        .toLowerCase()
                                                        .includes('android');

                                                return (
                                                    <div
                                                        key={device.id}
                                                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                                                    >
                                                        <div className="flex items-start gap-3.5">
                                                            <div className="mt-0.5 text-ink-soft">
                                                                {isMobilePlatform ? (
                                                                    <Smartphone
                                                                        className="h-5 w-5"
                                                                        aria-hidden="true"
                                                                    />
                                                                ) : (
                                                                    <Laptop
                                                                        className="h-5 w-5"
                                                                        aria-hidden="true"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-sm font-medium text-ink">
                                                                        {
                                                                            device.device_label
                                                                        }
                                                                    </span>
                                                                    {device.is_current && (
                                                                        <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
                                                                            This
                                                                            device
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                                                                    <span className="font-mono text-xs">
                                                                        {
                                                                            device.ip_address
                                                                        }
                                                                    </span>
                                                                    <span>
                                                                        ·
                                                                    </span>
                                                                    <LocationBadge
                                                                        location={
                                                                            device.location
                                                                        }
                                                                        ip={
                                                                            device.ip_address
                                                                        }
                                                                    />
                                                                    <span>
                                                                        ·
                                                                    </span>
                                                                    <span>
                                                                        Trust
                                                                        expires{' '}
                                                                        {
                                                                            device.expires_human
                                                                        }
                                                                    </span>
                                                                    {device.last_used_human && (
                                                                        <>
                                                                            <span>
                                                                                ·
                                                                            </span>
                                                                            <span>
                                                                                Last
                                                                                active{' '}
                                                                                {
                                                                                    device.last_used_human
                                                                                }
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 self-end sm:self-center">
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() =>
                                                                    setDeviceToRevoke(
                                                                        device,
                                                                    )
                                                                }
                                                                disabled={
                                                                    revokingDeviceId ===
                                                                    device.id
                                                                }
                                                            >
                                                                {revokingDeviceId ===
                                                                device.id ? (
                                                                    <>
                                                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                        Revoking…
                                                                    </>
                                                                ) : (
                                                                    'Revoke trust'
                                                                )}
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="quiet"
                                                                size="sm"
                                                                className="text-danger hover:bg-danger-soft hover:text-danger-strong"
                                                                onClick={() =>
                                                                    setDeviceToReportLost(
                                                                        device,
                                                                    )
                                                                }
                                                                disabled={
                                                                    reportingLostDeviceId ===
                                                                    device.id
                                                                }
                                                            >
                                                                Report lost
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Change Password Card */}
                                <div className="rounded-xl border border-line bg-surface">
                                    <div className="border-b border-line px-5 py-4">
                                        <h4 className="text-sm font-semibold text-ink">
                                            Change Password
                                        </h4>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            Update your account password.
                                        </p>
                                    </div>

                                    <form
                                        onSubmit={handlePasswordSubmit}
                                        className="max-w-md space-y-4 px-5 py-4"
                                    >
                                        <p className="text-xs text-ink-soft">
                                            Changing your password signs out all
                                            other web sessions.
                                        </p>

                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="current_password"
                                                required
                                            >
                                                Current Password
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="current_password"
                                                    name="current_password"
                                                    type={
                                                        showCurrentPassword
                                                            ? 'text'
                                                            : 'password'
                                                    }
                                                    autoComplete="current-password"
                                                    disabled={
                                                        passwordForm.processing
                                                    }
                                                    value={
                                                        passwordForm.data
                                                            .current_password
                                                    }
                                                    onChange={(e) =>
                                                        passwordForm.setData(
                                                            'current_password',
                                                            e.target.value,
                                                        )
                                                    }
                                                    error={
                                                        passwordForm.errors
                                                            .current_password
                                                    }
                                                    className="pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={
                                                        passwordForm.processing
                                                    }
                                                    onClick={() =>
                                                        setShowCurrentPassword(
                                                            (p) => !p,
                                                        )
                                                    }
                                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50"
                                                    aria-label={
                                                        showCurrentPassword
                                                            ? 'Hide current password'
                                                            : 'Show current password'
                                                    }
                                                >
                                                    {showCurrentPassword ? (
                                                        <EyeOff
                                                            className="h-4 w-4"
                                                            aria-hidden="true"
                                                        />
                                                    ) : (
                                                        <Eye
                                                            className="h-4 w-4"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                </button>
                                            </div>
                                            {passwordForm.errors
                                                .current_password && (
                                                <p
                                                    className="text-xs font-medium text-danger"
                                                    role="alert"
                                                >
                                                    {
                                                        passwordForm.errors
                                                            .current_password
                                                    }
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="new_password"
                                                required
                                            >
                                                New Password
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="new_password"
                                                    name="password"
                                                    type={
                                                        showNewPassword
                                                            ? 'text'
                                                            : 'password'
                                                    }
                                                    autoComplete="new-password"
                                                    disabled={
                                                        passwordForm.processing
                                                    }
                                                    value={
                                                        passwordForm.data
                                                            .password
                                                    }
                                                    onChange={(e) =>
                                                        passwordForm.setData(
                                                            'password',
                                                            e.target.value,
                                                        )
                                                    }
                                                    error={
                                                        passwordForm.errors
                                                            .password
                                                    }
                                                    className="pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={
                                                        passwordForm.processing
                                                    }
                                                    onClick={() =>
                                                        setShowNewPassword(
                                                            (p) => !p,
                                                        )
                                                    }
                                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50"
                                                    aria-label={
                                                        showNewPassword
                                                            ? 'Hide new password'
                                                            : 'Show new password'
                                                    }
                                                >
                                                    {showNewPassword ? (
                                                        <EyeOff
                                                            className="h-4 w-4"
                                                            aria-hidden="true"
                                                        />
                                                    ) : (
                                                        <Eye
                                                            className="h-4 w-4"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                </button>
                                            </div>
                                            {passwordForm.errors.password && (
                                                <p
                                                    className="text-xs font-medium text-danger"
                                                    role="alert"
                                                >
                                                    {
                                                        passwordForm.errors
                                                            .password
                                                    }
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="password_confirmation"
                                                required
                                            >
                                                Confirm New Password
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="password_confirmation"
                                                    name="password_confirmation"
                                                    type={
                                                        showConfirmPassword
                                                            ? 'text'
                                                            : 'password'
                                                    }
                                                    autoComplete="new-password"
                                                    disabled={
                                                        passwordForm.processing
                                                    }
                                                    value={
                                                        passwordForm.data
                                                            .password_confirmation
                                                    }
                                                    onChange={(e) =>
                                                        passwordForm.setData(
                                                            'password_confirmation',
                                                            e.target.value,
                                                        )
                                                    }
                                                    error={
                                                        passwordForm.errors
                                                            .password_confirmation
                                                    }
                                                    className="pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={
                                                        passwordForm.processing
                                                    }
                                                    onClick={() =>
                                                        setShowConfirmPassword(
                                                            (p) => !p,
                                                        )
                                                    }
                                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50"
                                                    aria-label={
                                                        showConfirmPassword
                                                            ? 'Hide password confirmation'
                                                            : 'Show password confirmation'
                                                    }
                                                >
                                                    {showConfirmPassword ? (
                                                        <EyeOff
                                                            className="h-4 w-4"
                                                            aria-hidden="true"
                                                        />
                                                    ) : (
                                                        <Eye
                                                            className="h-4 w-4"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                </button>
                                            </div>
                                            {passwordForm.errors
                                                .password_confirmation && (
                                                <p
                                                    className="text-xs font-medium text-danger"
                                                    role="alert"
                                                >
                                                    {
                                                        passwordForm.errors
                                                            .password_confirmation
                                                    }
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 pt-1">
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                size="sm"
                                                disabled={
                                                    passwordForm.processing
                                                }
                                            >
                                                {passwordForm.processing ? (
                                                    <>
                                                        <Loader2
                                                            className="mr-1.5 h-3.5 w-3.5 animate-spin"
                                                            aria-hidden="true"
                                                        />
                                                        Updating password…
                                                    </>
                                                ) : (
                                                    'Update password'
                                                )}
                                            </Button>
                                            {passwordForm.recentlySuccessful &&
                                                !passwordForm.isDirty && (
                                                    <span
                                                        role="status"
                                                        className="flex items-center gap-1.5 text-xs font-medium text-success"
                                                    >
                                                        <CheckCircle2
                                                            className="h-3.5 w-3.5"
                                                            aria-hidden="true"
                                                        />
                                                        Password updated
                                                    </span>
                                                )}
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: SIGN-IN ACTIVITY */}
                        {activeTab === 'activity' && (
                            <div
                                id="panel-activity"
                                role="tabpanel"
                                tabIndex={0}
                                aria-labelledby="tab-activity"
                                className="space-y-6 focus:outline-none"
                            >
                                <div className="border-b border-line pb-3">
                                    <h3 className="text-base font-semibold text-ink sm:text-lg">
                                        Sign-in Activity
                                    </h3>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        Active sessions and security activity
                                        log.
                                    </p>
                                </div>

                                {/* Sessions Card */}
                                <div className="rounded-xl border border-line bg-surface">
                                    <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-ink">
                                                Where you’re signed in
                                            </h4>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                Active sessions currently logged
                                                into your account.
                                            </p>
                                        </div>

                                        {otherSessions.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    revokeOthersForm.reset();
                                                    revokeOthersForm.clearErrors();
                                                    setRevokeOthersModalOpen(
                                                        true,
                                                    );
                                                }}
                                                className="self-start sm:self-auto"
                                            >
                                                Sign out other sessions
                                            </Button>
                                        )}
                                    </div>

                                    <div className="divide-y divide-line">
                                        {/* Current Session */}
                                        {currentSession && (
                                            <div className="flex items-start justify-between gap-4 px-5 py-4">
                                                <div className="flex items-start gap-3.5">
                                                    <div className="mt-0.5 text-ink-soft">
                                                        <DeviceIcon
                                                            deviceType={
                                                                currentSession.device_type
                                                            }
                                                            className="h-5 w-5"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-medium text-ink">
                                                                {
                                                                    currentSession.device_label
                                                                }
                                                            </span>
                                                            <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
                                                                This device
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                                                            <span className="font-mono text-xs">
                                                                {
                                                                    currentSession.ip_address
                                                                }
                                                            </span>
                                                            <span>·</span>
                                                            <LocationBadge
                                                                location={
                                                                    currentSession.location
                                                                }
                                                                ip={
                                                                    currentSession.ip_address
                                                                }
                                                            />
                                                            <span>·</span>
                                                            <span className="text-ink-soft">
                                                                Active now
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {sessions.length === 0 && (
                                            <div className="p-6 text-center text-xs text-ink-soft">
                                                No active sessions recorded.
                                            </div>
                                        )}

                                        {/* Other Sessions */}
                                        {otherSessions.map((session) => (
                                            <div
                                                key={session.id}
                                                className="flex items-center justify-between gap-4 px-5 py-3.5"
                                            >
                                                <div className="flex items-start gap-3.5">
                                                    <div className="mt-0.5 text-ink-soft">
                                                        <DeviceIcon
                                                            deviceType={
                                                                session.device_type
                                                            }
                                                            className="h-5 w-5"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-sm font-medium text-ink">
                                                            {
                                                                session.device_label
                                                            }
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                                                            <span className="font-mono text-xs">
                                                                {
                                                                    session.ip_address
                                                                }
                                                            </span>
                                                            <span>·</span>
                                                            <LocationBadge
                                                                location={
                                                                    session.location
                                                                }
                                                                ip={
                                                                    session.ip_address
                                                                }
                                                            />
                                                            <span>·</span>
                                                            <span>
                                                                {
                                                                    session.last_active_human
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="quiet"
                                                    size="sm"
                                                    disabled={
                                                        revokingSessionId ===
                                                        session.id
                                                    }
                                                    onClick={() =>
                                                        setSessionToRevoke(
                                                            session,
                                                        )
                                                    }
                                                    className="text-xs text-danger hover:bg-danger-soft/40"
                                                >
                                                    {revokingSessionId ===
                                                    session.id ? (
                                                        <>
                                                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                                            Revoking…
                                                        </>
                                                    ) : (
                                                        'Revoke'
                                                    )}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Activity */}
                                <div className="rounded-xl border border-line bg-surface">
                                    <div className="border-b border-line px-5 py-4">
                                        <h4 className="text-sm font-semibold text-ink">
                                            Recent activity
                                        </h4>
                                        <p className="mt-0.5 text-xs text-ink-soft">
                                            Log of recent sign-ins, security
                                            changes, and account activity.
                                        </p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="border-b border-line bg-surface-subtle text-xs font-medium text-ink-soft">
                                                <tr>
                                                    <th className="px-5 py-2.5">
                                                        Event
                                                    </th>
                                                    <th className="px-5 py-2.5">
                                                        Outcome
                                                    </th>
                                                    <th className="px-5 py-2.5">
                                                        Device & IP
                                                    </th>
                                                    <th className="px-5 py-2.5">
                                                        Location
                                                    </th>
                                                    <th className="px-5 py-2.5">
                                                        Date & Time
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-line">
                                                {recent_activity.data.map(
                                                    (event) => {
                                                        const isSuccess =
                                                            event.outcome.toLowerCase() ===
                                                            'success';

                                                        return (
                                                            <tr
                                                                key={event.id}
                                                                className="transition-colors hover:bg-surface-subtle/50"
                                                            >
                                                                <td className="px-5 py-3 font-medium text-ink">
                                                                    <div className="flex items-center gap-2">
                                                                        <ActivityEventIcon
                                                                            action={
                                                                                event.action
                                                                            }
                                                                            className="h-3.5 w-3.5 shrink-0 text-ink-soft"
                                                                        />
                                                                        <span>
                                                                            {
                                                                                event.event_label
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <span
                                                                        className={cn(
                                                                            'inline-flex items-center gap-1.5 text-xs font-medium',
                                                                            isSuccess
                                                                                ? 'text-ink-soft'
                                                                                : 'text-danger-strong',
                                                                        )}
                                                                    >
                                                                        {!isSuccess && (
                                                                            <span
                                                                                className="h-1.5 w-1.5 rounded-full bg-danger"
                                                                                aria-hidden="true"
                                                                            />
                                                                        )}
                                                                        <span className="capitalize">
                                                                            {
                                                                                event.outcome
                                                                            }
                                                                        </span>
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-3 text-ink-soft">
                                                                    <div>
                                                                        <span className="block text-ink">
                                                                            {
                                                                                event.device_label
                                                                            }
                                                                        </span>
                                                                        <span className="font-mono text-[11px] text-ink-soft">
                                                                            {
                                                                                event.ip_address
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <LocationBadge
                                                                        location={
                                                                            event.location
                                                                        }
                                                                        ip={
                                                                            event.ip_address
                                                                        }
                                                                    />
                                                                </td>
                                                                <td className="px-5 py-3 whitespace-nowrap text-ink-soft">
                                                                    <div>
                                                                        <span className="block text-ink">
                                                                            {
                                                                                event.occurred_at_human
                                                                            }
                                                                        </span>
                                                                        <span className="text-[11px] text-ink-soft">
                                                                            {event.occurred_at
                                                                                ? new Date(
                                                                                      event.occurred_at,
                                                                                  ).toLocaleString()
                                                                                : ''}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    },
                                                )}

                                                {recent_activity.data.length ===
                                                    0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={5}
                                                            className="p-6 text-center text-xs text-ink-soft"
                                                        >
                                                            No security activity
                                                            events recorded yet.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    {recent_activity.last_page > 1 && (
                                        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-soft">
                                            <span>
                                                Page{' '}
                                                {recent_activity.current_page}{' '}
                                                of {recent_activity.last_page} (
                                                {recent_activity.total} events)
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {recent_activity.prev_page_url ? (
                                                    <Link
                                                        href={getTabUrl(
                                                            recent_activity.prev_page_url,
                                                        )!}
                                                        preserveScroll
                                                        className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-subtle"
                                                    >
                                                        Previous
                                                    </Link>
                                                ) : (
                                                    <span className="cursor-not-allowed rounded-md border border-line bg-surface-subtle px-2.5 py-1 text-xs text-ink-soft/40">
                                                        Previous
                                                    </span>
                                                )}

                                                {recent_activity.next_page_url ? (
                                                    <Link
                                                        href={getTabUrl(
                                                            recent_activity.next_page_url,
                                                        )!}
                                                        preserveScroll
                                                        className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-subtle"
                                                    >
                                                        Next
                                                    </Link>
                                                ) : (
                                                    <span className="cursor-not-allowed rounded-md border border-line bg-surface-subtle px-2.5 py-1 text-xs text-ink-soft/40">
                                                        Next
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* MODAL: Email Change */}
            <Modal
                open={emailModalOpen}
                onClose={() => {
                    setEmailModalOpen(false);
                    setEmailStep('request');
                }}
                title="Change Email Address"
                description={
                    emailStep === 'request'
                        ? 'Enter your current password and new email address. A 6-digit code will be sent to verify it.'
                        : 'Enter the 6-digit code sent to your new email.'
                }
            >
                {emailStep === 'request' ? (
                    <form onSubmit={handleEmailRequest} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email_modal_password" required>
                                Current Password
                            </Label>
                            <Input
                                id="email_modal_password"
                                type="password"
                                autoComplete="current-password"
                                autoFocus
                                value={emailRequestForm.data.current_password}
                                onChange={(e) =>
                                    emailRequestForm.setData(
                                        'current_password',
                                        e.target.value,
                                    )
                                }
                                error={emailRequestForm.errors.current_password}
                            />
                            {emailRequestForm.errors.current_password && (
                                <p
                                    className="text-xs font-medium text-danger"
                                    role="alert"
                                >
                                    {emailRequestForm.errors.current_password}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email_modal_email" required>
                                New Email Address
                            </Label>
                            <Input
                                id="email_modal_email"
                                type="email"
                                placeholder="new.email@example.com"
                                value={emailRequestForm.data.email}
                                onChange={(e) =>
                                    emailRequestForm.setData(
                                        'email',
                                        e.target.value,
                                    )
                                }
                                error={emailRequestForm.errors.email}
                            />
                            {emailRequestForm.errors.email && (
                                <p
                                    className="text-xs font-medium text-danger"
                                    role="alert"
                                >
                                    {emailRequestForm.errors.email}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setEmailModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={emailRequestForm.processing}
                            >
                                {emailRequestForm.processing ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        Sending code…
                                    </>
                                ) : (
                                    'Send code'
                                )}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleEmailVerify} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email_verify_code" required>
                                6-Digit Verification Code
                            </Label>
                            <Input
                                id="email_verify_code"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="000000"
                                autoComplete="one-time-code"
                                autoFocus
                                value={emailVerifyForm.data.code}
                                onChange={(e) =>
                                    emailVerifyForm.setData(
                                        'code',
                                        e.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 6),
                                    )
                                }
                                className="text-center font-mono text-2xl tracking-[0.3em]"
                                error={emailVerifyForm.errors.code}
                            />
                            {emailVerifyForm.errors.code && (
                                <p
                                    className="text-xs font-medium text-danger"
                                    role="alert"
                                >
                                    {emailVerifyForm.errors.code}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEmailStep('request')}
                                    className="text-xs text-ink-soft hover:underline focus-visible:outline-1"
                                >
                                    ← Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResendEmailOtp}
                                    disabled={emailCooldown > 0}
                                    className="text-xs font-semibold text-brand-strong hover:underline disabled:cursor-not-allowed disabled:text-ink-soft/50"
                                >
                                    {emailCooldown > 0
                                        ? `Resend in ${emailCooldown}s`
                                        : 'Resend code'}
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setEmailModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={
                                        emailVerifyForm.processing ||
                                        emailVerifyForm.data.code.length !== 6
                                    }
                                >
                                    {emailVerifyForm.processing ? (
                                        <>
                                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                            Verifying…
                                        </>
                                    ) : (
                                        'Update email'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
            </Modal>

            {/* MODAL: OTP Enable / Disable */}
            <Modal
                open={otpModalOpen}
                onClose={() => {
                    setOtpModalOpen(false);
                    setOtpStep('password');
                }}
                title={
                    otpAction === 'enable'
                        ? 'Enable Two-Factor Authentication (2FA)'
                        : 'Disable Two-Factor Authentication (2FA)'
                }
                description={
                    otpStep === 'password'
                        ? 'Enter your current password to continue.'
                        : `Enter the 6-digit code sent to ${profile.email}.`
                }
            >
                {otpStep === 'password' ? (
                    <form
                        onSubmit={handleOtpPasswordSubmit}
                        className="space-y-4"
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="otp_modal_password" required>
                                Current Password
                            </Label>
                            <Input
                                id="otp_modal_password"
                                type="password"
                                autoComplete="current-password"
                                autoFocus
                                value={otpPasswordForm.data.current_password}
                                onChange={(e) =>
                                    otpPasswordForm.setData(
                                        'current_password',
                                        e.target.value,
                                    )
                                }
                                error={otpPasswordForm.errors.current_password}
                            />
                            {otpPasswordForm.errors.current_password && (
                                <p
                                    className="text-xs font-medium text-danger"
                                    role="alert"
                                >
                                    {otpPasswordForm.errors.current_password}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setOtpModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={otpPasswordForm.processing}
                            >
                                {otpPasswordForm.processing ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        Sending code…
                                    </>
                                ) : (
                                    'Send code'
                                )}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleOtpCodeSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="otp_verify_code" required>
                                6-Digit Verification Code
                            </Label>
                            <Input
                                id="otp_verify_code"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="000000"
                                autoComplete="one-time-code"
                                autoFocus
                                value={otpCodeForm.data.code}
                                onChange={(e) =>
                                    otpCodeForm.setData(
                                        'code',
                                        e.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 6),
                                    )
                                }
                                className="text-center font-mono text-2xl tracking-[0.3em]"
                                error={otpCodeForm.errors.code}
                            />
                            {otpCodeForm.errors.code && (
                                <p
                                    className="text-xs font-medium text-danger"
                                    role="alert"
                                >
                                    {otpCodeForm.errors.code}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={otpCooldown > 0}
                                className="text-xs font-semibold text-brand-strong hover:underline disabled:cursor-not-allowed disabled:text-ink-soft/50"
                            >
                                {otpCooldown > 0
                                    ? `Resend in ${otpCooldown}s`
                                    : 'Resend code'}
                            </button>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setOtpModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={
                                        otpCodeForm.processing ||
                                        otpCodeForm.data.code.length !== 6
                                    }
                                >
                                    {otpCodeForm.processing ? (
                                        <>
                                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                            Verifying…
                                        </>
                                    ) : otpAction === 'enable' ? (
                                        'Enable 2FA'
                                    ) : (
                                        'Disable 2FA'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
            </Modal>

            {/* MODAL: Revoke All Other Sessions */}
            <Modal
                open={revokeOthersModalOpen}
                onClose={() => setRevokeOthersModalOpen(false)}
                title="Sign Out Other Sessions"
                description="Sign out of all other browsers and devices. Enter your current password to confirm."
            >
                <form
                    onSubmit={handleRevokeOtherSessions}
                    className="space-y-4"
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="revoke_others_password" required>
                            Current Password
                        </Label>
                        <Input
                            id="revoke_others_password"
                            type="password"
                            autoComplete="current-password"
                            autoFocus
                            value={revokeOthersForm.data.current_password}
                            onChange={(e) =>
                                revokeOthersForm.setData(
                                    'current_password',
                                    e.target.value,
                                )
                            }
                            error={revokeOthersForm.errors.current_password}
                        />
                        {revokeOthersForm.errors.current_password && (
                            <p
                                className="text-xs font-medium text-danger"
                                role="alert"
                            >
                                {revokeOthersForm.errors.current_password}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setRevokeOthersModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="danger"
                            disabled={revokeOthersForm.processing}
                        >
                            {revokeOthersForm.processing ? (
                                <>
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                    Signing out…
                                </>
                            ) : (
                                'Sign out other sessions'
                            )}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL: Revoke Single Session Confirmation */}
            <Modal
                open={sessionToRevoke !== null}
                onClose={() => setSessionToRevoke(null)}
                title="Revoke Session"
                description="Sign out this session and disconnect the device."
            >
                {sessionToRevoke && (
                    <div className="space-y-4">
                        <div className="space-y-2.5 rounded-xl border border-line bg-surface-subtle p-4 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">Device:</span>
                                <span className="font-semibold text-ink">
                                    {sessionToRevoke.device_label}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">
                                    IP Address:
                                </span>
                                <span className="font-mono text-ink">
                                    {sessionToRevoke.ip_address}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">
                                    Approximate Location:
                                </span>
                                <LocationBadge
                                    location={sessionToRevoke.location}
                                    ip={sessionToRevoke.ip_address}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">
                                    Last Active:
                                </span>
                                <span className="text-ink">
                                    {sessionToRevoke.last_active_human}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setSessionToRevoke(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                disabled={
                                    revokingSessionId === sessionToRevoke.id
                                }
                                onClick={confirmRevokeSession}
                            >
                                {revokingSessionId === sessionToRevoke.id ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        Revoking…
                                    </>
                                ) : (
                                    'Revoke session'
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL: Revoke Single Device */}
            <Modal
                open={deviceToRevoke !== null}
                onClose={() => setDeviceToRevoke(null)}
                title="Revoke Device Trust"
                description="Revoke trust for this browser or device. An email verification code will be required on its next sign-in."
            >
                {deviceToRevoke && (
                    <div className="space-y-4">
                        <div className="space-y-2.5 rounded-xl border border-line bg-surface-subtle p-4 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">Device:</span>
                                <span className="font-semibold text-ink">
                                    {deviceToRevoke.device_label}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">
                                    IP Address:
                                </span>
                                <span className="font-mono text-ink">
                                    {deviceToRevoke.ip_address}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">
                                    Trust Expiration:
                                </span>
                                <span className="text-ink">
                                    {deviceToRevoke.expires_human}
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-ink-soft">
                            Note: Revoking trust does not immediately sign out
                            existing active sessions on this device. If you
                            believe this device is compromised, use &quot;Report
                            lost&quot; instead.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setDeviceToRevoke(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={confirmRevokeDevice}
                                disabled={revokingDeviceId !== null}
                            >
                                {revokingDeviceId !== null ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        Revoking…
                                    </>
                                ) : (
                                    'Revoke trust'
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL: Revoke All Trusted Devices */}
            <Modal
                open={revokeAllDevicesModalOpen}
                onClose={() => setRevokeAllDevicesModalOpen(false)}
                title="Revoke All Trusted Devices"
                description="Remove trusted device status from all browsers and mobile devices. All future sign-ins will require an email verification code."
            >
                <form onSubmit={handleRevokeAllDevices} className="space-y-4">
                    <p className="text-xs text-ink-soft">
                        This will invalidate trust tokens across all your
                        devices, including this one. You will need to complete
                        email verification the next time you sign in anywhere.
                        Active sessions will remain connected until their normal
                        expiration or until revoked from Sign-in Activity.
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setRevokeAllDevicesModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="danger"
                            disabled={isRevokingAllDevices}
                        >
                            {isRevokingAllDevices ? (
                                <>
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                    Revoking all…
                                </>
                            ) : (
                                'Revoke all devices'
                            )}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL: Report Device Lost or Stolen */}
            <Modal
                open={deviceToReportLost !== null}
                onClose={() => setDeviceToReportLost(null)}
                title="Report Device Lost or Stolen"
                description="Immediately revoke trust and terminate all active sessions and mobile tokens for this device."
            >
                {deviceToReportLost && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger-strong">
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                            />
                            <p>
                                This will immediately disconnect this device,
                                revoke its active sessions and mobile API
                                tokens, and require full credentials and email
                                verification for any future sign-in attempt.
                            </p>
                        </div>
                        <div className="space-y-2.5 rounded-xl border border-line bg-surface-subtle p-4 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">Device:</span>
                                <span className="font-semibold text-ink">
                                    {deviceToReportLost.device_label}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">
                                    IP Address:
                                </span>
                                <span className="font-mono text-ink">
                                    {deviceToReportLost.ip_address}
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setDeviceToReportLost(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={confirmReportLost}
                                disabled={reportingLostDeviceId !== null}
                            >
                                {reportingLostDeviceId !== null ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        Revoking access…
                                    </>
                                ) : (
                                    'Confirm Report Lost'
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <DevUserSwitcher />
        </div>
    );
}
