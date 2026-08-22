/**
 * Blue Engine JavaScript (Node.js) Test Client
 */

const zmq = require("zeromq");

// Command codes
const Command = {
  CREATE_ENGINE: 0x01,
  COMPILE_ORC: 0x02,
  READ_SCORE: 0x03,
  SET_OPTION: 0x04,
  START: 0x05,
  STOP: 0x06,
  DESTROY_ENGINE: 0x07,
  GET_ENGINE_STATE: 0x08,
  // Channel commands
  SET_CHANNEL: 0x10,
  GET_CHANNEL: 0x11,
  CREATE_CHANNEL: 0x12,
  GET_SHM_NAME: 0x13,
  // Automation commands
  CREATE_AUTOMATION: 0x20,
  UPDATE_AUTOMATION: 0x21,
  DELETE_AUTOMATION: 0x22,
  ENABLE_AUTOMATION: 0x23,
  DISABLE_AUTOMATION: 0x24,
  LIST_AUTOMATIONS: 0x25,
  CLEAR_AUTOMATIONS: 0x26,
};

// Status codes
const Status = {
  OK: 0x00,
  ERROR: 0x01,
};

const ENGINE_STATE_TOPIC = "engine.state";

// Automation curve types
const AutomationCurve = {
  STEP: 0x00,
  LINEAR: 0x01,
  EXPONENTIAL: 0x02,
};

class BlueEngineClient {
  constructor(endpoint = "tcp://localhost:5555", pubEndpoint = null) {
    this.endpoint = endpoint;
    this.pubEndpoint = pubEndpoint || derivePubEndpoint(endpoint);
    this.socket = new zmq.Request();
    this.subscriber = new zmq.Subscriber();
    this.subscriber.subscribe(ENGINE_STATE_TOPIC);
  }

  async connect() {
    await this.socket.connect(this.endpoint);
    await this.subscriber.connect(this.pubEndpoint);
  }

  async close() {
    this.socket.close();
    this.subscriber.close();
  }

  async sendCommand(cmd, payload = Buffer.alloc(0)) {
    // Build request
    const payloadBuf = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(payload, "utf-8");

    const request = Buffer.alloc(5 + payloadBuf.length);
    request.writeUInt8(cmd, 0);
    request.writeUInt32LE(payloadBuf.length, 1);
    payloadBuf.copy(request, 5);

    await this.socket.send(request);

    // Receive response
    const [response] = await this.socket.receive();

    if (response.length < 5) {
      return { ok: false, message: "Invalid response" };
    }

    const status = response.readUInt8(0);
    const msgLen = response.readUInt32LE(1);
    const message = response.slice(5, 5 + msgLen).toString("utf-8");

    return { ok: status === Status.OK, message };
  }

  async createEngine() {
    let resp = await this.sendCommand(Command.CREATE_ENGINE);
    if (!resp.ok && resp.message.includes("Engine already created")) {
      await this.sendCommand(Command.DESTROY_ENGINE);
      resp = await this.sendCommand(Command.CREATE_ENGINE);
    }
    return resp;
  }

  async compileOrc(orc) {
    return this.sendCommand(Command.COMPILE_ORC, orc);
  }

  async readScore(sco) {
    return this.sendCommand(Command.READ_SCORE, sco);
  }

  async setOption(option) {
    return this.sendCommand(Command.SET_OPTION, option);
  }

  async start() {
    return this.sendCommand(Command.START);
  }

  async stop() {
    return this.sendCommand(Command.STOP);
  }

  async destroyEngine() {
    return this.sendCommand(Command.DESTROY_ENGINE);
  }

  async getEngineState() {
    const resp = await this.sendCommand(Command.GET_ENGINE_STATE);
    if (!resp.ok) {
      return { ok: false, state: null };
    }

    return { ok: true, state: JSON.parse(resp.message) };
  }

  subscribeState(listener) {
    let active = true;

    const run = async () => {
      for await (const [topic, payload] of this.subscriber) {
        if (!active) {
          return;
        }

        if (topic.toString("utf-8") !== ENGINE_STATE_TOPIC) {
          continue;
        }

        listener(JSON.parse(payload.toString("utf-8")));
      }
    };

    void run();

    return () => {
      active = false;
    };
  }

  async createChannel(name, initialValue = 0.0) {
    const nameBuf = Buffer.from(name + "\0", "utf-8");
    const valueBuf = Buffer.alloc(8);
    valueBuf.writeDoubleLE(initialValue, 0);
    const payload = Buffer.concat([nameBuf, valueBuf]);
    return this.sendCommand(Command.CREATE_CHANNEL, payload);
  }

