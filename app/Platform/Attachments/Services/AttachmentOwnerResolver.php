<?php

namespace App\Platform\Attachments\Services;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Reporting\Models\JobReport;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;

final class AttachmentOwnerResolver
{
    /** @var array<string, class-string<Model>> */
    private const TYPES = [
        'job_report' => JobReport::class,
        'JobReport' => JobReport::class,
        'job_reports' => JobReport::class,
        'dispatch_job' => DispatchJob::class,
        'DispatchJob' => DispatchJob::class,
        'dispatch_jobs' => DispatchJob::class,
        'operational_asset' => OperationalAsset::class,
        'OperationalAsset' => OperationalAsset::class,
        'operational_assets' => OperationalAsset::class,
        'fuel_request' => FuelRequest::class,
        'FuelRequest' => FuelRequest::class,
        'fuel_requests' => FuelRequest::class,
    ];

    /** @return list<string> */
    public static function acceptedTypes(): array
    {
        return array_keys(self::TYPES);
    }

    /** @return class-string<Model>|null */
    public static function classFor(string $type): ?string
    {
        return self::TYPES[$type] ?? null;
    }

    public function resolve(string $type, int $id): Model
    {
        $modelClass = self::classFor($type);

        if ($modelClass === null) {
            throw (new ModelNotFoundException)->setModel(Model::class, [$id]);
        }

        return $modelClass::query()->findOrFail($id);
    }
}
