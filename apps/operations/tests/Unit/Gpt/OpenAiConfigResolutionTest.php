<?php

use App\Platform\Gpt\Services\OpenAiClientWrapper;
use Tests\TestCase;

uses(TestCase::class);

it('uses OpenRouter base URL and provider model when OpenRouter key is configured', function (): void {
    config([
        'services.openai.key' => 'sk-or-v1-test-openrouter-key',
        'services.openai.provider_model' => 'openai/gpt-5-mini',
        'services.openai.base_url' => 'https://openrouter.ai/api/v1',
    ]);

    $client = new OpenAiClientWrapper;

    expect($client->getApiKey())->toBe('sk-or-v1-test-openrouter-key')
        ->and($client->getModel())->toBe('openai/gpt-5-mini')
        ->and($client->getBaseUrl())->toBe('https://openrouter.ai/api/v1');
});

it('uses OpenAI base URL and model when OpenAI key is configured and OpenRouter key is empty', function (): void {
    config([
        'services.openai.key' => 'sk-proj-test-openai-key',
        'services.openai.provider_model' => 'gpt-5-mini',
        'services.openai.base_url' => 'https://api.openai.com/v1',
    ]);

    $client = new OpenAiClientWrapper;

    expect($client->getApiKey())->toBe('sk-proj-test-openai-key')
        ->and($client->getModel())->toBe('gpt-5-mini')
        ->and($client->getBaseUrl())->toBe('https://api.openai.com/v1');
});

it('allows OpenAiClientWrapper constructor overrides', function (): void {
    config([
        'services.openai.key' => 'default-key',
        'services.openai.provider_model' => 'default-model',
        'services.openai.base_url' => 'https://default.url/v1',
    ]);

    $client = new OpenAiClientWrapper(
        apiKey: 'custom-key',
        model: 'custom-model',
        baseUrl: 'https://custom.api.com/v1'
    );

    expect($client->getApiKey())->toBe('custom-key')
        ->and($client->getModel())->toBe('custom-model')
        ->and($client->getBaseUrl())->toBe('https://custom.api.com/v1');
});

it('evaluates services.openai config correctly based on active provider environment variables', function (): void {
    $setEnv = function (string $key, ?string $value): void {
        if ($value === null || $value === '') {
            putenv($key.'=');
            unset($_ENV[$key], $_SERVER[$key]);
        } else {
            putenv($key.'='.$value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    };

    $setEnv('OPENROUTER_API_KEY', null);
    $setEnv('OPENAI_API_KEY', 'sk-proj-my-openai-key');
    $setEnv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
    $setEnv('OPENAI_BASE_URL', null);

    $servicesConfig = require config_path('services.php');
    $openaiConfig = $servicesConfig['openai'];

    expect($openaiConfig['key'])->toBe('sk-proj-my-openai-key')
        ->and($openaiConfig['base_url'])->toBe('https://api.openai.com/v1')
        ->and($openaiConfig['provider_model'])->toBe('gpt-5-mini');

    $setEnv('OPENROUTER_API_KEY', 'sk-or-v1-my-openrouter-key');
    $setEnv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');

    $servicesConfig = require config_path('services.php');
    $openaiConfig = $servicesConfig['openai'];

    expect($openaiConfig['key'])->toBe('sk-or-v1-my-openrouter-key')
        ->and($openaiConfig['base_url'])->toBe('https://openrouter.ai/api/v1')
        ->and($openaiConfig['provider_model'])->toBe('openai/gpt-5-mini');

    $setEnv('OPENROUTER_API_KEY', null);
    $setEnv('OPENAI_API_KEY', null);
});
