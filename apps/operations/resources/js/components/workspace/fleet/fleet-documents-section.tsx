import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Download,
    Eye,
    FileText,
    Pencil,
    Plus,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import React, { useState } from 'react';
import { Button } from '@/components/ui';
import { FleetInput } from '@/components/workspace/fleet/fleet-input';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { AssetDocumentViewModel, AssetViewModel } from '@/types/workspace';

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

    const documents = asset.documents ?? [];

    const form = useForm<{
        category: string;
        title: string;
        document_number: string;
        issuing_authority: string;
        issued_at: string;
        expires_at: string;
        notes: string;
        file: File | null;
    }>({
        category: 'road_permits',
        title: '',
        document_number: '',
        issuing_authority: '',
        issued_at: '',
        expires_at: '',
        notes: '',
        file: null,
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
            forceFormData: true,
            onSuccess: () => {
                setShowUploadForm(false);
                form.reset();
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
                onSuccess: () => {
                    setEditingDoc(null);
                    editForm.reset();
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
                forceFormData: true,
                onSuccess: () => {
                    setReplacingDoc(null);
                    replaceForm.reset();
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
        });
    };

    const renderValidityBadge = (doc: AssetDocumentViewModel) => {
        switch (doc.validity_status) {
            case 'valid':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-strong">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Valid
                    </span>
                );
            case 'expiring_soon':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Expiring soon
                    </span>
                );
            case 'expired':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Expired
                    </span>
                );
            case 'revoked':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
                        Revoked
                    </span>
                );
            case 'superseded':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        Superseded
                    </span>
                );
            case 'no_expiration':
            case 'permanent':
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        No expiration date
                    </span>
                );
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-ink">
                        Asset Permits &amp; Regulatory Compliance Documents
                    </h3>
                    <p className="text-xs text-ink-soft">
                        Authorized certificates, road transit clearances, and
                        proof of insurance for {asset.code}.
                    </p>
                </div>
                {canManage && (
                    <Button
                        variant={showUploadForm ? 'quiet' : 'primary'}
                        size="sm"
                        onClick={() => setShowUploadForm(!showUploadForm)}
                        className="flex items-center gap-1.5"
                    >
                        {showUploadForm ? (
                            <>
                                <X className="h-3.5 w-3.5" /> Cancel
                            </>
                        ) : (
                            <>
                                <Plus className="h-3.5 w-3.5" /> Add Document
                            </>
                        )}
                    </Button>
                )}
            </div>

            {/* Upload Modal / Inline Form */}
            {showUploadForm && (
                <form
                    onSubmit={submitUpload}
                    className="space-y-3 rounded-xl border border-brand/20 bg-brand-soft/20 p-4"
                >
                    <h4 className="text-xs font-bold tracking-wider text-brand-strong uppercase">
                        Upload Authorized Permit / Certificate
                    </h4>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="block text-xs font-medium text-ink">
                                Category *
                            </label>
                            <select
                                value={form.data.category}
                                onChange={(e) =>
                                    form.setData('category', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
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
                            <label className="block text-xs font-medium text-ink">
                                Document Title *
                            </label>
                            <FleetInput
                                value={form.data.title}
                                onChange={(val) => form.setData('title', val)}
                                placeholder="e.g. DPWH Special Transit Permit"
                            />
                            {form.errors.title && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.title}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-ink">
                                Document / Permit Number
                            </label>
                            <FleetInput
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

                        <div>
                            <label className="block text-xs font-medium text-ink">
                                Issuing Authority
                            </label>
                            <FleetInput
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
                            <label className="block text-xs font-medium text-ink">
                                Issued Date
                            </label>
                            <input
                                type="date"
                                value={form.data.issued_at}
                                onChange={(e) =>
                                    form.setData('issued_at', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            {form.errors.issued_at && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.issued_at}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-ink">
                                Expiry Date (Leave empty if permanent)
                            </label>
                            <input
                                type="date"
                                value={form.data.expires_at}
                                onChange={(e) =>
                                    form.setData('expires_at', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            {form.errors.expires_at && (
                                <p className="mt-1 text-xs text-danger">
                                    {form.errors.expires_at}
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-ink">
                            Notes / Operating Restrictions
                        </label>
                        <textarea
                            rows={2}
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                            placeholder="e.g. Permits off-peak transit along C-5 and EDSA (10 PM to 4 AM)."
                            className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-ink">
                            Document Attachment (PDF or Image, max 10MB) *
                        </label>
                        <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/heic"
                            onChange={(e) =>
                                form.setData(
                                    'file',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                            className="mt-1 block w-full cursor-pointer text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-strong"
                        />
                        {form.errors.file && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.file}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="quiet"
                            size="sm"
                            onClick={() => setShowUploadForm(false)}
                            disabled={form.processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={form.processing || !form.data.file}
                            className="flex items-center gap-1.5"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            {form.processing ? 'Uploading…' : 'Upload Document'}
                        </Button>
                    </div>
                </form>
            )}

            {/* Documents List */}
            {documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-8 text-center">
                    <FileText className="mx-auto h-8 w-8 text-ink-soft/40" />
                    <h4 className="mt-2 text-sm font-semibold text-ink">
                        No documents on record
                    </h4>
                    <p className="mt-1 text-xs text-ink-soft">
                        No road permits, load test certificates, or insurance
                        records have been registered for this asset yet.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className="flex flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-xs transition-colors hover:border-brand/30"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold tracking-wider text-brand-strong uppercase">
                                                {doc.category_label ||
                                                    doc.category}
                                            </span>
                                            {renderValidityBadge(doc)}
                                        </div>
                                        <h4 className="mt-1 truncate text-sm font-semibold text-ink">
                                            {doc.title}
                                        </h4>
                                    </div>
                                    {canManage && (
                                        <div className="flex shrink-0 items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => openReplace(doc)}
                                                className="rounded-md p-1 text-ink-soft transition-colors hover:bg-surface-subtle hover:text-brand"
                                                title="Replace Document File"
                                                aria-label={`Replace file for ${doc.title}`}
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(doc)}
                                                className="rounded-md p-1 text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
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
                                                className="rounded-md p-1 text-ink-soft transition-colors hover:bg-surface-subtle hover:text-danger"
                                                title="Delete Document"
                                                aria-label={`Delete ${doc.title}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                                    <div>
                                        <dt className="text-ink-soft">
                                            Permit / Cert #
                                        </dt>
                                        <dd className="font-mono font-medium text-ink">
                                            {doc.document_number || 'N/A'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-ink-soft">
                                            Issuing Authority
                                        </dt>
                                        <dd className="truncate font-medium text-ink">
                                            {doc.issuing_authority || 'N/A'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-ink-soft">
                                            Issued Date
                                        </dt>
                                        <dd className="text-ink">
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
                                                'font-medium',
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
                                    <p className="mt-2 rounded-lg border border-line/60 bg-surface-subtle p-2 text-xs text-ink-soft">
                                        {doc.notes}
                                    </p>
                                )}
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs">
                                {doc.attachment ? (
                                    <>
                                        <span className="max-w-[160px] truncate text-ink-soft">
                                            {doc.attachment.original_filename} (
                                            {(
                                                doc.attachment.size_bytes /
                                                1024 /
                                                1024
                                            ).toFixed(1)}{' '}
                                            MB)
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPreviewDoc(doc)
                                                }
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-soft hover:bg-surface-subtle hover:text-ink"
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
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft hover:text-brand-strong"
                                            >
                                                <Download className="h-3.5 w-3.5" />{' '}
                                                Download
                                            </a>
                                        </div>
                                    </>
                                ) : (
                                    <span className="inline-flex items-center gap-1 font-medium text-warning-strong">
                                        <AlertTriangle className="h-3 w-3" />{' '}
                                        Missing attachment
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Document Preview Modal */}
            {previewDoc && previewDoc.attachment && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="preview-doc-title"
                >
                    <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-surface p-5 shadow-2xl">
                        <div className="flex items-start justify-between border-b border-line pb-3">
                            <div>
                                <h3
                                    id="preview-doc-title"
                                    className="text-base font-semibold text-ink"
                                >
                                    {previewDoc.title}
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    {previewDoc.category_label} ·{' '}
                                    {previewDoc.document_number} · Issued by{' '}
                                    {previewDoc.issuing_authority}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewDoc(null)}
                                className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="my-4 flex min-h-[300px] flex-1 items-center justify-center overflow-auto rounded-xl border border-line bg-surface-subtle p-2">
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
                                    className="h-[60vh] w-full rounded-lg border-0"
                                />
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-line pt-3">
                            <span className="text-xs text-ink-soft">
                                {previewDoc.attachment.original_filename} (
                                {(
                                    previewDoc.attachment.size_bytes /
                                    1024 /
                                    1024
                                ).toFixed(2)}{' '}
                                MB)
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="quiet"
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
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-strong"
                                >
                                    <Download className="h-3.5 w-3.5" />{' '}
                                    Download File
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Document Modal */}
            {editingDoc && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-doc-title"
                >
                    <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-line bg-surface p-5 shadow-2xl">
                        <div className="flex items-start justify-between border-b border-line pb-3">
                            <div>
                                <h3
                                    id="edit-doc-title"
                                    className="text-base font-semibold text-ink"
                                >
                                    Edit Document Metadata
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Update compliance certificate details and
                                    operating status for {asset.code}.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingDoc(null)}
                                className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form
                            onSubmit={submitEdit}
                            className="space-y-3 overflow-y-auto py-4"
                        >
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-medium text-ink">
                                        Category *
                                    </label>
                                    <select
                                        value={editForm.data.category}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'category',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                    >
                                        {CATEGORIES.map((c) => (
                                            <option
                                                key={c.value}
                                                value={c.value}
                                            >
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

                                <div>
                                    <label className="block text-xs font-medium text-ink">
                                        Document Title *
                                    </label>
                                    <FleetInput
                                        value={editForm.data.title}
                                        onChange={(val) =>
                                            editForm.setData('title', val)
                                        }
                                        placeholder="Document title"
                                    />
                                    {editForm.errors.title && (
                                        <p className="mt-1 text-xs text-danger">
                                            {editForm.errors.title}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ink">
                                        Document / Permit Number
                                    </label>
                                    <FleetInput
                                        value={editForm.data.document_number}
                                        onChange={(val) =>
                                            editForm.setData(
                                                'document_number',
                                                val,
                                            )
                                        }
                                        placeholder="e.g. DPWH-NCR-2026-SP-8821"
                                    />
                                    {editForm.errors.document_number && (
                                        <p className="mt-1 text-xs text-danger">
                                            {editForm.errors.document_number}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ink">
                                        Issuing Authority
                                    </label>
                                    <FleetInput
                                        value={editForm.data.issuing_authority}
                                        onChange={(val) =>
                                            editForm.setData(
                                                'issuing_authority',
                                                val,
                                            )
                                        }
                                        placeholder="Issuing agency"
                                    />
                                    {editForm.errors.issuing_authority && (
                                        <p className="mt-1 text-xs text-danger">
                                            {editForm.errors.issuing_authority}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ink">
                                        Issued Date
                                    </label>
                                    <input
                                        type="date"
                                        value={editForm.data.issued_at}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'issued_at',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                    />
                                    {editForm.errors.issued_at && (
                                        <p className="mt-1 text-xs text-danger">
                                            {editForm.errors.issued_at}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ink">
                                        Expiry Date (Leave empty if no
                                        expiration)
                                    </label>
                                    <input
                                        type="date"
                                        value={editForm.data.expires_at}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'expires_at',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                    />
                                    {editForm.errors.expires_at && (
                                        <p className="mt-1 text-xs text-danger">
                                            {editForm.errors.expires_at}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-ink">
                                    Document Status
                                </label>
                                <select
                                    value={editForm.data.status}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'status',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                >
                                    <option value="active">Active</option>
                                    <option value="revoked">Revoked</option>
                                    <option value="superseded">
                                        Superseded
                                    </option>
                                </select>
                                {editForm.errors.status && (
                                    <p className="mt-1 text-xs text-danger">
                                        {editForm.errors.status}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-ink">
                                    Notes / Operating Restrictions
                                </label>
                                <textarea
                                    rows={3}
                                    value={editForm.data.notes}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'notes',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Operating conditions or restrictions..."
                                    className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                />
                                {editForm.errors.notes && (
                                    <p className="mt-1 text-xs text-danger">
                                        {editForm.errors.notes}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 border-t border-line pt-3">
                                <Button
                                    type="button"
                                    variant="quiet"
                                    size="sm"
                                    onClick={() => setEditingDoc(null)}
                                    disabled={editForm.processing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={editForm.processing}
                                >
                                    {editForm.processing
                                        ? 'Saving…'
                                        : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Replace Document Attachment Modal */}
            {replacingDoc && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="replace-doc-title"
                >
                    <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-surface p-5 shadow-2xl">
                        <div className="flex items-start justify-between border-b border-line pb-3">
                            <div>
                                <h3
                                    id="replace-doc-title"
                                    className="text-base font-semibold text-ink"
                                >
                                    Replace Document Attachment
                                </h3>
                                <p className="text-xs text-ink-soft">
                                    Upload a renewed or superseding file for "
                                    {replacingDoc.title}".
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReplacingDoc(null)}
                                className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form
                            onSubmit={submitReplace}
                            className="space-y-3 py-4"
                        >
                            {replacingDoc.attachment && (
                                <div className="rounded-lg border border-line/80 bg-surface-subtle p-3 text-xs text-ink-soft">
                                    <span className="font-semibold text-ink">
                                        Current file:
                                    </span>{' '}
                                    {replacingDoc.attachment.original_filename}{' '}
                                    (
                                    {(
                                        replacingDoc.attachment.size_bytes /
                                        1024 /
                                        1024
                                    ).toFixed(2)}{' '}
                                    MB)
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-ink">
                                    New Attachment File (PDF or Image, max 10MB)
                                    *
                                </label>
                                <input
                                    type="file"
                                    accept="application/pdf,image/jpeg,image/png,image/heic"
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'file',
                                            e.target.files?.[0] ?? null,
                                        )
                                    }
                                    className="mt-1 block w-full cursor-pointer text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-strong"
                                />
                                {replaceForm.errors.file && (
                                    <p className="mt-1 text-xs text-danger">
                                        {replaceForm.errors.file}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-ink">
                                    Updated Expiration Date
                                </label>
                                <input
                                    type="date"
                                    value={replaceForm.data.expires_at}
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'expires_at',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                />
                                {replaceForm.errors.expires_at && (
                                    <p className="mt-1 text-xs text-danger">
                                        {replaceForm.errors.expires_at}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-ink">
                                    Update Notes / Renewal Details
                                </label>
                                <textarea
                                    rows={2}
                                    value={replaceForm.data.notes}
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'notes',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="e.g. Renewed for FY 2026-2027 by LTO central office."
                                    className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                />
                                {replaceForm.errors.notes && (
                                    <p className="mt-1 text-xs text-danger">
                                        {replaceForm.errors.notes}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 border-t border-line pt-3">
                                <Button
                                    type="button"
                                    variant="quiet"
                                    size="sm"
                                    onClick={() => setReplacingDoc(null)}
                                    disabled={replaceForm.processing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={
                                        replaceForm.processing ||
                                        !replaceForm.data.file
                                    }
                                    className="flex items-center gap-1.5"
                                >
                                    <Upload className="h-3.5 w-3.5" />
                                    {replaceForm.processing
                                        ? 'Uploading…'
                                        : 'Upload Replacement'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
