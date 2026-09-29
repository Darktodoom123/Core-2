import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Download,
    Eye,
    FileText,
    Paperclip,
    Pencil,
    Plus,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    Upload,
} from 'lucide-react';
import type { FormEvent } from 'react';
import React, { useState } from 'react';
import { Button, InlineNotice, Modal, buttonVariants } from '@/components/ui';
import {
    FleetEmptyState,
    FleetPill,
    FleetSectionHeader,
} from '@/components/workspace/fleet/fleet-detail-primitives';
import { FleetInput } from '@/components/workspace/fleet/fleet-input';
import { FleetPermitChecklist } from '@/components/workspace/fleet/fleet-permit-checklist';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetDocumentViewModel,
    AssetPermitItemViewModel,
    AssetViewModel,
} from '@/types/workspace';

export interface FleetDocumentsSectionProps {
    asset: AssetViewModel;
    canManage: boolean;
}

const CATEGORIES = [
    { value: 'road_permits', label: 'Road Transit Permit (DPWH / LGU)' },
    { value: 'load_test_certs', label: 'Load Test Certificate (DOLE-OSHC)' },
    { value: 'insurance', label: 'Comprehensive / Third-Party Insurance' },
    {
        value: 'registrations',
        label: 'LTO Official Receipt / Certificate of Registration (OR/CR)',
    },
    { value: 'emission_certs', label: 'Smoke Emission Clearance' },
    { value: 'other', label: 'Other Regulatory Permit' },
];

const fieldClass =
    'mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-soft';
const textareaClass =
    'mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden';
const fileInputClass =
    'mt-1 block min-h-11 w-full cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-contrast hover:file:bg-brand-strong hover:file:text-white dark:hover:file:text-brand-contrast';
const iconButtonClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden';

function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

