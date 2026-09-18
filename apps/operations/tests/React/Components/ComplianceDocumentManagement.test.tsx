import { fireEvent, render, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FleetDocumentsSection } from '@/components/workspace/fleet/fleet-documents-section';
import { PersonnelWorkspaceSection } from '@/components/workspace/personnel/personnel-workspace-section';
import type {
    AssetViewModel,
    PersonnelCredentialViewModel,
    WorkspaceCapabilities,
    WorkspaceUserViewModel,
} from '@/types/workspace';

const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockRouterDelete = vi.fn();

vi.mock('@inertiajs/react', () => {
    return {
        router: {
            delete: (url: string, options?: any) => {
                mockRouterDelete(url, options);
                options?.onSuccess?.();
            },
        },
        useForm: (initialValues: any) => {
            const [data, setDataState] = useState(initialValues);
            const [errors, setErrors] = useState<Record<string, string>>({});
            const [processing, setProcessing] = useState(false);

            return {
                data,
                setData: (keyOrFn: any, val?: any) => {
                    if (typeof keyOrFn === 'function') {
                        setDataState(keyOrFn);
                    } else if (typeof keyOrFn === 'string') {
                        setDataState((prev: any) => ({
                            ...prev,
                            [keyOrFn]: val,
                        }));
                    } else {
                        setDataState(keyOrFn);
                    }
                },
                post: (url: string, options?: any) => {
                    mockPost(url, { data, options });
                    options?.onSuccess?.();
                },
                patch: (url: string, options?: any) => {
                    mockPatch(url, { data, options });
                    options?.onSuccess?.();
                },
                errors,
                setErrors,
                processing,
                setProcessing,
                reset: vi.fn(),
                clearErrors: vi.fn(),
                setError: (key: string, message: string) => {
                    setErrors((prev) => ({ ...prev, [key]: message }));
                },
                transform: (cb: any) => cb,
            };
        },
    };
});

const defaultCapabilities: WorkspaceCapabilities = {
    create_dispatch: false,
    create_client: false,
    create_service_request: false,
    convert_service_request: false,
    create_rental_dispatch: false,
    create_sales_dispatch: false,
    share_location: false,
    request_fuel: false,
    approve_fuel: false,
    view_fuel_stats: false,
    create_job_report: false,
    view_reports: false,
    export_reports: false,
    export_audit_logs: false,
    delete_completed_jobs: false,
    delete_archived_jobs: false,
    view_safety: false,
    edit_safety: false,
    view_users: true,
    manage_users: false,
    view_sos: false,
    respond_sos: false,
    decide_approval: false,
};

const sampleCredential: PersonnelCredentialViewModel = {
    id: 10,
    user_id: 101,
    kind: 'driver_license',
    credential_type: 'Driver License (LTO Professional)',
    credential_number: 'N01-12-345678',
    issuing_authority: 'LTO',
    issued_at: '2025-01-15',
    expires_at: '2028-01-15',
    notes: 'Restriction codes 1, 2, 3',
    status: 'active',
    is_expired: false,
    expires_soon: false,
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
    attachment: {
        id: 501,
        file_name: 'license_scan.pdf',
        file_path: 'credentials/101/license_scan.pdf',
        file_size: 1048576,
        mime_type: 'application/pdf',
        url: '/attachments/501/download',
    },
};

const sampleUser: WorkspaceUserViewModel = {
    id: 101,
    name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    role: 'operator',
    department: 'Heavy Lifting',
    is_active: true,
    credentials: [sampleCredential],
};

const sampleAsset: AssetViewModel = {
    id: 201,
    code: 'ALB-CRN-050',
    name: 'Liebherr LTM 1050',
    kind: 'crane',
    status: {
        value: 'available',
        label: 'Available',
        badge_variant: 'default',
        description: 'Available for work',
    },
    specifications: {},
    equipment_type: 'Mobile Crane',
    is_active: true,
    documents: [
        {
            id: 301,
            asset_id: 201,
            category: 'road_permits',
            title: 'DPWH Special Heavy Transit Permit',
            document_number: 'DPWH-2026-001',
            issuing_authority: 'DPWH',
            issued_at: '2026-01-01',
            expires_at: null,
            status: 'active',
            is_expired: false,
            expires_soon: false,
            notes: 'Daytime travel prohibited on major highways',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            attachment: {
                id: 601,
                file_name: 'transit_permit.pdf',
                file_path: 'assets/201/transit_permit.pdf',
                file_size: 2048576,
                mime_type: 'application/pdf',
                url: '/attachments/601/download',
            },
        },
    ],
};

