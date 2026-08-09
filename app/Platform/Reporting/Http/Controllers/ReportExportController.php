<?php

namespace App\Platform\Reporting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Reporting\Actions\CreateReportExportAction;
use App\Platform\Reporting\Actions\RetryReportExportAction;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Http\Requests\StoreReportExportRequest;
use App\Platform\Reporting\Models\ReportExport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportController extends Controller
{
    public function store(StoreReportExportRequest $request, CreateReportExportAction $createAction): RedirectResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        $type = ReportExportType::from($validated['export_type']);
        $format = $validated['format'];

        $filters = array_filter([
            'date_from' => $validated['date_from'] ?? null,
            'date_to' => $validated['date_to'] ?? null,
        ]);

        $createAction->execute($user, $type, $format, $filters);

        return back()->with('flash', [
            'type' => 'success',
            'message' => 'Export task requested. Your file is generating in the background.',
        ]);
    }

    public function download(Request $request, ReportExport $export, RecordAuditEvent $recordAudit): StreamedResponse|RedirectResponse
    {
        Gate::authorize('download', $export);

        if (! $export->file_path || ! Storage::disk('private')->exists($export->file_path)) {
            return back()->with('flash', [
                'type' => 'error',
                'message' => 'The requested export file is no longer available or has expired.',
            ]);
        }

        $recordAudit->handle(
            actor: $request->user(),
            subject: $export,
            action: 'report_export.downloaded',
            after: [
                'file_path' => $export->file_path,
                'file_size_bytes' => $export->file_size_bytes,
            ]
        );

        $filename = basename($export->file_path);

        return Storage::disk('private')->download($export->file_path, $filename, [
            'Content-Type' => $export->format === 'pdf' ? 'application/pdf' : 'text/csv; charset=UTF-8',
        ]);
    }

    public function retry(Request $request, ReportExport $export, RetryReportExportAction $retryAction): RedirectResponse
    {
        Gate::authorize('retry', $export);

        $result = $retryAction->execute($request->user(), $export);

        return back()->with('flash', [
            'type' => 'success',
            'message' => $result['queued']
                ? 'Export task retried and queued for generation.'
                : 'Export task is already queued for generation.',
        ]);
    }
}