export function FleetDocumentsSection({
    asset,
    canManage,
}: FleetDocumentsSectionProps) {
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<AssetDocumentViewModel | null>(
        null,
    );
    const [editingDoc, setEditingDoc] = useState<AssetDocumentViewModel | null>(
        null,
    );
    const [replacingDoc, setReplacingDoc] =
        useState<AssetDocumentViewModel | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [renewing, setRenewing] = useState<AssetPermitItemViewModel | null>(
        null,
    );

    const documents = asset.documents ?? [];
    // Superseded permits are history: listed last and left out of the alerts.
    const currentDocuments = documents.filter(
        (doc) => doc.status !== 'superseded',
    );
    const sortedDocuments = [...documents].sort((a, b) => {
        const priority = (document: AssetDocumentViewModel) =>
            document.status === 'superseded'
                ? 3
                : document.is_expired
                  ? 0
                  : document.expires_soon
                    ? 1
                    : 2;
        const priorityDifference = priority(a) - priority(b);

        if (priorityDifference !== 0) {
            return priorityDifference;
        }

        const expiryDate = (document: AssetDocumentViewModel) => {
            if (!document.expires_at) {
                return Number.POSITIVE_INFINITY;
            }

            const timestamp = Date.parse(document.expires_at);

            return Number.isNaN(timestamp)
                ? Number.POSITIVE_INFINITY
                : timestamp;
        };

        return expiryDate(a) - expiryDate(b) || b.id - a.id;
    });

    const form = useForm<{
        category: string;
        title: string;
        document_number: string;
        issuing_authority: string;
        issued_at: string;
        expires_at: string;
        notes: string;
        file: File | null;
        supersedes_document_id: number | null;
    }>({
        category: 'road_permits',
        title: '',
        document_number: '',
        issuing_authority: '',
        issued_at: '',
        expires_at: '',
        notes: '',
        file: null,
        supersedes_document_id: null,
    });

    const editForm = useForm<{
        category: string;
        title: string;
        document_number: string;
        issuing_authority: string;
        issued_at: string;
        expires_at: string;
        notes: string;
        status: string;
    }>({
        category: 'road_permits',
        title: '',
        document_number: '',
        issuing_authority: '',
        issued_at: '',
        expires_at: '',
        notes: '',
        status: 'active',
    });

    const replaceForm = useForm<{
        file: File | null;
        notes: string;
        expires_at: string;
    }>({
        file: null,
        notes: '',
        expires_at: '',
    });

    const submitUpload = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/operations/assets/${asset.id}/documents`, {
            preserveScroll: true,
            preserveState: true,
            forceFormData: true,
            onSuccess: () => {
                setShowUploadForm(false);
                form.reset();
                setSuccessMessage(
                    renewing
                        ? `${renewing.label} renewed. The earlier permit is kept as superseded.`
                        : 'Document uploaded.',
                );
                setRenewing(null);
            },
        });
    };

    const openEdit = (doc: AssetDocumentViewModel) => {
        setEditingDoc(doc);
        editForm.setData({
            category: doc.category,
            title: doc.title,
            document_number: doc.document_number || '',
            issuing_authority: doc.issuing_authority || '',
            issued_at: doc.issued_at || '',
            expires_at: doc.expires_at || '',
            notes: doc.notes || '',
            status: doc.status || 'active',
        });
    };

    const submitEdit = (e: FormEvent) => {
        e.preventDefault();

        if (!editingDoc) {
            return;
        }

        editForm.patch(
            `/operations/assets/${asset.id}/documents/${editingDoc.id}`,
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setEditingDoc(null);
                    editForm.reset();
                    setSuccessMessage('Document details updated.');
                },
            },
        );
    };

    const openReplace = (doc: AssetDocumentViewModel) => {
        setReplacingDoc(doc);
        replaceForm.setData({
            file: null,
            notes: doc.notes || '',
            expires_at: doc.expires_at || '',
        });
    };

    const submitReplace = (e: FormEvent) => {
        e.preventDefault();

        if (!replacingDoc) {
            return;
        }

        replaceForm.post(
            `/operations/assets/${asset.id}/documents/${replacingDoc.id}/replace`,
            {
                preserveScroll: true,
                preserveState: true,
                forceFormData: true,
                onSuccess: () => {
                    setReplacingDoc(null);
                    replaceForm.reset();
                    setSuccessMessage('Document attachment replaced.');
                },
            },
        );
    };

    const handleDelete = (docId: number) => {
        if (
            !confirm(
                'Are you sure you want to remove this document? This action is recorded in audit logs.',
            )
        ) {
            return;
        }

        router.delete(`/operations/assets/${asset.id}/documents/${docId}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setSuccessMessage('Document removed.'),
        });
    };

    const openUploadDialog = () => {
        setSuccessMessage(null);
        form.clearErrors();
        setShowUploadForm(true);
    };

    const closeUploadDialog = () => {
        setShowUploadForm(false);
    };

    const openBlankUpload = () => {
        setRenewing(null);
        form.setData('supersedes_document_id', null);
        openUploadDialog();
    };

    const openPermitUpload = (item: AssetPermitItemViewModel) => {
        setRenewing(null);
        form.setData({
            ...form.data,
            category: item.category,
            title: item.label,
            supersedes_document_id: null,
        });
        openUploadDialog();
    };

    // A renewal is a new permit record; the one it replaces becomes superseded.
    const openPermitRenewal = (item: AssetPermitItemViewModel) => {
        const current = documents.find((doc) => doc.id === item.document_id);
        setRenewing(item);
        form.setData({
            category: item.category,
            title: current?.title ?? item.label,
            document_number: '',
            issuing_authority: current?.issuing_authority ?? '',
            issued_at: '',
            expires_at: '',
            notes: '',
            file: null,
            supersedes_document_id:
                current && current.status === 'active' ? current.id : null,
        });
        openUploadDialog();
    };

    const renderValidityBadge = (doc: AssetDocumentViewModel) => {
        switch (doc.validity_status) {
            case 'valid':
                return (
                    <FleetPill tone="success" icon={ShieldCheck}>
                        Valid
                    </FleetPill>
                );
            case 'expiring_soon':
                return (
                    <FleetPill tone="warning" icon={AlertTriangle}>
                        Expiring soon
                    </FleetPill>
                );
            case 'expired':
                return (
                    <FleetPill tone="danger" icon={ShieldAlert}>
                        Expired
                    </FleetPill>
                );
            case 'revoked':
                return <FleetPill tone="danger">Revoked</FleetPill>;
            case 'superseded':
                return <FleetPill tone="neutral">Superseded</FleetPill>;
            case 'no_expiration':
            case 'permanent':
            default:
                return <FleetPill tone="neutral">No expiration date</FleetPill>;
        }
    };

    const expiredCount = currentDocuments.filter(
        (doc) => doc.is_expired,
    ).length;
    const expiringCount = currentDocuments.filter(
        (doc) => !doc.is_expired && doc.expires_soon,
    ).length;
    const missingFileCount = currentDocuments.filter(
        (doc) => !doc.attachment,
    ).length;
    const permitCompliance = asset.permit_compliance;

    return (
        <div className="space-y-5">
            <FleetSectionHeader
                title="Permits & documents"
                description={`Authorized certificates, road transit clearances, and proof of insurance for ${asset.code}.`}
                action={
                    canManage && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={openBlankUpload}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Document
                        </Button>
                    )
                }
            />

            {permitCompliance && permitCompliance.items.length > 0 && (
                <FleetPermitChecklist
                    assetCode={asset.code}
                    compliance={permitCompliance}
                    canManage={canManage}
                    onUpload={openPermitUpload}
                    onRenew={openPermitRenewal}
                />
            )}

            {documents.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    <span className="mr-1 font-medium tabular-nums">
                        {documents.length}{' '}
                        {documents.length === 1 ? 'document' : 'documents'}
                    </span>
                    {expiredCount > 0 && (
                        <FleetPill tone="danger" dot>
                            {expiredCount} expired
                        </FleetPill>
                    )}
                    {expiringCount > 0 && (
                        <FleetPill tone="warning" dot>
                            {expiringCount} expiring soon
                        </FleetPill>
                    )}
                    {missingFileCount > 0 && (
                        <FleetPill tone="warning" icon={Paperclip}>
                            {missingFileCount} missing{' '}
                            {missingFileCount === 1 ? 'file' : 'files'}
                        </FleetPill>
                    )}
                    {expiredCount === 0 &&
                        expiringCount === 0 &&
                        missingFileCount === 0 && (
                            <FleetPill tone="success" icon={ShieldCheck}>
                                All current
                            </FleetPill>
                        )}
                </div>
            )}

            {successMessage && (
                <InlineNotice tone="success" title={successMessage} />
            )}

            <Modal
                open={showUploadForm && canManage}
                onClose={closeUploadDialog}
                title={
                    renewing
                        ? `Renew ${renewing.label}`
                        : 'Add compliance document'
                }
                description={`${asset.code} · ${asset.name ?? 'Fleet asset'}`}
                size="lg"
                closeOnBackdrop={false}
                contentClassName="p-5 sm:p-6"
                footer={
                    <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-ink-soft">
                            Your unfinished entries remain if you close this
                            dialog.
                        </p>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button
                                variant="secondary"
                                onClick={closeUploadDialog}
                                aria-label="Close document dialog"
                                disabled={form.processing}
                            >
                                Close
                            </Button>
                            <Button
                                type="submit"
                                form={`document-upload-form-${asset.id}`}
                                variant="primary"
                                disabled={form.processing || !form.data.file}
                                className="flex items-center gap-1.5"
                            >
                                <Upload className="h-3.5 w-3.5" />
                                {form.processing
                                    ? 'Uploading…'
                                    : 'Upload Document'}
                            </Button>
                        </div>
                    </div>
                }
            >
                <form
                    id={`document-upload-form-${asset.id}`}
                    onSubmit={submitUpload}
                    className="space-y-5"
                    noValidate
                >
                    <div>
                        <h3 className="text-base font-semibold text-ink">
                            Upload Authorized Permit / Certificate
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-ink-soft">
                            Add the compliance record and its source file so
                            dispatchers can verify it before assignment.
                        </p>
                    </div>

                    <div
                        role="note"
                        className="rounded-lg bg-surface-subtle p-3.5 text-xs leading-5 text-ink-soft"
                    >
                        Expired or expiring documents are surfaced first in the
                        asset record. Verify the issuing authority and dates
                        before uploading.
                    </div>

                    <section
                        aria-labelledby={`document-identity-${asset.id}`}
                        className="space-y-3"
                    >
                        <div>
                            <h4
                                id={`document-identity-${asset.id}`}
                                className="text-sm font-semibold text-ink"
                            >
                                Document identity
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-ink-soft">
                                Use the same title and number shown on the
                                source permit or certificate.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label
                                    htmlFor={`document-category-${asset.id}`}
                                    className="block text-sm font-medium text-ink"
                                >
                                    Category *
                                </label>
                                <select
                                    id={`document-category-${asset.id}`}
                                    value={form.data.category}
                                    data-autofocus
                                    onChange={(e) =>
                                        form.setData('category', e.target.value)
                                    }
                                    className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                >
                                    {CATEGORIES.map((c) => (
                                        <option key={c.value} value={c.value}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                                {form.errors.category && (
                                    <p className="mt-1 text-xs text-danger">
                                        {form.errors.category}
                                    </p>
                                )}
                            </div>

                            <div>
                                <FleetInput
                                    label="Document Title"
                                    required
                                    value={form.data.title}
                                    onChange={(val) =>
                                        form.setData('title', val)
                                    }
                                    placeholder="e.g. DPWH Special Transit Permit"
                                />
                                {form.errors.title && (
                                    <p className="mt-1 text-xs text-danger">
                                        {form.errors.title}
                                    </p>
                                )}
                            </div>

                            <div className="sm:col-span-2">
                                <FleetInput
                                    label="Document / Permit Number"
                                    value={form.data.document_number}
                                    onChange={(val) =>
                                        form.setData('document_number', val)
                                    }
                                    placeholder="e.g. DPWH-NCR-2026-SP-8821"
                                />
                                {form.errors.document_number && (
                                    <p className="mt-1 text-xs text-danger">
                                        {form.errors.document_number}
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section
                        aria-labelledby={`document-validity-${asset.id}`}
                        className="space-y-3 border-t border-line pt-4"
                    >
                        <div>
                            <h4
                                id={`document-validity-${asset.id}`}
                                className="text-sm font-semibold text-ink"
                            >
                                Authority and validity
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-ink-soft">
                                These fields determine the status dispatchers
                                and field operators see.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <FleetInput
                                    label="Issuing Authority"
                                    value={form.data.issuing_authority}
                                    onChange={(val) =>
                                        form.setData('issuing_authority', val)
                                    }
                                    placeholder="e.g. Department of Public Works and Highways"
                                />
                                {form.errors.issuing_authority && (
                                    <p className="mt-1 text-xs text-danger">
                                        {form.errors.issuing_authority}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor={`document-issued-at-${asset.id}`}
                                    className="block text-sm font-medium text-ink"
                                >
                                    Issued Date
                                </label>
                                <input
                                    id={`document-issued-at-${asset.id}`}
                                    type="date"
                                    value={form.data.issued_at}
                                    onChange={(e) =>
                                        form.setData(
                                            'issued_at',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                />
                                {form.errors.issued_at && (
                                    <p className="mt-1 text-xs text-danger">
                                        {form.errors.issued_at}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor={`document-expires-at-${asset.id}`}
                                    className="block text-sm font-medium text-ink"
                                >
                                    Expiry Date
                                </label>
                                <input
                                    id={`document-expires-at-${asset.id}`}
                                    type="date"
                                    value={form.data.expires_at}
                                    disabled={!form.data.expires_at}
                                    onChange={(e) =>
                                        form.setData(
                                            'expires_at',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-soft"
                                />
                                {form.errors.expires_at && (
                                    <p className="mt-1 text-xs text-danger">
                                        {form.errors.expires_at}
                                    </p>
                                )}
                                <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                                    <input
                                        type="checkbox"
                                        checked={!form.data.expires_at}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                form.setData('expires_at', '');
                                            } else {
                                                const today = new Date();
                                                form.setData(
                                                    'expires_at',
                                                    today
                                                        .toISOString()
                                                        .slice(0, 10),
                                                );
                                            }
                                        }}
                                        className="h-4 w-4 rounded border-line-strong text-brand-strong focus:ring-brand-strong"
                                    />
                                    No expiration date
                                </label>
                            </div>
                        </div>
                    </section>

                    <section
                        aria-labelledby={`document-notes-heading-${asset.id}`}
                        className="space-y-3 border-t border-line pt-4"
                    >
                        <div>
                            <h4
                                id={`document-notes-heading-${asset.id}`}
                                className="text-sm font-semibold text-ink"
                            >
                                Operating restrictions
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-ink-soft">
                                Record route, time-window, or dispatch
                                conditions that operators must see.
                            </p>
                        </div>
                        <textarea
                            id={`document-notes-${asset.id}`}
                            rows={3}
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                            placeholder="e.g. Permits off-peak transit along C-5 and EDSA (10 PM to 4 AM)."
                            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                        />
                        {form.errors.notes && (
                            <p className="text-xs text-danger">
                                {form.errors.notes}
                            </p>
                        )}
                    </section>

                    <section
                        aria-labelledby={`document-attachment-heading-${asset.id}`}
                        className="space-y-3 border-t border-line pt-4"
                    >
                        <div>
                            <h4
                                id={`document-attachment-heading-${asset.id}`}
                                className="text-sm font-semibold text-ink"
                            >
                                Source attachment
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-ink-soft">
                                Upload the source PDF or image. Maximum file
                                size is 10 MB.
                            </p>
                        </div>
                        <label
                            htmlFor={`document-file-${asset.id}`}
                            className="block text-sm font-medium text-ink"
                        >
                            Document Attachment (PDF or Image, max 10MB) *
                        </label>
                        <input
                            id={`document-file-${asset.id}`}
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/heic"
                            onChange={(e) =>
                                form.setData(
                                    'file',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                            className={fileInputClass}
                        />
                        {form.data.file && (
                            <p className="text-xs text-ink-soft">
                                Selected: {form.data.file.name} ·{' '}
                                {(form.data.file.size / 1024 / 1024).toFixed(2)}{' '}
                                MB
                            </p>
                        )}
                        {form.errors.file && (
                            <p className="text-xs text-danger">
                                {form.errors.file}
                            </p>
                        )}
                    </section>
                </form>
            </Modal>

            {documents.length === 0 ? (
                <FleetEmptyState
                    icon={FileText}
                    title="No documents on record"
                    description="No road permits, load test certificates, or insurance records have been registered for this asset yet."
                    action={
                        canManage ? (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={openBlankUpload}
                            >
                                <Upload className="h-3.5 w-3.5" />
                                Upload the first document
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <ul className="space-y-3" aria-label="Asset documents">
                    {sortedDocuments.map((doc) => (
                        <li
                            key={doc.id}
                            className={cn(
                                'overflow-hidden rounded-xl border bg-surface transition-colors',
                                doc.is_expired
                                    ? 'border-danger/40'
                                    : doc.expires_soon
                                      ? 'border-warning/40'
                                      : 'border-line hover:border-line-strong',
                            )}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <span
                                            className={cn(
                                                'hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex',
                                                doc.is_expired
                                                    ? 'bg-danger-soft text-danger-strong'
                                                    : doc.expires_soon
                                                      ? 'bg-warning-soft text-warning-strong'
                                                      : 'bg-brand-soft text-brand-strong',
                                            )}
                                            aria-hidden="true"
                                        >
                                            <FileText className="h-5 w-5" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="text-[11px] font-bold tracking-wider text-ink-soft uppercase">
                                                    {doc.category_label ||
                                                        doc.category}
                                                </span>
                                                {renderValidityBadge(doc)}
                                            </div>
                                            <h4 className="mt-1 text-sm font-semibold break-words text-ink">
                                                {doc.title}
                                            </h4>
                                        </div>
                                    </div>
                                    {canManage && (
                                        <div className="-mt-1 -mr-1 flex shrink-0 items-center">
                                            <button
                                                type="button"
                                                onClick={() => openReplace(doc)}
                                                className={iconButtonClass}
                                                title="Replace Document File"
                                                aria-label={`Replace file for ${doc.title}`}
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(doc)}
                                                className={iconButtonClass}
                                                title="Edit Document Metadata"
                                                aria-label={`Edit metadata for ${doc.title}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDelete(doc.id)
                                                }
                                                className={cn(
                                                    iconButtonClass,
                                                    'hover:bg-danger-soft hover:text-danger-strong',
                                                )}
                                                title="Delete Document"
                                                aria-label={`Delete ${doc.title}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4 sm:pl-13">
                                    <div className="min-w-0">
                                        <dt className="text-ink-soft">
                                            Permit / Cert #
                                        </dt>
                                        <dd className="mt-0.5 truncate font-mono font-medium text-ink">
                                            {doc.document_number || 'N/A'}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-ink-soft">
                                            Issuing Authority
                                        </dt>
                                        <dd className="mt-0.5 truncate font-medium text-ink">
                                            {doc.issuing_authority || 'N/A'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-ink-soft">
                                            Issued Date
                                        </dt>
                                        <dd className="mt-0.5 font-medium text-ink">
                                            {doc.issued_at
                                                ? formatDate(doc.issued_at)
                                                : 'N/A'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-ink-soft">
                                            Expiration Date
                                        </dt>
                                        <dd
                                            className={cn(
                                                'mt-0.5 font-medium',
                                                doc.is_expired
                                                    ? 'text-danger'
                                                    : doc.expires_soon
                                                      ? 'text-warning-strong'
                                                      : 'text-ink',
                                            )}
                                        >
                                            {doc.expires_at
                                                ? formatDate(doc.expires_at)
                                                : 'No expiration date'}
                                        </dd>
                                    </div>
                                </dl>

                                {doc.notes && (
                                    <p className="mt-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs leading-5 text-ink-soft sm:ml-13">
                                        {doc.notes}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-subtle/50 px-4 py-1.5 text-xs">
                                {doc.attachment ? (
                                    <>
                                        <span className="inline-flex min-w-0 items-center gap-1.5 text-ink-soft">
                                            <Paperclip
                                                className="h-3.5 w-3.5 shrink-0"
                                                aria-hidden="true"
                                            />
                                            <span className="max-w-56 truncate">
                                                {
                                                    doc.attachment
                                                        .original_filename
                                                }
                                            </span>
                                            <span className="shrink-0 tabular-nums">
                                                ·{' '}
                                                {formatFileSize(
                                                    doc.attachment.size_bytes,
                                                )}
                                            </span>
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPreviewDoc(doc)
                                                }
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                            >
                                                <Eye className="h-3.5 w-3.5" />{' '}
                                                Preview
                                            </button>
                                            <a
                                                href={
                                                    doc.attachment.download_url
                                                }
                                                download={
                                                    doc.attachment
                                                        .original_filename
                                                }
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                            >
                                                <Download className="h-3.5 w-3.5" />{' '}
                                                Download
                                            </a>
                                        </div>
                                    </>
                                ) : (
                                    <span className="inline-flex min-h-9 items-center gap-1.5 font-medium text-warning-strong">
                                        <AlertTriangle className="h-3.5 w-3.5" />{' '}
                                        Missing attachment
                                    </span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <Modal
                open={Boolean(previewDoc?.attachment)}
                onClose={() => setPreviewDoc(null)}
                title={previewDoc?.title}
                description={
                    previewDoc
                        ? [
                              previewDoc.category_label,
                              previewDoc.document_number,
                              previewDoc.issuing_authority
                                  ? `Issued by ${previewDoc.issuing_authority}`
                                  : null,
                          ]
                              .filter(Boolean)
                              .join(' · ')
                        : undefined
                }
                size="xl"
                contentClassName="bg-surface-subtle p-3 sm:p-4"
                footer={
                    previewDoc?.attachment && (
                        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="truncate text-xs text-ink-soft">
                                {previewDoc.attachment.original_filename} ·{' '}
                                {formatFileSize(
                                    previewDoc.attachment.size_bytes,
                                )}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setPreviewDoc(null)}
                                >
                                    Close
                                </Button>
                                <a
                                    href={previewDoc.attachment.download_url}
                                    download={
                                        previewDoc.attachment.original_filename
                                    }
                                    className={buttonVariants({
                                        variant: 'primary',
                                        size: 'sm',
                                    })}
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download File
                                </a>
                            </div>
                        </div>
                    )
                }
            >
                {previewDoc?.attachment && (
                    <div className="flex min-h-[300px] items-center justify-center">
                        {previewDoc.attachment.mime_type.startsWith(
                            'image/',
                        ) ? (
                            <img
                                src={previewDoc.attachment.download_url}
                                alt={previewDoc.title}
                                className="max-h-[60vh] max-w-full rounded-lg object-contain"
                            />
                        ) : (
                            <iframe
                                src={previewDoc.attachment.download_url}
                                title={previewDoc.title}
                                className="h-[60vh] w-full rounded-lg border-0 bg-surface"
                            />
                        )}
                    </div>
                )}
            </Modal>

            <Modal
                open={editingDoc !== null}
                onClose={() => setEditingDoc(null)}
                title="Edit Document Metadata"
                description={`Update compliance certificate details and operating status for ${asset.code}.`}
                size="lg"
                closeOnBackdrop={false}
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setEditingDoc(null)}
                            disabled={editForm.processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            form={`document-edit-form-${asset.id}`}
                            disabled={editForm.processing}
                        >
                            {editForm.processing ? 'Saving…' : 'Save Changes'}
                        </Button>
                    </>
                }
            >
                {editingDoc && (
                    <form
                        id={`document-edit-form-${asset.id}`}
                        onSubmit={submitEdit}
                        className="space-y-4"
                        noValidate
                    >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label
                                    htmlFor={`edit-document-category-${editingDoc.id}`}
                                    className="block text-sm font-medium text-ink"
                                >
                                    Category *
                                </label>
                                <select
                                    id={`edit-document-category-${editingDoc.id}`}
                                    value={editForm.data.category}
                                    data-autofocus
                                    onChange={(e) =>
                                        editForm.setData(
                                            'category',
                                            e.target.value,
                                        )
                                    }
                                    className={fieldClass}
                                >
                                    {CATEGORIES.map((c) => (
                                        <option key={c.value} value={c.value}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                                {editForm.errors.category && (
                                    <p className="mt-1 text-xs text-danger">
                                        {editForm.errors.category}
                                    </p>
                                )}
                            </div>

                            <FleetInput
                                label="Document Title"
                                required
                                value={editForm.data.title}
                                error={editForm.errors.title}
                                onChange={(val) =>
                                    editForm.setData('title', val)
                                }
                                placeholder="Document title"
                            />

                            <FleetInput
                                label="Document / Permit Number"
                                value={editForm.data.document_number}
                                error={editForm.errors.document_number}
                                onChange={(val) =>
                                    editForm.setData('document_number', val)
                                }
                                placeholder="e.g. DPWH-NCR-2026-SP-8821"
                            />

                            <FleetInput
                                label="Issuing Authority"
                                value={editForm.data.issuing_authority}
                                error={editForm.errors.issuing_authority}
                                onChange={(val) =>
                                    editForm.setData('issuing_authority', val)
                                }
                                placeholder="Issuing agency"
                            />

                            <div>
                                <label
                                    htmlFor={`edit-document-issued-at-${editingDoc.id}`}
                                    className="block text-sm font-medium text-ink"
                                >
                                    Issued Date
                                </label>
                                <input
                                    id={`edit-document-issued-at-${editingDoc.id}`}
                                    type="date"
                                    value={editForm.data.issued_at}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'issued_at',
                                            e.target.value,
                                        )
                                    }
                                    className={fieldClass}
                                />
                                {editForm.errors.issued_at && (
                                    <p className="mt-1 text-xs text-danger">
                                        {editForm.errors.issued_at}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor={`edit-document-expires-at-${editingDoc.id}`}
                                    className="block text-sm font-medium text-ink"
                                >
                                    Expiry Date
                                </label>
                                <input
                                    id={`edit-document-expires-at-${editingDoc.id}`}
                                    type="date"
                                    value={editForm.data.expires_at}
                                    disabled={!editForm.data.expires_at}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'expires_at',
                                            e.target.value,
                                        )
                                    }
                                    className={fieldClass}
                                />
                                <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                                    <input
                                        type="checkbox"
                                        checked={!editForm.data.expires_at}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'expires_at',
                                                e.target.checked
                                                    ? ''
                                                    : todayIsoDate(),
                                            )
                                        }
                                        className="h-4 w-4 rounded border-line-strong text-brand-strong focus:ring-brand-strong"
                                    />
                                    No expiration date
                                </label>
                                {editForm.errors.expires_at && (
                                    <p className="mt-1 text-xs text-danger">
                                        {editForm.errors.expires_at}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor={`edit-document-status-${editingDoc.id}`}
                                className="block text-sm font-medium text-ink"
                            >
                                Document Status
                            </label>
                            <select
                                id={`edit-document-status-${editingDoc.id}`}
                                value={editForm.data.status}
                                onChange={(e) =>
                                    editForm.setData('status', e.target.value)
                                }
                                className={fieldClass}
                            >
                                <option value="active">Active</option>
                                <option value="revoked">Revoked</option>
                                <option value="superseded">Superseded</option>
                            </select>
                            {editForm.errors.status && (
                                <p className="mt-1 text-xs text-danger">
                                    {editForm.errors.status}
                                </p>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor={`edit-document-notes-${editingDoc.id}`}
                                className="block text-sm font-medium text-ink"
                            >
                                Notes / Operating Restrictions
                            </label>
                            <textarea
                                id={`edit-document-notes-${editingDoc.id}`}
                                rows={3}
                                value={editForm.data.notes}
                                onChange={(e) =>
                                    editForm.setData('notes', e.target.value)
                                }
                                placeholder="Operating conditions or restrictions..."
                                className={textareaClass}
                            />
                            {editForm.errors.notes && (
                                <p className="mt-1 text-xs text-danger">
                                    {editForm.errors.notes}
                                </p>
                            )}
                        </div>
                    </form>
                )}
            </Modal>

            <Modal
                open={replacingDoc !== null}
                onClose={() => setReplacingDoc(null)}
                title="Replace Document Attachment"
                description={
                    replacingDoc
                        ? `Upload a renewed or superseding file for “${replacingDoc.title}”.`
                        : undefined
                }
                size="md"
                closeOnBackdrop={false}
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setReplacingDoc(null)}
                            disabled={replaceForm.processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            form={`document-replace-form-${asset.id}`}
                            disabled={
                                replaceForm.processing || !replaceForm.data.file
                            }
                        >
                            <Upload className="h-3.5 w-3.5" />
                            {replaceForm.processing
                                ? 'Uploading…'
                                : 'Upload Replacement'}
                        </Button>
                    </>
                }
            >
                {replacingDoc && (
                    <form
                        id={`document-replace-form-${asset.id}`}
                        onSubmit={submitReplace}
                        className="space-y-4"
                        noValidate
                    >
                        {replacingDoc.attachment && (
                            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-subtle px-3 py-2.5 text-xs text-ink-soft">
                                <Paperclip
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                <span className="font-semibold text-ink">
                                    Current file:
                                </span>
                                <span className="min-w-0 truncate">
                                    {replacingDoc.attachment.original_filename}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                    ·{' '}
                                    {formatFileSize(
                                        replacingDoc.attachment.size_bytes,
                                    )}
                                </span>
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor={`replace-document-file-${replacingDoc.id}`}
                                className="block text-sm font-medium text-ink"
                            >
                                New Attachment File (PDF or Image, max 10MB) *
                            </label>
                            <input
                                id={`replace-document-file-${replacingDoc.id}`}
                                type="file"
                                data-autofocus
                                accept="application/pdf,image/jpeg,image/png,image/heic"
                                onChange={(e) =>
                                    replaceForm.setData(
                                        'file',
                                        e.target.files?.[0] ?? null,
                                    )
                                }
                                className={fileInputClass}
                            />
                            {replaceForm.errors.file && (
                                <p className="mt-1 text-xs text-danger">
                                    {replaceForm.errors.file}
                                </p>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor={`replace-document-expires-at-${replacingDoc.id}`}
                                className="block text-sm font-medium text-ink"
                            >
                                Updated Expiration Date
                            </label>
                            <input
                                id={`replace-document-expires-at-${replacingDoc.id}`}
                                type="date"
                                value={replaceForm.data.expires_at}
                                disabled={!replaceForm.data.expires_at}
                                onChange={(e) =>
                                    replaceForm.setData(
                                        'expires_at',
                                        e.target.value,
                                    )
                                }
                                className={fieldClass}
                            />
                            <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                                <input
                                    type="checkbox"
                                    checked={!replaceForm.data.expires_at}
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'expires_at',
                                            e.target.checked
                                                ? ''
                                                : todayIsoDate(),
                                        )
                                    }
                                    className="h-4 w-4 rounded border-line-strong text-brand-strong focus:ring-brand-strong"
                                />
                                No expiration date
                            </label>
                            {replaceForm.errors.expires_at && (
                                <p className="mt-1 text-xs text-danger">
                                    {replaceForm.errors.expires_at}
                                </p>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor={`replace-document-notes-${replacingDoc.id}`}
                                className="block text-sm font-medium text-ink"
                            >
                                Update Notes / Renewal Details
                            </label>
                            <textarea
                                id={`replace-document-notes-${replacingDoc.id}`}
                                rows={2}
                                value={replaceForm.data.notes}
                                onChange={(e) =>
                                    replaceForm.setData('notes', e.target.value)
                                }
                                placeholder="e.g. Renewed for FY 2026-2027 by LTO central office."
                                className={textareaClass}
                            />
                            {replaceForm.errors.notes && (
                                <p className="mt-1 text-xs text-danger">
                                    {replaceForm.errors.notes}
                                </p>
                            )}
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
