<?php

namespace App\Platform\Reporting\Pdf;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;
use Mpdf\Mpdf;
use Mpdf\Output\Destination;

/**
 * Renders server-authored HTML (Blade views with escaped output) to PDF bytes
 * for on-demand report downloads. Each call gets its own mPDF temp directory
 * so concurrent requests never share a font cache.
 */
final class PdfDocumentRenderer
{
    public function render(string $html, string $title, bool $landscape = false): string
    {
        $tempDir = storage_path('app/temp/mpdf/'.Str::uuid()->toString());
        File::ensureDirectoryExists($tempDir, 0700, true);

        try {
            $defaultConfig = (new ConfigVariables)->getDefaults();
            $fontConfig = (new FontVariables)->getDefaults();

            $pdf = new Mpdf([
                'mode' => 'utf-8',
                'format' => $landscape ? 'A4-L' : 'A4',
                'tempDir' => $tempDir,
                'fontDir' => $defaultConfig['fontDir'],
                'fontdata' => $fontConfig['fontdata'],
                'default_font' => 'dejavusanscondensed',
                'margin_left' => 12,
                'margin_right' => 12,
                'margin_top' => 14,
                'margin_bottom' => 16,
            ]);
            $pdf->SetTitle($title);
            $pdf->SetFooter('{PAGENO} / {nbpg}');
            $pdf->WriteHTML($html);

            return $pdf->Output('', Destination::STRING_RETURN);
        } finally {
            File::deleteDirectory($tempDir);
        }
    }
}
