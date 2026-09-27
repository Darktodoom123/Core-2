import type { ComplianceDocument, DocumentCategory } from '../../types/index';

export type CategoryFilter = DocumentCategory | 'all';

export interface AssignedAsset {
    assetCode: string;
    assetName?: string;
}

export const CATEGORIES: Array<{ key: CategoryFilter; label: string }> = [
    { key: 'all', label: 'All Documents' },
    { key: 'road_permits', label: 'Road Permits' },
    { key: 'load_test_certs', label: 'Load Tests' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'registrations', label: 'Registration' },
    { key: 'emission_certs', label: 'Emissions' },
    { key: 'other', label: 'Other Compliance' },
    { key: 'operator_licenses', label: 'Licenses' },
    { key: 'delivery_receipts', label: 'Delivery' },
];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
    road_permits: 'Road Transit Permit',
    load_test_certs: 'Load Test Certificate',
    insurance: 'Insurance',
    registrations: 'Registration / LTO',
    emission_certs: 'Smoke Emission Clearance',
    other: 'Other Regulatory Permit',
    operator_licenses: 'Operator License',
    delivery_receipts: 'Delivery Receipt',
};

export const categoryLabel = (doc: ComplianceDocument): string =>
    doc.categoryLabel ||
    DOCUMENT_CATEGORY_LABELS[doc.category] ||
    'Compliance document';

/** Unit-scoped and personnel documents can share an id, so key by scope. */
export const documentKey = (doc: ComplianceDocument): string =>
    `${doc.assetCode ? `asset_${doc.assetCode}` : 'personnel'}_${doc.id}`;

// Assigned units can load after the wallet opens, and the caller's code may
// not be one of them, so fall back to the first assigned unit.
export const resolveActiveAssetCode = (
    requestedAssetCode: string,
    assignedAssets: AssignedAsset[] | undefined,
): string => {
    if (!assignedAssets || assignedAssets.length === 0) {
        return requestedAssetCode;
    }

    return assignedAssets.some(
        (asset) => asset.assetCode === requestedAssetCode,
    )
        ? requestedAssetCode
        : assignedAssets[0].assetCode;
};

export function filterDocuments(
    documents: ComplianceDocument[],
    category: CategoryFilter,
    searchQuery: string,
): ComplianceDocument[] {
    const query = searchQuery.trim().toLowerCase();

    return documents.filter((doc) => {
        const matchesCategory = category === 'all' || doc.category === category;
        const matchesQuery =
            !query ||
            doc.title?.toLowerCase().includes(query) ||
            doc.documentNumber?.toLowerCase().includes(query) ||
            doc.issuingAuthority?.toLowerCase().includes(query);

        return matchesCategory && Boolean(matchesQuery);
    });
}

export const isImageFile = (uri?: string | null): boolean =>
    Boolean(uri && /\.(png|jpe?g)$/i.test(uri));

export const fileNameFromUri = (uri?: string | null): string | null =>
    uri ? (uri.split('/').pop() ?? null) : null;

/**
 * The wallet shows the unit the operator is linked to; before linking, the
 * current job's unit. Never every unit on every assigned job.
 */
export function walletAssets(
    linked: AssignedAsset | null,
    fallback: AssignedAsset | null,
): AssignedAsset[] {
    const asset = linked?.assetCode ? linked : fallback;

    return asset?.assetCode ? [asset] : [];
}
