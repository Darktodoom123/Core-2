import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FuelLogModal } from '@/components/workspace/fuel/fuel-log-modal';
import { FuelRequestCard } from '@/components/workspace/fuel/fuel-request-card';
import { FuelSurface } from '@/components/workspace/fuel/fuel-surface';
import type {
    FuelRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

let mockAuthUser: { id: number; name: string } | null = {
    id: 1,
    name: 'Manager Alice',
};
const mockPost = vi.fn();

vi.mock('@inertiajs/react', () => {
    return {
        usePage: () => ({
            props: {
                auth: mockAuthUser ? { user: mockAuthUser } : undefined,
                flash: {},
                errors: {},
            },
            url: '/operations?section=fuel',
            component: 'Operations',
            version: null,
        }),
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
                errors,
                setError: (key: string, message: string) => {
                    setErrors((prev) => ({ ...prev, [key]: message }));
                },
                clearErrors: (...keys: string[]) => {
                    if (keys.length === 0) {
                        setErrors({});
                    } else {
                        setErrors((prev) => {
                            const next = { ...prev };

                            for (const k of keys) {
                                delete next[k];
                            }

                            return next;
                        });
                    }
                },
                reset: () => {
                    setDataState(initialValues);
                    setErrors({});
                },
                transform: vi.fn(),
                processing,
                setProcessing,
                post: mockPost,
            };
        },
        router: {
            visit: vi.fn(),
            get: vi.fn(),
            post: (...args: any[]) => mockPost(...args),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
            reload: vi.fn(),
            replace: vi.fn(),
        },
    };
});

function createCapabilities(
    overrides: Partial<WorkspaceCapabilities> = {},
): WorkspaceCapabilities {
    return {
        create_dispatch: true,
        create_client: true,
        create_service_request: true,
        convert_service_request: true,
        create_rental_dispatch: true,
        create_sales_dispatch: true,
        share_location: true,
        view_tracking: true,
        request_fuel: true,
        forward_fuel: true,
        approve_fuel: true,
        verify_fuel: true,
        record_fuel: true,
        decide_approval: true,
        update_assigned_dispatch_status: true,
        update_asset_status: true,
        safety_lockdown_asset: true,
        inspect_asset: true,
        maintain_asset: true,
        request_gpt_assistance: false,
        decide_gpt_recommendation: false,
        retry_gpt_recommendation: false,
        create_job_report: true,
        attachment_upload: true,
        attachment_policy: {
            owner_type: 'job_report',
            max_bytes: 10485760,
            max_count: 5,
            accepted_mime_types: ['image/jpeg', 'application/pdf'],
        },
        review_job_report: true,
        export_reports: true,
        manage_notifications: true,
        view_archive: true,
        restore_dispatch: true,
        view_sos: true,
        respond_sos: true,
        ...overrides,
    };
}

