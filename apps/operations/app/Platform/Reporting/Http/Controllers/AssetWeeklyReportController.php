<?php

namespace App\Platform\Reporting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Reporting\AssetWeekly\AssetWeeklyReportBuilder;
use App\Platform\Reporting\AssetWeekly\AssetWeeklyReportCsvWriter;
use App\Platform\Reporting\Pdf\PdfDocumentRenderer;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class AssetWeeklyReportController extends Controller
{
    /** Asset picker options plus, when an asset is chosen, that asset's week. */
    public function show(Request $request, AssetWeeklyReportBuilder $builder): JsonResponse
    {
        $validated = $this->validated($request);
        $actor = $request->user();

        $assets = OperationalAsset::visibleTo($actor)
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'kind'])
            ->map(fn (OperationalAsset $asset) => $asset->only(['id', 'code', 'name', 'kind']))
            ->values();

        $report = null;
        if (isset($validated['asset_id'])) {
            $asset = $this->resolveAsset($request, (int) $validated['asset_id']);
            $report = $builder->build($actor, $asset, AssetWeeklyReportBuilder::weekStart($validated['week'] ?? null));
        }

        return response()->json(['assets' => $assets, 'report' => $report]);
    }

    public function download(
        Request $request,
        OperationalAsset $asset,
        AssetWeeklyReportBuilder $builder,
        AssetWeeklyReportCsvWriter $csvWriter,
        PdfDocumentRenderer $pdfRenderer,
        RecordAuditEvent $recordAudit,
    ): Response {
        $validated = $this->validated($request, requireFormat: true);
        $asset = $this->resolveAsset($request, $asset->id);
        $report = $builder->build($request->user(), $asset, AssetWeeklyReportBuilder::weekStart($validated['week'] ?? null));
        $format = $validated['format'];
        $filename = sprintf('asset-%s-week-%s.%s', Str::slug($asset->code) ?: $asset->id, $report['week']['start'], $format);

        $recordAudit->handle(
            actor: $request->user(),
            subject: $asset,
            action: 'report.asset_weekly.downloaded',
            after: ['format' => $format, 'week_start' => $report['week']['start']],
        );

        if ($format === 'csv') {
            return response($csvWriter->write($report), 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Cache-Control' => 'no-store, private',
            ]);
        }

        $pdf = $pdfRenderer->render(
            view('reports.asset-weekly-pdf', ['report' => $report])->render(),
            $asset->code.' weekly report '.$report['week']['start'],
            landscape: true,
        );

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, bool $requireFormat = false): array
    {
        abort_unless(AssetWeeklyReportBuilder::canView($request->user()), 403);

        return $request->validate([
            'asset_id' => ['sometimes', 'nullable', 'integer'],
            'week' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'format' => [$requireFormat ? 'required' : 'sometimes', 'string', 'in:pdf,csv'],
        ]);
    }

    private function resolveAsset(Request $request, int $assetId): OperationalAsset
    {
        // 404 rather than 403 so hidden assets are indistinguishable from missing ones.
        return OperationalAsset::visibleTo($request->user())->findOrFail($assetId);
    }
}
