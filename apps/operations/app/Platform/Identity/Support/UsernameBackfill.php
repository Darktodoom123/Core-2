<?php

namespace App\Platform\Identity\Support;

use Illuminate\Support\Facades\DB;

final class UsernameBackfill
{
    /**
     * @param  iterable<array{id: int, email: string}>  $users
     * @param  array<string, true>  $used
     * @return array<int, string>
     */
    public static function assignments(iterable $users, array &$used = []): array
    {
        $assignments = [];

        foreach ($users as $user) {
            $assignments[$user['id']] = Username::fromEmailWithCollision(
                $user['email'],
                $user['id'],
                $used,
            );
        }

        return $assignments;
    }

    public static function run(): void
    {
        /** @var array<string, true> $used */
        $used = DB::table('users')
            ->whereNotNull('username')
            ->pluck('username')
            ->mapWithKeys(static fn (mixed $username): array => [(string) $username => true])
            ->all();

        DB::table('users')
            ->whereNull('username')
            ->orderBy('id')
            ->chunkById(500, function ($users) use (&$used): void {
                $rows = $users->map(static fn (object $user): array => [
                    'id' => (int) $user->id,
                    'email' => (string) $user->email,
                ])->all();

                foreach (self::assignments($rows, $used) as $id => $username) {
                    DB::table('users')->where('id', $id)->update(['username' => $username]);
                }
            });
    }
}