function createSampleRequests(): FuelRequestViewModel[] {
    return [
        {
            id: 101,
            reference: 'FUEL-REQ-101',
            requester: { id: 10, name: 'Operator Bob' },
            job: null,
            asset: {
                id: 1,
                code: 'CRN-501',
                name: 'Tadano 50T Mobile Crane',
                kind: 'crane',
                meter_type: 'hour_meter',
                meter_value: '3500.0',
                baseline_burn_rate: '12.5',
                burn_rate_unit: 'L/hr',
            },
            quantity_litres: '150',
            fuel_type: 'diesel',
            purpose: 'Highway bridge lift shift refueling',
            status: { value: 'submitted', label: 'Submitted' },
            logs: [],
        },
        {
            id: 102,
            reference: 'FUEL-REQ-102',
            requester: { id: 20, name: 'Driver Charlie' },
            job: {
                id: 88,
                reference: 'DISP-8801',
                title: 'Precast Girder Haul',
            },
            asset: {
                id: 2,
                code: 'TRK-202',
                name: 'Isuzu 10-Wheeler Dump',
                kind: 'truck',
                meter_type: 'odometer',
                meter_value: '45000',
                baseline_burn_rate: '3.5',
                burn_rate_unit: 'km/L',
            },
            quantity_litres: '220',
            fuel_type: 'diesel',
            purpose: 'Long-haul quarry delivery',
            status: { value: 'forwarded', label: 'Forwarded' },
            logs: [],
        },
        {
            id: 103,
            reference: 'FUEL-REQ-103',
            requester: { id: 30, name: 'Foreman Dan' },
            job: null,
            asset: {
                id: 3,
                code: 'GEN-303',
                name: 'Denyo 150kVA Generator',
                kind: 'equipment',
                meter_type: 'hour_meter',
                meter_value: '1200.0',
                baseline_burn_rate: '18.0',
                burn_rate_unit: 'L/hr',
            },
            quantity_litres: '300',
            fuel_type: 'diesel',
            purpose: 'Site continuous power',
            status: { value: 'approved', label: 'Approved' },
            logs: [],
        },
        {
            id: 104,
            reference: 'FUEL-REQ-104',
            requester: { id: 40, name: 'Operator Dave' },
            job: null,
            asset: {
                id: 4,
                code: 'EXC-404',
                name: 'Komatsu PC200 Excavator',
                kind: 'equipment',
                meter_type: 'hour_meter',
                meter_value: '2800.0',
                baseline_burn_rate: '15.0',
                burn_rate_unit: 'L/hr',
            },
            quantity_litres: '250',
            fuel_type: 'diesel',
            purpose: 'Excavation footing work',
            status: { value: 'verified', label: 'Verified' },
            logs: [],
        },
        {
            id: 105,
            reference: 'FUEL-REQ-105',
            requester: { id: 50, name: 'Driver Eva' },
            job: null,
            asset: {
                id: 5,
                code: 'TRK-505',
                name: 'Hino Prime Mover',
                kind: 'truck',
                meter_type: 'odometer',
                meter_value: '78000',
                baseline_burn_rate: '3.0',
                burn_rate_unit: 'km/L',
            },
            quantity_litres: '400',
            fuel_type: 'diesel',
            purpose: 'Night haul delivery fill',
            status: { value: 'logged', label: 'Logged' },
            logs: [
                {
                    id: 1001,
                    quantity_litres: '395',
                    total_cost: '25675',
                    price_per_litre: '65.00',
                    hour_meter: null,
                    odometer_km: 78450,
                    is_anomaly: false,
                    effective_burn_rate: '3.1',
                    recorded_at: '2026-09-06T15:00:00Z',
                    recorded_by: { id: 50, name: 'Driver Eva' },
                    receipt_path: '/storage/receipts/rec-1001.jpg',
                    receipt_url: 'https://cdn.example.com/rec-1001.jpg',
                    fuel_station: 'Petron SLEX Calamba',
                    remarks: 'Full tank dispensed successfully',
                },
            ],
        },
    ];
}

