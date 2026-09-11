<?php

namespace App\Modules\Sales\Data;

use Illuminate\Validation\ValidationException;

final readonly class SalesOrderReference
{
    private const PREFIX = 'SO-';

    private const MAX_LENGTH = 64;

    private function __construct(public string $value) {}

    public static function fromQuoteReference(string $quoteReference): self
    {
        $value = self::PREFIX.$quoteReference;

        if (mb_strlen($value) > self::MAX_LENGTH) {
            throw ValidationException::withMessages([
                'reference' => 'The derived sales order reference exceeds the maximum supported length.',
            ]);
        }

        return new self($value);
    }
}
