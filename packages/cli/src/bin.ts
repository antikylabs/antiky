#!/usr/bin/env -S node --experimental-strip-types --experimental-transform-types

import { runCli } from './cli.ts';
import { AntikyCliError } from './errors.ts';

try {
  process.exitCode = await runCli(process.argv.slice(2));
} catch (cause: unknown) {
  if (cause instanceof AntikyCliError) {
    process.stderr.write(`[${cause.code}] ${cause.message}\n`);
  } else {
    process.stderr.write(`[ANTIKY_INTERNAL_ERROR] ${cause instanceof Error ? cause.message : String(cause)}\n`);
  }
  process.exitCode = 1;
}
