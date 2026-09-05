import type {
    ActivateSosIncidentPayload,
    ApiErrorResponse,
    DispatchJob,
    JobReportCommandPayload,
    LocationSharePayload,
    SosConfiguration,
    SosIncident,
    SosIncidentCategory,
    SosLocationSnapshot,
    User,
    WeatherTelemetry,
} from '../types/index';

export class ApiClientError extends Error {
    public status: number;
    public errorCode?: string;
    public currentVersion?: number;
    public serverSnapshot?: DispatchJob | null;
    public validationErrors?: Record<string, string[]>;
    public requestId?: string;
    public retryAfter?: number;
    public isRateLimited: boolean;

    constructor(
        message: string,
        status: number,
        options?: {
            errorCode?: string;
            currentVersion?: number;
            serverSnapshot?: DispatchJob | null;
            validationErrors?: Record<string, string[]>;
            requestId?: string;
            retryAfter?: number;
            isRateLimited?: boolean;
        },
    ) {
        super(message);
        this.name = 'ApiClientError';
        this.status = status;
        this.errorCode = options?.errorCode;
        this.currentVersion = options?.currentVersion;
        this.serverSnapshot = options?.serverSnapshot;
        this.validationErrors = options?.validationErrors;
        this.requestId = options?.requestId;
        this.retryAfter = options?.retryAfter;
        this.isRateLimited =
            options?.isRateLimited ??
            (status === 429 || options?.errorCode === 'rate_limited');
    }
}

export interface ApiClientConfig {
    baseUrl: string;
    getToken: () => string | null;
    fetchFn?: typeof fetch;
}

export class FieldApiClient {
    private baseUrl: string;
    private getToken: () => string | null;
    private fetchFn: typeof fetch;

