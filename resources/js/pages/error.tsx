import { Head, Link } from '@inertiajs/react';
import { AlertCircle, Home, RefreshCw, ShieldAlert } from 'lucide-react';
import React from 'react';
import { ApplicationLogo } from '@/components/application-logo';
import { Button } from '@/components/ui';

interface ErrorPageProps {
    status: number;
    message?: string;
    requestId?: string;
}

export default function ErrorPage({
    status,
    message,
    requestId,
}: ErrorPageProps) {
    const errorDetails = {
        401: {
            title: 'Authentication Required',
            description:
                message ||
                'You must be signed in with a valid session to access this operational resource.',
            icon: ShieldAlert,
        },
        403: {
            title: 'Access Forbidden',
            description:
                message ||
                'Your account does not have the required operational permissions or role to access this resource.',
            icon: ShieldAlert,
        },
        404: {
            title: 'Page or Resource Not Found',
            description:
                message ||
                'The dispatch record, asset, or page you requested could not be located.',
            icon: AlertCircle,
        },
        419: {
            title: 'Page Expired',
            description:
                message ||
                'Your session timed out due to inactivity. Please refresh the page and sign in again.',
            icon: RefreshCw,
        },
        429: {
            title: 'Too Many Requests',
            description:
                message ||
                'You have exceeded the request rate limit. Please pause for a moment and try again.',
            icon: AlertCircle,
        },
        500: {
            title: 'Internal Server Error',
            description:
                message ||
                'An unexpected error occurred while processing your operational request. Our team has been notified.',
            icon: AlertCircle,
        },
        503: {
            title: 'Service Temporarily Unavailable',
            description:
                message ||
                'The system is undergoing scheduled maintenance or system synchronization. Please check back shortly.',
            icon: AlertCircle,
        },
    }[status] || {
        title: 'Unexpected Error',
        description:
            message || 'An error occurred while handling this request.',
        icon: AlertCircle,
    };

    const Icon = errorDetails.icon;

    return (
        <div className="flex min-h-screen flex-col bg-canvas text-ink">
            <Head title={`${status} - ${errorDetails.title}`} />

            <header className="border-b border-line bg-surface/80 px-6 py-4 backdrop-blur-sm">
                <div className="mx-auto flex max-w-5xl items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                        <ApplicationLogo className="h-7 w-auto text-brand" />
                        <span className="text-sm font-semibold tracking-wide text-ink">
                            Core Operations
                        </span>
                    </Link>
                    <span className="inline-flex items-center rounded-md border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        HTTP {status}
                    </span>
                </div>
            </header>

            <main className="flex flex-1 items-center justify-center p-6">
                <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-sm">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
                            <Icon className="h-7 w-7" aria-hidden="true" />
                        </div>

                        <span className="text-xs font-semibold tracking-wider text-danger uppercase">
                            Error {status}
                        </span>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                            {errorDetails.title}
                        </h1>

                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                            {errorDetails.description}
                        </p>

                        {requestId && (
                            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-surface-subtle px-3 py-1.5 text-xs text-ink-soft">
                                <span>Reference ID:</span>
                                <code className="font-mono text-xs font-semibold text-ink select-all">
                                    {requestId}
                                </code>
                            </div>
                        )}

                        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                            {status === 401 ? (
                                <Link href="/login">
                                    <Button
                                        variant="primary"
                                        className="w-full gap-2 sm:w-auto"
                                    >
                                        Sign In
                                    </Button>
                                </Link>
                            ) : (
                                <Link href="/">
                                    <Button
                                        variant="primary"
                                        className="w-full gap-2 sm:w-auto"
                                    >
                                        <Home
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                        Return to Workspace
                                    </Button>
                                </Link>
                            )}

                            <Button
                                variant="secondary"
                                className="w-full gap-2 sm:w-auto"
                                onClick={() => {
                                    if (typeof window !== 'undefined') {
                                        window.location.reload();
                                    }
                                }}
                            >
                                <RefreshCw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Reload Page
                            </Button>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="text-ink-muted border-t border-line py-4 text-center text-xs">
                Alibaton Heavy Equipment Operations · Core Transaction 2
            </footer>
        </div>
    );
}
