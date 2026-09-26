<?php

namespace App\Modules\Fuel\Enums;

enum FuelNoReceiptReason: string
{
    case OnSiteBowser = 'on_site_bowser';
    case VendorNoReceipt = 'vendor_no_receipt';
    case ReceiptLost = 'receipt_lost';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::OnSiteBowser => 'On-site bowser / fuel truck',
            self::VendorNoReceipt => 'Vendor gave no receipt',
            self::ReceiptLost => 'Receipt lost or damaged',
            self::Other => 'Other',
        };
    }
}
