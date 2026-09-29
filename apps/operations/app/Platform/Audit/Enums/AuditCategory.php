<?php

namespace App\Platform\Audit\Enums;

/**
 * Groups recorded audit actions by the domain prefix they are written with
 * (for example `user.login` or `dispatch.created`). Overrides cut across
 * domains, so one event can belong to a domain and to Overrides.
 */
enum AuditCategory: string
{
    case Access = 'access';
    case Dispatch = 'dispatch';
    case Fleet = 'fleet';
    case Safety = 'safety';
    case Reports = 'reports';
    case Gpt = 'gpt';
    case Overrides = 'overrides';

    /** @return list<string> SQL LIKE patterns matched against the action. */
    public function patterns(): array
    {
        return match ($this) {
            self::Access => ['user.%', 'personnel.%', 'account.%', 'auth.%'],
            self::Dispatch => ['dispatch.%', 'dispatch\_job%', 'project\_%', 'service\_request.%', 'client.%', 'rental\_%', 'approval.%'],
            self::Fleet => ['asset.%', 'maintenance.%', 'fuel.%', 'hos.%', 'dvir.%', 'equipment.%', 'unit\_link.%'],
            self::Safety => ['safety.%'],
            self::Reports => ['job\_report.%', 'report.%', 'report\_export%', 'attachment.%'],
            self::Gpt => ['gpt.%'],
            self::Overrides => ['%emergency\_abort%', '%safety\_lockdown%', '%override%'],
        };
    }

    /**
     * A parenthesised OR of LIKE clauses with its bindings.
     *
     * @return array{0: literal-string, 1: list<string>}
     */
    public function sql(): array
    {
        $patterns = $this->patterns();
        $clause = '';

        foreach (array_keys($patterns) as $index) {
            $clause .= ($index === 0 ? '' : ' OR ')."action LIKE ? ESCAPE '\\'";
        }

        return ['('.$clause.')', $patterns];
    }
}