describe('FuelSurface & 5-Stage Workflow Verifications', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthUser = { id: 1, name: 'Manager Alice' };
    });

    describe('Task 1: Modernize Fuel Surface & Compact Counted Filters', () => {
        it('renders without the 5-card marketing KPI strip and provides compact counted stage filters', () => {
            const requests = createSampleRequests();
            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            // Verify the 5-card marketing subtitles are GONE
            expect(
                screen.queryByText('Awaiting manager decision'),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Ready for station refueling'),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Awaiting fuel log & receipt'),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Meters & receipts audited'),
            ).not.toBeInTheDocument();

            // Compact counted filter buttons are present
            expect(
                screen.getByRole('button', { name: /all \(5\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /pending review \(2\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /approved \(1\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /verified \(1\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /logged \(1\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /anomalies \(0\)/i }),
            ).toBeInTheDocument();

            // Compact summary strip displays truthful requested litres aggregate
            // Total requested: 150 + 220 + 300 + 250 + 400 = 1,320
            expect(screen.getByText('Requested Litres')).toBeInTheDocument();
            expect(screen.getByText('1,320')).toBeInTheDocument();
            expect(screen.getByText('Dispensed Logs:')).toBeInTheDocument();
            expect(screen.getByText('395')).toBeInTheDocument();
        });

        it('opens on-demand request modal via "New request" button with validation and duplicate-submit protection', () => {
            render(
                <FuelSurface
                    requests={createSampleRequests()}
                    capabilities={createCapabilities({ request_fuel: true })}
                    assets={[]}
                />,
            );

            // The create form is NOT always open in the page
            expect(
                screen.queryByText('New Refueling Request'),
            ).not.toBeInTheDocument();

            // Click "New request" button in header
            const newRequestBtn = screen.getByRole('button', {
                name: /new request/i,
            });
            fireEvent.click(newRequestBtn);

            // Modal dialog opens
            expect(
                screen.getByText('New Refueling Request'),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /submit refuel request/i }),
            ).toBeDisabled();

            // Close dialog
            fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
            expect(
                screen.queryByText('New Refueling Request'),
            ).not.toBeInTheDocument();
        });
    });

    describe('Task 2: Strict 5-Stage State Machine Enforcement & Self-Review Guard', () => {
        it('strictly enforces submitted -> forwarded transition and prevents skipping to approved or logged', () => {
            const submittedReq = createSampleRequests()[0]; // status: submitted
            const onTransition = vi.fn();
            const onRecordLog = vi.fn();

            render(
                <FuelRequestCard
                    request={submittedReq}
                    capabilities={createCapabilities()}
                    onTransition={onTransition}
                    onRecordLog={onRecordLog}
                />,
            );

            // Shows "Forward for Review"
            const forwardBtn = screen.getByRole('button', {
                name: /forward for review/i,
            });
            expect(forwardBtn).toBeInTheDocument();
            fireEvent.click(forwardBtn);
            expect(onTransition).toHaveBeenCalledWith(101, 'forwarded');

            // CANNOT jump straight to Verify or Record Fuel Log
            expect(
                screen.queryByRole('button', { name: /verify allocation/i }),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: /record fuel log/i }),
            ).not.toBeInTheDocument();
        });

        it('guards self-review: requester cannot approve or reject their own forwarded request', () => {
            const forwardedReq = createSampleRequests()[1]; // requester: { id: 20 }
            mockAuthUser = { id: 20, name: 'Driver Charlie' }; // SAME as requester!

            render(
                <FuelRequestCard
                    request={forwardedReq}
                    capabilities={createCapabilities({ approve_fuel: true })}
                    onTransition={vi.fn()}
                    onRecordLog={vi.fn()}
                    currentUserId={20}
                />,
            );

            // Open inline review
            fireEvent.click(
                screen.getByRole('button', { name: /review decision/i }),
            );

            // Self-review warning is prominently displayed
            expect(
                screen.getByText('Self-Review Forbidden'),
            ).toBeInTheDocument();
            expect(
                screen.getByText(
                    /requester cannot approve or reject their own request/i,
                ),
            ).toBeInTheDocument();

            // Both Approve and Reject buttons are DISABLED
            const approveBtn = screen.getByRole('button', {
                name: /approve request/i,
            });
            const rejectBtn = screen.getByRole('button', {
                name: /reject request/i,
            });
            expect(approveBtn).toBeDisabled();
            expect(rejectBtn).toBeDisabled();
        });

        it('allows independent reviewer to approve or reject a forwarded request with feedback note', () => {
            const forwardedReq = createSampleRequests()[1]; // requester: { id: 20 }
            mockAuthUser = { id: 99, name: 'Independent Supervisor' }; // Different user!
            const onTransition = vi.fn();

            render(
                <FuelRequestCard
                    request={forwardedReq}
                    capabilities={createCapabilities({ approve_fuel: true })}
                    onTransition={onTransition}
                    onRecordLog={vi.fn()}
                    currentUserId={99}
                />,
            );

            fireEvent.click(
                screen.getByRole('button', { name: /review decision/i }),
            );

            // Buttons are ENABLED
            const approveBtn = screen.getByRole('button', {
                name: /approve request/i,
            });
            const rejectBtn = screen.getByRole('button', {
                name: /reject request/i,
            });
            expect(approveBtn).not.toBeDisabled();
            expect(rejectBtn).not.toBeDisabled();

            // Enter justification note and approve
            const noteInput = screen.getByPlaceholderText(
                /add reason or guidance/i,
            );
            fireEvent.change(noteInput, {
                target: { value: 'Approved for long haul dispatch' },
            });
            fireEvent.click(approveBtn);

            expect(onTransition).toHaveBeenCalledWith(
                102,
                'approved',
                'Approved for long haul dispatch',
            );
        });

        it('ELIMINATES illegal shortcut: approved requests CANNOT record fuel logs directly, must be verified first', () => {
            const approvedReq = createSampleRequests()[2]; // status: approved
            const onTransition = vi.fn();
            const onRecordLog = vi.fn();

            render(
                <FuelRequestCard
                    request={approvedReq}
                    capabilities={createCapabilities({
                        verify_fuel: true,
                        record_fuel: true,
                    })}
                    onTransition={onTransition}
                    onRecordLog={onRecordLog}
                />,
            );

            // Shows "Verify Allocation"
            const verifyBtn = screen.getByRole('button', {
                name: /verify allocation/i,
            });
            expect(verifyBtn).toBeInTheDocument();

            // CRITICAL TEST: "Record Fuel Log" MUST NOT BE PRESENT on an approved request!
            expect(
                screen.queryByRole('button', { name: /record fuel log/i }),
            ).not.toBeInTheDocument();

            // Transition to verified
            fireEvent.click(verifyBtn);
            expect(onTransition).toHaveBeenCalledWith(103, 'verified');
        });

        it('strictly requires request to be verified before "Record Fuel Log" is enabled', () => {
            const verifiedReq = createSampleRequests()[3]; // status: verified
            const onRecordLog = vi.fn();

            render(
                <FuelRequestCard
                    request={verifiedReq}
                    capabilities={createCapabilities({ record_fuel: true })}
                    onTransition={vi.fn()}
                    onRecordLog={onRecordLog}
                />,
            );

            // Now "Record Fuel Log" IS available
            const recordLogBtn = screen.getByRole('button', {
                name: /record fuel log/i,
            });
            expect(recordLogBtn).toBeInTheDocument();

            fireEvent.click(recordLogBtn);
            expect(onRecordLog).toHaveBeenCalledWith(verifiedReq);
        });
    });

    describe('Task 3: Truthful Quantities & Anomaly Accounting', () => {
        it('displays "Not enough data to assess consumption" when baseline or prior meter logs are absent', () => {
            const requests = createSampleRequests().slice(0, 4); // None have evaluated logs
            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            expect(
                screen.getByText('Not enough data to assess consumption'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(
                    'All evaluated logs within baseline burn rate',
                ),
            ).not.toBeInTheDocument();
        });

        it('displays "All evaluated logs within baseline burn rate" when evaluated logs have zero anomalies', () => {
            const requests = createSampleRequests(); // request 105 has normal evaluated log
            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            expect(
                screen.getByText(
                    'All evaluated logs within baseline burn rate',
                ),
            ).toBeInTheDocument();
        });

        it('displays anomaly count and warning badge when an anomaly is present in logs', () => {
            const requests = createSampleRequests();
            // Inject an anomaly into request 105 log
            requests[4].logs![0].is_anomaly = true;
            requests[4].logs![0].anomaly_reason =
                'Consumption exceeded baseline by 28.5%';
            requests[4].logs![0].variance_percentage = '28.5';

            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            expect(
                screen.getByText(/1 burn-rate anomaly/i),
            ).toBeInTheDocument();
        });
    });

    describe('Task 4: Fuel Log Modal Enforcement', () => {
        it('enforces monotonic meter validation: entered meter cannot be lower than current meter', () => {
            const verifiedReq = createSampleRequests()[3]; // asset current meter: 2800.0 hrs

            render(
                <FuelLogModal
                    isOpen={true}
                    onClose={vi.fn()}
                    request={verifiedReq}
                />,
            );

            // Dispensed volume
            const volumeInput = screen.getByPlaceholderText(/150\.00/i);
            fireEvent.change(volumeInput, { target: { value: '250' } });

            // Enter a lower meter reading: 2750 (violation! current is 2800)
            const meterInput = screen.getByPlaceholderText(/min: 2800/i);
            fireEvent.change(meterInput, { target: { value: '2750' } });

            // Monotonic violation warning appears
            expect(
                screen.getByText(/cannot be lower than current meter/i),
            ).toBeInTheDocument();

            // Submit button is disabled due to monotonic violation
            const submitBtn = screen.getByRole('button', {
                name: /submit refueling log/i,
            });
            expect(submitBtn).toBeDisabled();

            // Enter valid higher meter: 2850
            fireEvent.change(meterInput, { target: { value: '2850' } });
            expect(
                screen.queryByText(/cannot be lower than current meter/i),
            ).not.toBeInTheDocument();
            expect(submitBtn).not.toBeDisabled();
        });
    });

    describe('Task 5: Strict Selection Invariant (Zero Zombie Panes)', () => {
        it('immediately falls back to filtered[0] when active request is excluded by status filter', () => {
            const requests = createSampleRequests();

            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            // Initially request 101 (submitted) is selected
            expect(screen.getByText(/Ref: FUEL-REQ-101/i)).toBeInTheDocument();

            // Filter to "Logged (1)" -> only request 105 is visible
            const loggedFilterBtn = screen.getByRole('button', {
                name: /logged \(1\)/i,
            });
            fireEvent.click(loggedFilterBtn);

            // Selection immediately updates to FUEL-REQ-105! Zero zombie FUEL-REQ-101!
            expect(screen.getByText(/Ref: FUEL-REQ-105/i)).toBeInTheDocument();
            expect(
                screen.queryByText(/Ref: FUEL-REQ-101/i),
            ).not.toBeInTheDocument();
            expect(screen.queryByText('FUEL-REQ-101')).not.toBeInTheDocument();
        });

        it('clears selection to empty state when search filters out all records (zero zombie pane)', () => {
            const requests = createSampleRequests();

            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            // Select request 102
            const req102QueueBtn = screen.getByText('FUEL-REQ-102');
            fireEvent.click(req102QueueBtn);
            expect(screen.getByText(/Ref: FUEL-REQ-102/i)).toBeInTheDocument();

            // Search for non-existent reference
            const searchInput = screen.getByPlaceholderText(
                /search reference, asset/i,
            );
            fireEvent.change(searchInput, {
                target: { value: 'NON-EXISTENT-XYZ' },
            });

            // Zero matches: empty state shown, detail pane completely cleared
            expect(
                screen.getByText('No matching fuel requests'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/Ref: FUEL-REQ-102/i),
            ).not.toBeInTheDocument();
        });
    });
});

