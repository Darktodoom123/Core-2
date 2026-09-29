<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="broadcasting-enabled" content="{{ config('broadcasting.default') === 'reverb' ? 'true' : 'false' }}">
        @if (config('broadcasting.default') === 'reverb')
            <meta name="reverb-key" content="{{ config('broadcasting.connections.reverb.key') }}">
            <meta name="reverb-host" content="{{ config('services.reverb_client.host') }}">
            <meta name="reverb-port" content="{{ config('services.reverb_client.port') }}">
            <meta name="reverb-scheme" content="{{ config('services.reverb_client.scheme') }}">
        @endif

        <script>
            (() => {
                const themeKey = 'core2-theme-preference';
                const root = document.documentElement;
                let preference = 'light';

                try {
                    const stored = window.localStorage.getItem(themeKey);

                    if (stored === 'light' || stored === 'dark' || stored === 'system') {
                        preference = stored;
                    }
                } catch {
                    // Fall back to light mode when browser storage is unavailable.
                }

                const resolved =
                    preference === 'system'
                        ? typeof window.matchMedia === 'function' &&
                          window.matchMedia('(prefers-color-scheme: dark)')
                              .matches
                            ? 'dark'
                            : 'light'
                        : preference;

                root.classList.toggle('dark', resolved === 'dark');
                root.setAttribute('data-theme', resolved);
                root.setAttribute('data-theme-preference', preference);
            })();
        </script>

        <link rel="icon" href="/favicon.svg?v=alibaton2" type="image/svg+xml">
        <link rel="icon" href="/favicon.ico?v=alibaton2" sizes="any">
        <link rel="apple-touch-icon" href="/favicon.svg?v=alibaton2">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
