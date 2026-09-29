<?php

namespace App\Platform\Identity\Mail;

use App\Platform\Identity\Support\IpLocationResolver;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewDeviceSignInMail extends Mailable
{
    use Queueable, SerializesModels;

    private const DISPLAY_TIMEZONE = 'Asia/Manila';

    private const UNKNOWN_LOCATION = 'Unknown Location';

    public function __construct(
        public readonly string $deviceLabel,
        public readonly ?string $ipAddress,
        public readonly CarbonInterface $signedInAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'New sign-in to your Core-2 account');
    }

    public function content(): Content
    {
        $heading = 'New sign-in from '.$this->deviceLabel;

        // Resolved when the queued mail is built so the lookup never slows sign-in.
        $location = IpLocationResolver::resolve($this->ipAddress);

        return new Content(
            view: 'mail.new-device-sign-in',
            with: [
                'heading' => $heading,
                'preheader' => 'If this was you, there\'s nothing to do.',
                'location' => $location === self::UNKNOWN_LOCATION ? null : $location,
                'signedInAtLabel' => $this->signedInAt
                    ->copy()
                    ->timezone(self::DISPLAY_TIMEZONE)
                    ->format('M j, Y \a\t g:i A').' (Philippine time)',
            ],
        );
    }
}
