#!/usr/bin/env node

import { runCli } from './cli.ts';
import { AntikyCliError } from './errors.ts';
import type { CliDiagnosticSink } from './host/inspection/diagnostics.ts';

const diagnosticSink: CliDiagnosticSink = (event) => {
  if (event.level === 'error') {
    process.stderr.write(`[ANTIKY_DIAGNOSTIC] ${JSON.stringify(event)}\n`);
  }
};

try {
  process.exitCode = await runCli(process.argv.slice(2), undefined, { diagnosticSink });
} catch (cause: unknown) {
  if (cause instanceof AntikyCliError) {
    process.stderr.write(`[${cause.code}] ${cause.message}\n`);
  } else {
    process.stderr.write('[ANTIKY_INTERNAL_ERROR] The Antiky CLI failed unexpectedly.\n');
  }
  process.exitCode = 1;
}
