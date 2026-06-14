import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'script', // external registerSW.js — compatible with strict CSP (script-src 'self')
            includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
            manifest: {
                name: 'PPM Tool',
                short_name: 'PPM',
                description: 'Project & Portfolio Management',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                orientation: 'portrait-primary',
                theme_color: '#1b1b1d',
                background_color: '#1b1b1d',
                icons: [
                    { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                navigateFallback: '/index.html',
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
                cleanupOutdatedCaches: true,
                importScripts: ['/push-sw.js'], // custom push + notificationclick handlers
                runtimeCaching: [
                    {
                        // Cache GET API responses so last-seen data is available offline (NetworkFirst).
                        urlPattern: ({ url, request }) => url.origin === 'https://ppm-worker.almazor-schwab.workers.dev' && request.method === 'GET',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'ppm-api',
                            networkTimeoutSeconds: 5,
                            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // Split heavy vendor libs so the main bundle loads faster.
                    react: ['react', 'react-dom', 'react-router-dom'],
                    charts: ['recharts'],
                    query: ['@tanstack/react-query'],
                },
            },
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:8787',
                changeOrigin: true,
            },
        },
    },
});
