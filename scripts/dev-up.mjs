#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173);
const API_PORT = Number(process.env.API_PORT || 3000);

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', ...options });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
    socket.connect(port, '127.0.0.1');
  });
}

function lsofPortOwner(port) {
  const out = spawnSync('bash', ['-lc', `lsof -nP -iTCP:${port} -sTCP:LISTEN | tail -n +2 | head -n 1`], {
    encoding: 'utf8',
  });
  return out.stdout?.trim() || null;
}

async function ensurePortFreeOrExpected(port, expectedCmdPart) {
  const busy = await isPortBusy(port);
  if (!busy) return;

  const owner = lsofPortOwner(port);
  if (owner && owner.toLowerCase().includes(expectedCmdPart.toLowerCase())) {
    return;
  }

  console.error(`\nPort ${port} is already busy by another process.`);
  if (owner) console.error(owner);
  console.error('Stop that process and retry.');
  process.exit(1);
}

async function waitForPostgresHealthy() {
  const retries = 40;
  for (let i = 0; i < retries; i += 1) {
    const status = spawnSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'sql-schema-designer-postgres'], {
      encoding: 'utf8',
    });

    const value = status.stdout?.trim();
    if (value === 'healthy') return;
    await wait(1000);
  }

  console.error('Postgres container did not become healthy in time.');
  process.exit(1);
}

function spawnLong(name, cmd, args, env = process.env) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env,
    shell: false,
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code || 1);
    }
  });

  return child;
}

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  await ensurePortFreeOrExpected(API_PORT, 'node');
  await ensurePortFreeOrExpected(FRONTEND_PORT, 'node');

  console.log('Starting postgres...');
  const up = run('docker', ['compose', 'up', '-d', 'postgres']);
  if (up.status !== 0) process.exit(up.status || 1);

  console.log('Waiting for postgres health...');
  await waitForPostgresHealthy();

  console.log('Applying migrations...');
  const migrate = run('npm', ['run', 'api:migrate']);
  if (migrate.status !== 0) process.exit(migrate.status || 1);

  console.log('Starting API and frontend...');
  children.push(spawnLong('api', 'npm', ['run', 'api:dev']));
  children.push(spawnLong('web', 'npm', ['run', 'dev:web']));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
