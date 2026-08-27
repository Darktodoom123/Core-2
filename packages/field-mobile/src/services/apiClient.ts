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
} from '../types/index';

export class ApiClientError extends Error {
    public status: number;
    public errorCode?: string;
    public currentVersion?: number;
    public serverSnapshot?: DispatchJob | null;
    public validationErrors?: Record<string, string[]>;

    constructor(
        message: string,
        status: number,
        options?: {
            errorCode?: string;
            currentVersion?: number;
            serverSnapshot?: DispatchJob | null;
            validationErrors?: Record<string, string[]>;
        },
    ) {
        super(message);
        this.name = 'ApiClientError';
        this.status = status;
        this.errorCode = options?.errorCode;
        this.currentVersion = options?.currentVersion;
        this.serverSnapshot = options?.serverSnapshot;
        this.validationErrors = options?.validationErrors;
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

            throw new ApiClientError(
                errBody.message ||
                    `Request failed with status ${response.status}`,
                response.status,
                {
                    errorCode: errBody.error,
                    currentVersion: errBody.current_version,
                    serverSnapshot: errBody.data,
                    validationErrors: errBody.errors,
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
    ): Promise<SosIncident> {
        const url = `${this.baseUrl}/api/v1/sos-incidents/${encodeURIComponent(incidentId)}/classification`;
        const response = await this.fetchFn(url, {
            method: 'PATCH',
            headers: this.getHeaders(commandId),
            body: JSON.stringify({ category, command_id: commandId }),
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
}
