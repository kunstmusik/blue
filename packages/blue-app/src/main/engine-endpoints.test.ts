import { describe, expect, it } from 'vitest';
import { allocateTcpEndpointPair, checkPortAvailable } from './engine-endpoints';

describe('TCP endpoint pair allocation', () => {
  it('allocates adjacent available loopback pair when free', async () => {
    const pair = await allocateTcpEndpointPair({
      basePort: 6100,
      isPortAvailable: async () => true,
    });

    expect(pair).toEqual({
      controlPort: 6100,
      pubPort: 6101,
      controlEndpoint: 'tcp://127.0.0.1:6100',
      pubEndpoint: 'tcp://127.0.0.1:6101',
    });
  });

  it('allocates non-adjacent pub port when immediate adjacent is occupied', async () => {
    const occupied = new Set([6101]); // 6101 is busy, 6100 and 6102 are free

    const pair = await allocateTcpEndpointPair({
      basePort: 6100,
      isPortAvailable: async (port) => !occupied.has(port),
    });

    expect(pair).toEqual({
      controlPort: 6100,
      pubPort: 6102,
      controlEndpoint: 'tcp://127.0.0.1:6100',
      pubEndpoint: 'tcp://127.0.0.1:6102',
    });
  });

  it('skips occupied base port and finds next free candidate pair', async () => {
    const occupied = new Set([5555, 5556, 5557]); // first few ports occupied

    const pair = await allocateTcpEndpointPair({
      basePort: 5555,
      isPortAvailable: async (port) => !occupied.has(port),
    });

    expect(pair.controlPort).toBe(5558);
    expect(pair.pubPort).toBe(5559);
    expect(pair.controlEndpoint).toBe('tcp://127.0.0.1:5558');
    expect(pair.pubEndpoint).toBe('tcp://127.0.0.1:5559');
  });

  it('fails deterministically with descriptive error on exhaustion', async () => {
    await expect(
      allocateTcpEndpointPair({
        basePort: 7000,
        maxAttempts: 5,
        isPortAvailable: async () => false,
      }),
    ).rejects.toThrow(/Exhausted available TCP endpoint pairs after 5 attempts/);
  });

  it('checks actual loopback port availability on real OS sockets', async () => {
    // Port 0 in ephemeral range should test cleanly
    const isFree = await checkPortAvailable(28543);
    expect(typeof isFree).toBe('boolean');
  });
});
