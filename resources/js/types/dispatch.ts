import type { DispatchPriorityValue, StatusViewModel } from './workspace';

export type DispatchSourceType =
    | 'direct'
    | 'service_request'
    | 'rental_reservation'
    | 'sales_order'
    | 'manual';

export interface DispatchRequirementItem {
    id: string;
    text: string;
    completed: boolean;
    required_for_activation?: boolean;
}

export interface RentalItemContext {
    id: number;
    name: string;
    quantity: number;
    condition_notes?: string | null;
}

export interface SalesOrderItemContext {
    id: number;
    name: string;
    quantity: number;
    sku?: string | null;
}

export interface GeoCoordinates {
    latitude: number | null;
    longitude: number | null;
}

export interface DispatchSourceViewModel {
    type: DispatchSourceType;
    label: string;
    reference: string | null;
    status: StatusViewModel<string> | null;
    fulfillment_mode: string | null;
    location: string | null;
    manual_intake?: boolean;
    provenance_indicator?: string | null;
    service_type?: string | null;
    project_name?: string | null;
    site_notes?: string | null;
    technical_requirements?: string[];
    start_date?: string | null;
    end_date?: string | null;
    rental_items?: RentalItemContext[];
    condition_requirements?: string[];
    operator_required?: boolean;
    operator_context?: string | null;
    order_items?: SalesOrderItemContext[];
    delivery_destination_coordinates?: GeoCoordinates | null;
    total_cents?: number | null;
}

export interface UnlinkedHandoffItem {
    id: number;
    source_type: 'service' | 'rental' | 'sale';
    source_label: string;
    reference: string;
    client: {
        id: number;
        code: string;
        company_name: string;
    };
    title: string;
    location: string | null;
    scheduled_date?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    total_cents?: number | null;
    fulfillment_mode?: 'delivery' | 'pickup' | null;
    requirements?: string[];
    rental_items?: RentalItemContext[];
    order_items?: SalesOrderItemContext[];
    destination_coordinates?: GeoCoordinates | null;
    dispatch_job_id: number | null;
    matched_draft_job_id?: number | null;
    matched_draft_reference?: string | null;
    match_reason?: string | null;
    reconciliation_status: 'unlinked' | 'matching_draft_found' | 'linked';
}

export interface SourceAwareIntakeFormData {
    source_type: DispatchSourceType;
    reference: string;
    client_id?: string;
    client_name?: string;
    title: string;
    site: string;
    site_notes?: string;
    scheduled_start: string;
    scheduled_end: string;
    priority: DispatchPriorityValue;
    requirements: string[];
    service_type?: string;
    project_name?: string;
    rental_start_date?: string;
    rental_end_date?: string;
    operator_required?: boolean;
    operator_context?: string;
    order_items_text?: string;
    fulfillment_mode?: 'delivery' | 'pickup';
    destination_latitude?: string;
    destination_longitude?: string;
}
