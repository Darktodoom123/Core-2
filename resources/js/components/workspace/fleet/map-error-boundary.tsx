import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface MapErrorBoundaryProps {
    children: ReactNode;
    fallbackTitle?: string;
    fallbackMessage?: string;
    compact?: boolean;
    onReset?: () => void;
}

interface MapErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class MapErrorBoundary extends Component<
    MapErrorBoundaryProps,
    MapErrorBoundaryState
> {
    public state: MapErrorBoundaryState = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(
        error: Error,
    ): MapErrorBoundaryState {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('MapErrorBoundary caught an error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    public render(): ReactNode {
        if (this.state.hasError) {
            const {
                fallbackTitle = 'Live Map Unavailable',
                fallbackMessage = 'Live map preview currently unavailable. GPS telemetry coordinates and meter data remain fully accessible.',
                compact = false,
            } = this.props;

            return (
                <div
                    role="alert"
                    aria-live="polite"
                    className={cn(
                        'flex flex-col items-center justify-center rounded-2xl border border-warning/40 bg-warning-soft/20 p-6 text-center',
                        compact
                            ? 'h-[360px] md:h-[420px]'
                            : 'h-[560px] lg:h-[620px]',
                    )}
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning-strong">
                        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-ink">
                        {fallbackTitle}
                    </h4>
                    <p className="mx-auto mt-1 max-w-md text-xs text-ink-soft">
                        {fallbackMessage}
                    </p>
                    <div className="mt-4 flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={this.handleReset}
                        >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Retry loading map
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
