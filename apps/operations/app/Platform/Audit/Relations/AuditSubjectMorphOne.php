<?php

namespace App\Platform\Audit\Relations;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphOne;

/**
 * Morph-one relation for audit_events, whose subject_id column is VARCHAR so it
 * can reference both integer and UUID subjects. PostgreSQL has no
 * `varchar = integer` operator, so parent keys must be bound as strings instead
 * of Laravel's default raw integer IN list.
 *
 * @template TRelatedModel of Model
 * @template TDeclaringModel of Model
 *
 * @extends MorphOne<TRelatedModel, TDeclaringModel>
 */
class AuditSubjectMorphOne extends MorphOne
{
    public function getParentKey(): mixed
    {
        $key = parent::getParentKey();

        return $key === null ? null : (string) $key;
    }

    /**
     * @param  array<int, TDeclaringModel>  $models
     * @param  string|null  $key
     * @return array<int, string>
     */
    protected function getKeys(array $models, $key = null): array
    {
        return array_map(
            static fn (mixed $value): string => (string) $value,
            parent::getKeys($models, $key),
        );
    }

    /**
     * @param  string  $key
     */
    protected function whereInMethod(Model $model, $key): string
    {
        return 'whereIn';
    }
}
