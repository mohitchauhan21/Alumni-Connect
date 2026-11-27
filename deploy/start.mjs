/**
 * Runs the whole app in one container (used by the root Dockerfile, e.g. on Antideploy).
 *
 * The API listens inside the container on API_PORT (4400) and the website on PORT, the one port the
 * platform exposes. The website proxies /api and /socket.io to the API (apps/web/next.config.mjs),
 * so the browser only ever talks to one origin and the session cookie stays first-party.
 *
 * It also maps the platform's variable names onto the ones the API reads, without overriding
 * anything set explicitly: the site's own address becomes WEB_ORIGIN / PUBLIC_API_URL, and a
 * provided S3-compatible bucket switches document storage to it.
 *
 * If either process exits, the other is stopped and the container exits, so the platform restarts it.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const env = { ...process.env };
const first = (...names) => names.map((n) => env[n]).find((v) => v);
const fallback = (name, value) => {
  if (!env[name] && value) env[name] = value;
};

const site = first('WEB_ORIGIN', 'APP_URL', 'SITE_URL', 'NEXT_PUBLIC_APP_URL');
fallback('WEB_ORIGIN', site);
fallback('PUBLIC_API_URL', site);

if (first('S3_BUCKET', 'BUCKET_NAME')) {
  fallback('STORAGE_DRIVER', 's3');
  fallback('S3_BUCKET', env.BUCKET_NAME);
  fallback('S3_ENDPOINT', first('AWS_ENDPOINT_URL_S3', 'AWS_S3_ENDPOINT'));
  fallback('S3_REGION', env.AWS_REGION);
  fallback('S3_ACCESS_KEY_ID', env.AWS_ACCESS_KEY_ID);
  fallback('S3_SECRET_ACCESS_KEY', env.AWS_SECRET_ACCESS_KEY);
  fallback('S3_FORCE_PATH_STYLE', env.AWS_S3_FORCE_PATH_STYLE || 'true');
}

const webPort = env.PORT || '3000';
console.log(`[start] website on :${webPort}, API on :${env.API_PORT || '4400'}, site address ${env.WEB_ORIGIN || '(not set)'}`);
// Must match API_URL baked into the website at build time (Dockerfile). Not 4000: some hosts set
// PORT=4000 for the website itself.
const apiPort = env.API_PORT || '4400';
const root = process.cwd();
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

const children = [
  spawn(process.execPath, ['dist/index.js'], { cwd: path.join(root, 'apps/api'), env: { ...env, PORT: apiPort }, stdio: 'inherit' }),
  spawn(process.execPath, [nextBin, 'start', '-p', webPort, '-H', '0.0.0.0'], { cwd: path.join(root, 'apps/web'), env: { ...env, PORT: webPort }, stdio: 'inherit' }),
];

let stopping = false;
const stopAll = (signal = 'SIGTERM') => {
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill(signal);
};

for (const c of children) {
  c.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[start] ${c === children[0] ? 'API' : 'website'} exited (${signal ?? code}); stopping the container`);
      stopAll();
    }
    if (children.every((x) => x.exitCode !== null || x.signalCode !== null)) process.exit(code ?? 1);
  });
}
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => stopAll(sig));
