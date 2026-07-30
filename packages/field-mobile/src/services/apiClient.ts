import type {
    ApiErrorResponse,
    DispatchJob,
    LocationSharePayload,
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
        email: string,
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
                email,
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
}
