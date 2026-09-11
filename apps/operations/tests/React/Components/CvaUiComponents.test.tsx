import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    Panel,
    Badge,
    StatusBadge,
    Stat,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Modal,
    Input,
    Label,
    FormField,
} from '@/components/ui';
import { applyTheme } from '@/lib/use-theme';

describe('CVA UI Components & Design System', () => {
    describe('Button', () => {
        it('renders with default variant and size', () => {
            render(<Button>Click me</Button>);
            const button = screen.getByRole('button', { name: 'Click me' });
            expect(button).toBeInTheDocument();
            expect(button).toHaveClass('bg-surface');
            expect(button).toHaveClass('min-h-11');
        });

        it('renders primary variant with Golden Amber brand styling', () => {
            render(<Button variant="primary">Confirm Order</Button>);
            const button = screen.getByRole('button', {
                name: 'Confirm Order',
            });
            expect(button).toHaveClass('bg-brand');
            expect(button).toHaveClass('text-brand-contrast');
        });

        it('renders danger variant', () => {
            render(<Button variant="danger">Delete Dispatch</Button>);
            const button = screen.getByRole('button', {
                name: 'Delete Dispatch',
            });
            expect(button).toHaveClass('bg-danger');
        });

        it('disables interactions when disabled', () => {
            render(<Button disabled>Disabled Action</Button>);
            const button = screen.getByRole('button', {
                name: 'Disabled Action',
            });
            expect(button).toBeDisabled();
            expect(button).toHaveClass('disabled:opacity-50');
        });
    });

    describe('Card & Panel', () => {
        it('renders card with header, title, and content', () => {
            render(
                <Card>
                    <CardHeader>
                        <CardTitle>Fleet Inspection</CardTitle>
                        <CardDescription>Daily checklist</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>All cranes operational</p>
                    </CardContent>
                    <CardFooter>
                        <span>Verified</span>
                    </CardFooter>
                </Card>,
            );

            expect(screen.getByText('Fleet Inspection')).toBeInTheDocument();
            expect(screen.getByText('Daily checklist')).toBeInTheDocument();
            expect(
                screen.getByText('All cranes operational'),
            ).toBeInTheDocument();
            expect(screen.getByText('Verified')).toBeInTheDocument();
        });

        it('supports Panel alias for backwards compatibility', () => {
            render(<Panel>Legacy Panel Content</Panel>);
            expect(
                screen.getByText('Legacy Panel Content'),
            ).toBeInTheDocument();
        });
    });

    describe('Badge & StatusBadge', () => {
        it('renders badge with variants', () => {
            render(<Badge variant="brand">Brand Badge</Badge>);
            const badge = screen.getByText('Brand Badge');
            expect(badge).toHaveClass('bg-brand-soft');
        });

        it('renders StatusBadge with dot indicator and status styling', () => {
            const { container } = render(<StatusBadge status="Scheduled" />);
            expect(screen.getByText('Scheduled')).toBeInTheDocument();
            expect(container.firstChild).toHaveClass('bg-brand-soft');
            expect(
                container.querySelector('.h-1\\.5.w-1\\.5'),
            ).toBeInTheDocument();
        });
    });

    describe('Stat Card', () => {
        it('renders metric overview with title, value, and delta', () => {
            render(
                <Stat
                    title="Active Dispatches"
                    value={42}
                    description="Updated 2 mins ago"
                    delta={{ value: '+12%', trend: 'up' }}
                />,
            );

            expect(screen.getByText('Active Dispatches')).toBeInTheDocument();
            expect(screen.getByText('42')).toBeInTheDocument();
            expect(screen.getByText('Updated 2 mins ago')).toBeInTheDocument();
            expect(screen.getByText('↑ +12%')).toBeInTheDocument();
        });

        it('supports semantic tones and selection state', () => {
            const handleClick = vi.fn();
            render(
                <Stat
                    title="Pending Sign-Off"
                    value={5}
                    tone="warning"
                    selected={true}
                    onClick={handleClick}
                />,
            );

            const card = screen.getByRole('button', {
                name: /pending sign-off/i,
            });
            expect(card).toHaveAttribute('aria-pressed', 'true');
            expect(card).toHaveClass('border-warning');

            fireEvent.click(card);
            expect(handleClick).toHaveBeenCalledTimes(1);

            fireEvent.keyDown(card, { key: 'Enter' });
            expect(handleClick).toHaveBeenCalledTimes(2);
        });
    });

    describe('Table Primitives', () => {
        it('renders accessible responsive table structure', () => {
            render(
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Job ID</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>DSP-101</TableCell>
                            <TableCell>En route</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>,
            );

            expect(screen.getByText('Job ID')).toBeInTheDocument();
            expect(screen.getByText('DSP-101')).toBeInTheDocument();
            expect(screen.getByText('En route')).toBeInTheDocument();
        });

        it('supports containerClassName override and row selection', () => {
            render(
                <Table containerClassName="border-0 rounded-none shadow-none">
                    <TableBody>
                        <TableRow selected={true}>
                            <TableCell>Active Crane</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>,
            );

            const row = screen.getByText('Active Crane').closest('tr');
            expect(row).toHaveAttribute('data-state', 'selected');
            expect(row).toHaveClass('bg-brand-soft/40');

            const container = row?.closest('div');
            expect(container).toHaveClass('border-0');
            expect(container).toHaveClass('rounded-none');
        });
    });

    describe('Modal & Dialog', () => {
        it('renders modal dialog when open is true', () => {
            const onClose = vi.fn();
            render(
                <Modal
                    open={true}
                    onClose={onClose}
                    title="Assign Operator"
                    description="Select a qualified crane operator"
                >
                    <p>Modal body content</p>
                </Modal>,
            );

            expect(screen.getByText('Assign Operator')).toBeInTheDocument();
            expect(
                screen.getByText('Select a qualified crane operator'),
            ).toBeInTheDocument();
            expect(screen.getByText('Modal body content')).toBeInTheDocument();

            const closeButton = screen.getByRole('button', {
                name: 'Close dialog',
            });
            fireEvent.click(closeButton);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not render dialog when open is false', () => {
            render(
                <Modal open={false} onClose={() => {}} title="Hidden Dialog">
                    <p>Hidden body</p>
                </Modal>,
            );

            expect(screen.queryByText('Hidden Dialog')).toBeNull();
        });
    });

    describe('Form Primitives', () => {
        it('renders standalone Label with required asterisk', () => {
            render(<Label required>Operator Name</Label>);
            expect(screen.getByText('Operator Name')).toBeInTheDocument();
            expect(screen.getByText('*')).toBeInTheDocument();
        });

        it('renders FormField with label, input, description, and error', () => {
            render(
                <FormField
                    label="Crane Serial"
                    description="Enter 6-digit asset code"
                    error="Asset code is required"
                    required
                >
                    <Input placeholder="CR-0000" error />
                </FormField>,
            );

            expect(screen.getByText('Crane Serial')).toBeInTheDocument();
            expect(screen.getByText('*')).toBeInTheDocument();
            expect(
                screen.getByText('Asset code is required'),
            ).toBeInTheDocument();
            expect(screen.getByPlaceholderText('CR-0000')).toHaveAttribute(
                'aria-invalid',
                'true',
            );
        });
    });

    describe('Theming Engine', () => {
        beforeEach(() => {
            document.documentElement.classList.remove('dark');
            document.documentElement.removeAttribute('data-theme');
        });

        it('applies dark theme to document root', () => {
            const resolved = applyTheme('dark');
            expect(resolved).toBe('dark');
            expect(document.documentElement.classList.contains('dark')).toBe(
                true,
            );
            expect(document.documentElement.getAttribute('data-theme')).toBe(
                'dark',
            );
        });

        it('applies light theme to document root', () => {
            const resolved = applyTheme('light');
            expect(resolved).toBe('light');
            expect(document.documentElement.classList.contains('dark')).toBe(
                false,
            );
            expect(document.documentElement.getAttribute('data-theme')).toBe(
                'light',
            );
        });
    });
});
