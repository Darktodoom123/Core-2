<?php

namespace App\Modules\Dispatch\Enums;

enum DelayContext: string
{
    case Transit = 'transit';
    case OnSite = 'on_site';

    public function label(): string
    {
        return match ($this) {
            self::Transit => 'Transit Delay',
            self::OnSite => 'On-Site Delay',
        };
    }
}
