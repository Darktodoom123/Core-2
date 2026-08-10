import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Clock,
    X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface DateTimePickerProps {
    id?: string;
    label?: string;
    value?: string; // YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm
    onChange: (value: string) => void;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    includeTime?: boolean;
}

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Format date into YYYY-MM-DDTHH:mm
function toLocalISOString(date: Date, includeTime = true): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    if (!includeTime) {
        return `${y}-${m}-${d}`;
    }
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
}

// Display format string: "Aug 2, 2026, 05:00 PM"
function formatDisplayValue(value: string, includeTime = true): string {
    if (!value) return '';
    try {
        const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
        if (isNaN(date.getTime())) return value;
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = true;
        }
        return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch {
        return value;
    }
}

// Parse freeform user time input like "2:30 pm", "14:30", "9am", "1700", "08:15"
function parseTimeString(raw: string): { hours: number; minutes: number; ampm: 'AM' | 'PM' } | null {
    const str = raw.trim().toLowerCase();
    if (!str) return null;

    // Pattern 1: 14:30 or 02:30 or 2:30 or 2:30pm or 2:30 am
    const matchTime = str.match(/^(\d{1,2}):(\d{2})(?:\s*([ap]\.?m\.?))?$/);
    if (matchTime) {
        let h = parseInt(matchTime[1], 10);
        const m = parseInt(matchTime[2], 10);
        const period = matchTime[3];

        if (m < 0 || m > 59) return null;

        if (period) {
            const isPm = period.startsWith('p');
            if (h < 1 || h > 12) return null;
            return { hours: h, minutes: m, ampm: isPm ? 'PM' : 'AM' };
        } else {
            if (h >= 0 && h <= 23) {
                const isPm = h >= 12;
                let h12 = h % 12;
                if (h12 === 0) h12 = 12;
                return { hours: h12, minutes: m, ampm: isPm ? 'PM' : 'AM' };
            }
        }
    }

    // Pattern 2: 9am, 5pm, 12pm
    const matchSimpleHr = str.match(/^(\d{1,2})\s*([ap]\.?m\.?)$/);
    if (matchSimpleHr) {
        const h = parseInt(matchSimpleHr[1], 10);
        const isPm = matchSimpleHr[2].startsWith('p');
        if (h >= 1 && h <= 12) {
            return { hours: h, minutes: 0, ampm: isPm ? 'PM' : 'AM' };
        }
    }

    // Pattern 3: 4-digit military 1430 -> 14:30
    const matchMilitary = str.match(/^(\d{2})(\d{2})$/);
    if (matchMilitary) {
        const h = parseInt(matchMilitary[1], 10);
        const m = parseInt(matchMilitary[2], 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            const isPm = h >= 12;
            let h12 = h % 12;
            if (h12 === 0) h12 = 12;
            return { hours: h12, minutes: m, ampm: isPm ? 'PM' : 'AM' };
        }
    }

    return null;
}

