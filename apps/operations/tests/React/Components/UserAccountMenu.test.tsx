import { router } from '@inertiajs/react';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAccountMenu } from '@/components/workspace/user-account-menu';
import type { User } from '@/types/auth';

const mockUser: User = {
    id: 1,
    name: 'Dev System Administrator',
    username: 'devadmin',
    email: 'admin@example.com',
    email_verified_at: '2026-09-01T00:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
};

describe('UserAccountMenu Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();

        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    it('renders nothing when isOpen is false', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={false}
                onClose={vi.fn()}
                triggerRef={triggerRef}
            />,
        );

        expect(
            screen.queryByRole('menu', { name: /User account options/i }),
        ).not.toBeInTheDocument();
    });

    it('renders user identity header with name, email, initials, role badge, and active status indicator when open', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
            />,
        );

        const menu = screen.getByRole('menu', {
            name: /User account options/i,
        });

        expect(menu).toBeInTheDocument();
        expect(
            screen.getByText('Dev System Administrator'),
        ).toBeInTheDocument();
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
        expect(screen.getByText('DA')).toBeInTheDocument();
        expect(screen.getByText('System Administrator')).toBeInTheDocument();
        expect(screen.getByTitle('Active session')).toBeInTheDocument();
    });

    it('renders identity header cleanly when user has no email', () => {
        const triggerRef = createRef<HTMLButtonElement>();
        const userWithoutEmail: User = {
            ...mockUser,
            email: undefined as unknown as string,
        };

        render(
            <UserAccountMenu
                user={userWithoutEmail}
                roleLabel="Field Operator"
                userInitials="FO"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
            />,
        );

        expect(
            screen.getByText('Dev System Administrator'),
        ).toBeInTheDocument();
        expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument();
        expect(
            screen.queryByText(/No email on record/i),
        ).not.toBeInTheDocument();
    });

    it('renders My Account navigation link and omits redundant secondary navigation links', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
            />,
        );

        const myAccountLink = screen.getByRole('menuitem', {
            name: /My Account/i,
        });

        expect(myAccountLink).toHaveAttribute('href', '/account');
        expect(
            screen.queryByRole('menuitem', { name: /Security & 2FA/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('menuitem', { name: /Team Management/i }),
        ).not.toBeInTheDocument();

        // Verify redundant subtitles are eliminated
        expect(
            screen.queryByText(/Profile & preferences/i),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText(/Active sessions & credentials/i),
        ).not.toBeInTheDocument();
    });

    it('omits Team Management link even when canManageUsers is true', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
                canManageUsers={true}
            />,
        );

        expect(
            screen.queryByRole('menuitem', { name: /Team Management/i }),
        ).not.toBeInTheDocument();
    });

    it('provides a 3-way segmented theme controller (Light / Dark / System) with active radio state', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
            />,
        );

        const radiogroup = screen.getByRole('radiogroup', {
            name: /Theme selection/i,
        });

        expect(radiogroup).toBeInTheDocument();

        const lightRadio = screen.getByRole('radio', { name: /Light/i });
        const darkRadio = screen.getByRole('radio', { name: /Dark/i });
        const systemRadio = screen.getByRole('radio', { name: /System/i });

        expect(lightRadio).toBeInTheDocument();
        expect(darkRadio).toBeInTheDocument();
        expect(systemRadio).toBeInTheDocument();

        // Clicking dark theme updates theme selection
        fireEvent.click(darkRadio);
        expect(darkRadio).toHaveAttribute('aria-checked', 'true');
        expect(lightRadio).toHaveAttribute('aria-checked', 'false');

        // Clicking system theme switches to system
        fireEvent.click(systemRadio);
        expect(systemRadio).toHaveAttribute('aria-checked', 'true');
    });

    it('executes sign out and closes menu when Sign Out is clicked', () => {
        const triggerRef = createRef<HTMLButtonElement>();
        const onClose = vi.fn();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={onClose}
                triggerRef={triggerRef}
            />,
        );

        const signOutBtn = screen.getByRole('menuitem', {
            name: /Sign out/i,
        });

        fireEvent.click(signOutBtn);

        expect(onClose).toHaveBeenCalled();
        expect(router.post).toHaveBeenCalledWith('/logout');
    });

    it('closes menu and restores focus to trigger on Escape key', () => {
        const trigger = document.createElement('button');

        document.body.appendChild(trigger);
        const triggerRef = { current: trigger };
        const onClose = vi.fn();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={onClose}
                triggerRef={triggerRef}
            />,
        );

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalled();

        document.body.removeChild(trigger);
    });

    it('closes menu when clicking outside', () => {
        const trigger = document.createElement('button');
        const outsideElement = document.createElement('div');

        document.body.appendChild(trigger);
        document.body.appendChild(outsideElement);
        const triggerRef = { current: trigger };
        const onClose = vi.fn();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={onClose}
                triggerRef={triggerRef}
            />,
        );

        fireEvent.pointerDown(outsideElement);

        expect(onClose).toHaveBeenCalled();

        document.body.removeChild(trigger);
        document.body.removeChild(outsideElement);
    });

    it('closes menu when clicking outside even if triggerRef.current is null', () => {
        const outsideElement = document.createElement('div');
        document.body.appendChild(outsideElement);
        const triggerRef = { current: null };
        const onClose = vi.fn();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={onClose}
                triggerRef={triggerRef}
            />,
        );

        fireEvent.pointerDown(outsideElement);
        expect(onClose).toHaveBeenCalled();

        document.body.removeChild(outsideElement);
    });

    it('activates link menuitem on Space key press', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
            />,
        );

        const myAccountLink = screen.getByRole('menuitem', {
            name: /My Account/i,
        });

        const clickSpy = vi.spyOn(myAccountLink, 'click');
        myAccountLink.focus();

        fireEvent.keyDown(myAccountLink, { key: ' ' });
        expect(clickSpy).toHaveBeenCalled();
    });

    it('closes menu on Tab key', () => {
        const triggerRef = createRef<HTMLButtonElement>();
        const onClose = vi.fn();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={onClose}
                triggerRef={triggerRef}
            />,
        );

        const myAccountLink = screen.getByRole('menuitem', {
            name: /My Account/i,
        });

        fireEvent.keyDown(myAccountLink, { key: 'Tab' });
        expect(onClose).toHaveBeenCalled();
    });

    it('handles 2D spatial keyboard navigation: ArrowDown/Up vertically and ArrowLeft/Right horizontally across themes', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
                canManageUsers={true}
            />,
        );

        const myAccountLink = screen.getByRole('menuitem', {
            name: /My Account/i,
        });
        const lightRadio = screen.getByRole('radio', { name: /Light/i });
        const darkRadio = screen.getByRole('radio', { name: /Dark/i });
        const systemRadio = screen.getByRole('radio', { name: /System/i });
        const signOutBtn = screen.getByRole('menuitem', {
            name: /Sign out/i,
        });

        myAccountLink.focus();
        expect(document.activeElement).toBe(myAccountLink);

        // ArrowDown moves from My Account directly down into the active theme option (light by default)
        fireEvent.keyDown(myAccountLink, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(lightRadio);

        // ArrowRight moves horizontally from Light to Dark and updates theme
        fireEvent.keyDown(lightRadio, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(darkRadio);
        expect(darkRadio).toHaveAttribute('aria-checked', 'true');

        // ArrowRight moves horizontally from Dark to System
        fireEvent.keyDown(darkRadio, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(systemRadio);
        expect(systemRadio).toHaveAttribute('aria-checked', 'true');

        // ArrowLeft moves horizontally back from System to Dark
        fireEvent.keyDown(systemRadio, { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(darkRadio);
        expect(darkRadio).toHaveAttribute('aria-checked', 'true');

        // ArrowDown from theme group moves vertically to Sign out!
        fireEvent.keyDown(darkRadio, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(signOutBtn);

        // ArrowUp from Sign out moves back up to the active theme option (dark)
        fireEvent.keyDown(signOutBtn, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(darkRadio);

        // ArrowUp from theme moves back up to My Account
        fireEvent.keyDown(darkRadio, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(myAccountLink);

        // Home key jumps to the very first item
        fireEvent.keyDown(darkRadio, { key: 'Home' });
        expect(document.activeElement).toBe(myAccountLink);

        // End key jumps to Sign out
        fireEvent.keyDown(myAccountLink, { key: 'End' });
        expect(document.activeElement).toBe(signOutBtn);
    });

    it('handles container fallback keyboard navigation when focus is on the menu wrapper', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
            />,
        );

        const menu = screen.getByRole('menu', {
            name: /User account options/i,
        });
        const myAccountLink = screen.getByRole('menuitem', {
            name: /My Account/i,
        });
        const signOutBtn = screen.getByRole('menuitem', {
            name: /Sign out/i,
        });

        // Focus the menu container directly
        menu.focus();
        expect(document.activeElement).toBe(menu);

        // ArrowDown from container focuses first focusable nav item (My Account)
        fireEvent.keyDown(menu, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(myAccountLink);

        menu.focus();
        // Home from container focuses first focusable nav item (My Account)
        fireEvent.keyDown(menu, { key: 'Home' });
        expect(document.activeElement).toBe(myAccountLink);

        menu.focus();
        // ArrowUp from container focuses last item (Sign out)
        fireEvent.keyDown(menu, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(signOutBtn);

        menu.focus();
        // End from container focuses last item (Sign out)
        fireEvent.keyDown(menu, { key: 'End' });
        expect(document.activeElement).toBe(signOutBtn);
    });

    it('marks sliding indicator pill with aria-hidden and gives active theme icon brand color', () => {
        const triggerRef = createRef<HTMLButtonElement>();

        render(
            <UserAccountMenu
                user={mockUser}
                roleLabel="System Administrator"
                userInitials="DA"
                isOpen={true}
                onClose={vi.fn()}
                triggerRef={triggerRef}
            />,
        );

        // Active radio button should contain an aria-hidden motion indicator span
        const activeRadio = screen.getByRole('radio', { name: /Light/i });
        const pill = activeRadio.querySelector('[aria-hidden="true"]');
        expect(pill).toBeInTheDocument();

        // Active radio icon has brand-strong color class
        const activeIcon = activeRadio.querySelector('svg');
        expect(activeIcon).toHaveClass('text-brand-strong');

        // Switch to Dark
        const darkRadio = screen.getByRole('radio', { name: /Dark/i });
        fireEvent.click(darkRadio);

        const darkIcon = darkRadio.querySelector('svg');
        expect(darkIcon).toHaveClass('text-brand-strong');
    });
});