  async setChannel(name, value) {
    const nameBuf = Buffer.from(name + "\0", "utf-8");
    const valueBuf = Buffer.alloc(8);
    valueBuf.writeDoubleLE(value, 0);
    const payload = Buffer.concat([nameBuf, valueBuf]);
    return this.sendCommand(Command.SET_CHANNEL, payload);
  }

  async getChannel(name) {
    const payload = Buffer.from(name + "\0", "utf-8");
    const resp = await this.sendCommand(Command.GET_CHANNEL, payload);
    if (resp.ok && resp.message.length >= 8) {
      const buf = Buffer.from(resp.message, "latin1");
      return { ok: true, value: buf.readDoubleLE(0) };
    }
    return { ok: false, value: 0.0 };
  }

  async createAutomation(channelName, curve, points, enabled = true, resolutionDecimal = "0") {
    const nameBuf = Buffer.from(channelName + "\0", "utf-8");
    const resolutionBuf = Buffer.from(resolutionDecimal, "ascii");
    // header: curve(1B) + enabled(1B) + resolutionLength(4B) + resolution(ASCII) + n_points(4B)
    const header = Buffer.alloc(2 + 4 + resolutionBuf.length + 4);
    header.writeUInt8(curve, 0);
    header.writeUInt8(enabled ? 1 : 0, 1);
    header.writeUInt32LE(resolutionBuf.length, 2);
    resolutionBuf.copy(header, 6);
    header.writeUInt32LE(points.length, 6 + resolutionBuf.length);

    const pointsData = Buffer.alloc(points.length * 16);
    for (let i = 0; i < points.length; i++) {
      pointsData.writeDoubleLE(points[i].time, i * 16);
      pointsData.writeDoubleLE(points[i].value, i * 16 + 8);
    }

    const payload = Buffer.concat([nameBuf, header, pointsData]);
    const resp = await this.sendCommand(Command.CREATE_AUTOMATION, payload);

    if (resp.ok && resp.message.length >= 4) {
      const buf = Buffer.from(resp.message, "latin1");
      return { ok: true, id: buf.readUInt32LE(0) };
    }
    return { ok: false, id: 0 };
  }

  async updateAutomation(channelName, curve, points, enabled = true, resolutionDecimal = "0") {
    const nameBuf = Buffer.from(channelName + "\0", "utf-8");
    const resolutionBuf = Buffer.from(resolutionDecimal, "ascii");
    // header: curve(1B) + enabled(1B) + resolutionLength(4B) + resolution(ASCII) + n_points(4B)
    const header = Buffer.alloc(2 + 4 + resolutionBuf.length + 4);
    header.writeUInt8(curve, 0);
    header.writeUInt8(enabled ? 1 : 0, 1);
    header.writeUInt32LE(resolutionBuf.length, 2);
    resolutionBuf.copy(header, 6);
    header.writeUInt32LE(points.length, 6 + resolutionBuf.length);

    const pointsData = Buffer.alloc(points.length * 16);
    for (let i = 0; i < points.length; i++) {
      pointsData.writeDoubleLE(points[i].time, i * 16);
      pointsData.writeDoubleLE(points[i].value, i * 16 + 8);
    }

    const payload = Buffer.concat([nameBuf, header, pointsData]);
    return this.sendCommand(Command.UPDATE_AUTOMATION, payload);
  }

  async deleteAutomation(channelName) {
    const payload = Buffer.from(channelName + "\0", "utf-8");
    return this.sendCommand(Command.DELETE_AUTOMATION, payload);
  }

  async enableAutomation(channelName) {
    const payload = Buffer.from(channelName + "\0", "utf-8");
    return this.sendCommand(Command.ENABLE_AUTOMATION, payload);
  }

  async disableAutomation(channelName) {
    const payload = Buffer.from(channelName + "\0", "utf-8");
    return this.sendCommand(Command.DISABLE_AUTOMATION, payload);
  }

  async listAutomations() {
    const resp = await this.sendCommand(Command.LIST_AUTOMATIONS);
    if (!resp.ok || resp.message.length < 4) {
      return { ok: false, automations: [] };
    }

    const buf = Buffer.from(resp.message, "latin1");
    const count = buf.readUInt32LE(0);
    const automations = [];
    let offset = 4;

    for (let i = 0; i < count; i++) {
      if (offset + 73 > buf.length) break;

      const id = buf.readUInt32LE(offset);
      offset += 4;

      const enabled = buf.readUInt8(offset) !== 0;
      offset += 1;

      const channel = buf.slice(offset, offset + 64).toString("utf-8").replace(/\0.*$/, "");
      offset += 64;

      const nPoints = buf.readUInt32LE(offset);
      offset += 4;

      automations.push({ id, enabled, channel, nPoints });
    }

    return { ok: true, automations };
  }

  async clearAutomations() {
    return this.sendCommand(Command.CLEAR_AUTOMATIONS);
  }
}

