/**
 * Static server that replays the production response headers.
 *
 * The headers are parsed out of `netlify.toml` rather than duplicated here.
 * A copied policy would drift from the deployed one and the CSP test would
 * quietly start asserting nothing — so if the file cannot be parsed, this
 * throws instead of falling back to a default.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

/** Read the `[[headers]]` block that applies to `/*` from netlify.toml. */
export async function productionHeaders(tomlPath = 'netlify.toml') {
  const toml = await readFile(resolve(tomlPath), 'utf8');

  // Isolate the `for = "/*"` block: from that line to the next [[headers]].
  const start = toml.indexOf('for = "/*"');
  if (start === -1) throw new Error(`No 'for = "/*"' headers block in ${tomlPath}`);
  const rest = toml.slice(start);
  const end = rest.indexOf('[[headers]]');
  const block = end === -1 ? rest : rest.slice(0, end);

  const headers = {};
  // key = "value"  — values are single-line in this file.
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/);
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'for') continue;
    headers[key] = value;
  }

  if (!headers['Content-Security-Policy']) {
    throw new Error(`Could not parse Content-Security-Policy out of ${tomlPath}`);
  }
  return headers;
}

/**
 * Serve `root` on an ephemeral port with the production headers applied.
 * Returns { url, close, headers }.
 */
export async function serveWithProductionHeaders(root) {
  const headers = await productionHeaders();
  const rootDir = resolve(root);

  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Contain path traversal, then fall back to index.html like the SPA rule.
    const candidate = normalize(join(rootDir, urlPath));
    const safe = candidate.startsWith(rootDir) ? candidate : rootDir;

    let file = safe;
    let body;
    try {
      body = await readFile(file);
    } catch {
      file = join(rootDir, 'index.html');
      try {
        body = await readFile(file);
      } catch {
        res.writeHead(404).end('not found');
        return;
      }
    }

    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.writeHead(200).end(body);
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    headers,
    close: () => new Promise((r) => server.close(r)),
  };
}
