export type FuelStatus =
    'submitted' | 'forwarded' | 'approved' | 'rejected' | 'verified' | 'logged';

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
}

export interface RecordFuelPayload {
    quantity_litres: number;
    odometer_km?: number;
    hour_meter?: number;
    total_cost?: number;
    fuel_station?: string;
    remarks?: string;
}

export interface FuelReceiptUpload {
    uri: string;
    name: string;
    type: string;
}

export interface FuelRequestPage {
    items: MobileFuelRequest[];
    nextPage: number | null;
}

export type FuelApi = {
    fetchFuelOptions(): Promise<FuelOptions>;
    fetchFuelRequests(page?: number): Promise<FuelRequestPage>;
    fetchFuelRequest(id: number): Promise<MobileFuelRequest>;
    createFuelRequest(payload: CreateFuelPayload): Promise<MobileFuelRequest>;
    recordFuel(
        id: number,
        payload: RecordFuelPayload,
        receipt?: FuelReceiptUpload,
    ): Promise<MobileFuelRequest>;
};

export const fuelStatusLabels: Record<FuelStatus, string> = {
    submitted: 'Submitted',
    forwarded: 'Awaiting approval',
    approved: 'Approved',
    rejected: 'Rejected',
    verified: 'Ready to refuel',
    logged: 'Fuel recorded',
};
