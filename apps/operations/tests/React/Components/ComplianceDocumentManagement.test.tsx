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
    view_tracking: false,
    request_fuel: false,
    forward_fuel: false,
    approve_fuel: false,
    verify_fuel: false,
    record_fuel: false,
    decide_approval: false,
    update_assigned_dispatch_status: false,
    update_asset_status: false,
    safety_lockdown_asset: false,
    inspect_asset: false,
    maintain_asset: false,
    request_gpt_assistance: false,
    decide_gpt_recommendation: false,
    retry_gpt_recommendation: false,
    create_job_report: false,
    export_reports: false,
    attachment_upload: false,
    attachment_policy: {
        owner_type: 'job_report',
        max_bytes: 10 * 1024 * 1024,
        max_count: 5,
        accepted_mime_types: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    review_job_report: false,
    manage_notifications: false,
    view_archive: false,
    restore_dispatch: false,
    view_sos: false,
    respond_sos: false,
};

const sampleCredential: PersonnelCredentialViewModel = {
    id: 10,
    kind: 'driver_license',
    credential_type: 'Driver License (LTO Professional)',
    credential_number: 'N01-12-345678',
    issuing_authority: 'LTO',
    issued_at: '2025-01-15',
    expires_at: '2028-01-15',
    notes: 'Restriction codes 1, 2, 3',
    status: 'active',
    attachment: {
        id: 501,
        original_filename: 'license_scan.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1048576,
        download_url: '/attachments/501/download',
    },
};

const sampleUser: WorkspaceUserViewModel = {
    id: 101,
    name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    role: 'operator',
    role_label: 'Operator',
    is_active: true,
    credentials: [sampleCredential],
};

