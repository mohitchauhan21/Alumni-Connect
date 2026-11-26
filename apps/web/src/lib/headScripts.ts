/**
 * Inline scripts for <head>, run before the first paint. They live in a plain module (no
 * 'use client') so the server layout receives the actual text: a string exported from a client
 * module reaches a server component as a client reference, not as the string.
 */

export const THEME_KEY = 'amn.theme';

/** Applies the saved light/dark choice (or the OS setting) before paint. Keep in sync with lib/theme.tsx resolve(). */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_KEY}');var d=c==='dark'||((c===null||c==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

