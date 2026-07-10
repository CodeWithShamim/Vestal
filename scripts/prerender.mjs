/**
 * Smoke test: server-render every route through Vite's SSR pipeline.
 * Executes all page components for real — catches runtime errors that
 * `vite build` cannot. Run with `npm run smoke`.
 */
import { createServer } from 'vite';

const routes = ['/', '/explore', '/token/aurum', '/token/kiln', '/token/oriel', '/launch', '/docs'];

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const { render } = await server.ssrLoadModule('/src/smoke-entry.jsx');
  let failed = false;
  for (const route of routes) {
    try {
      const html = render(route);
      if (!html || html.length < 500) throw new Error(`suspiciously short output (${html.length} chars)`);
      console.log(`ok   ${route}  (${html.length} chars)`);
    } catch (err) {
      failed = true;
      console.error(`FAIL ${route}`);
      console.error(err);
    }
  }
  process.exitCode = failed ? 1 : 0;
} finally {
  await server.close();
}
