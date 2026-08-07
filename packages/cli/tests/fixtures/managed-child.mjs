import { appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const [role, markerPath, behavior = 'run'] = process.argv.slice(2);
appendFileSync(markerPath, `${role}:${process.pid}\n`);

if (behavior === 'orphan') {
  spawn(process.execPath, [import.meta.filename, 'game', markerPath, 'run'], {
    detached: false,
    stdio: 'ignore',
  }).unref();
  setTimeout(() => process.exit(0), 80);
} else if (behavior === 'fail') {
  setTimeout(() => process.exit(7), 40);
} else {
  const timer = setInterval(() => {}, 1000);
  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
