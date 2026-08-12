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

    if (
        env.APP_ENV === 'production' &&
        mapProvider === 'stadia' &&
        mapPlan === 'free'
    ) {
        throw new Error(
            'Stadia Free is development/evaluation-only. Set VITE_MAP_PLAN=starter or configure another approved paid provider before a production build.',
        );
    }

    return {
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
