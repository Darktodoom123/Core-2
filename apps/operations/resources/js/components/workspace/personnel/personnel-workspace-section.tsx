import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Download,
    Eye,
    FileText,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    User as UserIcon,
    X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import React, { useMemo, useState } from 'react';
import { Button, EmptyState, Panel } from '@/components/ui';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AuditEventViewModel,
    PersonnelCredentialViewModel,
    WorkspaceCapabilities,
    WorkspaceUserViewModel,
} from '@/types/workspace';

export interface PersonnelWorkspaceSectionProps {
    users: WorkspaceUserViewModel[];
    capabilities: WorkspaceCapabilities;
    auditEvents?: AuditEventViewModel[];
}

const CREDENTIAL_KINDS = [
    { value: 'driver_license', label: 'Driver License (LTO Professional)' },
    {
        value: 'operator_certification',
        label: 'Operator Certification (TESDA NC-II/NC-III)',
    },
    { value: 'qualification', label: 'Safety / Medical / DPWH Qualification' },
];

export function PersonnelWorkspaceSection({
    users,
    capabilities,
}: PersonnelWorkspaceSectionProps) {
    const canManage = capabilities.manage_users ?? false;
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<number>(
        users[0]?.id ?? 0,
    );
    const [previewCred, setPreviewCred] =
        useState<PersonnelCredentialViewModel | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [editingCred, setEditingCred] =
        useState<PersonnelCredentialViewModel | null>(null);
    const [replacingCred, setReplacingCred] =
        useState<PersonnelCredentialViewModel | null>(null);

    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            return users;
        }

        return users.filter((u) => {
            const nameMatch = u.name.toLowerCase().includes(query);
            const emailMatch = u.email.toLowerCase().includes(query);
            const roleMatch = (u.role_label ?? '')
                .toLowerCase()
                .includes(query);
            const empMatch = (u.profile?.employee_number ?? '')
                .toLowerCase()
                .includes(query);

            return nameMatch || emailMatch || roleMatch || empMatch;
        });
    }, [users, searchQuery]);

    const selectedUser = useMemo(() => {
        return (
            users.find((u) => u.id === selectedUserId) ??
            filteredUsers[0] ??
            null
        );
    }, [users, filteredUsers, selectedUserId]);

    const uploadForm = useForm<{
        kind: string;
        credential_type: string;
        credential_number: string;
        issuing_authority: string;
        issued_at: string;
        expires_at: string;
        notes: string;
        file: File | null;
    }>({
        kind: 'driver_license',
        credential_type: '',
        credential_number: '',
        issuing_authority: '',
        issued_at: '',
        expires_at: '',
        notes: '',
        file: null,
    });

    const editForm = useForm<{
        kind: string;
        credential_type: string;
        credential_number: string;
        issuing_authority: string;
        issued_at: string;
        expires_at: string;
        notes: string;
        status: string;
    }>({
        kind: 'driver_license',
        credential_type: '',
        credential_number: '',
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

    const handleUploadSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (!selectedUser) {
            return;
        }

        uploadForm.post(`/operations/users/${selectedUser.id}/credentials`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setShowUploadModal(false);
                uploadForm.reset();
            },
        });
    };

    const handleOpenEdit = (cred: PersonnelCredentialViewModel) => {
        setEditingCred(cred);
        editForm.setData({
            kind: cred.kind || 'driver_license',
            credential_type: cred.credential_type || '',
            credential_number: cred.credential_number || '',
            issuing_authority: cred.issuing_authority || '',
            issued_at: cred.issued_at || '',
            expires_at: cred.expires_at || '',
            notes: cred.notes || '',
            status: cred.status || 'active',
        });
    };

    const handleEditSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (!selectedUser || !editingCred) {
            return;
        }

        editForm.patch(
            `/operations/users/${selectedUser.id}/credentials/${editingCred.id}`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingCred(null);
                    editForm.reset();
                },
            },
        );
    };

    const handleOpenReplace = (cred: PersonnelCredentialViewModel) => {
        setReplacingCred(cred);
        replaceForm.setData({
            file: null,
            notes: cred.notes || '',
            expires_at: cred.expires_at || '',
        });
    };

    const handleReplaceSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (!selectedUser || !replacingCred) {
            return;
        }

        replaceForm.post(
            `/operations/users/${selectedUser.id}/credentials/${replacingCred.id}/replace`,
            {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => {
                    setReplacingCred(null);
                    replaceForm.reset();
                },
            },
        );
    };

    const handleDelete = (credId: number) => {
        if (!selectedUser) {
            return;
        }

        if (
            !confirm(
                'Are you sure you want to remove this credential? This action is recorded in audit logs.',
            )
        ) {
            return;
        }

        router.delete(
            `/operations/users/${selectedUser.id}/credentials/${credId}`,
            {
                preserveScroll: true,
            },
        );
    };

    const renderValidityBadge = (cred: PersonnelCredentialViewModel) => {
        switch (cred.validity_status) {
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
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                        No expiration date
                    </span>
                );
        }
    };

    const credentials = selectedUser?.credentials ?? [];

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-ink">
                        Personnel Registry &amp; Compliance Credentials
                    </h2>
                    <p className="text-sm text-ink-soft">
                        Maintain driver licenses, heavy equipment operator
                        certifications, and regulatory qualification documents.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
                {/* Users List Sidebar */}
                <Panel className="flex flex-col overflow-hidden p-0">
                    <div className="border-b border-line p-3">
                        <div className="relative">
                            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-ink-soft" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search personnel..."
                                className="w-full rounded-md border border-line bg-surface py-1.5 pr-3 pl-8 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus:ring-1 focus:ring-brand-strong focus:outline-none"
                                aria-label="Search personnel"
                            />
                        </div>
                    </div>
                    <div
                        className="max-h-[36rem] divide-y divide-line overflow-y-auto"
                        role="list"
                    >
                        {filteredUsers.length === 0 ? (
                            <div className="p-4 text-center text-xs text-ink-soft">
                                No personnel found.
                            </div>
                        ) : (
                            filteredUsers.map((u) => {
                                const isSelected = selectedUser?.id === u.id;
                                const creds = u.credentials ?? [];
                                const hasExpired = creds.some(
                                    (c) => c.validity_status === 'expired',
                                );
                                const hasExpiringSoon = creds.some(
                                    (c) =>
                                        c.validity_status === 'expiring_soon',
                                );

                                return (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => setSelectedUserId(u.id)}
                                        className={cn(
                                            'w-full p-3 text-left transition hover:bg-surface-subtle',
                                            isSelected &&
                                                'bg-surface-subtle ring-1 ring-brand-strong/30 ring-inset',
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-ink">
                                                {u.name}
                                            </span>
                                            <span
                                                className={cn(
                                                    'inline-block h-2 w-2 rounded-full',
                                                    u.is_active
                                                        ? 'bg-success'
                                                        : 'bg-muted',
                                                )}
                                            />
                                        </div>
                                        <div className="mt-0.5 flex items-center justify-between text-xs text-ink-soft">
                                            <span>
                                                {u.role_label ?? u.role}
                                            </span>
                                            <span>
                                                {creds.length} cred
                                                {creds.length === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        {(hasExpired || hasExpiringSoon) && (
                                            <div className="mt-1 flex gap-1">
                                                {hasExpired && (
                                                    <span className="py-0.2 rounded bg-danger-soft px-1.5 text-[10px] font-semibold text-danger">
                                                        Expired
                                                    </span>
                                                )}
                                                {hasExpiringSoon && (
                                                    <span className="py-0.2 rounded bg-warning-soft px-1.5 text-[10px] font-semibold text-warning-strong">
                                                        Expiring soon
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </Panel>

                {/* Personnel Details and Credentials Main Panel */}
                {selectedUser ? (
                    <div className="space-y-6">
                        {/* Profile Header */}
                        <Panel className="space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-ink">
                                        {selectedUser.name}
                                    </h3>
                                    <p className="text-xs text-ink-soft">
                                        {selectedUser.role_label ??
                                            selectedUser.role}{' '}
                                        &bull; {selectedUser.email}
                                        {selectedUser.phone
                                            ? ` &bull; ${selectedUser.phone}`
                                            : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                            selectedUser.is_active
                                                ? 'bg-success-soft text-success-strong'
                                                : 'bg-muted/30 text-ink-soft',
                                        )}
                                    >
                                        {selectedUser.is_active
                                            ? 'Active'
                                            : 'Suspended'}
                                    </span>
                                </div>
                            </div>
                            {selectedUser.profile && (
                                <div className="grid gap-2 border-t border-line pt-3 text-xs text-ink-soft sm:grid-cols-3">
                                    <div>
                                        <span className="font-semibold text-ink">
                                            Employee Number:{' '}
                                        </span>
                                        {selectedUser.profile.employee_number ||
                                            'N/A'}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-ink">
                                            Availability:{' '}
                                        </span>
                                        {
                                            selectedUser.profile
                                                .availability_status
                                        }
                                    </div>
                                    <div>
                                        <span className="font-semibold text-ink">
                                            Emergency Contact:{' '}
                                        </span>
                                        {selectedUser.profile
                                            .emergency_contact_name
                                            ? `${selectedUser.profile.emergency_contact_name} (${selectedUser.profile.emergency_contact_phone || 'No phone'})`
                                            : 'Not specified'}
                                    </div>
                                </div>
                            )}
                        </Panel>

                        {/* Credentials List */}
                        <Panel className="space-y-4">
                            <div className="flex items-center justify-between border-b border-line pb-3">
                                <div>
                                    <h4 className="font-semibold text-ink">
                                        Compliance Credentials
                                    </h4>
                                    <p className="text-xs text-ink-soft">
                                        Official operating licenses,
                                        certifications, and compliance
                                        attachments.
                                    </p>
                                </div>
                                {canManage && (
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => setShowUploadModal(true)}
                                        data-testid="add-credential-button"
                                    >
                                        <Plus className="mr-1.5 h-4 w-4" />
                                        Add Credential
                                    </Button>
                                )}
                            </div>

                            {credentials.length === 0 ? (
                                <EmptyState
                                    icon={FileText}
                                    title="No credentials on file"
                                    message={
                                        canManage
                                            ? 'Upload verified driver licenses, TESDA certificates, or safety accreditations.'
                                            : 'No regulatory credentials have been recorded for this user.'
                                    }
                                />
                            ) : (
                                <div className="space-y-3">
                                    {credentials.map((cred) => (
                                        <div
                                            key={cred.id}
                                            className="rounded-lg border border-line bg-surface p-4 shadow-sm transition hover:border-brand-strong/40"
                                            data-testid={`credential-card-${cred.id}`}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-ink">
                                                            {
                                                                cred.credential_type
                                                            }
                                                        </span>
                                                        {renderValidityBadge(
                                                            cred,
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-ink-soft">
                                                        Number:{' '}
                                                        <span className="font-mono font-medium text-ink">
                                                            {
                                                                cred.credential_number
                                                            }
                                                        </span>{' '}
                                                        &bull; Issued by:{' '}
                                                        {cred.issuing_authority ||
                                                            'Unknown'}
                                                    </p>
                                                </div>
                                                <div className="text-right text-xs text-ink-soft">
                                                    <div>
                                                        Issued:{' '}
                                                        {cred.issued_at
                                                            ? formatDate(
                                                                  cred.issued_at,
                                                              )
                                                            : 'N/A'}
                                                    </div>
                                                    <div>
                                                        Expires:{' '}
                                                        {cred.expires_at
                                                            ? formatDate(
                                                                  cred.expires_at,
                                                              )
                                                            : 'No expiration date'}
                                                    </div>
                                                </div>
                                            </div>

                                            {cred.notes && (
                                                <p className="mt-2 rounded bg-surface-subtle p-2 text-xs text-ink-soft">
                                                    {cred.notes}
                                                </p>
                                            )}

                                            {/* Attachment & Action Footer */}
                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
                                                {cred.attachment ? (
                                                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                                                        <FileText className="h-4 w-4 text-brand-strong" />
                                                        <span className="font-medium text-ink">
                                                            {
                                                                cred.attachment
                                                                    .original_filename
                                                            }
                                                        </span>
                                                        <span>
                                                            (
                                                            {Math.round(
                                                                cred.attachment
                                                                    .size_bytes /
                                                                    1024,
                                                            )}{' '}
                                                            KB)
                                                        </span>
                                                        <a
                                                            href={
                                                                cred.attachment
                                                                    .download_url
                                                            }
                                                            className="inline-flex items-center gap-1 font-semibold text-brand-strong hover:underline"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            data-testid={`download-credential-${cred.id}`}
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            Download
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setPreviewCred(
                                                                    cred,
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1 font-semibold text-ink hover:text-brand-strong"
                                                            data-testid={`preview-credential-${cred.id}`}
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            Preview
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-ink-soft italic">
                                                        No file attachment
                                                    </span>
                                                )}

                                                {/* Management Actions (Gated) */}
                                                {canManage && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                handleOpenReplace(
                                                                    cred,
                                                                )
                                                            }
                                                            data-testid={`replace-credential-${cred.id}`}
                                                        >
                                                            <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                                            Replace File
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                handleOpenEdit(
                                                                    cred,
                                                                )
                                                            }
                                                            data-testid={`edit-credential-${cred.id}`}
                                                        >
                                                            <Pencil className="mr-1 h-3.5 w-3.5" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            onClick={() =>
                                                                handleDelete(
                                                                    cred.id,
                                                                )
                                                            }
                                                            data-testid={`delete-credential-${cred.id}`}
                                                        >
                                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                            Delete
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </div>
                ) : (
                    <Panel>
                        <EmptyState
                            icon={UserIcon}
                            title="Select a user"
                            message="Choose a user from the list to view and manage compliance credentials."
                        />
                    </Panel>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && selectedUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3 className="font-bold text-ink">
                                Add Credential for {selectedUser.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowUploadModal(false)}
                                className="text-ink-soft hover:text-ink"
                                aria-label="Close modal"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form
                            onSubmit={handleUploadSubmit}
                            className="mt-4 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Credential Kind
                                </label>
                                <select
                                    value={uploadForm.data.kind}
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'kind',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                >
                                    {CREDENTIAL_KINDS.map((k) => (
                                        <option key={k.value} value={k.value}>
                                            {k.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Credential Type / Title
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={uploadForm.data.credential_type}
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'credential_type',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="e.g. Heavy Mobile Crane NC-III"
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Credential / License Number
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={uploadForm.data.credential_number}
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'credential_number',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="e.g. TESDA-NC3-99120"
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold text-ink">
                                        Issuing Authority
                                    </label>
                                    <input
                                        type="text"
                                        value={
                                            uploadForm.data.issuing_authority
                                        }
                                        onChange={(e) =>
                                            uploadForm.setData(
                                                'issuing_authority',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="e.g. TESDA Central Office"
                                        className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink">
                                        Issued Date
                                    </label>
                                    <input
                                        type="date"
                                        value={uploadForm.data.issued_at}
                                        onChange={(e) =>
                                            uploadForm.setData(
                                                'issued_at',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Expiration Date
                                </label>
                                <input
                                    type="date"
                                    value={uploadForm.data.expires_at}
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'expires_at',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                                <span className="mt-0.5 block text-[11px] text-ink-soft">
                                    Leave blank if no expiration date is
                                    specified.
                                </span>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Attachment File (PDF, PNG, JPEG &le; 10MB)
                                </label>
                                <input
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg"
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'file',
                                            e.target.files?.[0] ?? null,
                                        )
                                    }
                                    className="mt-1 w-full text-xs text-ink-soft"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Operational Notes / Conditions
                                </label>
                                <textarea
                                    value={uploadForm.data.notes}
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'notes',
                                            e.target.value,
                                        )
                                    }
                                    rows={2}
                                    placeholder="Optional restrictions or endorsement details..."
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 border-t border-line pt-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowUploadModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={uploadForm.processing}
                                >
                                    {uploadForm.processing
                                        ? 'Saving...'
                                        : 'Save Credential'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Metadata & Status Modal */}
            {editingCred && selectedUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3 className="font-bold text-ink">
                                Edit Credential Metadata
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingCred(null)}
                                className="text-ink-soft hover:text-ink"
                                aria-label="Close modal"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form
                            onSubmit={handleEditSubmit}
                            className="mt-4 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Credential Status
                                </label>
                                <select
                                    value={editForm.data.status}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'status',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                >
                                    <option value="active">Active</option>
                                    <option value="revoked">Revoked</option>
                                    <option value="superseded">
                                        Superseded
                                    </option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Credential Type / Title
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.data.credential_type}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'credential_type',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Credential / License Number
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.data.credential_number}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'credential_number',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold text-ink">
                                        Issuing Authority
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.data.issuing_authority}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'issuing_authority',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink">
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
                                        className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Expiration Date
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
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                                <span className="mt-0.5 block text-[11px] text-ink-soft">
                                    Leave blank if no expiration date is
                                    specified.
                                </span>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Operational Notes / Conditions
                                </label>
                                <textarea
                                    value={editForm.data.notes}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'notes',
                                            e.target.value,
                                        )
                                    }
                                    rows={2}
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 border-t border-line pt-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setEditingCred(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={editForm.processing}
                                >
                                    {editForm.processing
                                        ? 'Saving...'
                                        : 'Update Credential'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Replace File Modal */}
            {replacingCred && selectedUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3 className="font-bold text-ink">
                                Replace File Attachment
                            </h3>
                            <button
                                type="button"
                                onClick={() => setReplacingCred(null)}
                                className="text-ink-soft hover:text-ink"
                                aria-label="Close modal"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form
                            onSubmit={handleReplaceSubmit}
                            className="mt-4 space-y-4"
                        >
                            <p className="text-xs text-ink-soft">
                                Replacing this file will archive the previous
                                version and attach the new file to credential{' '}
                                <span className="font-semibold text-ink">
                                    {replacingCred.credential_number}
                                </span>
                                .
                            </p>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    New File (PDF, PNG, JPEG &le; 10MB)
                                </label>
                                <input
                                    type="file"
                                    required
                                    accept="application/pdf,image/png,image/jpeg"
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'file',
                                            e.target.files?.[0] ?? null,
                                        )
                                    }
                                    className="mt-1 w-full text-xs text-ink-soft"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    New Expiration Date (if renewed)
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
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink">
                                    Replacement Reason / Notes
                                </label>
                                <textarea
                                    value={replaceForm.data.notes}
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'notes',
                                            e.target.value,
                                        )
                                    }
                                    rows={2}
                                    placeholder="e.g. Renewed license for 2026-2029 cycle."
                                    className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus:outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 border-t border-line pt-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setReplacingCred(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={replaceForm.processing}
                                >
                                    {replaceForm.processing
                                        ? 'Uploading...'
                                        : 'Replace File'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Document Preview Modal */}
            {previewCred && previewCred.attachment && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line p-4">
                            <div>
                                <h4 className="font-bold text-ink">
                                    {previewCred.credential_type}
                                </h4>
                                <p className="text-xs text-ink-soft">
                                    {previewCred.attachment.original_filename}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewCred(null)}
                                className="text-ink-soft hover:text-ink"
                                aria-label="Close preview"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {previewCred.attachment.mime_type.startsWith(
                                'image/',
                            ) ? (
                                <img
                                    src={previewCred.attachment.download_url}
                                    alt={
                                        previewCred.title ??
                                        previewCred.credential_type
                                    }
                                    className="max-h-[60vh] w-full rounded-md object-contain"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileText className="h-16 w-16 text-brand-strong" />
                                    <p className="mt-3 text-sm font-semibold text-ink">
                                        {
                                            previewCred.attachment
                                                .original_filename
                                        }
                                    </p>
                                    <p className="text-xs text-ink-soft">
                                        PDF Document &bull;{' '}
                                        {Math.round(
                                            previewCred.attachment.size_bytes /
                                                1024,
                                        )}{' '}
                                        KB
                                    </p>
                                    <a
                                        href={
                                            previewCred.attachment.download_url
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-contrast shadow hover:bg-brand-strong hover:text-white dark:hover:text-brand-contrast"
                                    >
                                        <Download className="h-4 w-4" />
                                        Download PDF Document
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
