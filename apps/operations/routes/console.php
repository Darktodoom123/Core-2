<?php

use App\Platform\Attachments\Jobs\PruneExpiredAttachmentsJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Services\PushNotificationService;
use App\Platform\Reporting\Jobs\PruneExpiredExportsJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('gpt:queue-status', function (): void {
    $counts = GptRecommendation::query()
        ->selectRaw('status, count(*) as count')
        ->groupBy('status')
        ->pluck('count', 'status')
        ->map(static fn (mixed $count): int => (int) $count)
        ->all();

    $this->line(json_encode([
        'pending' => (int) ($counts['draft'] ?? 0) + (int) ($counts['processing'] ?? 0),
        'pending_review' => (int) ($counts['pending_review'] ?? 0),
        'failed' => (int) ($counts['failed'] ?? 0),
        'accepted' => (int) ($counts['accepted'] ?? 0),
        'rejected' => (int) ($counts['rejected'] ?? 0),
        'last_metric_at' => GptRecommendationMetric::query()->max('occurred_at'),
    ], JSON_THROW_ON_ERROR));
})->purpose('Report safe aggregate GPT queue status without exposing recommendation context');

Artisan::command('reports:prune-expired', function (): void {
    $this->info('Pruning expired report export files...');
    PruneExpiredExportsJob::dispatchSync();
    $this->info('Expired report exports pruned successfully.');
})->purpose('Purge expired report export files from protected storage');

Artisan::command('attachments:prune-expired', function (): void {
    $this->info('Pruning expired attachments exceeding statutory retention...');
    PruneExpiredAttachmentsJob::dispatchSync();
    $this->info('Expired attachments pruned successfully.');
})->purpose('Purge attachments that have reached end-of-retention (statutory 7 years)');

Artisan::command('push:process-receipts', function (PushNotificationService $pushService): int {
    $this->info('Processing pending push delivery receipts...');
    $result = $pushService->processPendingReceipts(100);
    $this->line("Receipts checked: {$result['checked']}, Delivered: {$result['delivered']}, Failed: {$result['failed']}, Deactivated: {$result['deactivated']}");
    $pruned = $pushService->pruneOldDeliveries(30);
    if ($pruned > 0) {
        $this->line("Pruned {$pruned} expired push deliveries.");
    }
    $this->info('Push receipt reconciliation complete.');

    return 0;
})->purpose('Reconcile pending push notification receipts and prune old delivery records');

Artisan::command('user:recover-admin {identifier? : Username or email of the administrator} {--password= : Set a new password} {--reset-factors : Reset trusted devices and active verification challenges}', function (): int {
    $identifier = $this->argument('identifier');
    if (! $identifier) {
        $identifier = $this->ask('Enter administrator username or email');
    }

    /** @var User|null $user */
    $user = User::query()
        ->where('username', $identifier)
        ->orWhere('email', $identifier)
        ->first();

    if (! $user) {
        $this->error("User '{$identifier}' not found.");

        return 1;
    }

    $adminRole = RoleName::SystemAdministrator->value;
    if (! $user->hasRole($adminRole)) {
        $this->warn("User '{$identifier}' does not have the System Administrator role.");
        if (! $this->confirm('Promote this user to System Administrator?')) {
            return 1;
        }
        $user->assignRole($adminRole);
    }

    // Ensure account is active and verified
    $user->is_active = true;
    $user->suspended_at = null;
    if (! $user->email_verified_at) {
        $user->email_verified_at = Carbon::now();
    }

    $newPassword = $this->option('password');
    if (is_string($newPassword) && $newPassword !== '') {
        $user->password = Hash::make($newPassword);
        $this->info('Password updated successfully.');
    }

    $user->save();

    // Revoke trusted devices, active sessions, and bearer tokens
    if ($this->option('reset-factors') || $newPassword) {
        $user->trustedDevices()->delete();
        $user->tokens()->delete();
        DB::table('sessions')->where('user_id', $user->id)->delete();
        EmailOneTimeCode::where('user_id', $user->id)->delete();
        $this->info("All trusted devices, sessions, API tokens, and OTP codes revoked for {$user->username}.");
    }

    $this->info("Administrator account '{$user->username}' recovered successfully.");

    return 0;
})->purpose('Emergency break-glass recovery for System Administrator accounts');

Artisan::command('mail:check-transport {recipient? : Optional email address to send a verification probe to}', function (): int {
    $this->info('Inspecting mail transport configuration...');
    $default = (string) config('mail.default', 'log');
    $this->line("Default mailer: <comment>{$default}</comment>");

    /** @var array<string, mixed> $config */
    $config = (array) config("mail.mailers.{$default}", []);
    $transportType = (string) ($config['transport'] ?? 'unknown');
    $this->line("Transport driver: <comment>{$transportType}</comment>");

    if ($transportType === 'smtp') {
        $host = (string) ($config['host'] ?? '127.0.0.1');
        $port = (string) ($config['port'] ?? '2525');
        $username = ! empty($config['username']) ? (substr((string) $config['username'], 0, 4).'***') : 'none';
        $this->line("SMTP Relay: <comment>{$host}:{$port}</comment>");
        $this->line("SMTP Username: <comment>{$username}</comment>");
    }

    $from = (string) config('mail.from.address', 'hello@example.com');
    $fromName = (string) config('mail.from.name', 'Core-2');
    $this->line("Sender envelope: <comment>{$fromName} <{$from}></comment>");

    $this->info('Testing transport connection & authentication...');
    try {
        $transport = app('mailer')->getSymfonyTransport();
        if (method_exists($transport, 'start')) {
            $transport->start();
        }
        $this->info('Transport connection & authentication: SUCCESS');
    } catch (Throwable $e) {
        $this->error('Transport connection failed: '.$e->getMessage());

        return 1;
    }

    $recipient = $this->argument('recipient');
    if (is_string($recipient) && $recipient !== '') {
        $this->info("Sending probe verification email to '{$recipient}'...");
        try {
            Mail::raw('Core-2 mail transport verification probe. All systems operational.', function ($message) use ($recipient): void {
                $message->to($recipient)
                    ->subject('Core-2 Mail Transport Verification Probe');
            });
            $this->info("Probe email delivered successfully to {$recipient}.");
        } catch (Throwable $e) {
            $this->error('Probe email delivery failed: '.$e->getMessage());

            return 1;
        }
    }

    return 0;
})->purpose('Inspect and verify mail transport readiness and optionally send a delivery probe');
