import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui';

export interface ErrorBoundaryProps {
    children: ReactNode;
    name?: string;
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onReset?: () => void;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    public override state: ErrorBoundaryState = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    public override componentDidCatch(
        error: Error,
        errorInfo: ErrorInfo,
    ): void {
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // Log to console for debugging
        if (typeof console !== 'undefined' && console.error) {
            console.error(
                `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`,
                error,
                errorInfo,
            );
        }
    }

    public resetErrorBoundary = (): void => {
        if (this.props.onReset) {
            this.props.onReset();
        }

        this.setState({ hasError: false, error: null });
    };

    public override render(): ReactNode {
        if (!this.state.hasError) {
            return this.props.children;
        }

        if (this.props.fallback) {
            if (typeof this.props.fallback === 'function') {
                return this.props.fallback(
                    this.state.error || new Error('Unknown error'),
                    this.resetErrorBoundary,
                );
            }

            return this.props.fallback;
        }

        const componentName = this.props.name || 'Component';

        return (
            <div
                role="alert"
                aria-live="assertive"
                className="my-4 flex flex-col items-start gap-4 rounded-xl border border-danger/30 bg-danger-soft/40 p-5 text-ink shadow-xs"
            >
                <div className="flex items-center gap-3 text-danger">
                    <AlertTriangle
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                    />
                    <h3 className="text-sm font-semibold tracking-wide">
                        {componentName} encountered an unexpected error
                    </h3>
                </div>

                <p className="text-xs text-ink-soft">
                    {this.state.error?.message ||
                        'An isolated rendering failure occurred in this section. Other parts of the workspace remain functional.'}
                </p>

                <div className="flex items-center gap-2 pt-1">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={this.resetErrorBoundary}
                        className="gap-1.5 text-xs font-semibold"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Try again
                    </Button>
                </div>
            </div>
        );
    }
}
