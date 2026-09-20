export interface AccountProfileData {
    name: string;
    username: string;
    email: string;
    email_verified: boolean;
    phone: string | null;
    role?: string | null;
    role_label?: string;
    account_status: 'active' | 'suspended' | 'inactive';
    account_status_label: string;
    permissions?: string[];
}

export interface SecuritySettingsData {
    email_otp_enabled: boolean;
    has_verified_email: boolean;
}

export interface ActiveSessionItem {
    id: string;
    is_current: boolean;
    ip_address: string;
    browser: string;
    platform: string;
    device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    device_label: string;
    location: string;
    last_active_at: string;
    last_active_human: string;
}

export interface TrustedDeviceItem {
    id: string;
    device_label: string;
    platform: string;
    ip_address: string;
    location: string;
    is_current: boolean;
    last_used_at: string | null;
    last_used_human: string;
    expires_at: string;
    expires_human: string;
}

export interface SecurityActivityItem {
    id: number;
    action: string;
    event_label: string;
    outcome: string;
    ip_address: string;
    device_label: string;
    location: string;
    occurred_at: string;
    occurred_at_human: string;
}

export interface SecurityActivityResponse {
    data: SecurityActivityItem[];
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    total: number;
}

export interface AccountDetailsResponse {
    profile: AccountProfileData;
    security: SecuritySettingsData;
    trusted_devices: TrustedDeviceItem[];
    sessions: ActiveSessionItem[];
    recent_activity: SecurityActivityResponse;
}

export interface OtpChallengeResponse {
    message: string;
    challenge_id: string;
    cooldown_seconds?: number;
}
