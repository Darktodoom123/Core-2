@extends('mail.layout')

@section('body')
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
        Someone just signed in to your Core-2 account from a device that isn't trusted yet, using the code we emailed you.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px; font-size: 14px; line-height: 1.5;">
        <tr>
            <td style="padding: 6px 0; width: 88px; color: #64748b; vertical-align: top;">Device</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">{{ $deviceLabel }}</td>
        </tr>
        <tr>
            <td style="padding: 6px 0; color: #64748b; vertical-align: top;">When</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">{{ $signedInAtLabel }}</td>
        </tr>
        @if ($location)
            <tr>
                <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Location</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">{{ $location }} <span style="font-weight: 400; color: #64748b;">(approximate)</span></td>
            </tr>
        @endif
        @if ($ipAddress)
            <tr>
                <td style="padding: 6px 0; color: #64748b; vertical-align: top;">IP address</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">{{ $ipAddress }}</td>
            </tr>
        @endif
    </table>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
        If this was you, there's nothing to do.
    </p>
    <p style="margin: 0; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; line-height: 1.6; color: #64748b;">
        <strong style="color: #0f172a;">Not you?</strong> Someone has your password and access to your email. Change your password now and tell your IT administrator.
    </p>
@endsection
