<?php

namespace App\Platform\Security\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnforceSecurityHeaders
{
    /**
     * Handle an incoming request and enforce robust security headers on the response.
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $this->stripInformationDisclosureHeaders($response);
        $this->applySecurityHeaders($request, $response);

        return $response;
    }

    /**
     * Strip headers that leak server or framework information.
     */
    private function stripInformationDisclosureHeaders(Response $response): void
    {
        /** @var array<int, string> $stripHeaders */
        $stripHeaders = (array) config('security.strip_headers', ['X-Powered-By', 'Server']);

        foreach ($stripHeaders as $header) {
            $response->headers->remove($header);
            if (function_exists('header_remove')) {
                @header_remove($header);
            }
        }
    }

    /**
     * Apply hardened security headers to the response.
     */
    private function applySecurityHeaders(Request $request, Response $response): void
    {
        $xFrameOptions = (string) config('security.headers.x_frame_options', 'SAMEORIGIN');
        if ($xFrameOptions !== '') {
            $response->headers->set('X-Frame-Options', $xFrameOptions);
        }

        $xContentTypeOptions = (string) config('security.headers.x_content_type_options', 'nosniff');
        if ($xContentTypeOptions !== '') {
            $response->headers->set('X-Content-Type-Options', $xContentTypeOptions);
        }

        $referrerPolicy = (string) config('security.headers.referrer_policy', 'strict-origin-when-cross-origin');
        if ($referrerPolicy !== '') {
            $response->headers->set('Referrer-Policy', $referrerPolicy);
        }

        $permissionsPolicy = config('security.headers.permissions_policy');
        if (is_string($permissionsPolicy) && trim($permissionsPolicy) !== '') {
            $response->headers->set('Permissions-Policy', trim($permissionsPolicy));
        }

        $coop = config('security.headers.cross_origin_opener_policy');
        if (is_string($coop) && trim($coop) !== '') {
            $response->headers->set('Cross-Origin-Opener-Policy', trim($coop));
        }

        if ((bool) config('security.csp.enabled', false) || config('security.headers.content_security_policy') !== null) {
            $csp = $this->buildContentSecurityPolicy();
            if ($csp !== '') {
                $response->headers->set('Content-Security-Policy', $csp);
            }
        }

        if ($request->isSecure() && (bool) config('security.hsts.enabled', true)) {
            $maxAge = (int) config('security.hsts.max_age', 31536000);
            $hstsValue = "max-age={$maxAge}";

            if ((bool) config('security.hsts.include_subdomains', true)) {
                $hstsValue .= '; includeSubDomains';
            }

            if ((bool) config('security.hsts.preload', false)) {
                $hstsValue .= '; preload';
            }

            $response->headers->set('Strict-Transport-Security', $hstsValue);
        }
    }

    /**
     * Build the Content-Security-Policy string.
     */
    private function buildContentSecurityPolicy(): string
    {
        $custom = config('security.headers.content_security_policy');
        if (is_string($custom) && trim($custom) !== '') {
            return trim($custom);
        }

        /** @var array<string, array<int, string>> $cspDirectives */
        $cspDirectives = (array) config('security.csp', []);
        unset($cspDirectives['enabled']);

        if ($cspDirectives === []) {
            return '';
        }

        // Dynamically append Vite dev server origin if running locally
        if (file_exists(public_path('hot'))) {
            $hotUrl = trim((string) @file_get_contents(public_path('hot')));
            if ($hotUrl !== '') {
                $wsHotUrl = preg_replace('/^http/', 'ws', $hotUrl);
                foreach (['script-src', 'style-src', 'font-src', 'connect-src'] as $dir) {
                    if (isset($cspDirectives[$dir]) && ! in_array($hotUrl, $cspDirectives[$dir], true)) {
                        $cspDirectives[$dir][] = $hotUrl;
                    }
                }
                if ($wsHotUrl && isset($cspDirectives['connect-src']) && ! in_array($wsHotUrl, $cspDirectives['connect-src'], true)) {
                    $cspDirectives['connect-src'][] = $wsHotUrl;
                }
            }
        }

        $directives = [];
        foreach ($cspDirectives as $directive => $sources) {
            $sourcesStr = implode(' ', (array) $sources);
            $directives[] = "{$directive} {$sourcesStr}";
        }

        return implode('; ', $directives);
    }
}
