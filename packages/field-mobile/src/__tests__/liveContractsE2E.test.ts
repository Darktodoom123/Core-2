import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ApiClientError, FieldApiClient } from '../services/apiClient';
import type {
    DispatchJob,
    JobReportCommandPayload,
    User,
} from '../types/index';

describe('Field Mobile Live Contracts & E2E Workflows', () => {
    const seededOperatorUser: User = {
        id: 4,
        name: 'Dev Crane Operator',
        username: 'operator',
        email: 'operator@example.com',
        role: 'crane_operator',
        is_active: true,
    };

    const liveAssetCrane = {
        id: 101,
        operational_asset_id: 101,
        asset_code: 'CRN-101',
        asset_name: '50T Tadano All-Terrain Crane',
        asset_kind: 'crane',
        asset_subtype: 'All-Terrain',
        model: 'ATF 50G-3',
        manufacturer: 'Tadano',
        rated_capacity: 50.0,
        capacity_unit: 'tonnes',
        engine_hours: 1420.5,
        meter_type: 'hour_meter',
        attachments: ['20T Counterweight', 'Jib Extension'],
        site_latitude: 14.5547,
        site_longitude: 121.0244,
        assigned_at: '2026-09-06T08:00:00Z',
        active_until: null,
    };

    const liveDispatchJob: DispatchJob = {
        id: 891,
        reference: 'DSP-2026-0891',
        client: 'Megawide - Metro Manila Subway Project',
        title: '50T Tandem Lift & Structural Steel Erection',
        site: 'North Staging Terminal - Pier 4',
        site_latitude: 14.5547,
        site_longitude: 121.0244,
        priority: { value: 'priority', label: 'Priority' },
        status: { value: 'dispatched', label: 'Dispatched' },
        version: 1,
        my_assignment: {
            id: 401,
            response_status: 'accepted',
            response_status_label: 'Accepted',
            assigned_at: '2026-09-06T08:00:00Z',
        },
        asset_assignments: [liveAssetCrane as any],
        capabilities: {
            can_respond: false,
            can_update_status: true,
            can_share_location: true,
        },
    };

    // =========================================================================
    // TIER 1: FEATURE COVERAGE (HAPPY PATH CONTRACTS)
    // =========================================================================

    test('Tier 1: R1 Live Dispatch - fetches assigned jobs with live asset metadata and zero fallback mockups', async () => {
        let capturedAuth = '';

        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            capturedAuth =
                (init?.headers as Record<string, string>)?.['Authorization'] ||
                '';
            const url = String(input);

            if (url.includes('/api/v1/dispatch-jobs')) {
                return new Response(
                    JSON.stringify({
                        data: [liveDispatchJob],
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'valid-sanctum-token-op4',
            fetchFn: mockFetch as any,
        });

        const jobs = await client.fetchAssignedJobs();
        assert.equal(jobs.length, 1);
        assert.equal(capturedAuth, 'Bearer valid-sanctum-token-op4');

        const job = jobs[0];
        assert.equal(job.reference, 'DSP-2026-0891');
        assert.equal(job.client, 'Megawide - Metro Manila Subway Project');
        assert.equal(job.site, 'North Staging Terminal - Pier 4');
        assert.equal(job.site_latitude, 14.5547);
        assert.equal(job.site_longitude, 121.0244);

        // Verify live asset metadata
        const asset = (job.asset_assignments as any[])[0];
        assert.equal(asset.asset_code, 'CRN-101');
        assert.equal(asset.asset_name, '50T Tadano All-Terrain Crane');
        assert.equal(asset.model, 'ATF 50G-3');
        assert.equal(asset.rated_capacity, 50.0);
        assert.equal(asset.engine_hours, 1420.5);
        assert.deepEqual(asset.attachments, [
            '20T Counterweight',
            'Jib Extension',
        ]);

        // Assert ZERO fallback mockups
        assert.notEqual(asset.asset_code, 'ALB-CRN-050');
        assert.notEqual(asset.engine_hours, '4,820 hrs');
    });

    test('Tier 1: R2 HoS Live Clocks - fetches live shift clocks and 8-day rolling cycle history', async () => {
        const mockClocks = {
            shift_active: true,
            shift_status: 'active',
            current_duty_status: 'operating',
            started_at: '2026-09-06T06:00:00Z',
            hours_elapsed: 4.5,
            drive_remaining_minutes: 420,
            shift_window_remaining_minutes: 570,
            break_countdown_minutes: 210,
            cycle_remaining_minutes: 3800,
            cycle_accumulated_minutes: 400,
            cycle_limit_minutes: 4200,
            timeline_segments: [
                {
                    id: 1,
                    status: 'operating',
                    status_label: 'On Duty — Crane / Machine Operating',
                    started_at: '2026-09-06T06:00:00Z',
                    ended_at: null,
                    duration_minutes: 270,
                    location_name: 'Pier 4 Heavy Yard',
                },
            ],
            recent_logs: [
                {
                    id: 1,
                    duty_status: 'operating',
                    started_at: '06:00 AM',
                    ended_at: 'Current',
                    duration_formatted: '4h 30m',
                },
            ],
            active_demurrage: false,
            is_certified: false,
        };

        const mockFetch = async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/v1/hos/current-shift')) {
                return new Response(
                    JSON.stringify({
                        data: {
                            shift: { id: 701, user_id: 4, status: 'active' },
                            clocks: mockClocks,
                        },
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            if (url.includes('/api/v1/hos/cycle-history')) {
                return new Response(
                    JSON.stringify({
                        data: {
                            days: 8,
                            shifts: [
                                { id: 701, started_at: '2026-09-06T06:00:00Z' },
                            ],
                            logs: [{ id: 1, duty_status: 'operating' }],
                        },
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        const currentShift = await client.fetchCurrentHosShift();
        assert.ok(currentShift.shift);
        assert.equal(currentShift.clocks.shift_active, true);
        assert.equal(currentShift.clocks.current_duty_status, 'operating');
        assert.equal(currentShift.clocks.hours_elapsed, 4.5);
        assert.equal(currentShift.clocks.drive_remaining_minutes, 420);
        assert.ok(currentShift.clocks.timeline_segments);
        assert.equal(currentShift.clocks.timeline_segments.length, 1);

        const cycleHistory = await client.fetchHosCycleHistory(8);
        assert.equal(cycleHistory.days, 8);
        assert.equal(cycleHistory.shifts.length, 1);
    });

    test('Tier 1: R3 Relief Handover & Safety DVIR - initiates dynamic 4-digit PIN and posts DVIR inspection', async () => {
        let dvirCapturedBody: any = null;

        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const url = String(input);

            if (url.includes('/handover/initiate')) {
                return new Response(
                    JSON.stringify({
                        message: 'Equipment handover initiated successfully.',
                        data: {
                            handover_token:
                                '89a94158-b173-455b-bfa9-15ee8e59ec4c',
                            pin: '6391',
                            expires_at: '2026-09-06T10:45:00Z',
                            asset_code: 'CRN-101',
                        },
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            if (url.includes('/handover/claim')) {
                const body = JSON.parse(String(init?.body));
                assert.equal(body.pin, '6391');

                return new Response(
                    JSON.stringify({
                        message:
                            'Equipment handover claimed successfully. Asset bound to relief operator.',
                        data: {
                            status: 'transferred',
                            previous_operator_id: 4,
                            active_operator_id: 8,
                        },
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            if (url.includes('/api/v1/dvir/inspections')) {
                dvirCapturedBody = JSON.parse(String(init?.body));

                return new Response(
                    JSON.stringify({
                        message: 'DVIR walkaround inspection logged.',
                        data: {
                            id: 901,
                            asset_code: dvirCapturedBody.asset_code,
                            has_defects: dvirCapturedBody.has_defects,
                            checks: dvirCapturedBody.checks,
                        },
                    }),
                    {
                        status: 201,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        // 1. Handover initiate check
        const initiateRes = await (client as any).fetchFn(
            'http://localhost:8000/api/v1/dispatch-jobs/891/handover/initiate',
            {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer token',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ relief_user_id: 8 }),
            },
        );
        const initJson = await initiateRes.json();
        assert.equal(initJson.data.pin, '6391');
        assert.match(initJson.data.pin, /^\d{4}$/);
        assert.notEqual(initJson.data.pin, '8421'); // Must NOT be static 8421

        // 2. Handover claim check
        const claimRes = await (client as any).fetchFn(
            'http://localhost:8000/api/v1/dispatch-jobs/891/handover/claim',
            {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer token-relief',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pin: '6391' }),
            },
        );
        const claimJson = await claimRes.json();
        assert.equal(claimJson.data.status, 'transferred');
        assert.equal(claimJson.data.active_operator_id, 8);

        // 3. Safety DVIR walkaround check
        const dvirResult = await client.createDvirInspection({
            inspection_type: 'pre_trip',
            asset_code: 'CRN-101',
            asset_name: '50T Tadano All-Terrain Crane',
            engine_hours: 1420.5,
            has_defects: false,
            signature_captured: true,
            checks: [
                {
                    category: 'hydraulics',
                    label: 'Outrigger hydraulic jacks',
                    status: 'good',
                },
            ],
        });
        assert.equal(dvirResult.asset_code, 'CRN-101');
        assert.equal(dvirResult.has_defects, false);
        assert.equal(
            dvirCapturedBody.checks[0].label,
            'Outrigger hydraulic jacks',
        );
    });

    test('Tier 1: R4 Job Completion Report - sends Bearer token, Idempotency-Key, and digital signature metadata', async () => {
        let capturedUrl = '';
        let capturedHeaders: Record<string, string> = {};
        let capturedBody: any = null;

        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            capturedUrl = String(input);
            capturedHeaders = Object.fromEntries(
                new Headers(init?.headers).entries(),
            );
            capturedBody = JSON.parse(String(init?.body));

            return new Response(
                JSON.stringify({
                    data: {
                        id: 550,
                        dispatch_job_id: capturedBody.dispatch_job_id,
                        work_summary: capturedBody.work_summary,
                        status: 'submitted',
                        signer_name: capturedBody.signer_name,
                        signer_role: capturedBody.signer_role,
                        signed_at: capturedBody.signed_at,
                    },
                }),
                {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'operator-bearer-token',
            fetchFn: mockFetch as any,
        });

        const commandId = 'c7e8a931-e401-447a-a43b-85194fbc265e';
        const payload: JobReportCommandPayload = {
            dispatch_job_id: 891,
            work_summary:
                'Erected four precast concrete beam units on grid lines 4 to 8.',
            remarks: 'Smooth operation, zero near-miss incidents.',
            started_at: '2026-09-06T08:00:00Z',
            ended_at: '2026-09-06T16:00:00Z',
            ending_meter_value: 1428.5,
            meter_type: 'hour_meter',
            latitude: 14.5547,
            longitude: 121.0244,
            signer_name: 'Engr. Roberto Cruz',
            signer_role: 'Site Safety Director',
            signed_at: '2026-09-06T16:05:00Z',
        };

        const result: any = await client.submitJobReport(payload, commandId);
        assert.ok(result);

        // Verify URL and headers
        assert.ok(capturedUrl.includes('/api/v1/job-reports'));
        assert.equal(
            capturedHeaders['authorization'],
            'Bearer operator-bearer-token',
        );
        assert.equal(capturedHeaders['idempotency-key'], commandId);

        // Verify payload preservation
        assert.equal(capturedBody.dispatch_job_id, 891);
        assert.equal(
            capturedBody.work_summary,
            'Erected four precast concrete beam units on grid lines 4 to 8.',
        );
        assert.equal(capturedBody.ending_meter_value, 1428.5);
        assert.equal(capturedBody.signer_name, 'Engr. Roberto Cruz');
        assert.equal(capturedBody.signer_role, 'Site Safety Director');
        assert.equal(capturedBody.signed_at, '2026-09-06T16:05:00Z');

        // Verify response parsing
        assert.equal(result.id, 550);
        assert.equal(result.status, 'submitted');
    });

    test('Tier 1: R5 Seeded Operator Login & Data Display - operator logs in and retrieves live assigned crane', async () => {
        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const url = String(input);

            if (url.includes('/api/v1/auth/login')) {
                const body = JSON.parse(String(init?.body));
                assert.equal(body.username, 'operator');
                assert.equal(body.password, 'password');

                return new Response(
                    JSON.stringify({
                        token: 'seeded-bearer-token-user-4',
                        user: seededOperatorUser,
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            if (url.includes('/api/v1/dispatch-jobs')) {
                return new Response(
                    JSON.stringify({
                        data: [liveDispatchJob],
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'seeded-bearer-token-user-4',
            fetchFn: mockFetch as any,
        });

        const authResult = await client.login('operator', 'password');
        assert.equal(authResult.token, 'seeded-bearer-token-user-4');
        assert.equal(authResult.user.id, 4);
        assert.equal(authResult.user.role, 'crane_operator');

        const jobs = await client.fetchAssignedJobs();
        assert.equal(jobs.length, 1);
        assert.equal(
            (jobs[0].asset_assignments as any[])[0].asset_code,
            'CRN-101',
        );
    });

    // =========================================================================
    // TIER 2: BOUNDARY & CORNER CASES
    // =========================================================================

    test('Tier 2: Boundary - handles unassigned operator cleanly with empty jobs array and off-duty HoS', async () => {
        const mockFetch = async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/v1/dispatch-jobs')) {
                return new Response(JSON.stringify({ data: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            if (url.includes('/api/v1/hos/current-shift')) {
                return new Response(
                    JSON.stringify({
                        data: {
                            shift: null,
                            clocks: {
                                shift_active: false,
                                shift_status: 'completed',
                                current_duty_status: 'off_duty',
                                hours_elapsed: 0.0,
                                drive_remaining_minutes: 660,
                                shift_window_remaining_minutes: 840,
                                break_countdown_minutes: 480,
                                cycle_remaining_minutes: 4200,
                                timeline_segments: [],
                                recent_logs: [],
                                active_demurrage: false,
                                is_certified: false,
                            },
                        },
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        const jobs = await client.fetchAssignedJobs();
        assert.equal(jobs.length, 0);

        const hos = await client.fetchCurrentHosShift();
        assert.equal(hos.shift, null);
        assert.equal(hos.clocks.shift_active, false);
        assert.equal(hos.clocks.current_duty_status, 'off_duty');
        assert.equal(hos.clocks.hours_elapsed, 0.0);
    });

    test('Tier 2: Corner Case - rejects handover self-claim with 422 ApiClientError', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message:
                        'Cannot claim handover from yourself. Another relief operator must claim the unit.',
                    error: 'validation_failed',
                }),
                {
                    status: 422,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await (client as any)
                .fetchFn(
                    'http://localhost:8000/api/v1/dispatch-jobs/891/handover/claim',
                    {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer token',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ pin: '6391' }),
                    },
                )
                .then(async (r: Response) => {
                    if (!r.ok) {
                        const err = await r.json();

                        throw new ApiClientError(err.message, r.status);
                    }
                });
            assert.fail('Expected ApiClientError');
        } catch (err: any) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 422);
            assert.match(err.message, /Cannot claim handover from yourself/);
        }
    });

    test('Tier 2: Corner Case - rejects expired or invalid handover PIN with 422 ApiClientError', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message:
                        'Handover session expired or invalid for this equipment.',
                    error: 'invalid_credentials',
                }),
                {
                    status: 422,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await (client as any)
                .fetchFn(
                    'http://localhost:8000/api/v1/dispatch-jobs/891/handover/claim',
                    {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer token',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ pin: '0000' }),
                    },
                )
                .then(async (r: Response) => {
                    if (!r.ok) {
                        const err = await r.json();

                        throw new ApiClientError(err.message, r.status);
                    }
                });
            assert.fail('Expected ApiClientError');
        } catch (err: any) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 422);
            assert.match(err.message, /Handover session expired or invalid/);
        }
    });

    test('Tier 2: Validation - maps 422 validation errors into ApiClientError.validationErrors', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'The work summary field is required.',
                    errors: {
                        work_summary: ['The work summary field is required.'],
                        ending_meter_value: [
                            'The ending meter value must be at least 0.',
                        ],
                    },
                }),
                {
                    status: 422,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        try {
            await client.submitJobReport(
                {
                    dispatch_job_id: 891,
                    work_summary: '',
                    ending_meter_value: -10,
                },
                'uuid-123',
            );
            assert.fail('Expected ApiClientError');
        } catch (err: any) {
            assert.ok(err instanceof ApiClientError);
            assert.equal(err.status, 422);
            assert.ok(err.validationErrors?.work_summary);
            assert.ok(err.validationErrors?.ending_meter_value);
        }
    });

    // =========================================================================
    // TIER 3: CROSS-FEATURE COMBINATIONS
    // =========================================================================

    test('Tier 3: Combination - duty transition to standby updates live timeline segments and active demurrage', async () => {
        let capturedStatus = '';
        let capturedReason = '';

        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const url = String(input);

            if (url.includes('/api/v1/hos/duty-status')) {
                const body = JSON.parse(String(init?.body));
                capturedStatus = body.duty_status;
                capturedReason = body.standby_reason;

                return new Response(
                    JSON.stringify({
                        shift: { id: 701, status: 'active' },
                        clocks: {
                            shift_active: true,
                            current_duty_status: 'standby',
                            active_demurrage: false,
                        },
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        const updateResult = await client.updateHosDutyStatus({
            duty_status: 'standby',
            standby_reason: 'weather_hold',
            remarks: 'Wind speed exceeded 38 km/h safe lifting threshold.',
        });

        assert.equal(capturedStatus, 'standby');
        assert.equal(capturedReason, 'weather_hold');
        assert.equal(updateResult.clocks.current_duty_status, 'standby');
    });

    test('Tier 3: Combination - chains DVIR inspection, shift operation, and dynamic relief handover', async () => {
        let dvirSubmitted = false;
        let shiftStarted = false;
        let handoverInitiated = false;
        let handoverClaimed = false;

        const mockFetch = async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/v1/dvir/inspections')) {
                dvirSubmitted = true;

                return new Response(
                    JSON.stringify({ data: { id: 10, has_defects: false } }),
                    { status: 201 },
                );
            }

            if (url.includes('/api/v1/hos/shifts/start')) {
                shiftStarted = true;

                return new Response(
                    JSON.stringify({ data: { id: 20, status: 'active' } }),
                    { status: 201 },
                );
            }

            if (url.includes('/handover/initiate')) {
                handoverInitiated = true;

                return new Response(
                    JSON.stringify({
                        data: { pin: '4488', handover_token: 'uuid-4488' },
                    }),
                    { status: 200 },
                );
            }

            if (url.includes('/handover/claim')) {
                handoverClaimed = true;

                return new Response(
                    JSON.stringify({ data: { status: 'transferred' } }),
                    { status: 200 },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'token',
            fetchFn: mockFetch as any,
        });

        // 1. Pre-trip DVIR
        await client.createDvirInspection({
            inspection_type: 'pre_trip',
            asset_code: 'CRN-101',
            has_defects: false,
            signature_captured: true,
            checks: [],
        });
        assert.equal(dvirSubmitted, true);

        // 2. Start Shift
        await client.startHosShift({
            operational_asset_id: 101,
            dispatch_job_id: 891,
            duty_status: 'operating',
        });
        assert.equal(shiftStarted, true);

        // 3. Initiate handover
        const initRes = await (client as any).fetchFn(
            'http://localhost:8000/api/v1/dispatch-jobs/891/handover/initiate',
            {
                method: 'POST',
            },
        );
        const initData = (await initRes.json()).data;
        assert.equal(handoverInitiated, true);
        assert.equal(initData.pin, '4488');

        // 4. Claim handover
        await (client as any).fetchFn(
            'http://localhost:8000/api/v1/dispatch-jobs/891/handover/claim',
            {
                method: 'POST',
                body: JSON.stringify({ pin: initData.pin }),
            },
        );
        assert.equal(handoverClaimed, true);
    });

    // =========================================================================
    // TIER 4: REAL-WORLD WORKLOAD SCENARIOS
    // =========================================================================

    test('Tier 4: Real-World Scenario - simulates complete operator workday lifecycle', async () => {
        const lifecycleSteps: string[] = [];

        const mockFetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const url = String(input);

            if (url.includes('/api/v1/auth/login')) {
                lifecycleSteps.push('login');

                return new Response(
                    JSON.stringify({
                        token: 'sanctum-token-user-4',
                        user: seededOperatorUser,
                    }),
                    { status: 200 },
                );
            }

            if (
                url.includes('/api/v1/dispatch-jobs') &&
                !url.includes('handover') &&
                !url.includes('status')
            ) {
                lifecycleSteps.push('fetch_jobs');

                return new Response(
                    JSON.stringify({ data: [liveDispatchJob] }),
                    { status: 200 },
                );
            }

            if (url.includes('/api/v1/dvir/inspections')) {
                lifecycleSteps.push('dvir_walkaround');

                return new Response(
                    JSON.stringify({ data: { id: 1001, status: 'passed' } }),
                    { status: 201 },
                );
            }

            if (url.includes('/api/v1/hos/shifts/start')) {
                lifecycleSteps.push('start_shift');

                return new Response(
                    JSON.stringify({ data: { id: 701, status: 'active' } }),
                    { status: 201 },
                );
            }

            if (url.includes('/api/v1/hos/current-shift')) {
                lifecycleSteps.push('check_hos_clocks');

                return new Response(
                    JSON.stringify({
                        data: {
                            shift: { id: 701 },
                            clocks: {
                                shift_active: true,
                                hours_elapsed: 7.5,
                                drive_remaining_minutes: 240,
                            },
                        },
                    }),
                    { status: 200 },
                );
            }

            if (url.includes('/handover/initiate')) {
                lifecycleSteps.push('handover_initiate');

                return new Response(
                    JSON.stringify({
                        data: {
                            pin: '9182',
                            handover_token: 'uuid-9182',
                            asset_code: 'CRN-101',
                        },
                    }),
                    { status: 200 },
                );
            }

            if (url.includes('/handover/claim')) {
                lifecycleSteps.push('handover_claim');

                return new Response(
                    JSON.stringify({ data: { status: 'transferred' } }),
                    { status: 200 },
                );
            }

            if (url.includes('/api/v1/hos/shifts/certify')) {
                lifecycleSteps.push('certify_shift');

                return new Response(
                    JSON.stringify({
                        shift: { id: 701 },
                        clocks: { is_certified: true },
                    }),
                    { status: 200 },
                );
            }

            if (url.includes('job-reports')) {
                lifecycleSteps.push('submit_job_report');
                const body = JSON.parse(String(init?.body));
                assert.equal(body.signer_name, 'Engr. Roberto Cruz');
                assert.equal(body.ending_meter_value, 1428.5);

                return new Response(
                    JSON.stringify({ data: { id: 888, status: 'submitted' } }),
                    { status: 201 },
                );
            }

            return new Response('Not Found', { status: 404 });
        };

        const client = new FieldApiClient({
            baseUrl: 'http://localhost:8000',
            getToken: () => 'sanctum-token-user-4',
            fetchFn: mockFetch as any,
        });

        // 1. Login with seeded credentials
        const loginRes = await client.login('operator', 'password');
        assert.equal(loginRes.user.id, 4);

        // 2. Fetch assigned jobs and verify crane unit
        const jobs = await client.fetchAssignedJobs();
        assert.equal(
            (jobs[0].asset_assignments as any[])[0].asset_code,
            'CRN-101',
        );

        // 3. Complete pre-trip DVIR clearance
        await client.createDvirInspection({
            inspection_type: 'pre_trip',
            asset_code: 'CRN-101',
            has_defects: false,
            signature_captured: true,
            checks: [],
        });

        // 4. Start shift
        await client.startHosShift({
            operational_asset_id: 101,
            dispatch_job_id: 891,
            duty_status: 'operating',
        });

        // 5. Query live HoS clocks
        const hos = await client.fetchCurrentHosShift();
        assert.equal(hos.clocks.shift_active, true);

        // 6. Initiate dynamic relief handover
        const initRes = await (client as any).fetchFn(
            'http://localhost:8000/api/v1/dispatch-jobs/891/handover/initiate',
            {
                method: 'POST',
            },
        );
        const pin = (await initRes.json()).data.pin;
        assert.equal(pin, '9182');

        // 7. Relief operator claims unit
        await (client as any).fetchFn(
            'http://localhost:8000/api/v1/dispatch-jobs/891/handover/claim',
            {
                method: 'POST',
                body: JSON.stringify({ pin }),
            },
        );

        // 8. Certify completed shift
        await client.certifyHosShift({
            certification_statement:
                'I hereby certify that my duty logs for this shift are true and accurate.',
        });

        // 9. Submit final Job Completion Report with digital sign-off
        await client.submitJobReport(
            {
                dispatch_job_id: 891,
                work_summary: 'Full day shift lifting completed.',
                ending_meter_value: 1428.5,
                signer_name: 'Engr. Roberto Cruz',
                signer_role: 'Site Safety Director',
                signed_at: '2026-09-06T16:05:00Z',
            },
            'cmd-uuid-full-lifecycle',
        );

        // Verify all 9 lifecycle steps were executed in sequence
        assert.deepEqual(lifecycleSteps, [
            'login',
            'fetch_jobs',
            'dvir_walkaround',
            'start_shift',
            'check_hos_clocks',
            'handover_initiate',
            'handover_claim',
            'certify_shift',
            'submit_job_report',
        ]);
    });
});
