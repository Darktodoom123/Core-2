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
        return new Content(
            htmlString: <<<HTML
            <div style="font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
                <div style="margin-bottom: 20px;">
                    <span style="font-weight: 700; font-size: 18px; color: #18181b; letter-spacing: -0.02em;">CORE-2 Operations</span>
                </div>
                <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #18181b;">Verification Code</h2>
                <p style="margin: 0 0 20px; font-size: 14px; color: #52525b; line-height: 1.5;">
                    Please use the following 6-digit code to complete your security verification. This code expires in {$this->expiresInMinutes} minutes.
                </p>
                <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
                    <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.25em; color: #09090b;">{$this->code}</span>
                </div>
                <p style="margin: 20px 0 0; font-size: 12px; color: #71717a; line-height: 1.5;">
                    If you did not initiate this request, please change your password immediately and notify your IT administrator. Never share this code with anyone.
                </p>
            </div>
            HTML,
        );
    }
}
