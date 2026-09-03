import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100vw-2rem)] min-h-[calc(100vh-2rem)]',
};

export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    className,
    closeOnEscape = true,
    closeOnBackdrop = true,
}: ModalProps) {
    const prefersReducedMotion = useReducedMotion() ?? false;
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && closeOnEscape) {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalOverflow;
        };
    }, [open, closeOnEscape, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={title ? 'modal-title' : undefined}
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={
                            prefersReducedMotion ? undefined : { opacity: 1 }
                        }
                        exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                        onClick={closeOnBackdrop ? onClose : undefined}
                        aria-hidden="true"
                    />

                    {/* Dialog Card */}
                    <motion.div
                        ref={dialogRef}
                        initial={
                            prefersReducedMotion
                                ? false
                                : { opacity: 0, scale: 0.96, y: 8 }
                        }
                        animate={
                            prefersReducedMotion
                                ? undefined
                                : { opacity: 1, scale: 1, y: 0 }
                        }
                        exit={
                            prefersReducedMotion
                                ? undefined
                                : { opacity: 0, scale: 0.96, y: 8 }
                        }
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className={cn(
                            'relative z-10 w-full overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-xl',
                            sizeClasses[size],
                            className,
                        )}
                    >
                        {/* Header */}
                        {(title || description) && (
                            <div className="flex items-start justify-between border-b border-line px-6 py-5">
                                <div className="space-y-1">
                                    {title && (
                                        <h2
                                            id="modal-title"
                                            className="text-lg font-semibold tracking-tight text-ink"
                                        >
                                            {title}
                                        </h2>
                                    )}
                                    {description && (
                                        <p className="text-sm text-ink-soft">
                                            {description}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="quiet"
                                    size="iconSm"
                                    onClick={onClose}
                                    aria-label="Close dialog"
                                    className="-mr-2 text-ink-soft hover:text-ink"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Content */}
                        <div className="max-h-[calc(85vh-10rem)] overflow-y-auto p-6">
                            {children}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div className="flex items-center justify-end gap-3 border-t border-line bg-surface-subtle/50 px-6 py-4">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

export const Dialog = Modal;
