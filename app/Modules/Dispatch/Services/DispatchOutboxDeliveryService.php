<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Contracts\DispatchOutboxDeliveryHandler;
use App\Modules\Dispatch\Events\DispatchOutboxMessageDelivered;
use App\Modules\Dispatch\Models\DispatchOutboxMessage;
use Illuminate\Support\Facades\DB;

final class DispatchOutboxDeliveryService
{
    public function __construct(private readonly DispatchOutboxDeliveryHandler $handler) {}

    public function deliver(int $messageId): DispatchOutboxMessage
    {
        $message = DB::transaction(function () use ($messageId): DispatchOutboxMessage {
            $message = DispatchOutboxMessage::query()->lockForUpdate()->findOrFail($messageId);

            if ($message->status === 'delivered') {
                return $message;
            }

            $message->update([
                'status' => 'processing',
                'attempts' => $message->attempts + 1,
                'last_error' => null,
            ]);

            return $message->refresh();
        });

        if ($message->status === 'delivered') {
            return $message;
        }

        try {
            $this->handler->handle($message);
        } catch (\Throwable $exception) {
            DB::transaction(function () use ($message, $exception): void {
                DispatchOutboxMessage::query()->whereKey($message->id)->update([
                    'status' => 'failed',
                    'available_at' => now()->addSeconds(min(300, 2 ** max(0, $message->attempts - 1))),
                    'last_error' => mb_substr($exception->getMessage(), 0, 2000),
                ]);
            });

            throw $exception;
        }

        return DB::transaction(function () use ($message): DispatchOutboxMessage {
            $delivered = DispatchOutboxMessage::query()->lockForUpdate()->findOrFail($message->id);
            if ($delivered->status !== 'delivered') {
                $delivered->update(['status' => 'delivered', 'delivered_at' => now()]);
                $delivered->refresh();
                event(new DispatchOutboxMessageDelivered($delivered));
            }

            return $delivered;
        });
    }
}
