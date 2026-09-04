#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { Client } from 'node-osc';
import { OSC_COMMAND_REGISTRY, OSC_DEFAULT_PREFERRED_PORT } from '../src/shared/osc-control.ts';

const HELP = `
Send one OSC control message to Blue.

Usage:
  pnpm --filter @blue/app osc:send -- --command <id> [options]
  pnpm --filter @blue/app osc:send -- --address <path> [options]

Options:
  --command <id>       A registered command ID; use --list to see all IDs.
  --address <path>     Send a custom OSC address instead of a registered command.
  --host <hostname>    Destination host (default: 127.0.0.1).
  --port <port>        Destination UDP port (default: ${OSC_DEFAULT_PREFERRED_PORT}).
  --list               Print registered commands and exit.
  --help, -h           Print this help and exit.

Examples:
  pnpm --filter @blue/app osc:send -- --command score.play
  pnpm --filter @blue/app osc:send -- --command blueLive.allNotesOff --port 9000
  pnpm --filter @blue/app osc:send -- --address /score/play/alternate --host 192.168.1.20
`.trim();

function fail(message) {
  throw new Error(`${message}\n\n${HELP}`);
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail('--port must be a whole number from 1 through 65535.');
  }
  return port;
}

function parseOptions(argumentsList) {
  const normalizedArgs = argumentsList.filter((arg) => arg !== '--');

  let parsed;
  try {
    parsed = parseArgs({
      args: normalizedArgs,
      options: {
        command: { type: 'string' },
        address: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'string' },
        list: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const { values } = parsed;

  if (values.help) {
    console.log(HELP);
    return null;
  }

  const options = {
    address: values.address ?? null,
    commandId: values.command ?? null,
    host: values.host ?? '127.0.0.1',
    list: values.list ?? false,
    port: values.port !== undefined ? parsePort(values.port) : OSC_DEFAULT_PREFERRED_PORT,
  };

  if (options.list) return options;
  if (options.address && options.commandId) {
    fail('Use either --command or --address, not both.');
  }
  if (!options.address && !options.commandId) {
    fail('Specify --command or --address.');
  }
  if (options.address && !options.address.startsWith('/')) {
    fail('--address must start with /.');
  }
  return options;
}

function printCommands() {
  for (const command of OSC_COMMAND_REGISTRY) {
    console.log(`${command.id}\t${command.addressPrefix}\t${command.description}`);
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!options) return;
  if (options.list) {
    printCommands();
    return;
  }

  const command = options.commandId
    ? OSC_COMMAND_REGISTRY.find((entry) => entry.id === options.commandId)
    : null;
  if (options.commandId && !command) {
    fail(`Unknown command ID: ${options.commandId}`);
  }

  const address = options.address ?? command.addressPrefix;
  const client = new Client(options.host, options.port);
  let rejectSocketError;
  const socketError = new Promise((_, reject) => {
    rejectSocketError = reject;
  });
  const onError = (error) => rejectSocketError(error);
  client.once('error', onError);
  try {
    await Promise.race([client.send(address), socketError]);
    console.log(`Sent ${address} to ${options.host}:${options.port}.`);
  } finally {
    client.removeListener('error', onError);
    await client.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
