import { router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
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
    embedded?: boolean;
}

const CREDENTIAL_KINDS = [
    { value: 'driver_license', label: 'Driver License (LTO Professional)' },
    {
        value: 'operator_certification',
        label: 'Operator Certification (TESDA NC-II/NC-III)',
    },
    { value: 'qualification', label: 'Safety / Medical / DPWH Qualification' },
];

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) {
        return null;
    }

    return (
        <p
            id={id}
            role="alert"
            className="mt-1 text-xs font-medium text-danger"
        >
            {message}
        </p>
    );
}

export function PersonnelWorkspaceSection({
    users,
    capabilities,
    embedded = false,
}: PersonnelWorkspaceSectionProps) {
    const canManage = capabilities.manage_users ?? false;
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<number>(
        users[0]?.id ?? 0,
    );
    const [showMobileDetail, setShowMobileDetail] = useState(false);
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
            filteredUsers.find((u) => u.id === selectedUserId) ??
            filteredUsers[0] ??
            null
        );
    }, [filteredUsers, selectedUserId]);

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
    const personnelOverview = useMemo(() => {
        const allCredentials = users.flatMap((user) => user.credentials ?? []);
        const expired = allCredentials.filter(
            (credential) => credential.validity_status === 'expired',
        ).length;
        const expiringSoon = allCredentials.filter(
            (credential) => credential.validity_status === 'expiring_soon',
        ).length;

        return {
            people: users.length,
            credentials: allCredentials.length,
            expired,
            expiringSoon,
        };
    }, [users]);

    return (
        <div className={embedded ? 'space-y-6' : 'space-y-6 p-4 md:p-6'}>
            {!embedded && (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-ink">
                            Personnel Registry &amp; Compliance Credentials
                        </h2>
                        <p className="text-sm text-ink-soft">
                            Maintain driver licenses, heavy equipment operator
                            certifications, and regulatory qualification
                            documents.
                        </p>
                    </div>
                </div>
            )}

            <section
                aria-label="Personnel overview"
                className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-2.5 text-sm"
            >
                <p className="inline-flex items-baseline gap-1.5">
                    <span
                        className="font-semibold text-ink"
                        data-testid="personnel-overview-people"
                    >
                        {personnelOverview.people}
                    </span>
                    <span className="text-ink-soft">people</span>
                </p>
                <span
                    aria-hidden="true"
                    className="hidden h-4 border-l border-line sm:block"
                />
                <p className="inline-flex items-baseline gap-1.5">
                    <span
                        className="font-semibold text-ink"
                        data-testid="personnel-overview-credentials"
                    >
                        {personnelOverview.credentials}
                    </span>
                    <span className="text-ink-soft">credentials on file</span>
                </p>
                <span
                    aria-hidden="true"
                    className="hidden h-4 border-l border-line sm:block"
                />
                <p
                    className="inline-flex flex-wrap items-baseline gap-x-1.5"
                    data-testid="personnel-overview-review"
                >
                    <span className="text-ink-soft">Needs review:</span>
                    <span
                        className={cn(
                            'font-medium',
                            personnelOverview.expired > 0
                                ? 'text-danger'
                                : 'text-ink',
                        )}
                    >
                        {personnelOverview.expired} expired
                    </span>
                    <span aria-hidden="true" className="text-ink-soft">
                        ·
                    </span>
                    <span
                        className={cn(
                            'font-medium',
                            personnelOverview.expiringSoon > 0
                                ? 'text-warning-strong'
                                : 'text-ink',
                        )}
                    >
                        {personnelOverview.expiringSoon} expiring soon
                    </span>
                </p>
            </section>

            <div
                className={cn(
                    'grid gap-4',
                    users.length > 0 &&
                        'lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]',
                )}
            >
                {/* Users List Sidebar */}
                <Panel
                    className={cn(
                        'flex min-w-0 flex-col overflow-hidden p-0',
                        showMobileDetail && 'hidden lg:flex',
                    )}
                >
                    <div className="space-y-3 border-b border-line p-4">
                        <div className="flex items-center justify-between gap-3">
                            <h3
                                id="personnel-directory-heading"
                                className="text-sm font-semibold text-ink"
                            >
                                Directory
                            </h3>
                            <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-soft">
                                {filteredUsers.length === users.length
                                    ? `${users.length} ${users.length === 1 ? 'person' : 'people'}`
                                    : `${filteredUsers.length} of ${users.length}`}
                            </span>
                        </div>
                        <div className="relative">
                            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-ink-soft" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search personnel..."
                                className="min-h-11 w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-10 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus:ring-2 focus:ring-brand-strong/30 focus:outline-none"
                                aria-label="Search personnel"
                            />
                        </div>
                    </div>
                    <div
                        className="max-h-[min(52vh,28rem)] divide-y divide-line overflow-y-auto lg:max-h-[min(65vh,42rem)]"
                        role="list"
                        aria-labelledby="personnel-directory-heading"
                    >
                        {filteredUsers.length === 0 ? (
                            <div className="space-y-3 p-4 text-center">
                                <p className="text-sm font-medium text-ink">
                                    {users.length === 0
                                        ? 'No personnel records yet'
                                        : 'No matching personnel'}
                                </p>
                                <p className="text-xs leading-5 text-ink-soft">
                                    {users.length === 0
                                        ? 'Personnel records will appear here when they are added to the workspace.'
                                        : `No one matches “${searchQuery.trim()}”. Clear your search to see the full directory.`}
                                </p>
                                {users.length > 0 && (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setSearchQuery('')}
                                    >
                                        Clear search
                                    </Button>
                                )}
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
                                    <div key={u.id} role="listitem">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedUserId(u.id);
                                                setShowMobileDetail(true);
                                            }}
                                            aria-pressed={isSelected}
                                            aria-label={`${u.name}, ${u.role_label ?? u.role}, ${u.is_active ? 'active' : 'suspended'}, ${creds.length} ${creds.length === 1 ? 'credential' : 'credentials'}`}
                                            className={cn(
                                                'w-full min-w-0 p-3 text-left transition hover:bg-surface-subtle focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-strong',
                                                'border-l-2 border-transparent',
                                                isSelected &&
                                                    'border-l-brand-strong bg-surface-subtle',
                                            )}
                                        >
                                            <div className="flex min-w-0 items-start justify-between gap-2">
                                                <span className="min-w-0 text-sm font-semibold break-words text-ink">
                                                    {u.name}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                        u.is_active
                                                            ? 'bg-success-soft text-success-strong'
                                                            : 'bg-surface-subtle text-ink-soft',
                                                    )}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className={cn(
                                                            'h-1.5 w-1.5 rounded-full',
                                                            u.is_active
                                                                ? 'bg-success-strong'
                                                                : 'bg-muted',
                                                        )}
                                                    />
                                                    {u.is_active
                                                        ? 'Active'
                                                        : 'Suspended'}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex min-w-0 items-start justify-between gap-2 text-xs text-ink-soft">
                                                <span className="min-w-0 break-words">
                                                    {u.role_label ?? u.role}
                                                </span>
                                                <span className="shrink-0">
                                                    {creds.length}{' '}
                                                    {creds.length === 1
                                                        ? 'credential'
                                                        : 'credentials'}
                                                </span>
                                            </div>
                                            {(hasExpired ||
                                                hasExpiringSoon) && (
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
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Panel>

                {/* Personnel Details and Credentials Main Panel */}
                {selectedUser ? (
                    <div
                        className={cn(
                            'min-w-0 space-y-4',
                            showMobileDetail ? 'block' : 'hidden lg:block',
                        )}
                    >
                        <Button
                            size="sm"
                            variant="secondary"
                            className="lg:hidden"
                            onClick={() => setShowMobileDetail(false)}
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            All personnel
                        </Button>
                        {/* Profile Header */}
                        <Panel className="min-w-0 overflow-hidden p-0">
                            <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xl leading-tight font-semibold break-words text-ink sm:text-2xl">
                                        {selectedUser.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-ink-soft">
                                        {selectedUser.role_label ??
                                            selectedUser.role}
                                    </p>
                                    <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                                        <span className="break-all">
                                            {selectedUser.email}
                                        </span>
                                        {selectedUser.phone && (
                                            <>
                                                <span
                                                    aria-hidden="true"
                                                    className="hidden h-3 border-l border-line sm:block"
                                                />
                                                <span>
                                                    {selectedUser.phone}
                                                </span>
                                            </>
                                        )}
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold',
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
                            {selectedUser.profile && (
                                <dl className="grid min-w-0 grid-cols-1 divide-y divide-line border-t border-line text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                    <div className="min-w-0 px-4 py-3 sm:px-5">
                                        <dt className="text-xs text-ink-soft">
                                            Employee number
                                        </dt>
                                        <dd className="mt-1 font-medium break-words text-ink">
                                            {selectedUser.profile
                                                .employee_number ||
                                                'Not provided'}
                                        </dd>
                                    </div>
                                    <div className="min-w-0 px-4 py-3 sm:px-5">
                                        <dt className="text-xs text-ink-soft">
                                            Availability
                                        </dt>
                                        <dd className="mt-1 font-medium break-words text-ink capitalize">
                                            {selectedUser.profile
                                                .availability_status ||
                                                'Not specified'}
                                        </dd>
                                    </div>
                                    <div className="min-w-0 px-4 py-3 sm:px-5">
                                        <dt className="text-xs text-ink-soft">
                                            Emergency contact
                                        </dt>
                                        <dd className="mt-1 font-medium break-words text-ink">
                                            {selectedUser.profile
                                                .emergency_contact_name
                                                ? `${selectedUser.profile.emergency_contact_name} (${selectedUser.profile.emergency_contact_phone || 'No phone'})`
                                                : 'Not specified'}
                                        </dd>
                                    </div>
                                </dl>
                            )}

                            <section
                                aria-labelledby="personnel-credentials-heading"
                                className="border-t border-line px-4 py-4 sm:px-5"
                            >
                                <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <h4
                                            id="personnel-credentials-heading"
                                            className="font-semibold text-ink"
                                        >
                                            Compliance Credentials
                                        </h4>
                                        <p className="mt-1 text-sm leading-5 text-ink-soft">
                                            Licenses, certifications, and
                                            supporting documents.
                                        </p>
                                    </div>
                                    {canManage && (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() =>
                                                setShowUploadModal(true)
                                            }
                                            data-testid="add-credential-button"
                                            aria-label={`Add compliance credential for ${selectedUser.name}`}
                                            className="shrink-0"
                                        >
                                            <Plus className="mr-1.5 h-4 w-4" />
                                            Add Credential
                                        </Button>
                                    )}
                                </div>

                                {credentials.length === 0 ? (
                                    <div className="flex min-w-0 items-start gap-2.5 pt-4 text-sm">
                                        <FileText
                                            className="mt-0.5 size-4 shrink-0 text-ink-soft"
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0">
                                            <h5 className="font-medium text-ink">
                                                No credentials on file
                                            </h5>
                                            <p className="mt-1 text-ink-soft">
                                                {canManage
                                                    ? 'Add a verified license, operator certification, or safety qualification to this record.'
                                                    : 'No regulatory credentials have been recorded for this person.'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="min-w-0">
                                        {credentials.map((cred) => (
                                            <article
                                                key={cred.id}
                                                className="min-w-0 border-t border-line py-4 first:border-t-0 first:pt-4"
                                                data-testid={`credential-card-${cred.id}`}
                                            >
                                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="min-w-0 text-sm font-semibold break-words text-ink">
                                                                {
                                                                    cred.credential_type
                                                                }
                                                            </span>
                                                            {renderValidityBadge(
                                                                cred,
                                                            )}
                                                        </div>
                                                        <p className="mt-1 text-xs leading-5 break-words text-ink-soft">
                                                            <span className="font-medium text-ink">
                                                                Number:{' '}
                                                            </span>
                                                            <span className="font-mono font-medium break-all text-ink">
                                                                {
                                                                    cred.credential_number
                                                                }
                                                            </span>
                                                            <span className="mx-1.5 text-ink-soft">
                                                                &bull;
                                                            </span>
                                                            <span className="font-medium text-ink">
                                                                Issued by:{' '}
                                                            </span>
                                                            {cred.issuing_authority ||
                                                                'Unknown'}
                                                        </p>
                                                    </div>
                                                    <dl className="grid shrink-0 gap-1 text-xs text-ink-soft sm:text-right">
                                                        <div>
                                                            <dt className="inline font-medium text-ink">
                                                                Issued:{' '}
                                                            </dt>
                                                            <dd className="inline">
                                                                {cred.issued_at
                                                                    ? formatDate(
                                                                          cred.issued_at,
                                                                      )
                                                                    : 'N/A'}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="inline font-medium text-ink">
                                                                Expires:{' '}
                                                            </dt>
                                                            <dd className="inline">
                                                                {cred.expires_at
                                                                    ? formatDate(
                                                                          cred.expires_at,
                                                                      )
                                                                    : 'No expiration date'}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                </div>

                                                {cred.notes && (
                                                    <p className="mt-2 rounded bg-surface-subtle p-2 text-xs leading-5 break-words text-ink-soft">
                                                        {cred.notes}
                                                    </p>
                                                )}

                                                {/* Attachment & Action Footer */}
                                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
                                                    {cred.attachment ? (
                                                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                                                            <FileText className="h-4 w-4 shrink-0 text-brand-strong" />
                                                            <span className="min-w-0 font-medium break-all text-ink">
                                                                {
                                                                    cred
                                                                        .attachment
                                                                        .original_filename
                                                                }
                                                            </span>
                                                            <span>
                                                                (
                                                                {Math.round(
                                                                    cred
                                                                        .attachment
                                                                        .size_bytes /
                                                                        1024,
                                                                )}{' '}
                                                                KB)
                                                            </span>
                                                            <a
                                                                href={
                                                                    cred
                                                                        .attachment
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
                                                        <div className="flex flex-wrap items-center gap-1.5">
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
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </Panel>
                    </div>
                ) : (
                    <Panel>
                        <EmptyState
                            icon={UserIcon}
                            title={
                                users.length === 0
                                    ? 'No personnel to review'
                                    : 'No matching personnel'
                            }
                            message={
                                users.length === 0
                                    ? 'Personnel records will appear here when they are added to the workspace.'
                                    : 'Clear the search to return to the full personnel directory.'
                            }
                            compact
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
                    aria-labelledby="add-credential-title"
                >
                    <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-xl sm:p-6">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3
                                id="add-credential-title"
                                className="font-bold text-ink"
                            >
                                Add Credential for {selectedUser.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowUploadModal(false)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
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
                                <label
                                    htmlFor="credential-kind"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Credential Kind
                                </label>
                                <select
                                    id="credential-kind"
                                    aria-invalid={Boolean(
                                        uploadForm.errors.kind,
                                    )}
                                    aria-describedby={
                                        uploadForm.errors.kind
                                            ? 'credential-kind-error'
                                            : undefined
                                    }
                                    value={uploadForm.data.kind}
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'kind',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                >
                                    {CREDENTIAL_KINDS.map((k) => (
                                        <option key={k.value} value={k.value}>
                                            {k.label}
                                        </option>
                                    ))}
                                </select>
                                <FieldError
                                    id="credential-kind-error"
                                    message={uploadForm.errors.kind}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="credential-type"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Credential Type / Title
                                </label>
                                <input
                                    id="credential-type"
                                    aria-invalid={Boolean(
                                        uploadForm.errors.credential_type,
                                    )}
                                    aria-describedby={
                                        uploadForm.errors.credential_type
                                            ? 'credential-type-error'
                                            : undefined
                                    }
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
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="credential-type-error"
                                    message={uploadForm.errors.credential_type}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="credential-number"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Credential / License Number
                                </label>
                                <input
                                    id="credential-number"
                                    aria-invalid={Boolean(
                                        uploadForm.errors.credential_number,
                                    )}
                                    aria-describedby={
                                        uploadForm.errors.credential_number
                                            ? 'credential-number-error'
                                            : undefined
                                    }
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
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="credential-number-error"
                                    message={
                                        uploadForm.errors.credential_number
                                    }
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="credential-authority"
                                        className="block text-xs font-semibold text-ink"
                                    >
                                        Issuing Authority
                                    </label>
                                    <input
                                        id="credential-authority"
                                        aria-invalid={Boolean(
                                            uploadForm.errors.issuing_authority,
                                        )}
                                        aria-describedby={
                                            uploadForm.errors.issuing_authority
                                                ? 'credential-authority-error'
                                                : undefined
                                        }
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
                                        className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                    />
                                    <FieldError
                                        id="credential-authority-error"
                                        message={
                                            uploadForm.errors.issuing_authority
                                        }
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="credential-issued-at"
                                        className="block text-xs font-semibold text-ink"
                                    >
                                        Issued Date
                                    </label>
                                    <input
                                        id="credential-issued-at"
                                        aria-invalid={Boolean(
                                            uploadForm.errors.issued_at,
                                        )}
                                        aria-describedby={
                                            uploadForm.errors.issued_at
                                                ? 'credential-issued-at-error'
                                                : undefined
                                        }
                                        type="date"
                                        value={uploadForm.data.issued_at}
                                        onChange={(e) =>
                                            uploadForm.setData(
                                                'issued_at',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                    />
                                    <FieldError
                                        id="credential-issued-at-error"
                                        message={uploadForm.errors.issued_at}
                                    />
                                </div>
                            </div>
                            <div>
                                <label
                                    htmlFor="credential-expires-at"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Expiration Date
                                </label>
                                <input
                                    id="credential-expires-at"
                                    aria-invalid={Boolean(
                                        uploadForm.errors.expires_at,
                                    )}
                                    aria-describedby={
                                        uploadForm.errors.expires_at
                                            ? 'credential-expires-at-error'
                                            : undefined
                                    }
                                    type="date"
                                    value={uploadForm.data.expires_at}
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'expires_at',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="credential-expires-at-error"
                                    message={uploadForm.errors.expires_at}
                                />
                                <span className="mt-0.5 block text-[11px] text-ink-soft">
                                    Leave blank if no expiration date is
                                    specified.
                                </span>
                            </div>
                            <div>
                                <label
                                    htmlFor="credential-file"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Attachment File (PDF, PNG, JPEG &le; 10MB)
                                </label>
                                <input
                                    id="credential-file"
                                    aria-invalid={Boolean(
                                        uploadForm.errors.file,
                                    )}
                                    aria-describedby={
                                        uploadForm.errors.file
                                            ? 'credential-file-error'
                                            : undefined
                                    }
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg"
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'file',
                                            e.target.files?.[0] ?? null,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full text-xs text-ink-soft focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none"
                                />
                                <FieldError
                                    id="credential-file-error"
                                    message={uploadForm.errors.file}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="credential-notes"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Operational Notes / Conditions
                                </label>
                                <textarea
                                    id="credential-notes"
                                    aria-invalid={Boolean(
                                        uploadForm.errors.notes,
                                    )}
                                    aria-describedby={
                                        uploadForm.errors.notes
                                            ? 'credential-notes-error'
                                            : undefined
                                    }
                                    value={uploadForm.data.notes}
                                    onChange={(e) =>
                                        uploadForm.setData(
                                            'notes',
                                            e.target.value,
                                        )
                                    }
                                    rows={2}
                                    placeholder="Optional restrictions or endorsement details..."
                                    className="mt-1 min-h-20 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="credential-notes-error"
                                    message={uploadForm.errors.notes}
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
                    aria-labelledby="edit-credential-title"
                >
                    <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-xl sm:p-6">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3
                                id="edit-credential-title"
                                className="font-bold text-ink"
                            >
                                Edit Credential Metadata
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingCred(null)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
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
                                <label
                                    htmlFor="edit-credential-status"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Credential Status
                                </label>
                                <select
                                    id="edit-credential-status"
                                    aria-invalid={Boolean(
                                        editForm.errors.status,
                                    )}
                                    aria-describedby={
                                        editForm.errors.status
                                            ? 'edit-credential-status-error'
                                            : undefined
                                    }
                                    value={editForm.data.status}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'status',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                >
                                    <option value="active">Active</option>
                                    <option value="revoked">Revoked</option>
                                    <option value="superseded">
                                        Superseded
                                    </option>
                                </select>
                                <FieldError
                                    id="edit-credential-status-error"
                                    message={editForm.errors.status}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="edit-credential-type"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Credential Type / Title
                                </label>
                                <input
                                    id="edit-credential-type"
                                    aria-invalid={Boolean(
                                        editForm.errors.credential_type,
                                    )}
                                    aria-describedby={
                                        editForm.errors.credential_type
                                            ? 'edit-credential-type-error'
                                            : undefined
                                    }
                                    type="text"
                                    required
                                    value={editForm.data.credential_type}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'credential_type',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="edit-credential-type-error"
                                    message={editForm.errors.credential_type}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="edit-credential-number"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Credential / License Number
                                </label>
                                <input
                                    id="edit-credential-number"
                                    aria-invalid={Boolean(
                                        editForm.errors.credential_number,
                                    )}
                                    aria-describedby={
                                        editForm.errors.credential_number
                                            ? 'edit-credential-number-error'
                                            : undefined
                                    }
                                    type="text"
                                    required
                                    value={editForm.data.credential_number}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'credential_number',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="edit-credential-number-error"
                                    message={editForm.errors.credential_number}
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="edit-credential-authority"
                                        className="block text-xs font-semibold text-ink"
                                    >
                                        Issuing Authority
                                    </label>
                                    <input
                                        id="edit-credential-authority"
                                        aria-invalid={Boolean(
                                            editForm.errors.issuing_authority,
                                        )}
                                        aria-describedby={
                                            editForm.errors.issuing_authority
                                                ? 'edit-credential-authority-error'
                                                : undefined
                                        }
                                        type="text"
                                        value={editForm.data.issuing_authority}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'issuing_authority',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                    />
                                    <FieldError
                                        id="edit-credential-authority-error"
                                        message={
                                            editForm.errors.issuing_authority
                                        }
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="edit-credential-issued-at"
                                        className="block text-xs font-semibold text-ink"
                                    >
                                        Issued Date
                                    </label>
                                    <input
                                        id="edit-credential-issued-at"
                                        aria-invalid={Boolean(
                                            editForm.errors.issued_at,
                                        )}
                                        aria-describedby={
                                            editForm.errors.issued_at
                                                ? 'edit-credential-issued-at-error'
                                                : undefined
                                        }
                                        type="date"
                                        value={editForm.data.issued_at}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'issued_at',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                    />
                                    <FieldError
                                        id="edit-credential-issued-at-error"
                                        message={editForm.errors.issued_at}
                                    />
                                </div>
                            </div>
                            <div>
                                <label
                                    htmlFor="edit-credential-expires-at"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Expiration Date
                                </label>
                                <input
                                    id="edit-credential-expires-at"
                                    aria-invalid={Boolean(
                                        editForm.errors.expires_at,
                                    )}
                                    aria-describedby={
                                        editForm.errors.expires_at
                                            ? 'edit-credential-expires-at-error'
                                            : undefined
                                    }
                                    type="date"
                                    value={editForm.data.expires_at}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'expires_at',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="edit-credential-expires-at-error"
                                    message={editForm.errors.expires_at}
                                />
                                <span className="mt-0.5 block text-[11px] text-ink-soft">
                                    Leave blank if no expiration date is
                                    specified.
                                </span>
                            </div>
                            <div>
                                <label
                                    htmlFor="edit-credential-notes"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Operational Notes / Conditions
                                </label>
                                <textarea
                                    id="edit-credential-notes"
                                    aria-invalid={Boolean(
                                        editForm.errors.notes,
                                    )}
                                    aria-describedby={
                                        editForm.errors.notes
                                            ? 'edit-credential-notes-error'
                                            : undefined
                                    }
                                    value={editForm.data.notes}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'notes',
                                            e.target.value,
                                        )
                                    }
                                    rows={2}
                                    className="mt-1 min-h-20 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="edit-credential-notes-error"
                                    message={editForm.errors.notes}
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
                    aria-labelledby="replace-credential-title"
                >
                    <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-xl sm:p-6">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3
                                id="replace-credential-title"
                                className="font-bold text-ink"
                            >
                                Replace File Attachment
                            </h3>
                            <button
                                type="button"
                                onClick={() => setReplacingCred(null)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
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
                                <label
                                    htmlFor="replace-credential-file"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    New File (PDF, PNG, JPEG &le; 10MB)
                                </label>
                                <input
                                    id="replace-credential-file"
                                    aria-invalid={Boolean(
                                        replaceForm.errors.file,
                                    )}
                                    aria-describedby={
                                        replaceForm.errors.file
                                            ? 'replace-credential-file-error'
                                            : undefined
                                    }
                                    type="file"
                                    required
                                    accept="application/pdf,image/png,image/jpeg"
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'file',
                                            e.target.files?.[0] ?? null,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full text-xs text-ink-soft focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none"
                                />
                                <FieldError
                                    id="replace-credential-file-error"
                                    message={replaceForm.errors.file}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="replace-credential-expires-at"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    New Expiration Date (if renewed)
                                </label>
                                <input
                                    id="replace-credential-expires-at"
                                    aria-invalid={Boolean(
                                        replaceForm.errors.expires_at,
                                    )}
                                    aria-describedby={
                                        replaceForm.errors.expires_at
                                            ? 'replace-credential-expires-at-error'
                                            : undefined
                                    }
                                    type="date"
                                    value={replaceForm.data.expires_at}
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'expires_at',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="replace-credential-expires-at-error"
                                    message={replaceForm.errors.expires_at}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="replace-credential-notes"
                                    className="block text-xs font-semibold text-ink"
                                >
                                    Replacement Reason / Notes
                                </label>
                                <textarea
                                    id="replace-credential-notes"
                                    aria-invalid={Boolean(
                                        replaceForm.errors.notes,
                                    )}
                                    aria-describedby={
                                        replaceForm.errors.notes
                                            ? 'replace-credential-notes-error'
                                            : undefined
                                    }
                                    value={replaceForm.data.notes}
                                    onChange={(e) =>
                                        replaceForm.setData(
                                            'notes',
                                            e.target.value,
                                        )
                                    }
                                    rows={2}
                                    placeholder="e.g. Renewed license for 2026-2029 cycle."
                                    className="mt-1 min-h-20 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/40 focus-visible:outline-none"
                                />
                                <FieldError
                                    id="replace-credential-notes-error"
                                    message={replaceForm.errors.notes}
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
                    aria-labelledby="credential-preview-title"
                >
                    <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line p-4">
                            <div className="min-w-0">
                                <h4
                                    id="credential-preview-title"
                                    className="font-bold break-words text-ink"
                                >
                                    {previewCred.credential_type}
                                </h4>
                                <p className="text-xs break-all text-ink-soft">
                                    {previewCred.attachment.original_filename}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewCred(null)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
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
                                    alt={previewCred.credential_type}
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
