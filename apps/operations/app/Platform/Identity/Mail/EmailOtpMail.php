<?php

namespace App\Platform\Identity\Mail;

use App\Platform\Identity\Models\EmailOneTimeCode;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EmailOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $code,
        public readonly string $purpose,
        public readonly int $expiresInMinutes = 5,
    ) {}

    public function envelope(): Envelope
    {
        $subject = match ($this->purpose) {
            EmailOneTimeCode::PURPOSE_LOGIN => 'Your Core-2 Web Sign-in Verification Code',
            EmailOneTimeCode::PURPOSE_ENABLE_OTP => 'Enable Email Code Verification for Core-2',
            EmailOneTimeCode::PURPOSE_DISABLE_OTP => 'Disable Email Code Verification for Core-2',
            EmailOneTimeCode::PURPOSE_EMAIL_CHANGE => 'Verify Your New Email Address for Core-2',
            default => 'Your Core-2 Verification Code',
        };

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        [$heading, $intro] = match ($this->purpose) {
            EmailOneTimeCode::PURPOSE_LOGIN => [
                'Your sign-in code',
                'Someone is signing in to your Core-2 account from a new device. If that\'s you, enter this code to finish signing in:',
            ],
            EmailOneTimeCode::PURPOSE_ENABLE_OTP => [
                'Turn on email codes',
                'Enter this code in your account settings to start requiring an email code when you sign in from a new device:',
            ],
            EmailOneTimeCode::PURPOSE_DISABLE_OTP => [
                'Turn off email codes',
                'Enter this code in your account settings to stop requiring email codes at sign-in:',
            ],
            EmailOneTimeCode::PURPOSE_EMAIL_CHANGE => [
                'Confirm your new email address',
                'Enter this code in your account settings to confirm this is your new email address:',
            ],
            default => [
                'Your verification code',
                'Enter this code in Core-2 to continue:',
            ],
        };

        return new Content(
            view: 'mail.email-otp',
            with: [
                'heading' => $heading,
                'intro' => $intro,
                'preheader' => "{$heading}. This code expires in {$this->expiresInMinutes} minutes.",
            ],
        );
    }
}
