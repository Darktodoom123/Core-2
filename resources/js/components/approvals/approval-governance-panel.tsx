import { Lock } from 'lucide-react';

interface ApprovalGovernancePanelProps {
    decisionBlocker: string | null;
}

export function ApprovalGovernancePanel({
    decisionBlocker,
}: ApprovalGovernancePanelProps) {
    return (
        <div
            className="rounded-xl border border-warning/30 bg-warning-soft/25 p-4 transition-all"
            role="status"
            aria-live="polite"
        >
            <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-strong ring-1 ring-warning/30">
                    <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-warning-strong">
                            Segregation of Duties
                        </span>
                        <span className="text-ink-soft">·</span>
                        <span className="font-medium text-ink-soft">
                            Independent Review Required
                        </span>
                    </div>
                    <p className="leading-relaxed text-ink">
                        {decisionBlocker ??
                            'You submitted this operational change. Corporate governance requires an independent, authorized second manager to record the final decision.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
