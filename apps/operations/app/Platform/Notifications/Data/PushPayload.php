<?php

namespace App\Platform\Notifications\Data;

final class PushPayload
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public readonly string $title,
        public readonly string $body,
        public readonly array $data = [],
        public readonly string $channelId = 'dispatch-urgent',
        public readonly string $priority = 'high',
        public readonly string $sound = 'default',
        public readonly int $ttl = 86400,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toExpoMessage(string $pushToken): array
    {
        return [
            'to' => $pushToken,
            'title' => $this->title,
            'body' => $this->body,
            'data' => $this->data,
            'sound' => $this->sound,
            'priority' => $this->priority,
            'channelId' => $this->channelId,
            'ttl' => $this->ttl,
        ];
    }
}
