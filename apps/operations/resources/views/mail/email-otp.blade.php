{{-- The preheader never includes the code so it stays off lock screens. --}}
@extends('mail.layout')

@section('body')
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
@endsection