const sampleAsset: AssetViewModel = {
    id: 201,
    code: 'ALB-CRN-050',
    name: 'Liebherr LTM 1050',
    kind: 'crane',
    subtype: 'mobile_crane',
    registration_number: null,
    manufacturer: 'Liebherr',
    model: 'LTM 1050',
    rated_capacity: 50,
    capacity_unit: 'tonnes',
    meter_type: 'hours',
    meter_value: 0,
    location: 'Alibaton yard',
    status: {
        value: 'available',
        label: 'Available',
    },
    specifications: {},
    blocking_work_orders_count: 0,
    is_dispatchable: true,
    inspections: [],
    maintenance_work_orders: [],
    documents: [
        {
            id: 301,
            category: 'road_permits',
            category_label: 'Road permits',
            title: 'DPWH Special Heavy Transit Permit',
            document_number: 'DPWH-2026-001',
            issuing_authority: 'DPWH',
            issued_at: '2026-01-01',
            expires_at: null,
            status: 'active',
            validity_status: 'no_expiration',
            is_expired: false,
            expires_soon: false,
            notes: 'Daytime travel prohibited on major highways',
            attachment: {
                id: 601,
                original_filename: 'transit_permit.pdf',
                mime_type: 'application/pdf',
                size_bytes: 2048576,
                download_url: '/attachments/601/download',
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
                    capabilities={{
                        ...defaultCapabilities,
                        manage_users: false,
                    }}
                />,
            );

            expect(
                screen.getAllByText('Juan Dela Cruz').length,
            ).toBeGreaterThan(0);
            expect(screen.getByText('N01-12-345678')).toBeInTheDocument();

            // Mutating management actions must NOT be present
            expect(
                screen.queryByText('Add Credential'),
            ).not.toBeInTheDocument();
            expect(screen.queryByText('Edit')).not.toBeInTheDocument();
            expect(screen.queryByText('Replace File')).not.toBeInTheDocument();
            expect(screen.queryByText('Delete')).not.toBeInTheDocument();

            // View-only preview button MUST be present
            expect(
                screen.getByTestId('preview-credential-10'),
            ).toBeInTheDocument();
        });

        it('allows credential management actions when user has manage_users capability', () => {
            render(
                <PersonnelWorkspaceSection
                    users={[sampleUser]}
                    capabilities={{
                        ...defaultCapabilities,
                        manage_users: true,
                    }}
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
                    capabilities={{
                        ...defaultCapabilities,
                        manage_users: true,
                    }}
                />,
            );

            fireEvent.click(screen.getByText('Add Credential'));
            expect(
                screen.getByRole('dialog', {
                    name: 'Add Credential for Juan Dela Cruz',
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByLabelText('Credential Kind'),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/Credential Type \/ Title/i),
            ).toBeInTheDocument();
        });

        it('keeps the selected details aligned with the filtered directory', () => {
            const secondUser: WorkspaceUserViewModel = {
                id: 102,
                name: 'Maria Santos',
                email: 'maria@example.com',
                role: 'operator',
                role_label: 'Operator',
                is_active: true,
                credentials: [],
            };

            render(
                <PersonnelWorkspaceSection
                    users={[sampleUser, secondUser]}
                    capabilities={defaultCapabilities}
                />,
            );

            fireEvent.change(
                screen.getByRole('textbox', { name: /search personnel/i }),
                {
                    target: { value: 'Maria' },
                },
            );

            expect(
                screen.getByRole('heading', { name: 'Maria Santos' }),
            ).toBeInTheDocument();
            expect(
                screen.queryByRole('heading', { name: 'Juan Dela Cruz' }),
            ).not.toBeInTheDocument();
        });

        it('summarizes personnel and credentials across the full directory', () => {
            const reviewUser: WorkspaceUserViewModel = {
                id: 102,
                name: 'Maria Santos',
                email: 'maria@example.com',
                role: 'operator',
                role_label: 'Operator',
                is_active: true,
                credentials: [
                    { ...sampleCredential, id: 11, validity_status: 'expired' },
                    {
                        ...sampleCredential,
                        id: 12,
                        validity_status: 'expiring_soon',
                    },
                ],
            };

            render(
                <PersonnelWorkspaceSection
                    users={[sampleUser, reviewUser]}
                    capabilities={defaultCapabilities}
                />,
            );

            expect(
                screen.getByTestId('personnel-overview-people'),
            ).toHaveTextContent('2');
            expect(
                screen.getByTestId('personnel-overview-credentials'),
            ).toHaveTextContent('3');
            expect(
                screen.getByTestId('personnel-overview-review'),
            ).toHaveTextContent(/1 expired\s*·\s*1 expiring soon/);
            expect(
                screen.getByRole('region', { name: 'Personnel overview' }),
            ).toHaveTextContent(/1 expired\s*·\s*1 expiring soon/);
        });

        it('keeps the first-credential action available in the compact empty state', () => {
            render(
                <PersonnelWorkspaceSection
                    users={[{ ...sampleUser, credentials: [] }]}
                    capabilities={{
                        ...defaultCapabilities,
                        manage_users: true,
                    }}
                />,
            );

            expect(
                screen.getByText('No credentials on file'),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', {
                    name: 'Add compliance credential for Juan Dela Cruz',
                }),
            ).toBeInTheDocument();
        });

        it('filters user list based on search query', () => {
            const secondUser: WorkspaceUserViewModel = {
                id: 102,
                name: 'Maria Santos',
                email: 'maria@example.com',
                role: 'driver',
                role_label: 'Driver',
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
            expect(
                within(userList).getByText('Juan Dela Cruz'),
            ).toBeInTheDocument();
            expect(
                within(userList).getByText('Maria Santos'),
            ).toBeInTheDocument();

            const searchInput = screen.getByPlaceholderText(
                'Search personnel...',
            );
            fireEvent.change(searchInput, { target: { value: 'Maria' } });

            expect(
                within(userList).queryByText('Juan Dela Cruz'),
            ).not.toBeInTheDocument();
            expect(
                within(userList).getByText('Maria Santos'),
            ).toBeInTheDocument();
        });
    });

    describe('FleetDocumentsSection', () => {
        it('restricts mutating actions when canManage is false', () => {
            render(
                <FleetDocumentsSection asset={sampleAsset} canManage={false} />,
            );

            expect(
                screen.getByText('DPWH Special Heavy Transit Permit'),
            ).toBeInTheDocument();
            expect(screen.getByText('DPWH-2026-001')).toBeInTheDocument();

            // Missing expiration date is displayed as "No expiration date", not "Permanent"
            expect(
                screen.getAllByText('No expiration date').length,
            ).toBeGreaterThan(0);
            expect(screen.queryByText('Permanent')).not.toBeInTheDocument();

            // Mutating actions must NOT be present
            expect(screen.queryByText('Add Document')).not.toBeInTheDocument();
            expect(
                screen.queryByTitle('Edit Document Metadata'),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByTitle('Replace Document File'),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByTitle('Delete Document'),
            ).not.toBeInTheDocument();

            // Preview and download remain available for compliance inspection
            expect(screen.getByText('Preview')).toBeInTheDocument();
            expect(screen.getByText('Download')).toBeInTheDocument();
        });

        it('shows management actions when canManage is true', () => {
            render(
                <FleetDocumentsSection asset={sampleAsset} canManage={true} />,
            );

            expect(screen.getByText('Add Document')).toBeInTheDocument();
            expect(
                screen.getByTitle('Edit Document Metadata'),
            ).toBeInTheDocument();
            expect(
                screen.getByTitle('Replace Document File'),
            ).toBeInTheDocument();
            expect(screen.getByTitle('Delete Document')).toBeInTheDocument();
        });

        it('opens Add Document in a modal and submits the selected file', () => {
            render(
                <FleetDocumentsSection asset={sampleAsset} canManage={true} />,
            );

            fireEvent.click(
                screen.getByRole('button', { name: /add document/i }),
            );

            expect(
                screen.getByRole('dialog', {
                    name: /add compliance document/i,
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByText('Upload Authorized Permit / Certificate'),
            ).toBeInTheDocument();

            const uploadButton = screen.getByRole('button', {
                name: /upload document/i,
            });
            expect(uploadButton).toBeDisabled();

            fireEvent.change(
                screen.getByLabelText(
                    /document attachment \(pdf or image, max 10mb\)/i,
                ),
                {
                    target: {
                        files: [
                            new File(['permit'], 'permit.pdf', {
                                type: 'application/pdf',
                            }),
                        ],
                    },
                },
            );

            expect(uploadButton).not.toBeDisabled();
            fireEvent.click(uploadButton);

            expect(mockPost).toHaveBeenCalledWith(
                '/operations/assets/201/documents',
                expect.objectContaining({
                    data: expect.objectContaining({
                        file: expect.any(File),
                    }),
                }),
            );
            expect(screen.getByText('Document uploaded.')).toBeInTheDocument();
        });

        it('makes the shared no-expiration state explicit in the upload form', () => {
            render(
                <FleetDocumentsSection asset={sampleAsset} canManage={true} />,
            );

            fireEvent.click(
                screen.getByRole('button', { name: /add document/i }),
            );

            const expiryInput = screen.getByLabelText('Expiry Date');
            const noExpiration = screen.getByRole('checkbox', {
                name: 'No expiration date',
            });

            expect(noExpiration).toBeChecked();
            expect(expiryInput).toBeDisabled();

            fireEvent.click(noExpiration);

            expect(noExpiration).not.toBeChecked();
            expect(expiryInput).not.toBeDisabled();
        });
    });
});
