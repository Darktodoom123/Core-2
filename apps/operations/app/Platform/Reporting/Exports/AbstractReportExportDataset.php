<?php

namespace App\Platform\Reporting\Exports;

use Illuminate\Database\Eloquent\Builder;

abstract class AbstractReportExportDataset implements ReportExportDataset
{
    /** @param array<string, mixed> $filters
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    protected function applyDateFilters(Builder $query, array $filters, string $column = 'created_at'): Builder
    {
        if (is_string($filters['date_from'] ?? null)) {
            $query->whereDate($column, '>=', $filters['date_from']);
        }
        if (is_string($filters['date_to'] ?? null)) {
            $query->whereDate($column, '<=', $filters['date_to']);
        }

        return $query;
    }
}
