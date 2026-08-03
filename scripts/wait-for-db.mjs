/**
 * Waits until PostgreSQL accepts TCP connections, then exits.
 *
 * `pnpm setup` used to wait a fixed seven seconds after `docker compose up`,
 * which is a race: on a cold machine the container needs longer, and the schema
 * push then failed with a connection error. This polls instead.
 *
 * Host and port come from DATABASE_URL, so it works against the Docker
 * container or any PostgreSQL you point the project at.
 */
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '../.env');

let url = process.env.DATABASE_URL;
if (!url && existsSync(envPath)) {
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('DATABASE_URL='));
  if (line)
    url = line
      .slice(line.indexOf('=') + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
}

if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.demo to .env first.');
  process.exit(1);
}

const { hostname, port } = new URL(url);
const target = { host: hostname, port: Number(port || 5432) };
const deadline = Date.now() + 90_000;

process.stdout.write(`waiting for postgres at ${target.host}:${target.port} `);

const attempt = () =>
  new Promise((done) => {
    const socket = net.connect(target);
    const finish = (ok) => {
      socket.destroy();
      done(ok);
    };
    socket.setTimeout(2000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });

while (Date.now() < deadline) {
  if (await attempt()) {
    console.log('— ready');
    process.exit(0);
  }
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, 1000));
}

console.error('\ntimed out. Is Docker running? Try: pnpm db:up');
process.exit(1);
