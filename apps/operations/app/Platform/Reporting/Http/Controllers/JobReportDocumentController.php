<?php

namespace App\Platform\Reporting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Reporting\Pdf\PdfDocumentRenderer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

class JobReportDocumentController extends Controller
{
    public const PACKET_LIMIT = 50;

    public function pdf(Request $request, JobReport $jobReport, PdfDocumentRenderer $renderer, RecordAuditEvent $recordAudit): Response
    {
        Gate::authorize('view', $jobReport);

        $recordAudit->handle(actor: $request->user(), subject: $jobReport, action: 'job_report.pdf_downloaded', after: []);

        return $this->pdfResponse(
            $renderer,
            collect([$jobReport]),
            $jobReport->job->reference.' job report '.$jobReport->id,
            'job-report-'.$jobReport->id.'.pdf',
        );
    }

    /** Multi-report PDF, one report per page, limited to reports the viewer may see. */
    public function packet(Request $request, PdfDocumentRenderer $renderer, RecordAuditEvent $recordAudit): Response
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:'.self::PACKET_LIMIT],
            'ids.*' => ['integer'],
        ]);

        $order = array_flip(array_values(array_unique($validated['ids'])));
        $reports = JobReport::visibleTo($request->user())
            ->whereIn('id', array_keys($order))
            ->get()
            ->filter(fn (JobReport $report) => Gate::allows('view', $report))
            ->sortBy(fn (JobReport $report) => $order[$report->id])
            ->values();

        abort_if($reports->isEmpty(), 404);

        $recordAudit->handle(
            actor: $request->user(),
            subject: $reports->first(),
            action: 'job_report.packet_downloaded',
            after: ['report_ids' => $reports->pluck('id')->all()],
        );

        return $this->pdfResponse(
            $renderer,
            $reports,
            'Job reports packet ('.$reports->count().')',
            'job-reports-packet-'.now()->format('Y-m-d').'.pdf',
        );
    }

    /** @param Collection<int, JobReport> $reports */
    private function pdfResponse(PdfDocumentRenderer $renderer, Collection $reports, string $title, string $filename): Response
    {
        $reports->each->loadMissing(['job', 'author', 'attachments']);

        $pdf = $renderer->render(
            view('reports.job-report-pdf', ['reports' => $reports, 'title' => $title])->render(),
            $title,
        );

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store, private',
        ]);
    }
}