describe('Fuel Management sections', () => {
    it('opens recorded logs and returns to their request with cleared filters', () => {
        render(
            <FuelSurface
                requests={createSampleRequests()}
                capabilities={createCapabilities()}
            />,
        );
        expect(
            screen.getByRole('heading', { name: 'Fuel Management' }),
        ).toBeInTheDocument();
        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'no-match' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Fuel Logs' }));
        expect(
            screen.getByRole('list', { name: 'Fuel log records' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Petron SLEX Calamba')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'View receipt' }),
        ).toHaveAttribute('href', 'https://cdn.example.com/rec-1001.jpg');
        fireEvent.click(
            screen.getByRole('button', { name: 'View request FUEL-REQ-105' }),
        );
        expect(screen.getByText(/Ref: FUEL-REQ-105/i)).toBeInTheDocument();
        expect(screen.getByRole('searchbox')).toHaveValue('');
    });

    it('labels the page scope and shows missing consumption measurements honestly', () => {
        const requests = createSampleRequests();
        requests[4].logs![0].effective_burn_rate = null;
        requests[4].logs![0].variance_percentage = null;
        render(
            <FuelSurface
                requests={requests}
                capabilities={createCapabilities()}
                pagination={{
                    current_page: 1,
                    last_page: 2,
                    per_page: 5,
                    total: 10,
                }}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Consumption' }));
        expect(
            screen.getByText(/consumption summaries cover this page only/),
        ).toBeInTheDocument();
        expect(screen.getAllByText('Not evaluated')).toHaveLength(2);
        expect(
            screen.getByRole('button', { name: 'Previous page' }),
        ).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    });

    it('shows an honest empty log state without inventing records', () => {
        render(
            <FuelSurface requests={[]} capabilities={createCapabilities()} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Fuel Logs' }));
        expect(
            screen.getByText('No fuel logs on this page'),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('list', { name: 'Fuel log records' }),
        ).not.toBeInTheDocument();
    });

    it('renders rejection callout and reviewer note on rejected requests and replaces awaiting pump log in queue', () => {
        const rejectedRequest: FuelRequestViewModel = {
            id: 199,
            reference: 'FUEL-REQ-REJECTED-99',
            requester: { id: 10, name: 'Operator Bob' },
            job: { id: 88, reference: 'DISP-8801', title: 'Precast Girder Haul' },
            asset: null,
            quantity_litres: '50.00',
            fuel_type: 'diesel',
            purpose: 'Emergency generator backup',
            status: { value: 'rejected', label: 'Rejected' },
            decision_reason: 'Exceeds authorized weekly allocation quota',
            approved_at: '2026-08-30T10:00:00Z',
            logs: [],
        };

        render(
            <FuelSurface
                requests={[rejectedRequest]}
                capabilities={createCapabilities()}
            />,
        );

        // Queue card should display "Request rejected" instead of "Awaiting pump log"
        expect(screen.getByText('Request rejected')).toBeInTheDocument();
        expect(screen.queryByText('Awaiting pump log')).not.toBeInTheDocument();

        // Detail pane should show prominent rejection callout
        const rejectionCallout = screen.getByTestId('rejection-callout');
        expect(rejectionCallout).toBeInTheDocument();
        expect(screen.getByText('Fuel Request Rejected by Operations')).toBeInTheDocument();
        expect(rejectionCallout).toHaveTextContent('Exceeds authorized weekly allocation quota');

        // Detail pane should show unlinked asset warning because asset is null
        expect(screen.getByText('Unlinked General Request (No Equipment Assigned)')).toBeInTheDocument();
    });

    it('opens receipt lightbox modal when clicking inspect receipt', () => {
        const requestWithReceipt: FuelRequestViewModel = {
            id: 105,
            reference: 'FUEL-REQ-RECEIPT-01',
            requester: { id: 20, name: 'Driver Charlie' },
            job: null,
            asset: {
                id: 2,
                code: 'TRK-202',
                name: 'Isuzu 10-Wheeler Dump',
                kind: 'truck',
                meter_type: 'odometer',
                meter_value: '45000',
            },
            quantity_litres: '100',
            fuel_type: 'diesel',
            purpose: 'Quarry haul refuel',
            status: { value: 'logged', label: 'Logged' },
            logs: [
                {
                    id: 501,
                    quantity_litres: '100',
                    odometer_km: 45200,
                    hour_meter: null,
                    price_per_litre: '65.00',
                    total_cost: '6500.00',
                    fuel_station: 'Petron Highway',
                    remarks: 'Full tank',
                    receipt_path: 'receipts/test.jpg',
                    receipt_url: 'https://example.com/receipt.jpg',
                    recorded_by: { id: 20, name: 'Driver Charlie' },
                    recorded_at: '2026-08-28T14:00:00Z',
                },
            ],
        };

        render(
            <FuelSurface
                requests={[requestWithReceipt]}
                capabilities={createCapabilities()}
            />,
        );

        const inspectBtn = screen.getByRole('button', { name: /inspect station receipt photo in lightbox/i });
        expect(inspectBtn).toBeInTheDocument();

        fireEvent.click(inspectBtn);

        // Lightbox dialog should appear
        expect(screen.getByRole('dialog', { name: /station receipt inspection lightbox/i })).toBeInTheDocument();
        expect(screen.getByText(/Station Receipt Audit · FUEL-REQ-RECEIPT-01/i)).toBeInTheDocument();

        // Close lightbox
        const closeBtn = screen.getByRole('button', { name: /close receipt inspection/i });
        fireEvent.click(closeBtn);

        expect(screen.queryByRole('dialog', { name: /station receipt inspection lightbox/i })).not.toBeInTheDocument();
    });
});