    constructor(config: ApiClientConfig) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, '');
        this.getToken = config.getToken;
        this.fetchFn = config.fetchFn ?? globalThis.fetch;
    }

    private getHeaders(commandId?: string): Record<string, string> {
        const token = this.getToken();
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        if (commandId) {
            headers['Idempotency-Key'] = commandId;
        }

        return headers;
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        const text = await response.text();
        let body: ApiErrorResponse | { data: T } = {} as any;

        if (text) {
            try {
                body = JSON.parse(text);
            } catch {
                // Non-JSON response fallback
            }
        }

        if (!response.ok) {
            const errBody = body as ApiErrorResponse;
            const requestId =
                errBody.request_id ||
                response.headers?.get?.('X-Request-Id') ||
                undefined;

            let retryAfter: number | undefined;
            const isRateLimited =
                response.status === 429 || errBody.error === 'rate_limited';

            if (isRateLimited) {
                const retryAfterHeader = response.headers?.get?.('Retry-After');

                if (
                    retryAfterHeader !== null &&
                    retryAfterHeader !== undefined &&
                    retryAfterHeader.trim() !== ''
                ) {
                    const parsed = parseInt(retryAfterHeader.trim(), 10);

                    if (!Number.isNaN(parsed)) {
                        retryAfter = parsed;
                    }
                }

                if (
                    retryAfter === undefined &&
                    errBody.retry_after !== undefined &&
                    errBody.retry_after !== null
                ) {
                    const parsed =
                        typeof errBody.retry_after === 'number'
                            ? errBody.retry_after
                            : parseInt(String(errBody.retry_after).trim(), 10);

                    if (!Number.isNaN(parsed)) {
                        retryAfter = parsed;
                    }
                }
            }

            throw new ApiClientError(
                errBody.message ||
                    `Request failed with status ${response.status}`,
                response.status,
                {
                    errorCode: errBody.error,
                    currentVersion: errBody.current_version,
                    serverSnapshot: errBody.data,
                    validationErrors: errBody.errors,
                    requestId,
                    retryAfter,
                    isRateLimited,
                },
            );
        }

        if ('data' in body && body.data !== undefined) {
            return body.data as T;
        }

        return body as T;
    }

    public async login(
        username: string,
        password: string,
        deviceName?: string,
    ): Promise<{ token: string; user: User }> {
        const url = `${this.baseUrl}/api/v1/auth/login`;
        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                password,
                device_name: deviceName ?? 'React Native Field Mobile',
            }),
        });

        return this.handleResponse<{ token: string; user: User }>(response);
    }

    public async fetchMe(): Promise<User> {
        const url = `${this.baseUrl}/api/v1/auth/me`;
        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<User>(response);
    }

    public async logout(): Promise<{ message: string }> {
        const url = `${this.baseUrl}/api/v1/auth/logout`;
        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(),
        });

        return this.handleResponse<{ message: string }>(response);
    }

    public async fetchAssignedJobs(): Promise<DispatchJob[]> {
        const url = `${this.baseUrl}/api/v1/dispatch-jobs`;
        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<DispatchJob[]>(response);
    }

    public async fetchLocationWeather(
        latitude: number,
        longitude: number,
    ): Promise<WeatherTelemetry> {
        const url = `${this.baseUrl}/api/v1/telemetry/weather?latitude=${latitude}&longitude=${longitude}`;
        const controller =
            typeof AbortController !== 'undefined'
                ? new AbortController()
                : null;
        const timer = controller
            ? setTimeout(() => controller.abort(), 3500)
            : null;

        try {
            const response = await this.fetchFn(url, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: controller?.signal,
            });
            if (timer) clearTimeout(timer);

            const result =
                await this.handleResponse<WeatherTelemetry>(response);

            return result;
        } catch {
            if (timer) clearTimeout(timer);
            // If local server is slow, unreachable (e.g. mobile on cellular), or down,
            // fetch directly from Open-Meteo public API with zero mock data.
            return await this.fetchDirectOpenMeteoWeather(latitude, longitude);
        }
    }

    public async fetchDirectOpenMeteoWeather(
        latitude: number,
        longitude: number,
    ): Promise<WeatherTelemetry> {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh`;
        const controller =
            typeof AbortController !== 'undefined'
                ? new AbortController()
                : null;
        const timer = controller
            ? setTimeout(() => controller.abort(), 4000)
            : null;

        try {
            const response = await this.fetchFn(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller?.signal,
            });
            if (timer) clearTimeout(timer);

            if (!response.ok) {
                throw new Error(
                    `Weather service returned HTTP ${response.status}`,
                );
            }

            const json = (await response.json()) as {
                current?: {
                    temperature_2m?: number;
                    relative_humidity_2m?: number;
                    precipitation?: number;
                    weather_code?: number;
                    wind_speed_10m?: number;
                    wind_gusts_10m?: number;
                };
            };

            const current = json.current;
            if (!current) {
                throw new Error('No weather telemetry found for coordinates.');
            }

            const windSpeedKmh =
                Math.round((current.wind_speed_10m ?? 0) * 10) / 10;
            const windGustsKmh =
                Math.round((current.wind_gusts_10m ?? windSpeedKmh) * 10) / 10;
            const temperature =
                Math.round((current.temperature_2m ?? 28) * 10) / 10;
            const rainMm = Math.round((current.precipitation ?? 0) * 10) / 10;
            const humidity = Math.round(current.relative_humidity_2m ?? 75);
            const weatherCode = current.weather_code ?? 0;

            const safety = this.evaluateCraneWeatherSafety(
                windSpeedKmh,
                windGustsKmh,
                rainMm,
            );

            return {
                latitude,
                longitude,
                location_name: '',
                temperature_celsius: temperature,
                wind_speed_kmh: windSpeedKmh,
                wind_gusts_kmh: windGustsKmh,
                rain_intensity_mmh: rainMm,
                humidity_percent: humidity,
                weather_description: this.mapWmoWeatherCode(weatherCode),
                safety_level: safety.level,
                safety_message: safety.message,
                source: 'open_meteo_direct',
                fetched_at: new Date().toISOString(),
            };
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private evaluateCraneWeatherSafety(
        windSpeedKmh: number,
        windGustsKmh: number,
        rainMm: number,
    ): {
        level: 'safe_normal' | 'warning_caution' | 'critical_stop_work';
        message: string;
    } {
        const maxWind = Math.max(windSpeedKmh, windGustsKmh);

        if (maxWind >= 45.0) {
            return {
                level: 'critical_stop_work',
                message:
                    'Mandatory Stop Work: Wind exceeds DOLE 45 km/h limit. Engage free-slew immediately.',
            };
        }

        if (maxWind >= 36.0 || rainMm >= 10.0) {
            return {
                level: 'warning_caution',
                message:
                    'High Wind Caution: Restrict large surface area loads (36-44 km/h). Maintain taglines.',
            };
        }

        return {
            level: 'safe_normal',
            message: 'Normal Wind: Standard hoisting permitted (< 36 km/h).',
        };
    }

    private mapWmoWeatherCode(code: number): string {
        if (code === 0) return 'Clear Sky';
        if ([1, 2, 3].includes(code)) return 'Mainly Clear / Overcast';
        if ([45, 48].includes(code)) return 'Fog';
        if ([51, 53, 55].includes(code)) return 'Drizzle';
        if ([61, 63, 65].includes(code)) return 'Rain';
        if ([80, 81, 82].includes(code)) return 'Rain Showers';
        if ([95, 96, 99].includes(code)) return 'Thunderstorm';
        return 'Clear Sky';
    }

    public async fetchJobDetail(jobId: number): Promise<DispatchJob> {
        const url = `${this.baseUrl}/api/v1/dispatch-jobs/${jobId}`;
        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<DispatchJob>(response);
    }

    public async respondAssignment(
        jobId: number,
        assignmentId: number,
        responseStatus: 'accepted' | 'rejected',
        reason: string | undefined,
        version: number,
        commandId: string,
    ): Promise<DispatchJob> {
        const url = `${this.baseUrl}/api/v1/dispatch-jobs/${jobId}/assignments/${assignmentId}/response`;
        const payload: Record<string, unknown> = {
            response: responseStatus,
            version,
            command_id: commandId,
        };

        if (reason !== undefined) {
            payload.reason = reason;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<DispatchJob>(response);
    }

    public async transitionStatus(
        jobId: number,
        status: string,
        version: number,
        commandId: string,
    ): Promise<DispatchJob> {
        const url = `${this.baseUrl}/api/v1/dispatch-jobs/${jobId}/status`;
        const payload = {
            status,
            version,
            command_id: commandId,
        };

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<DispatchJob>(response);
    }

    public async shareLocation(
        payload: LocationSharePayload,
        commandId: string,
    ): Promise<unknown> {
        const url = `${this.baseUrl}/api/v1/locations`;
        const bodyPayload = {
            ...payload,
            command_id: commandId,
        };

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(bodyPayload),
        });

        return this.handleResponse<unknown>(response);
    }

    public async submitJobReport(
        payload: JobReportCommandPayload,
        commandId: string,
    ): Promise<unknown> {
        const url = `${this.baseUrl}/operations/job-reports`;
        const bodyPayload = {
            ...payload,
            command_id: commandId,
        };

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(bodyPayload),
        });

        return this.handleResponse<unknown>(response);
    }

    public async activateSosIncident(
        payload: ActivateSosIncidentPayload,
        commandId: string,
    ): Promise<SosIncident> {
        const url = `${this.baseUrl}/api/v1/sos-incidents`;
        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify({ ...payload, command_id: commandId }),
        });

        return this.handleResponse<SosIncident>(response);
    }

    public async fetchActiveSosIncident(): Promise<SosIncident | null> {
        const url = `${this.baseUrl}/api/v1/sos-incidents/active`;
        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        if (response.status === 404) {
            return null;
        }

        return this.handleResponse<SosIncident | null>(response);
    }

    public async classifySosIncident(
        incidentId: string,
        category: SosIncidentCategory,
        commandId: string,
        note?: string | null,
    ): Promise<SosIncident> {
        const url = `${this.baseUrl}/api/v1/sos-incidents/${encodeURIComponent(incidentId)}/classification`;
        const response = await this.fetchFn(url, {
            method: 'PATCH',
            headers: this.getHeaders(commandId),
            body: JSON.stringify({
                category,
                command_id: commandId,
                ...(note !== undefined && note !== null
                    ? { note, worker_note: note }
                    : {}),
            }),
        });

        return this.handleResponse<SosIncident>(response);
    }

    public async updateSosLocation(
        incidentId: string,
        location: SosLocationSnapshot,
        commandId: string,
    ): Promise<SosIncident> {
        const url = `${this.baseUrl}/api/v1/sos-incidents/${encodeURIComponent(incidentId)}/location`;
        const response = await this.fetchFn(url, {
            method: 'PATCH',
            headers: this.getHeaders(commandId),
            body: JSON.stringify({ ...location, command_id: commandId }),
        });

        return this.handleResponse<SosIncident>(response);
    }

    public async fetchSosConfiguration(): Promise<SosConfiguration> {
        const url = `${this.baseUrl}/api/v1/sos-configuration`;
        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<SosConfiguration>(response);
    }

    // ==========================================
    // Dispatch V2 API Adapter Methods
    // ==========================================

    public async fetchAssignedJobsV2(): Promise<any[]> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs`;
        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<any[]>(response);
    }

    public async fetchJobDetailV2(jobId: number): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}`;
        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<any>(response);
    }

    public async fetchReadinessV2(jobId: number): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/readiness`;
        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<any>(response);
    }

    public async dispatchJobV2(
        jobId: number,
        version: number,
        commandId?: string,
        reason?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/dispatch`;
        const payload: Record<string, unknown> = { version };

        if (reason !== undefined) {
            payload.reason = reason;
        }

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async progressJobV2(
        jobId: number,
        status: string,
        version: number,
        commandId?: string,
        reason?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/progress`;
        const payload: Record<string, unknown> = { status, version };

        if (reason !== undefined) {
            payload.reason = reason;
        }

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async cancelJobV2(
        jobId: number,
        version: number,
        reason: string,
        commandId?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/cancel`;
        const payload: Record<string, unknown> = { version, reason };

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async reopenJobV2(
        jobId: number,
        version: number,
        reason: string,
        commandId?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/reopen`;
        const payload: Record<string, unknown> = { version, reason };

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async archiveJobV2(
        jobId: number,
        version: number,
        reason?: string,
        commandId?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/archive`;
        const payload: Record<string, unknown> = { version };

        if (reason !== undefined) {
            payload.reason = reason;
        }

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async acceptOfferV2(
        jobId: number,
        offerId: number,
        version: number,
        commandId?: string,
        reason?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/offers/${offerId}/accept`;
        const payload: Record<string, unknown> = { version };

        if (reason !== undefined) {
            payload.reason = reason;
        }

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async rejectOfferV2(
        jobId: number,
        offerId: number,
        version: number,
        reason: string,
        commandId?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/offers/${offerId}/reject`;
        const payload: Record<string, unknown> = { version, reason };

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async withdrawOfferV2(
        jobId: number,
        offerId: number,
        version: number,
        reason: string,
        commandId?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/offers/${offerId}/withdraw`;
        const payload: Record<string, unknown> = { version, reason };

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async designateLeadV2(
        jobId: number,
        offerId: number,
        version: number,
        commandId?: string,
        reason?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/api/v2/dispatch-jobs/${jobId}/lead`;
        const payload: Record<string, unknown> = { offer_id: offerId, version };

        if (reason !== undefined) {
            payload.reason = reason;
        }

        if (commandId !== undefined) {
            payload.command_id = commandId;
        }

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(commandId),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async fetchCurrentHosShift(): Promise<{
        shift: any | null;
        clocks: {
            shift_active: boolean;
            shift_status: string;
            current_duty_status: string;
            started_at: string | null;
            hours_elapsed: number;
            drive_remaining_minutes: number;
            shift_window_remaining_minutes: number;
            break_countdown_minutes: number;
            cycle_remaining_minutes: number;
            cycle_accumulated_minutes: number;
            cycle_limit_minutes: number;
            timeline_segments: any[];
            recent_logs: any[];
            active_demurrage: boolean;
            is_certified: boolean;
        };
    }> {
        const url = `${this.baseUrl}/api/v1/hos/current-shift`;

        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<{
            shift: any | null;
            clocks: any;
        }>(response);
    }

    public async startHosShift(payload: {
        operational_asset_id?: number;
        dispatch_job_id?: number;
        duty_status?: string;
        latitude?: number;
        longitude?: number;
        location_name?: string;
        remarks?: string;
    }): Promise<any> {
        const url = `${this.baseUrl}/api/v1/hos/shifts/start`;

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }

    public async updateHosDutyStatus(payload: {
        duty_status: string;
        standby_reason?: string;
        latitude?: number;
        longitude?: number;
        location_name?: string;
        remarks?: string;
    }): Promise<{ shift: any; clocks: any }> {
        const url = `${this.baseUrl}/api/v1/hos/duty-status`;

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<{ shift: any; clocks: any }>(response);
    }

    public async certifyHosShift(payload: {
        certification_statement: string;
        remarks?: string;
    }): Promise<{ shift: any; clocks: any }> {
        const url = `${this.baseUrl}/api/v1/hos/shifts/certify`;

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<{ shift: any; clocks: any }>(response);
    }

    public async fetchHosCycleHistory(
        days = 8,
    ): Promise<{ days: number; shifts: any[]; logs: any[] }> {
        const url = `${this.baseUrl}/api/v1/hos/cycle-history?days=${days}`;

        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<{
            days: number;
            shifts: any[];
            logs: any[];
        }>(response);
    }

    public async fetchDvirInspections(
        days = 30,
        operationalAssetId?: number,
    ): Promise<{ days: number; inspections: any[] }> {
        const params = new URLSearchParams({ days: String(days) });

        if (operationalAssetId) {
            params.set('operational_asset_id', String(operationalAssetId));
        }

        const url = `${this.baseUrl}/api/v1/dvir/inspections?${params.toString()}`;

        const response = await this.fetchFn(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        return this.handleResponse<{ days: number; inspections: any[] }>(
            response,
        );
    }

    public async createDvirInspection(payload: {
        inspection_type: 'pre_trip' | 'post_trip';
        operational_asset_id?: number;
        dispatch_job_id?: number;
        asset_code?: string;
        asset_name?: string;
        inspector_name?: string;
        starting_odometer_km?: number | null;
        ending_odometer_km?: number | null;
        engine_hours?: number | null;
        has_defects: boolean;
        signature_captured: boolean;
        remarks?: string | null;
        completed_at?: string;
        checks: Array<{
            id?: string;
            category: string;
            label: string;
            status: string;
            status_label?: string | null;
            notes?: string | null;
        }>;
    }): Promise<any> {
        const url = `${this.baseUrl}/api/v1/dvir/inspections`;

        const response = await this.fetchFn(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        return this.handleResponse<any>(response);
    }
}
