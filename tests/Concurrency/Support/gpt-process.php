<?php

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Actions\AcceptGptRecommendation;
use App\Platform\Gpt\Actions\GenerateGptRecommendation;
use App\Platform\Gpt\Actions\RejectGptRecommendation;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 3).'/vendor/autoload.php';

[$mode, $actorId, $recommendationId, $barrier] = array_pad(array_slice($argv, 1), 4, null);
$barrier = getenv('CORE2_GPT_BARRIER') ?: $barrier;

function traceConcurrentGptWorker(string $phase): void
{
    $tracePath = getenv('CORE2_GPT_TRACE_PATH');
    if (is_string($tracePath) && $tracePath !== '') {
        file_put_contents($tracePath, $phase."\n", FILE_APPEND);
    }
}

function reportConcurrentGptWorkerResult(array $result): void
{
    $payload = json_encode($result, JSON_THROW_ON_ERROR);
    $resultPath = getenv('CORE2_GPT_RESULT_PATH');

    if (is_string($resultPath) && $resultPath !== '') {
        file_put_contents($resultPath, $payload);

        return;
    }

    fwrite(STDOUT, $payload);
}

traceConcurrentGptWorker('autoloaded');
$app = require dirname(__DIR__, 3).'/bootstrap/app.php';
traceConcurrentGptWorker('application-created');
$app->make(Kernel::class)->bootstrap();
traceConcurrentGptWorker('application-bootstrapped');

try {
    $actor = User::query()->findOrFail((int) $actorId);
    traceConcurrentGptWorker('actor-loaded');

    if (in_array($mode, ['accept', 'reject'], true)) {
        DB::statement("set lock_timeout = '15s'");
    }

    if (in_array($mode, ['accept', 'reject'], true) && is_string($barrier)) {
        touch($barrier.'.ready.'.getmypid());
        traceConcurrentGptWorker('barrier-ready');
        $deadline = microtime(true) + 10;
        while (! file_exists($barrier.'.go') && microtime(true) < $deadline) {
            usleep(10_000);
        }
    }

    if ($mode === 'accept') {
        traceConcurrentGptWorker('accept-started');
        $recommendation = GptRecommendation::query()->findOrFail((int) $recommendationId);
        $app->make(AcceptGptRecommendation::class)->handle($actor, $recommendation);
    } elseif ($mode === 'reject') {
        traceConcurrentGptWorker('reject-started');
        $recommendation = GptRecommendation::query()->findOrFail((int) $recommendationId);
        $app->make(RejectGptRecommendation::class)->handle($actor, $recommendation, 'Concurrent decision');
    } elseif ($mode === 'complete_after_barrier') {
        OpenAiClientWrapper::fake(static function () use ($barrier): array {
            if (is_string($barrier)) {
                touch($barrier.'.ready');
                $deadline = microtime(true) + 10;
                while (! file_exists($barrier.'.go') && microtime(true) < $deadline) {
                    usleep(10_000);
                }
            }

            return [
                'summary' => 'Late completion',
                'proposed_personnel' => [],
                'proposed_assets' => [],
                'reasons' => [],
                'assumptions' => [],
                'conflicts' => [],
            ];
        });

        (new GenerateGptRecommendationJob((int) $recommendationId, ['job' => ['id' => 1]]))->handle(
            $app->make(OpenAiClientWrapper::class),
            $app->make(RecordAuditEvent::class),
        );
    } elseif ($mode === 'fail_after_barrier') {
        GptRecommendation::query()->whereKey((int) $recommendationId)->update(['status' => 'processing']);
        if (is_string($barrier)) {
            touch($barrier.'.ready');
            $deadline = microtime(true) + 10;
            while (! file_exists($barrier.'.go') && microtime(true) < $deadline) {
                usleep(10_000);
            }
        }
        (new GenerateGptRecommendationJob((int) $recommendationId, []))->failed(new RuntimeException('Late worker failure'));
    } elseif ($mode === 'generate') {
        if (is_string($barrier)) {
            touch($barrier.'.ready.'.getmypid());
            $deadline = microtime(true) + 10;
            while (! file_exists($barrier.'.go') && microtime(true) < $deadline) {
                usleep(10_000);
            }
        }
        $job = DispatchJob::query()->findOrFail((int) $recommendationId);
        $app->make(GenerateGptRecommendation::class)->handle($actor, $job);
    } else {
        throw new InvalidArgumentException('Unsupported concurrent GPT process mode.');
    }

    reportConcurrentGptWorkerResult(['ok' => true]);
    exit(0);
} catch (Throwable $exception) {
    reportConcurrentGptWorkerResult(['ok' => false, 'exception' => $exception::class]);
    exit(1);
}