describe('Compliance Document Management & RBAC Gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('PersonnelWorkspaceSection', () => {
        it('restricts mutating management actions for view-only users', () => {
            render(
                <PersonnelWorkspaceSection
                    users={[sampleUser]}
                    capabilities={{ ...defaultCapabilities, manage_users: false }}
                />,
            );

            expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThan(0);
            expect(screen.getByText('N01-12-345678')).toBeInTheDocument();

            // Mutating management actions must NOT be present
            expect(screen.queryByText('Add Credential')).not.toBeInTheDocument();
            expect(screen.queryByText('Edit')).not.toBeInTheDocument();
            expect(screen.queryByText('Replace File')).not.toBeInTheDocument();
            expect(screen.queryByText('Delete')).not.toBeInTheDocument();

            // View-only preview button MUST be present
            expect(screen.getByTestId('preview-credential-10')).toBeInTheDocument();
        });

        it('allows credential management actions when user has manage_users capability', () => {
            render(
                <PersonnelWorkspaceSection
                    users={[sampleUser]}
                    capabilities={{ ...defaultCapabilities, manage_users: true }}
                />,
            );

            // Mutating management actions MUST be visible
            expect(screen.getByText('Add Credential')).toBeInTheDocument();
            expect(screen.getByText('Edit')).toBeInTheDocument();
            expect(screen.getByText('Replace File')).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
        });

        it('opens Add Credential modal when clicking Add Credential button', () => {
            render(
                <PersonnelWorkspaceSection
                    users={[sampleUser]}
                    capabilities={{ ...defaultCapabilities, manage_users: true }}
                />,
            );

            fireEvent.click(screen.getByText('Add Credential'));
            expect(screen.getByText('Add Credential for Juan Dela Cruz')).toBeInTheDocument();
            expect(screen.getByText(/Credential Type \/ Title/i)).toBeInTheDocument();
        });

        it('filters user list based on search query', () => {
            const secondUser: WorkspaceUserViewModel = {
                id: 102,
                name: 'Maria Santos',
                email: 'maria@example.com',
                role: 'driver',
                is_active: true,
                credentials: [],
            };

            render(
                <PersonnelWorkspaceSection
                    users={[sampleUser, secondUser]}
                    capabilities={defaultCapabilities}
                />,
            );

            const userList = screen.getByRole('list');
            expect(within(userList).getByText('Juan Dela Cruz')).toBeInTheDocument();
            expect(within(userList).getByText('Maria Santos')).toBeInTheDocument();

            const searchInput = screen.getByPlaceholderText('Search personnel...');
            fireEvent.change(searchInput, { target: { value: 'Maria' } });

            expect(within(userList).queryByText('Juan Dela Cruz')).not.toBeInTheDocument();
            expect(within(userList).getByText('Maria Santos')).toBeInTheDocument();
        });
    });

    describe('FleetDocumentsSection', () => {
        it('restricts mutating actions when canManage is false', () => {
            render(
                <FleetDocumentsSection
                    asset={sampleAsset}
                    canManage={false}
                />,
            );

            expect(screen.getByText('DPWH Special Heavy Transit Permit')).toBeInTheDocument();
            expect(screen.getByText('DPWH-2026-001')).toBeInTheDocument();

            // Missing expiration date is displayed as "No expiration date", not "Permanent"
            expect(screen.getAllByText('No expiration date').length).toBeGreaterThan(0);
            expect(screen.queryByText('Permanent')).not.toBeInTheDocument();

            // Mutating actions must NOT be present
            expect(screen.queryByText('Add Document')).not.toBeInTheDocument();
            expect(screen.queryByTitle('Edit Document Metadata')).not.toBeInTheDocument();
            expect(screen.queryByTitle('Replace Document File')).not.toBeInTheDocument();
            expect(screen.queryByTitle('Delete Document')).not.toBeInTheDocument();

            // Preview and download remain available for compliance inspection
            expect(screen.getByText('Preview')).toBeInTheDocument();
            expect(screen.getByText('Download')).toBeInTheDocument();
        });

        it('shows management actions when canManage is true', () => {
            render(
                <FleetDocumentsSection
                    asset={sampleAsset}
                    canManage={true}
                />,
            );

            expect(screen.getByText('Add Document')).toBeInTheDocument();
            expect(screen.getByTitle('Edit Document Metadata')).toBeInTheDocument();
            expect(screen.getByTitle('Replace Document File')).toBeInTheDocument();
            expect(screen.getByTitle('Delete Document')).toBeInTheDocument();
        });
    });
});