export function DateTimePicker({
    id,
    label,
    value = '',
    onChange,
    error,
    required,
    disabled,
    placeholder = 'Select date & time...',
    className,
    includeTime = true,
}: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [isMounted, setIsMounted] = useState(false);

    const [coords, setCoords] = useState<{
        top: number;
        left: number;
        width: number;
        maxHeight: number;
    }>({
        top: 0,
        left: 0,
        width: 330,
        maxHeight: 520,
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Initial parsing from `value`
    const parsedDate = value ? new Date(value.includes('T') ? value : value.replace(' ', 'T')) : null;
    const isValidDate = parsedDate && !isNaN(parsedDate.getTime());

    const currentDate = isValidDate ? parsedDate : new Date();

    const [viewYear, setViewYear] = useState(currentDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(currentDate.getMonth());

    const [selectedDate, setSelectedDate] = useState<Date | null>(
        isValidDate ? currentDate : null
    );

    // Time states
    const [hours, setHours] = useState(
        isValidDate ? currentDate.getHours() % 12 || 12 : 9
    );
    const [minutes, setMinutes] = useState(
        isValidDate ? Math.floor(currentDate.getMinutes() / 5) * 5 : 0
    );
    const [ampm, setAmPm] = useState<'AM' | 'PM'>(
        isValidDate && currentDate.getHours() >= 12 ? 'PM' : 'AM'
    );

    // Freeform manual time input string state
    const [manualTimeInput, setManualTimeInput] = useState('');
    const errorId = id ? `${id}-error` : undefined;

    // Synchronize internal state when `value` changes externally
    useEffect(() => {
        if (value) {
            const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
                setSelectedDate(d);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
                const h12 = d.getHours() % 12 || 12;
                const m = d.getMinutes();
                const period = d.getHours() >= 12 ? 'PM' : 'AM';
                setHours(h12);
                setMinutes(m);
                setAmPm(period);
                setManualTimeInput(
                    `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`
                );
            }
        } else {
            setSelectedDate(null);
            setManualTimeInput('');
        }
    }, [value]);

    // Recalculate screen bounds so popover is ALWAYS 100% inside visible screen
    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const popoverHeight = popoverRef.current?.offsetHeight || 460;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const popoverWidth = Math.min(330, Math.max(0, viewportWidth - 24));

        const spaceBelow = viewportHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;

        let placeTop = false;
        if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
            placeTop = true;
        }

        let computedTop: number;
        if (placeTop) {
            computedTop = Math.max(12, rect.top - popoverHeight - 8);
        } else {
            computedTop = Math.min(rect.bottom + 8, viewportHeight - popoverHeight - 12);
        }

        let computedLeft = rect.left;
        if (computedLeft + popoverWidth > viewportWidth - 12) {
            computedLeft = viewportWidth - popoverWidth - 12;
        }
        if (computedLeft < 12) computedLeft = 12;

        setCoords({
            top: Math.max(12, computedTop),
            left: computedLeft,
            width: popoverWidth,
            maxHeight: Math.min(popoverHeight, viewportHeight - 24),
        });
    };

    // Update position when opened or on resize/scroll
    useEffect(() => {
        if (isOpen) {
            updatePosition();
            const timer = setTimeout(updatePosition, 10);
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [isOpen]);

    // Handle outside click to close popover
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (
                triggerRef.current &&
                !triggerRef.current.contains(target) &&
                popoverRef.current &&
                !popoverRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Month Navigation
    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    // Calculate calendar grid days
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const calendarGrid: Array<{
        day: number;
        month: 'prev' | 'current' | 'next';
        date: Date;
    }> = [];

    // Prev month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
        calendarGrid.push({
            day: d,
            month: 'prev',
            date: new Date(prevYear, prevMonth, d),
        });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        calendarGrid.push({
            day: d,
            month: 'current',
            date: new Date(viewYear, viewMonth, d),
        });
    }

    // Next month padding
    const remainingSlots = 42 - calendarGrid.length;
    for (let d = 1; d <= remainingSlots; d++) {
        const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
        calendarGrid.push({
            day: d,
            month: 'next',
            date: new Date(nextYear, nextMonth, d),
        });
    }

    // Update parent onChange with selected date and current time
    const commitValue = (baseDate: Date, h: number, m: number, period: 'AM' | 'PM') => {
        const result = new Date(baseDate);
        let actualHour = h % 12;
        if (period === 'PM') actualHour += 12;
        result.setHours(actualHour, m, 0, 0);
        setSelectedDate(result);
        setManualTimeInput(
            `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`
        );
        onChange(toLocalISOString(result, includeTime));
    };

    const handleSelectDay = (gridDate: Date) => {
        commitValue(gridDate, hours, minutes, ampm);
    };

    const handleTimeChange = (newHour: number, newMin: number, newAmPm: 'AM' | 'PM') => {
        const clampedHour = Math.max(1, Math.min(12, newHour || 12));
        const clampedMin = Math.max(0, Math.min(59, newMin || 0));
        setHours(clampedHour);
        setMinutes(clampedMin);
        setAmPm(newAmPm);
        const base = selectedDate || new Date();
        commitValue(base, clampedHour, clampedMin, newAmPm);
    };

    // Handle manual time input typing e.g. "14:30" or "2:30 pm"
    const handleManualTimeInputChange = (rawText: string) => {
        setManualTimeInput(rawText);
        const parsed = parseTimeString(rawText);
        if (parsed) {
            setHours(parsed.hours);
            setMinutes(parsed.minutes);
            setAmPm(parsed.ampm);
            const base = selectedDate || new Date();
            commitValue(base, parsed.hours, parsed.minutes, parsed.ampm);
        }
    };

    // Quick Presets
    const handlePreset = (preset: 'now' | 'today-9' | 'today-17' | 'plus-1h' | 'tomorrow-9') => {
        const now = new Date();
        let target = new Date();

        if (preset === 'now') {
            target = now;
        } else if (preset === 'today-9') {
            target.setHours(9, 0, 0, 0);
        } else if (preset === 'today-17') {
            target.setHours(17, 0, 0, 0);
        } else if (preset === 'plus-1h') {
            target = new Date(now.getTime() + 60 * 60 * 1000);
        } else if (preset === 'tomorrow-9') {
            target.setDate(target.getDate() + 1);
            target.setHours(9, 0, 0, 0);
        }

        setViewYear(target.getFullYear());
        setViewMonth(target.getMonth());
        setSelectedDate(target);
        const h12 = target.getHours() % 12 || 12;
        const m = target.getMinutes();
        const period = target.getHours() >= 12 ? 'PM' : 'AM';
        setHours(h12);
        setMinutes(m);
        setAmPm(period);
        setManualTimeInput(
            `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`
        );

        onChange(toLocalISOString(target, includeTime));
    };

    const handleClear = () => {
        setSelectedDate(null);
        setManualTimeInput('');
        onChange('');
        setIsOpen(false);
    };

    const todayDate = new Date();
    const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

    const popoverContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        maxHeight: `${coords.maxHeight}px`,
                        zIndex: 99999,
                    }}
                    className="max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-line bg-surface p-3.5 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
                >
                    {/* Quick Presets Bar */}
                    <div className="mb-2.5 flex flex-wrap items-center gap-1 border-b border-line pb-2.5 text-xs">
                        <button
                            type="button"
                            onClick={() => handlePreset('now')}
                            className="rounded-md border border-line bg-surface-subtle px-2 py-1 font-medium text-ink hover:bg-brand-soft hover:text-brand transition-colors"
                        >
                            Now
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePreset('plus-1h')}
                            className="rounded-md border border-line bg-surface-subtle px-2 py-1 font-medium text-ink hover:bg-brand-soft hover:text-brand transition-colors"
                        >
                            +1 Hour
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePreset('today-9')}
                            className="rounded-md border border-line bg-surface-subtle px-2 py-1 font-medium text-ink hover:bg-brand-soft hover:text-brand transition-colors"
                        >
                            9:00 AM
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePreset('today-17')}
                            className="rounded-md border border-line bg-surface-subtle px-2 py-1 font-medium text-ink hover:bg-brand-soft hover:text-brand transition-colors"
                        >
                            5:00 PM
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePreset('tomorrow-9')}
                            className="rounded-md border border-line bg-surface-subtle px-2 py-1 font-medium text-ink hover:bg-brand-soft hover:text-brand transition-colors"
                        >
                            Tomorrow 9 AM
                        </button>
                    </div>

                    {/* Month Header Navigation */}
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-ink">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-surface-subtle hover:text-ink transition-colors"
                                aria-label="Previous month"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-surface-subtle hover:text-ink transition-colors"
                                aria-label="Next month"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Calendar Grid Header */}
                    <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-soft mb-0.5">
                        {DAYS_OF_WEEK.map((d) => (
                            <div key={d} className="py-0.5">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                        {calendarGrid.map((item, idx) => {
                            const isSelected = selectedDate && isSameDay(selectedDate, item.date);
                            const isToday = isSameDay(todayDate, item.date);

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectDay(item.date)}
                                    className={cn(
                                        'relative flex h-7 w-7 items-center justify-center rounded-md font-medium transition-colors mx-auto text-xs',
                                        item.month !== 'current' && 'text-ink-soft/40',
                                        item.month === 'current' && !isSelected && 'text-ink hover:bg-surface-subtle',
                                        isToday && !isSelected && 'font-bold text-brand ring-1 ring-brand/40',
                                        isSelected && 'bg-brand text-brand-contrast font-semibold shadow-sm'
                                    )}
                                >
                                    {item.day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Time Input Section */}
                    {includeTime && (
                        <div className="mt-2.5 border-t border-line pt-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                                    <Clock className="h-3.5 w-3.5 text-brand" />
                                    <span>Time</span>
                                </div>
                                <span className="text-xs font-mono font-medium text-ink">
                                    {hours.toString().padStart(2, '0')}:
                                    {minutes.toString().padStart(2, '0')} {ampm}
                                </span>
                            </div>

                            {/* Direct Typing Input Field */}
                            <div className="mb-2">
                                <input
                                    type="text"
                                    value={manualTimeInput}
                                    onChange={(e) => handleManualTimeInputChange(e.target.value)}
                                    placeholder="Type time e.g. 2:30 PM or 14:30"
                                    className="h-8 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-xs text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
                                />
                            </div>

                            {/* Direct Number Inputs & AM/PM Toggle */}
                            <div className="grid grid-cols-3 gap-1.5">
                                {/* Direct Editable Hours Input */}
                                <div className="relative flex items-center">
                                    <input
                                        type="number"
                                        min={1}
                                        max={12}
                                        value={hours}
                                        onChange={(e) =>
                                            handleTimeChange(
                                                parseInt(e.target.value, 10) || 12,
                                                minutes,
                                                ampm
                                            )
                                        }
                                        className="h-8 w-full rounded-lg border border-line-strong bg-surface px-2 text-center text-xs font-medium text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
                                    />
                                    <span className="absolute right-1 text-[10px] text-ink-soft/50 pointer-events-none">
                                        Hr
                                    </span>
                                </div>

                                {/* Direct Editable Minutes Input */}
                                <div className="relative flex items-center">
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        step={5}
                                        value={minutes}
                                        onChange={(e) =>
                                            handleTimeChange(
                                                hours,
                                                parseInt(e.target.value, 10) || 0,
                                                ampm
                                            )
                                        }
                                        className="h-8 w-full rounded-lg border border-line-strong bg-surface px-2 text-center text-xs font-medium text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
                                    />
                                    <span className="absolute right-1 text-[10px] text-ink-soft/50 pointer-events-none">
                                        Min
                                    </span>
                                </div>

                                {/* AM / PM Toggle Button */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleTimeChange(
                                            hours,
                                            minutes,
                                            ampm === 'AM' ? 'PM' : 'AM'
                                        )
                                    }
                                    className="h-8 rounded-lg border border-line-strong bg-surface-subtle font-semibold text-xs text-ink hover:bg-brand-soft hover:text-brand transition-colors"
                                >
                                    {ampm}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer Action Buttons */}
                    <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs font-medium text-ink-soft hover:text-danger transition-colors px-1"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-brand-contrast hover:bg-brand-strong transition-colors"
                        >
                            Apply
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className={cn('relative flex flex-col gap-1.5', className)}>
            {label && (
                <label
                    htmlFor={id}
                    className="text-xs font-semibold uppercase tracking-wider text-ink-soft"
                >
                    {label} {required && <span className="text-danger">*</span>}
                </label>
            )}

            {/* Input Trigger Button */}
            <div className="relative flex items-center">
                <button
                    id={id}
                    ref={triggerRef}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        if (!isOpen) updatePosition();
                        setIsOpen((prev) => !prev);
                    }}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={errorId}
                    className={cn(
                        'flex h-11 w-full items-center justify-between rounded-lg border bg-surface px-3.5 text-left text-sm font-normal transition-all focus:outline-none focus:ring-2 focus:ring-brand/30',
                        error
                            ? 'border-danger focus:border-danger'
                            : isOpen
                            ? 'border-brand ring-2 ring-brand/20'
                            : 'border-line-strong hover:border-ink-soft/50',
                        disabled && 'cursor-not-allowed opacity-50 bg-surface-subtle'
                    )}
                >
                    <span
                        className={cn(
                            'truncate',
                            value ? 'text-ink font-medium' : 'text-ink-soft'
                        )}
                    >
                        {value ? formatDisplayValue(value, includeTime) : placeholder}
                    </span>
                    <div className="flex items-center gap-1.5 text-ink-soft">
                        {value && !disabled && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClear();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        handleClear();
                                    }
                                }}
                                className="rounded p-0.5 hover:bg-surface-subtle hover:text-ink transition-colors"
                                title="Clear date"
                            >
                                <X className="h-4 w-4" />
                            </span>
                        )}
                        <CalendarIcon className="h-4 w-4 text-brand" />
                    </div>
                </button>
            </div>

            {error && (
                <p
                    id={errorId}
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                    className="text-xs text-danger"
                >
                    {error}
                </p>
            )}

            {/* Portal popover to document.body to avoid parent container overflow clipping */}
            {isMounted && createPortal(popoverContent, document.body)}
        </div>
    );
}
