<?php

declare(strict_types=1);

use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Models\Notification;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

$root = dirname(__DIR__, 2);
$testingDirectory = $root.DIRECTORY_SEPARATOR.'storage'.DIRECTORY_SEPARATOR.'framework'.DIRECTORY_SEPARATOR.'testing';
$defaultDatabase = $testingDirectory.DIRECTORY_SEPARATOR.'browser.sqlite';
$databaseOverride = getenv('CORE2_E2E_DB_DATABASE');
$browserDatabase = is_string($databaseOverride) && trim($databaseOverride) !== ''
    ? $databaseOverride
    : $defaultDatabase;

if ($browserDatabase !== $defaultDatabase) {
    $resolvedTestingDirectory = realpath($testingDirectory);
    $resolvedDatabase = realpath($browserDatabase);
    $testingPrefix = $resolvedTestingDirectory === false
        ? ''
        : $resolvedTestingDirectory.DIRECTORY_SEPARATOR;

    if (
        $resolvedTestingDirectory === false
        || $resolvedDatabase === false
        || ! str_starts_with($resolvedDatabase, $testingPrefix)
        || strtolower(pathinfo($resolvedDatabase, PATHINFO_EXTENSION)) !== 'sqlite'
    ) {
        fwrite(STDERR, "The notification fixture only accepts SQLite fixtures inside storage/framework/testing.\n");
        exit(1);
    }

    $browserDatabase = $resolvedDatabase;
}

putenv('APP_ENV=testing');
putenv('DB_CONNECTION=sqlite');
putenv('DB_DATABASE='.$browserDatabase);
putenv('CACHE_STORE=array');
putenv('BROADCAST_CONNECTION=null');
putenv('BROADCAST_DRIVER=null');

$_ENV['BROADCAST_CONNECTION'] = 'null';
$_SERVER['BROADCAST_CONNECTION'] = 'null';

require_once $root.DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR.'autoload.php';
$app = require_once $root.DIRECTORY_SEPARATOR.'bootstrap'.DIRECTORY_SEPARATOR.'app.php';
$app->make(Kernel::class)->bootstrap();
$app['config']->set('broadcasting.default', 'null');
$app['config']->set('broadcasting.connections.null', ['driver' => 'null']);
Event::fake([WorkspaceUpdated::class]);

$action = $argv[1] ?? 'seed';
$identifier = $argv[2] ?? 'browser.manager';
$category = $argv[3] ?? 'dispatch';
$fixtureId = $argv[4] ?? 'notification-center';

$user = User::query()
    ->where('username', $identifier)
    ->orWhere('email', $identifier)
    ->first();

if (! $user) {
    fwrite(STDERR, "User '{$identifier}' not found in database.\n");
    exit(1);
}

$fixtures = Notification::query()
    ->where('notifiable_type', $user->getMorphClass())
    ->where('notifiable_id', $user->id)
    ->where('type', 'browser.notification-center.e2e')
    ->where('data->browser_fixture_id', $fixtureId);

if ($action === 'cleanup') {
    $fixtures->delete();
    echo json_encode(['cleaned' => true], JSON_THROW_ON_ERROR);
    exit(0);
}

if ($action === 'seed-history') {
    $count = filter_var($argv[5] ?? 125, FILTER_VALIDATE_INT);

    if ($category !== 'system' || $count === false || $count < 101 || $count > 150) {
        fwrite(STDERR, "History fixtures must seed between 101 and 150 system notifications.\n");
        exit(1);
    }

    $fixtures->delete();
    $now = now();

    for ($index = 1; $index <= $count; $index++) {
        $notification = Notification::query()->create([
            'type' => 'browser.notification-center.e2e',
            'notifiable_type' => $user->getMorphClass(),
            'notifiable_id' => $user->id,
            'status' => 'unread',
            'data' => [
                'browser_fixture_id' => $fixtureId,
                'category' => 'system',
                'event' => 'system.updated',
                'message' => "E2E system history item {$fixtureId} {$index}",
            ],
        ]);

        DB::table('notifications')
            ->where('id', $notification->getKey())
            ->update(['created_at' => $now->copy()->subSeconds($index)]);
    }

    echo json_encode([
        'count' => $count,
        'oldest_message' => "E2E system history item {$fixtureId} {$count}",
    ], JSON_THROW_ON_ERROR);
    exit(0);
}

if (! in_array($category, ['dispatch', 'safety', 'fuel', 'system'], true)) {
    fwrite(STDERR, "Unsupported notification category '{$category}'.\n");
    exit(1);
}

$fixtures->delete();
$event = match ($category) {
    'dispatch' => 'dispatch.assigned',
    'safety' => 'inspection.failed',
    'fuel' => 'fuel.request_updated',
    default => 'system.updated',
};
$notification = Notification::query()->create([
    'type' => 'browser.notification-center.e2e',
    'notifiable_type' => $user->getMorphClass(),
    'notifiable_id' => $user->id,
    'status' => 'unread',
    'data' => [
        'browser_fixture_id' => $fixtureId,
        'category' => $category,
        'event' => $event,
        'message' => "E2E {$category} notification {$fixtureId}",
    ],
]);

echo json_encode(['id' => (string) $notification->getKey()], JSON_THROW_ON_ERROR);
