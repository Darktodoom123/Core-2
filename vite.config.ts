import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    const mapProvider = env.VITE_MAP_PROVIDER || 'stadia';
    const mapPlan = env.VITE_MAP_PLAN || 'free';
    const mapUseCase = (env.VITE_MAP_USE_CASE || 'commercial')
        .trim()
        .toLowerCase();

    if (
        env.APP_ENV === 'production' &&
        mapProvider === 'stadia' &&
        mapPlan === 'free' &&
        mapUseCase !== 'academic'
    ) {
        throw new Error(
            'Stadia Free is limited to non-commercial academic evaluation. Set VITE_MAP_USE_CASE=academic only for a capstone/demo, or set VITE_MAP_PLAN=starter (or configure another approved paid provider) for commercial production.',
        );
    }

    return {
        optimizeDeps: {
            // MapLibre's worker is an ESM asset that Vite's dependency
            // optimizer can separate from the pre-bundled module. Keep the
            // package in source form during dev; maplibre-map.tsx provides
            // the worker URL explicitly for both dev and production builds.
            exclude: ['maplibre-gl'],
        },
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.tsx'],
                refresh: true,
                fonts: [
                    bunny('Instrument Sans', {
                        weights: [400, 500, 600],
                    }),
                ],
            }),
            inertia(),
            react({
                babel: {
                    plugins: ['babel-plugin-react-compiler'],
                },
            }),
            tailwindcss(),
            wayfinder({
                formVariants: true,
            }),
        ],
    };
});
