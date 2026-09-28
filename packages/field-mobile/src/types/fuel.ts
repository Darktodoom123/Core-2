export type FuelStatus =
    | 'submitted'
    | 'forwarded'
    | 'approved'
    | 'rejected'
    | 'verified'
    | 'logged'
    | 'withdrawn';

export type FuelUrgency = 'normal' | 'urgent' | 'critical';

export type FuelNoReceiptReason =
    'on_site_bowser' | 'vendor_no_receipt' | 'receipt_lost' | 'other';

export interface FuelAsset {
    id: number;
    code: string;
    name: string;
    meter_type: string | null;
    meter_value?: string | number | null;
}

export interface FuelOptions {
    can_request: boolean;
    assets: FuelAsset[];
    jobs: {
        id: number;
        reference: string;
        title: string;
        operational_asset_ids: number[];
    }[];
    /** Server-resolved active assignment (shift first, then a single assignment). */
    defaults?: {
        operational_asset_id: number | null;
        dispatch_job_id: number | null;
    };
}

export interface MobileFuelLog {
    id: number;
    quantity_litres: string;
    odometer_km: number | null;
    hour_meter: string | null;
    total_cost: string | null;
    fuel_station: string | null;
    recorded_at: string | null;
    is_anomaly: boolean;
    anomaly_reason: string | null;
    has_receipt?: boolean;
    receipt_number?: string | null;
    no_receipt_reason?: FuelNoReceiptReason | null;
    no_receipt_reason_label?: string | null;
    no_receipt_note?: string | null;
    requires_receipt_review?: boolean;
    receipt_reviewed_at?: string | null;
    receipt_review_note?: string | null;
}

export interface MobileFuelRequest {
    id: number;
    reference: string;
    client_request_id: string | null;
    quantity_litres: string;
    fuel_type: 'diesel' | 'gasoline';
    purpose: string;
    status: FuelStatus;
    decision_reason: string | null;
    operational_asset_id: number | null;
    dispatch_job_id: number | null;
    asset: FuelAsset | null;
    job: { id: number; reference: string; title: string } | null;
    logs: MobileFuelLog[];
    can_record: boolean;
    can_withdraw?: boolean;
    urgency?: FuelUrgency;
    needed_by?: string | null;
    current_fuel_level_percent?: number | null;
    withdrawn_at?: string | null;
    withdrawal_reason?: string | null;
    created_at: string | null;
    reviewed_at?: string | null;
    approved_at?: string | null;
    verified_at?: string | null;
}

export interface CreateFuelPayload {
    client_request_id: string;
    quantity_litres: number;
    fuel_type: 'diesel' | 'gasoline';
    purpose: string;
    operational_asset_id?: number;
    dispatch_job_id?: number;
    urgency?: FuelUrgency;
    needed_by?: string;
    current_fuel_level_percent?: number;
}

export interface RecordFuelPayload {
    quantity_litres: number;
    odometer_km?: number;
    hour_meter?: number;
    total_cost?: number;
    price_per_litre?: number;
    fuel_station?: string;
    remarks?: string;
    receipt_number?: string;
    no_receipt_reason?: FuelNoReceiptReason;
    no_receipt_note?: string;
}

export interface FuelReceiptUpload {
    uri: string;
    name: string;
    type: string;
}

export interface FuelLogCommandPayload {
    fuel_request_id: number;
    details: RecordFuelPayload;
    receipt?: FuelReceiptUpload;
}

export interface WithdrawFuelPayload {
    fuel_request_id: number;
    reason?: string;
}

export interface FuelOfflineSnapshot {
    options: FuelOptions | null;
    requests: MobileFuelRequest[];
    nextPage: number | null;
}

export interface FuelRequestPage {
    items: MobileFuelRequest[];
    nextPage: number | null;
}

export type FuelApi = {
    fetchFuelOptions(): Promise<FuelOptions>;
    fetchFuelRequests(page?: number): Promise<FuelRequestPage>;
    fetchFuelRequest(id: number): Promise<MobileFuelRequest>;
    createFuelRequest(
        payload: CreateFuelPayload,
        commandId?: string,
    ): Promise<MobileFuelRequest>;
    recordFuel(
        id: number,
        payload: RecordFuelPayload,
        receipt?: FuelReceiptUpload,
        commandId?: string,
    ): Promise<MobileFuelRequest>;
    withdrawFuelRequest?(
        id: number,
        reason?: string,
        commandId?: string,
    ): Promise<MobileFuelRequest>;
};

export const fuelStatusLabels: Record<FuelStatus, string> = {
    submitted: 'Submitted',
    forwarded: 'Awaiting approval',
    approved: 'Approved',
    rejected: 'Rejected',
    verified: 'Ready to refuel',
    logged: 'Fuel recorded',
    withdrawn: 'Withdrawn',
};

export const fuelUrgencyOptions: {
    value: FuelUrgency;
    label: string;
    hint: string;
}[] = [
    { value: 'normal', label: 'Normal', hint: 'Planned refuel' },
    { value: 'urgent', label: 'Urgent', hint: 'Needed this shift' },
    { value: 'critical', label: 'Critical', hint: 'Work is stopped' },
];

export const fuelTankLevels: { value: number; label: string }[] = [
    { value: 0, label: 'Empty' },
    { value: 10, label: 'Reserve' },
    { value: 25, label: '¼' },
    { value: 50, label: '½' },
    { value: 75, label: '¾' },
];

export const fuelNoReceiptReasons: {
    value: FuelNoReceiptReason;
    label: string;
}[] = [
    { value: 'on_site_bowser', label: 'On-site bowser / fuel truck' },
    { value: 'vendor_no_receipt', label: 'Vendor gave no receipt' },
    { value: 'receipt_lost', label: 'Receipt lost or damaged' },
    { value: 'other', label: 'Other' },
];
