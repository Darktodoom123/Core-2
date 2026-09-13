<?php

namespace App\Platform\Identity\Support;

class UserAgentParser
{
    /**
     * @return array{
     *     browser: string,
     *     platform: string,
     *     device_type: 'desktop'|'mobile'|'tablet'|'unknown',
     *     label: string
     * }
     */
    public static function parse(?string $userAgent): array
    {
        if (empty($userAgent)) {
            return [
                'browser' => 'Web Browser',
                'platform' => 'Unknown Device',
                'device_type' => 'unknown',
                'label' => 'Web Browser',
            ];
        }

        // Platform detection
        $platform = 'Unknown Platform';
        $deviceType = 'desktop';

        if (preg_match('/iPhone/i', $userAgent)) {
            $platform = 'iOS';
            $deviceType = 'mobile';
        } elseif (preg_match('/iPad/i', $userAgent)) {
            $platform = 'iPadOS';
            $deviceType = 'tablet';
        } elseif (preg_match('/Android/i', $userAgent)) {
            $platform = 'Android';
            $deviceType = preg_match('/Mobile/i', $userAgent) ? 'mobile' : 'tablet';
        } elseif (preg_match('/Macintosh|Mac OS X/i', $userAgent)) {
            $platform = 'macOS';
            $deviceType = 'desktop';
        } elseif (preg_match('/Windows|Win32|Win64/i', $userAgent)) {
            $platform = 'Windows';
            $deviceType = 'desktop';
        } elseif (preg_match('/Linux/i', $userAgent)) {
            $platform = 'Linux';
            $deviceType = 'desktop';
        }

        // Browser detection (order matters for user agent substrings)
        $browser = 'Web Browser';
        if (preg_match('/Edg(?:e)?\/([0-9.]+)/i', $userAgent)) {
            $browser = 'Edge';
        } elseif (preg_match('/OPR\/|Opera/i', $userAgent)) {
            $browser = 'Opera';
        } elseif (preg_match('/Chrome\/([0-9.]+)/i', $userAgent)) {
            $browser = 'Chrome';
        } elseif (preg_match('/Safari\/([0-9.]+)/i', $userAgent) && ! preg_match('/Chrome/i', $userAgent)) {
            $browser = 'Safari';
        } elseif (preg_match('/Firefox\/([0-9.]+)/i', $userAgent)) {
            $browser = 'Firefox';
        }

        $label = "{$browser} on {$platform}";

        return [
            'browser' => $browser,
            'platform' => $platform,
            'device_type' => $deviceType,
            'label' => $label,
        ];
    }
}
