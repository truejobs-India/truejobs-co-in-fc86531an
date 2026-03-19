/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import * as navigationPreload from 'workbox-navigation-preload';

// ── Activation ──────────────────────────────────────────────────────
self.skipWaiting();
clientsClaim();

// ── Precache ────────────────────────────────────────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Navigation preload ──────────────────────────────────────────────
navigationPreload.enable();

// ── A. Non-GET requests → NetworkOnly ───────────────────────────────
registerRoute(
  ({ request }) => request.method !== 'GET',
  new NetworkOnly(),
);

// ── B. Supabase REST & Edge Functions → NetworkOnly ─────────────────
registerRoute(
  ({ url }) =>
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/v1/'),
  new NetworkOnly(),
);

// ── C. Sensitive navigation routes → NetworkOnly ────────────────────
const SENSITIVE_PATHS = [
  '/admin',
  '/dashboard',
  '/employer',
  '/login',
  '/signup',
  '/phone-signup',
  '/forgot-password',
  '/profile',
  '/enrol-now',
  '/tools/resume-builder',
  '/tools/resume-checker',
  '/auth/callback',
];

registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    SENSITIVE_PATHS.some((p) => url.pathname.startsWith(p)),
  new NetworkOnly(),
);

// ── D. Google Fonts stylesheets → StaleWhileRevalidate ──────────────
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' }),
);

// ── E. Google Fonts files → CacheFirst ──────────────────────────────
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  }),
);

// ── F. Images → CacheFirst ──────────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  }),
);

// ── G. JS / CSS → StaleWhileRevalidate ──────────────────────────────
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({ cacheName: 'static-assets' }),
);

// ── H. Public navigation fallback → NetworkFirst + /index.html ──────
const NAV_DENYLIST = new RegExp(
  [
    '^\\/admin',
    '^\\/dashboard',
    '^\\/employer',
    '^\\/login',
    '^\\/signup',
    '^\\/phone-signup',
    '^\\/forgot-password',
    '^\\/profile',
    '^\\/enrol-now',
    '^\\/tools\\/',
    '^\\/auth\\/',
    '^\\/api\\/',
    '^\\/rest\\/',
    '^\\/functions\\/',
  ].join('|'),
);

registerRoute(navRoute);

// Navigation route: serves precached /index.html for public paths
const navRoute = new NavigationRoute(
  createHandlerBoundToURL('/index.html'),
  { denylist: [NAV_DENYLIST] },
);

registerRoute(navRoute);
