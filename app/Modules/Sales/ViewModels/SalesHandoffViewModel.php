<?php

namespace App\Modules\Sales\ViewModels;

use App\Modules\Sales\Models\SalesOrder;
use BackedEnum;
use Illuminate\Support\Collection;

final class SalesHandoffViewModel
{
    /**
     * @param  Collection<int, SalesOrder>  $orders
     * @return array<int, array<string, mixed>>
     */
    public static function collection(Collection $orders): array
    {
        return $orders->map(static fn (SalesOrder $order): array => self::single($order))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public static function single(SalesOrder $order): array
    {
        $status = $order->getAttribute('status');
        $statusValue = $status instanceof BackedEnum ? (string) $status->value : (string) $status;

        return [
            'id' => (int) $order->getKey(),
            'reference' => $order->reference,
            'client' => [
                'id' => (int) $order->client->getKey(),
                'code' => $order->client->code,
                'company_name' => $order->client->company_name,
            ],
            'status' => [
                'value' => $statusValue,
                'label' => self::humanizeStatus($statusValue),
            ],
            'fulfillment_mode' => $order->fulfillmentMode()->value,
            'location' => $order->delivery_location,
            'dispatch_job_id' => $order->dispatch_job_id,
            'ready' => $order->isReadyForDispatchHandoff(),
            'total_cents' => $order->total_cents,
        ];
    }

    private static function humanizeStatus(string $value): string
    {
        return str($value)->replace('_', ' ')->title()->toString();
    }
}
