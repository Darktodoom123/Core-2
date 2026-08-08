<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use Generator;

interface ReportExportDataset
{
    public function type(): ReportExportType;

    public function authorize(User $actor): bool;

    /** @return list<string> */
    public function headers(): array;

    /** @param array<string, mixed> $filters
     * @return Generator<int, list<string|int|float|null>>
     */
    public function rows(User $actor, array $filters): Generator;
}