function derivePubEndpoint(endpoint) {
  const match = endpoint.match(/^(tcp:\/\/[^:]+:)(\d+)$/);
  if (!match) {
    throw new Error(`Cannot derive pub endpoint from ${endpoint}`);
  }

  return `${match[1]}${Number(match[2]) + 1}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(selectedTest) {
  console.log("Connecting to blue-engine...");

  const client = new BlueEngineClient();
  await client.connect();
  const unsubscribeState = client.subscribeState((snapshot) => {
    console.log(`[state] ${snapshot.sequence} ${snapshot.state} (${snapshot.stopReason})`);
  });

  try {
    // Compile orchestra using standard chnexport control channels.
    const orc = `
        sr = 44100
        ksmps = 64
        nchnls = 2
        0dbfs = 1

        gk_freq init 440
        gk_freq chnexport "freq", 3

        gk_amp init 0.5
        gk_amp chnexport "amp", 3

        instr 1
            aenv = linseg:a(0, 0.01, 1, p3 - 0.02, 1, 0.01, 0)
            asig = oscil:a(aenv * gk_amp, gk_freq)
            out(asig, asig)
        endin
    `;

    if (selectedTest == null || selectedTest === 1) {
      // Create engine
      let resp = await client.createEngine();
      console.log(`create_engine: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);
      if (!resp.ok) return;

      // Set options
      await client.setOption("-odac");
      console.log("set_option(-odac): OK");

      await client.setOption("-d");
      console.log("set_option(-d): OK");

      resp = await client.compileOrc(orc);
      console.log(`compile_orc: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      // Create channels
      resp = await client.createChannel("freq", 440.0);
      console.log(`create_channel(freq): ${resp.ok ? "OK" : "FAILED"}`);

      resp = await client.createChannel("amp", 0.5);
      console.log(`create_channel(amp): ${resp.ok ? "OK" : "FAILED"}`);

      // Test 1: Manual channel updates
      console.log("\n=== Test 1: Manual Channel Updates ===");
      resp = await client.readScore("i1 0 5");
      console.log(`read_score: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      // Start
      resp = await client.start();
      console.log(`start: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);
      console.log("polled state:", await client.getEngineState());

      // Demonstrate channel updates
      console.log("Playing with channel updates...");
      const frequencies = [440, 550, 660, 880, 660, 550, 440];
      for (const freq of frequencies) {
        resp = await client.setChannel("freq", freq);
        console.log(`  set freq=${freq}: ${resp.ok ? "OK" : "FAILED"}`);
        await sleep(400);
      }

      // Stop
      await client.stop();
      console.log("stop: OK");

      // Destroy
      await client.destroyEngine();
      console.log("destroy_engine: OK");
    }

    if (selectedTest == null || selectedTest === 2) {
      // Test 2: Automation system
      console.log("\n=== Test 2: Automation System ===");

      let resp = await client.createEngine();
      console.log(`create_engine: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      await client.setOption("-odac");
      await client.setOption("-d");

      resp = await client.compileOrc(orc);
      console.log(`compile_orc: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      resp = await client.createChannel("freq", 440.0);
      console.log(`create_channel(freq): ${resp.ok ? "OK" : "FAILED"}`);

      resp = await client.createChannel("amp", 0.5);
      console.log(`create_channel(amp): ${resp.ok ? "OK" : "FAILED"}`);

      // Create automation from time 2 to 4 (freq goes 440 -> 880)
      const points = [
        { time: 2.0, value: 440.0 },
        { time: 4.0, value: 880.0 },
      ];

      console.log("\nCreating automation (disabled initially)...");
      let autoResp = await client.createAutomation("freq", AutomationCurve.LINEAR, points, false);
      console.log(`create_automation: ${autoResp.ok ? "OK" : "FAILED"}, ID=${autoResp.id}`);

      resp = await client.readScore("i1 0 6");
      console.log(`read_score: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      resp = await client.start();
      console.log(`start: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      console.log("\nPlaying for 2 seconds with automation disabled (steady 440Hz)...");
      await sleep(2000);

      console.log("\nEnabling automation (LINEAR curve: 440Hz -> 880Hz over 2 seconds)...");
      resp = await client.enableAutomation("freq");
      console.log(`enable_automation: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      await sleep(2500);

      await client.stop();
      console.log("stop: OK");
    }

    if (selectedTest == null || selectedTest === 3) {
      // Test 3: STEP curve
      console.log("\n=== Test 3: STEP Curve Automation ===");
      await client.destroyEngine();
      await client.createEngine();
      await client.setOption("-odac");
      await client.setOption("-d");
      await client.compileOrc(orc);
      await client.createChannel("freq", 440.0);
      await client.createChannel("amp", 0.5);

      const stepPoints = [
        { time: 2.0, value: 440.0 },
        { time: 2.5, value: 550.0 },
        { time: 3.0, value: 660.0 },
        { time: 3.5, value: 880.0 },
        { time: 4.0, value: 660.0 },
      ];

      let autoResp = await client.createAutomation("freq", AutomationCurve.STEP, stepPoints, false);
      console.log(`create_automation (STEP): ${autoResp.ok ? "OK" : "FAILED"}, ID=${autoResp.id}`);

      await client.readScore("i1 0 6");
      await client.start();

      console.log("Waiting 2 seconds before enabling STEP automation...");
      await sleep(2000);

      console.log("Enabling STEP automation (frequency jumps every 0.5 seconds)...");
      let resp = await client.enableAutomation("freq");
      console.log(`enable_automation: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      await sleep(2500);

      await client.stop();
      console.log("stop: OK");
    }

    if (selectedTest == null || selectedTest === 4) {
      // Test 4: EXPONENTIAL curve
      console.log("\n=== Test 4: EXPONENTIAL Curve Automation ===");
      await client.destroyEngine();
      await client.createEngine();
      await client.setOption("-odac");
      await client.setOption("-d");
      await client.compileOrc(orc);
      await client.createChannel("freq", 440.0);
      await client.createChannel("amp", 0.5);

      const expPoints = [
        { time: 2.0, value: 220.0 },
        { time: 4.0, value: 880.0 },
      ];

      let autoResp = await client.createAutomation("freq", AutomationCurve.EXPONENTIAL, expPoints, false);
      console.log(`create_automation (EXPONENTIAL): ${autoResp.ok ? "OK" : "FAILED"}, ID=${autoResp.id}`);

      await client.readScore("i1 0 6");
      await client.start();

      console.log("Waiting 2 seconds before enabling EXPONENTIAL automation...");
      await sleep(2000);

      console.log("Enabling EXPONENTIAL automation (220Hz -> 880Hz exponential curve)...");
      let resp = await client.enableAutomation("freq");
      console.log(`enable_automation: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      await sleep(2500);

      await client.stop();
      console.log("stop: OK");

      // List automations
      console.log("\n=== Listing Automations ===");
      const listResp = await client.listAutomations();
      console.log(`list_automations: ${listResp.ok ? "OK" : "FAILED"}`);
      for (const auto of listResp.automations) {
        console.log(`  ID=${auto.id}, channel=${auto.channel}, enabled=${auto.enabled}, points=${auto.nPoints}`);
      }

      // Clear all automations
      console.log("\nClearing all automations...");
      let resp2 = await client.clearAutomations();
      console.log(`clear_automations: ${resp2.ok ? "OK" : "FAILED"} ${resp2.message}`);

      // Final cleanup
      await client.destroyEngine();
      console.log("destroy_engine: OK");
    }

    if (selectedTest == null || selectedTest === 5) {
      console.log("\n=== Test 5: LINEAR Automation with Resolution ===");
      await client.createEngine();
      await client.setOption("-odac");
      await client.setOption("-d");
      await client.compileOrc(orc);
      await client.createChannel("freq", 220.0);
      await client.createChannel("amp", 0.5);

      const quantPoints = [
        { time: 2.0, value: 220.0 },
        { time: 6.0, value: 880.0 },
      ];

      const resolution = "100";
      let autoResp = await client.createAutomation(
        "freq",
        AutomationCurve.LINEAR,
        quantPoints,
        false,
        resolution
      );
      console.log(
        `create_automation (LINEAR + resolution=${resolution}): ${
          autoResp.ok ? "OK" : "FAILED"
        }, ID=${autoResp.id}`
      );

      await client.readScore("i1 0 8");
      await client.start();

      console.log("Waiting 2 seconds before enabling quantized automation...");
      await sleep(2000);

      console.log(
        "Enabling quantized LINEAR automation (listen for stepped pitch changes)..."
      );
      let resp = await client.enableAutomation("freq");
      console.log(`enable_automation: ${resp.ok ? "OK" : "FAILED"} ${resp.message}`);

      await sleep(4500);

      await client.stop();
      console.log("stop: OK");

      await client.destroyEngine();
      console.log("destroy_engine: OK");
    }

  } finally {
    unsubscribeState();
    await client.close();
  }

  console.log("\nAll tests completed!");
}

const args = process.argv.slice(2);
let selectedTest = null;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--test=")) {
    const v = parseInt(arg.slice("--test=".length), 10);
    if (!Number.isNaN(v)) selectedTest = v;
  } else if (arg === "--test" && i + 1 < args.length) {
    const v = parseInt(args[i + 1], 10);
    if (!Number.isNaN(v)) selectedTest = v;
    i++;
  }
}

main(selectedTest).catch(console.error);
