import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Request } from 'zeromq';
import type { BlueData, JavaRuntimeClientContract, JavaRuntimeResponse } from '@blue/data';

async function freePort(): Promise<number> {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as net.AddressInfo;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

/** Original host adapter for the helper's authenticated JSON request protocol. */
export async function startCliJavaRuntime(project: BlueData, projectDirectory: string) {
  if (!project.usesJavaRuntime()) return null;
  const artifact = path.join(__dirname, 'java', 'blue-java.jar');
  if (!fs.existsSync(artifact)) throw new Error('Blue Java helper is missing. Reinstall blue-cli.');
  const executable = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java';
  const endpoint = 'tcp://127.0.0.1:' + (await freePort());
  const token = randomBytes(32).toString('hex');
  const child = spawn(
    executable,
    ['-jar', artifact, '--control-endpoint', endpoint, '--auth-token', token],
    {
      cwd: projectDirectory,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let diagnostics = '';
  child.stdout.on('data', (text: Buffer) => {
    diagnostics = (diagnostics + text.toString()).slice(-8192);
  });
  child.stderr.on('data', (text: Buffer) => {
    diagnostics = (diagnostics + text.toString()).slice(-8192);
  });
  let exited = false;
  const terminated = new Promise<never>((_, reject) => {
    child.once('error', (error) => {
      exited = true;
      reject(new Error('Cannot start Java 17 or newer. Check JAVA_HOME or PATH. ' + error.message));
    });
    child.once('exit', (code) => {
      exited = true;
      reject(
        new Error(
          'Blue Java helper exited (' + code + '). Java 17 or newer is required. ' + diagnostics,
        ),
      );
    });
  });
  void terminated.catch(() => undefined);
  let socket: Request;
  try {
    socket = new Request({ linger: 0, sendTimeout: 15000, receiveTimeout: 60000 });
    socket.connect(endpoint);
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
  let index = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const request = <T>(method: string, params: unknown = {}): Promise<JavaRuntimeResponse<T>> => {
    const operation = queue.then(async () => {
      const id = 'cli-' + ++index;
      const exchange = async () => {
        await socket.send(JSON.stringify({ id, method, authToken: token, params }));
        const [bytes] = await socket.receive();
        const reply = JSON.parse(bytes.toString());
        if (reply.id !== id || typeof reply.ok !== 'boolean')
          throw new Error('Invalid Java runtime response.');
        if (reply.stdout) process.stderr.write(reply.stdout);
        if (reply.stderr) process.stderr.write(reply.stderr);
        return reply as JavaRuntimeResponse<T>;
      };
      return Promise.race([exchange(), terminated]);
    });
    queue = operation.catch(() => undefined);
    return operation;
  };
  const client: JavaRuntimeClientContract = {
    health: () => request('runtime.health'),
    initSession: (params) => request('session.init', params),
    reinitializeClojure: () => request('clojure.reinitialize'),
    evaluateClojure: (params) => request('clojure.eval', params),
    evaluateClojureScoreObject: (params) => request('clojure.evalScoreObject', params),
    jythonImportCheck: (params) => request('jython.importCheck', params),
    evaluateJythonScript: (params) => request('jython.evalScript', params),
    evaluateJythonScoreObject: (params) => request('jython.evalScoreObject', params),
    evaluateJythonObjectBuilder: (params) => request('jython.evalObjectBuilder', params),
    evaluateJythonInstrument: (params) => request('jython.evalInstrument', params),
    processJythonNoteList: (params) => request('jython.processNoteList', params),
    reinitializeJython: () => request('jython.reinitialize'),
  };
  let disposing: Promise<void> | undefined;
  const killOnExit = () => {
    if (!exited) child.kill('SIGKILL');
  };
  const dispose = (): Promise<void> => {
    if (disposing) return disposing;
    disposing = (async () => {
      socket.close();
      if (!exited) {
        child.kill('SIGTERM');
        const timer = setTimeout(killOnExit, 2000);
        try {
          await terminated.catch(() => undefined);
        } finally {
          clearTimeout(timer);
        }
      }
      process.removeListener('exit', killOnExit);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
    })();
    return disposing;
  };
  const interrupt = () => {
    void dispose().finally(() => process.exit(130));
  };
  const terminate = () => {
    void dispose().finally(() => process.exit(143));
  };
  process.once('exit', killOnExit);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  try {
    const health = await client.health();
    if (!health.ok) throw new Error(health.error?.message ?? 'Java runtime health check failed.');
    const response = await client.initSession({
      projectSessionId: 1,
      projectDir: projectDirectory,
      clojureDependencies:
        project
          .getClojureProjectData()
          ?.getLibraryEntries()
          .map((entry) => ({
            coordinates: entry.getDependencyCoordinates(),
            version: entry.getVersion(),
          })) ?? [],
      jythonPythonLibRoot: path.join(__dirname, 'java', 'pythonLib'),
      jythonUserPythonLibRoot: path.join(os.homedir(), '.blue', 'pythonLib'),
    });
    if (!response.ok)
      throw new Error(response.error?.message ?? 'Java runtime initialization failed.');
    const failed =
      response.result?.dependenciesLoaded.filter((dependency) => dependency.status === 'failed') ??
      [];
    if (failed.length)
      throw new Error(
        'Cannot load Clojure dependencies: ' + failed.map((entry) => entry.coordinates).join(', '),
      );
    return { client, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}
