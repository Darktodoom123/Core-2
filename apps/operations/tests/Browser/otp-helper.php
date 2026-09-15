<?php

declare(strict_types=1);

use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\RateLimiter;

$root = dirname(__DIR__, 2);
$browserDatabase = $root.DIRECTORY_SEPARATOR.'storage'.DIRECTORY_SEPARATOR.'framework'.DIRECTORY_SEPARATOR.'testing'.DIRECTORY_SEPARATOR.'browser.sqlite';

putenv('APP_ENV=testing');
putenv('DB_CONNECTION=sqlite');
putenv('DB_DATABASE='.$browserDatabase);
putenv('CACHE_STORE=array');

require_once $root.DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR.'autoload.php';
$app = require_once $root.DIRECTORY_SEPARATOR.'bootstrap'.DIRECTORY_SEPARATOR.'app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$action = $argv[1] ?? 'get';
$identifier = $argv[2] ?? 'browser.manager';

$user = User::query()
    ->where('username', $identifier)
    ->orWhere('email', $identifier)
    ->first();

if (! $user) {
    fwrite(STDERR, "User '{$identifier}' not found in database.\n");
    exit(1);
}

if ($action === 'reset-user') {
    $user->trustedDevices()->delete();
    EmailOneTimeCode::query()->where('user_id', $user->id)->delete();
    RateLimiter::clear('email-otp-cooldown:'.$user->id.':'.EmailOneTimeCode::PURPOSE_LOGIN);
    RateLimiter::clear('email-otp-send:'.$user->id.':127.0.0.1');
    RateLimiter::clear('email-otp-send:'.$user->id.':unknown');
    RateLimiter::clear('email-otp-verify:'.$user->id.':127.0.0.1');
    RateLimiter::clear('email-otp-verify:'.$user->id.':unknown');
    echo json_encode(['reset' => true], JSON_THROW_ON_ERROR);
    exit(0);
}

if ($action === 'clear-cooldown') {
    RateLimiter::clear('email-otp-cooldown:'.$user->id.':'.EmailOneTimeCode::PURPOSE_LOGIN);
    RateLimiter::clear('email-otp-send:'.$user->id.':127.0.0.1');
    RateLimiter::clear('email-otp-send:'.$user->id.':unknown');
    echo json_encode(['cleared' => true], JSON_THROW_ON_ERROR);
    exit(0);
}

if ($action === 'count-trusted-devices') {
    echo json_encode([
        'count' => $user->trustedDevices()->count(),
        'devices' => $user->trustedDevices()->get(['id', 'device_label', 'platform', 'expires_at']),
    ], JSON_THROW_ON_ERROR);
    exit(0);
}

if ($action === 'get') {
    /** @var EmailOneTimeCode|null $record */
    $record = EmailOneTimeCode::query()
        ->where('user_id', $user->id)
        ->where('purpose', EmailOneTimeCode::PURPOSE_LOGIN)
        ->whereNull('verified_at')
        ->latest('id')
        ->first();

    if (! $record) {
        fwrite(STDERR, "No active OTP record found for user {$identifier}.\n");
        exit(1);
    }

    $appKey = (string) config('app.key');
    $matchedCode = null;

    for ($i = 100000; $i <= 999999; $i++) {
        $candidate = (string) $i;
        if (hash_hmac('sha256', $candidate, $appKey) === $record->code_hash) {
            $matchedCode = $candidate;
            break;
        }
    }

    if ($matchedCode === null) {
        fwrite(STDERR, "Could not match 6-digit code for hash {$record->code_hash}.\n");
        exit(1);
    }

    echo json_encode([
        'code' => $matchedCode,
        'challenge_id' => $record->challenge_id,
        'attempts' => $record->attempts,
        'resend_count' => $record->resend_count,
        'expires_at' => (string) $record->expires_at,
    ], JSON_THROW_ON_ERROR);
    exit(0);
}

fwrite(STDERR, "Unknown action '{$action}'. Use 'get', 'clear-cooldown', 'count-trusted-devices', or 'reset-user'.\n");
exit(1);
