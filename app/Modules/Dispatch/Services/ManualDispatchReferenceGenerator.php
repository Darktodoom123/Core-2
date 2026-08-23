<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Support\Facades\DB;
use LogicException;

final class ManualDispatchReferenceGenerator
{
    public function generate(): string
    {
        $timestamp = now();
        $year = $timestamp->year;

        DB::table('dispatch_reference_sequences')->insertOrIgnore([
            'reference_year' => $year,
            'next_number' => 1,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);

        $sequence = DB::table('dispatch_reference_sequences')
            ->where('reference_year', $year)
            ->lockForUpdate()
            ->first();

        if ($sequence === null) {
            throw new LogicException('The manual dispatch reference sequence could not be initialized.');
        }

        $number = (int) $sequence->next_number;

        do {
            $reference = sprintf('DSP-MAN-%d-%03d', $year, $number);
            $number++;
        } while (DispatchJob::query()->withTrashed()->where('reference', $reference)->exists());

        DB::table('dispatch_reference_sequences')
            ->where('reference_year', $year)
            ->update([
                'next_number' => $number,
                'updated_at' => $timestamp,
            ]);

        return $reference;
    }
}
