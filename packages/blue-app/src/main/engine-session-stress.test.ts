import { describe, expect, it } from 'vitest';
import { EngineSession, isSessionActive } from './engine-session';
import {
  FakeChildProcess,
  FakeEngineClient,
  ControllableClock,
  FakeProcessRegistry,
} from './engine-session.test-support';

describe('EngineSession 100-cycle rapid Play/Stop stress', () => {
  it('runs 100 rapid Play/Stop cycles with delayed child exits and leaves 0 leaked manifests', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const delayedChildren: FakeChildProcess[] = [];

    let activeSession: EngineSession | null = null;
    let pidCounter = 1000;

    for (let cycle = 1; cycle <= 100; cycle++) {
      const pid = ++pidCounter;
      const child = new FakeChildProcess(pid);

      // In 50% of cycles, simulate a delayed exit where child delays exiting until after replacement
      if (cycle % 2 === 0) {
        child.onKillBehavior = () => {
          // Delayed exit: don't exit immediately on kill
          delayedChildren.push(child);
        };
      }

      const session = new EngineSession(
        { kind: 'realtime', enginePath: '/bin/blue-engine', generation: cycle },
        {
          spawn: () => child as any,
          createClient: () => new FakeEngineClient() as any,
          registerManifest: (m) => registry.registerEngineProcess(m),
          removeManifest: (p) => registry.removeEngineProcessRecord(p),
          clock,
        },
      );

      // Previous active session is stopped/replaced
      const previousSession = activeSession;
      if (previousSession) {
        // Asynchronously stop previous session
        void previousSession.shutdown('replacement');
      }

      await session.spawn();
      await session.awaitReady();

      activeSession = session;
      expect(isSessionActive(session, activeSession)).toBe(true);

      // Occasionally flush some delayed exits from older children
      if (delayedChildren.length > 0 && cycle % 5 === 0) {
        const delayedChild = delayedChildren.shift()!;
        delayedChild.emitExit(0, 'SIGTERM');
      }

      // Active session should remain active despite older child exits
      expect(isSessionActive(session, activeSession)).toBe(true);
      expect(session.getState()).toBe('ready');
    }

    // Final shutdown of active session
    if (activeSession) {
      const shutdownPromise = activeSession.shutdown('final-stop');
      // Drain any remaining delayed children
      while (delayedChildren.length > 0) {
        const delayedChild = delayedChildren.shift()!;
        delayedChild.emitExit(0, 'SIGTERM');
      }
      const finalResult = await shutdownPromise;
      expect(finalResult.status).toBe('exited');
    }

    // Final state: all manifests cleaned up
    expect(registry.getAllRecords().size).toBe(0);
  });
});
