import * as net from 'net';

export interface TcpEndpointPair {
  controlPort: number;
  pubPort: number;
  controlEndpoint: string;
  pubEndpoint: string;
}

export interface EndpointAllocationOptions {
  basePort?: number;
  maxAttempts?: number;
  isPortAvailable?: (port: number) => Promise<boolean>;
}

export async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;
    const finish = (available: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(available);
    };

    server.unref();
    server.once('error', () => {
      finish(false);
    });
    server.once('listening', () => {
      server.close((error) => {
        finish(!error);
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

export async function allocateTcpEndpointPair(
  options: EndpointAllocationOptions = {},
): Promise<TcpEndpointPair> {
  const basePort = options.basePort ?? 5555;
  const maxAttempts = options.maxAttempts ?? 20;
  const isAvailable = options.isPortAvailable ?? checkPortAvailable;

  let currentCandidate = basePort;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    const controlPort = currentCandidate;
    const isControlFree = await isAvailable(controlPort);
    if (!isControlFree) {
      currentCandidate++;
      continue;
    }

    // Try finding a suitable pubPort (adjacent or nearby)
    let pubCandidate = controlPort + 1;
    let pubFound = false;
    for (let i = 0; i < 5; i++) {
      if (await isAvailable(pubCandidate)) {
        pubFound = true;
        break;
      }
      pubCandidate++;
    }

    if (pubFound) {
      return {
        controlPort,
        pubPort: pubCandidate,
        controlEndpoint: `tcp://127.0.0.1:${controlPort}`,
        pubEndpoint: `tcp://127.0.0.1:${pubCandidate}`,
      };
    }

    currentCandidate = pubCandidate + 1;
  }

  throw new Error(
    `Exhausted available TCP endpoint pairs after ${maxAttempts} attempts starting from port ${basePort}`,
  );
}
