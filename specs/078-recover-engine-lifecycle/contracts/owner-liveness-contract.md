# Blue Engine Owner-Liveness Contract

## Negotiation

- Supporting engines advertise `owner-liveness-v1`.
- Electron passes `--owner-pid <positive-integer>` only when advertised.
- Legacy compatible engines receive no new argument.
- Invalid, self, missing, or unrelated owner values fail startup before binding endpoints.

## Platform behavior

- **Linux**: establish parent-death notification, then immediately verify the current parent.
- **macOS**: validate the direct owner and observe exact process exit through the native process-event facility.
- **Windows**: open a synchronization handle to the exact owner and wait for it.

The mechanisms sit behind one native owner-monitor interface.

## Shutdown

- Owner loss requests `ZmqHandler` shutdown exactly once and wakes its loop.
- Normal teardown releases performance state, sockets, shared memory, and runtime resources.
- Normal signal/command shutdown cancels and joins the monitor before dependencies are destroyed.
- Failure to establish a requested monitor is a startup failure, not silent disablement.
- Standalone/signal modes remain valid when no owner is supplied.

## Required evidence

Capability and argument validation; injected owner-loss/cancellation/duplicate/failure tests; native short-lived-owner integration on macOS/Windows/Linux with exit within five seconds; normal shutdown without deadlock; legacy engine receives no unsupported argument.
