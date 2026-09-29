<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light only">
    <title>{{ $heading }}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; -webkit-text-size-adjust: 100%;">
    {{-- Inbox preheader: never include the code so it stays off lock screens. --}}
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
        {{ $preheader }}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7;">
        <tr>
            <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
                    <tr>
                        <td style="padding: 0 4px 16px; font-size: 14px; font-weight: 700; color: #0f172a;">
                            Core-2
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #ffffff; border-top: 3px solid #ffbf00; border-radius: 4px; padding: 32px;">
                            <p style="margin: 0 0 20px; font-size: 18px; line-height: 1.4; font-weight: 600; color: #0f172a;">
                                {{ $heading }}
                            </p>
                            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
                                {{ $intro }}
                            </p>
                            <p style="margin: 0 0 24px; font-family: Consolas, Menlo, 'Courier New', monospace; font-size: 32px; line-height: 1; font-weight: 700; letter-spacing: 6px; color: #0f172a;">{{ $code }}</p>
                            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
                                The code expires in {{ $expiresInMinutes }} minutes and can only be used once.
                            </p>
                            <p style="margin: 0; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; line-height: 1.6; color: #64748b;">
                                If this wasn't you, change your password and tell your IT administrator. Don't share this code with anyone.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 16px 4px 0; font-size: 12px; line-height: 1.6; color: #94a3b8;">
                            Core-2 Operations
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
