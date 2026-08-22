package com.kunstmusik.blueengine;

import org.zeromq.SocketType;
import org.zeromq.ZContext;
import org.zeromq.ZMQ;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

/**
 * Blue Engine Java Client
 */
public class BlueEngineClient implements AutoCloseable {

    // Command codes
    public static final byte CMD_CREATE_ENGINE = 0x01;
    public static final byte CMD_COMPILE_ORC = 0x02;
    public static final byte CMD_READ_SCORE = 0x03;
    public static final byte CMD_SET_OPTION = 0x04;
    public static final byte CMD_START = 0x05;
    public static final byte CMD_STOP = 0x06;
    public static final byte CMD_DESTROY_ENGINE = 0x07;
    // Channel commands
    public static final byte CMD_SET_CHANNEL = 0x10;
    public static final byte CMD_GET_CHANNEL = 0x11;
    public static final byte CMD_CREATE_CHANNEL = 0x12;
    public static final byte CMD_GET_SHM_NAME = 0x13;
    // Automation commands
    public static final byte CMD_CREATE_AUTOMATION = 0x20;
    public static final byte CMD_UPDATE_AUTOMATION = 0x21;
    public static final byte CMD_DELETE_AUTOMATION = 0x22;
    public static final byte CMD_ENABLE_AUTOMATION = 0x23;
    public static final byte CMD_DISABLE_AUTOMATION = 0x24;
    public static final byte CMD_LIST_AUTOMATIONS = 0x25;
    public static final byte CMD_CLEAR_AUTOMATIONS = 0x26;

    // Status codes
    public static final byte STATUS_OK = 0x00;
    public static final byte STATUS_ERROR = 0x01;

    // Automation curve types
    public static final byte CURVE_STEP = 0x00;
    public static final byte CURVE_LINEAR = 0x01;
    public static final byte CURVE_EXPONENTIAL = 0x02;

    public record AutomationPoint(double time, double value) {}

    private final ZContext context;
    private final ZMQ.Socket socket;

    public BlueEngineClient(String endpoint) {
        context = new ZContext();
        socket = context.createSocket(SocketType.REQ);
        socket.connect(endpoint);
    }

    public BlueEngineClient() {
        this("tcp://localhost:5555");
    }

    @Override
    public void close() {
        context.close();
    }

    public record Response(boolean ok, String message) {}

    private Response sendCommand(byte cmd, byte[] payload) {
        // Build request
        ByteBuffer request = ByteBuffer.allocate(5 + payload.length);
        request.order(ByteOrder.LITTLE_ENDIAN);
        request.put(cmd);
        request.putInt(payload.length);
        request.put(payload);

        socket.send(request.array(), 0);

        // Receive response
        byte[] response = socket.recv(0);
        if (response == null || response.length < 5) {
            return new Response(false, "Invalid response");
        }

        ByteBuffer buf = ByteBuffer.wrap(response);
        buf.order(ByteOrder.LITTLE_ENDIAN);

        byte status = buf.get();
        int msgLen = buf.getInt();
        byte[] msgBytes = new byte[msgLen];
        buf.get(msgBytes);
        String message = new String(msgBytes, StandardCharsets.UTF_8);

        return new Response(status == STATUS_OK, message);
    }

    private Response sendCommand(byte cmd, String payload) {
        return sendCommand(cmd, payload.getBytes(StandardCharsets.UTF_8));
    }

    private Response sendCommand(byte cmd) {
        return sendCommand(cmd, new byte[0]);
    }

    public Response createEngine() {
        Response resp = sendCommand(CMD_CREATE_ENGINE);
        if (!resp.ok() && resp.message().contains("Engine already created")) {
            sendCommand(CMD_DESTROY_ENGINE);
            resp = sendCommand(CMD_CREATE_ENGINE);
        }
        return resp;
    }

    public Response compileOrc(String orc) {
        return sendCommand(CMD_COMPILE_ORC, orc);
    }

    public Response readScore(String sco) {
        return sendCommand(CMD_READ_SCORE, sco);
    }

    public Response setOption(String option) {
        return sendCommand(CMD_SET_OPTION, option);
    }

    public Response start() {
        return sendCommand(CMD_START);
    }

    public Response stop() {
        return sendCommand(CMD_STOP);
    }

    public Response destroyEngine() {
        return sendCommand(CMD_DESTROY_ENGINE);
    }

    // Channel operations
    public Response createChannel(String name, double initialValue) {
        byte[] nameBytes = (name + "\0").getBytes(StandardCharsets.UTF_8);
        ByteBuffer payload = ByteBuffer.allocate(nameBytes.length + 8);
        payload.order(ByteOrder.LITTLE_ENDIAN);
        payload.put(nameBytes);
        payload.putDouble(initialValue);
        return sendCommand(CMD_CREATE_CHANNEL, payload.array());
    }

    public Response setChannel(String name, double value) {
        byte[] nameBytes = (name + "\0").getBytes(StandardCharsets.UTF_8);
        ByteBuffer payload = ByteBuffer.allocate(nameBytes.length + 8);
        payload.order(ByteOrder.LITTLE_ENDIAN);
        payload.put(nameBytes);
        payload.putDouble(value);
        return sendCommand(CMD_SET_CHANNEL, payload.array());
    }

    public record ChannelResponse(boolean ok, double value) {}

    public ChannelResponse getChannel(String name) {
        byte[] nameBytes = (name + "\0").getBytes(StandardCharsets.UTF_8);
        Response resp = sendCommand(CMD_GET_CHANNEL, nameBytes);
        if (resp.ok() && resp.message().length() >= 8) {
            ByteBuffer buf = ByteBuffer.wrap(resp.message().getBytes(StandardCharsets.ISO_8859_1));
            buf.order(ByteOrder.LITTLE_ENDIAN);
            return new ChannelResponse(true, buf.getDouble());
        }
        return new ChannelResponse(false, 0.0);
    }

    public Response getShmName() {
        return sendCommand(CMD_GET_SHM_NAME);
    }

    // Automation operations
    public record AutomationResponse(boolean ok, int id, String message) {}

    public AutomationResponse createAutomation(String channelName, byte curve,
                                              AutomationPoint[] points, boolean enabled) {
        return createAutomation(channelName, curve, points, enabled, "0");
    }

    public AutomationResponse createAutomation(String channelName, byte curve,
                                              AutomationPoint[] points, boolean enabled,
                                              String resolutionDecimal) {
        byte[] nameBytes = (channelName + "\0").getBytes(StandardCharsets.UTF_8);
        byte[] resolutionBytes = resolutionDecimal.getBytes(StandardCharsets.US_ASCII);
        // payload: name\0 + curve(1B) + enabled(1B) + resolutionLength(4B) + resolution(ASCII) + n_points(4B) + points(16B each)
        int payloadLen = Math.addExact(nameBytes.length + 2 + 4 + resolutionBytes.length + 4,
                Math.multiplyExact(points.length, 16));
        ByteBuffer payload = ByteBuffer.allocate(payloadLen);
        payload.order(ByteOrder.LITTLE_ENDIAN);
        payload.put(nameBytes);
        payload.put(curve);
        payload.put((byte) (enabled ? 1 : 0));
        payload.putInt(resolutionBytes.length);
        payload.put(resolutionBytes);
        payload.putInt(points.length);
        for (AutomationPoint pt : points) {
            payload.putDouble(pt.time());
            payload.putDouble(pt.value());
        }

        Response resp = sendCommand(CMD_CREATE_AUTOMATION, payload.array());
        int id = 0;
        if (resp.ok() && resp.message().length() >= 4) {
            ByteBuffer buf = ByteBuffer.wrap(resp.message().getBytes(StandardCharsets.ISO_8859_1));
            buf.order(ByteOrder.LITTLE_ENDIAN);
            id = buf.getInt();
        }
        return new AutomationResponse(resp.ok(), id, resp.message());
    }

    public Response updateAutomation(String channelName, byte curve,
                                    AutomationPoint[] points, boolean enabled) {
        return updateAutomation(channelName, curve, points, enabled, "0");
    }

    public Response updateAutomation(String channelName, byte curve,
                                    AutomationPoint[] points, boolean enabled,
                                    String resolutionDecimal) {
        byte[] nameBytes = (channelName + "\0").getBytes(StandardCharsets.UTF_8);
        byte[] resolutionBytes = resolutionDecimal.getBytes(StandardCharsets.US_ASCII);
        // payload: name\0 + curve(1B) + enabled(1B) + resolutionLength(4B) + resolution(ASCII) + n_points(4B) + points(16B each)
        int payloadLen = Math.addExact(nameBytes.length + 2 + 4 + resolutionBytes.length + 4,
                Math.multiplyExact(points.length, 16));
        ByteBuffer payload = ByteBuffer.allocate(payloadLen);
        payload.order(ByteOrder.LITTLE_ENDIAN);
        payload.put(nameBytes);
        payload.put(curve);
        payload.put((byte) (enabled ? 1 : 0));
        payload.putInt(resolutionBytes.length);
        payload.put(resolutionBytes);
        payload.putInt(points.length);
        for (AutomationPoint pt : points) {
            payload.putDouble(pt.time());
            payload.putDouble(pt.value());
        }
        return sendCommand(CMD_UPDATE_AUTOMATION, payload.array());
    }

    public Response deleteAutomation(String channelName) {
        return sendCommand(CMD_DELETE_AUTOMATION, (channelName + "\0").getBytes(StandardCharsets.UTF_8));
    }

    public Response enableAutomation(String channelName) {
        return sendCommand(CMD_ENABLE_AUTOMATION, (channelName + "\0").getBytes(StandardCharsets.UTF_8));
    }

    public Response disableAutomation(String channelName) {
        return sendCommand(CMD_DISABLE_AUTOMATION, (channelName + "\0").getBytes(StandardCharsets.UTF_8));
    }

    public Response listAutomations() {
        return sendCommand(CMD_LIST_AUTOMATIONS);
    }

    public Response clearAutomations() {
        return sendCommand(CMD_CLEAR_AUTOMATIONS);
    }

    public static void main(String[] args) throws InterruptedException {
        int selectedTest = 0; // 0 = all tests
        for (int i = 0; i < args.length; i++) {
            if (args[i].startsWith("--test=")) {
                try {
                    selectedTest = Integer.parseInt(args[i].substring("--test=".length()));
                } catch (NumberFormatException ignored) {
                    selectedTest = 0;
                }
            } else if ("--test".equals(args[i]) && i + 1 < args.length) {
                try {
                    selectedTest = Integer.parseInt(args[i + 1]);
                } catch (NumberFormatException ignored) {
                    selectedTest = 0;
                }
                i++;
            }
        }

        System.out.println("Connecting to blue-engine...");

        try (BlueEngineClient client = new BlueEngineClient()) {
            // Compile orchestra using standard chnexport control channels.
            String orc = """
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
                """;

            if (selectedTest == 0 || selectedTest == 1) {
                // Create engine
                Response resp = client.createEngine();
                System.out.println("create_engine: " + (resp.ok() ? "OK" : "FAILED") + " " + resp.message());
                if (!resp.ok()) return;

                // Set options
                client.setOption("-odac");
                System.out.println("set_option(-odac): OK");

                client.setOption("-d");
                System.out.println("set_option(-d): OK");

                resp = client.compileOrc(orc);
                System.out.println("compile_orc: " + (resp.ok() ? "OK" : "FAILED") + " " + resp.message());

                // Create channels
                resp = client.createChannel("freq", 440.0);
                System.out.println("create_channel(freq): " + (resp.ok() ? "OK" : "FAILED"));

                resp = client.createChannel("amp", 0.5);
                System.out.println("create_channel(amp): " + (resp.ok() ? "OK" : "FAILED"));

                // Test 1: Manual channel updates
                System.out.println("\n=== Test 1: Manual Channel Updates ===");
                resp = client.readScore("i1 0 5");
                System.out.println("read_score: " + (resp.ok() ? "OK" : "FAILED") + " " + resp.message());

                // Start
                resp = client.start();
                System.out.println("start: " + (resp.ok() ? "OK" : "FAILED") + " " + resp.message());

                // Demonstrate channel updates
                System.out.println("Playing with channel updates...");
                int[] frequencies = {440, 550, 660, 880, 660, 550, 440};
                for (int freq : frequencies) {
                    resp = client.setChannel("freq", freq);
                    System.out.println("  set freq=" + freq + ": " + (resp.ok() ? "OK" : "FAILED"));
                    Thread.sleep(400);
                }

                // Stop
                client.stop();
                System.out.println("stop: OK");

                // Destroy
                client.destroyEngine();
                System.out.println("destroy_engine: OK");
            }

            if (selectedTest == 0 || selectedTest == 2) {
                // Test 2: LINEAR curve automation
                System.out.println("\n=== Test 2: LINEAR Curve Automation ===");
                Response resp = client.createEngine();
                System.out.println("create_engine: " + (resp.ok() ? "OK" : "FAILED"));
                client.setOption("-odac");
                client.setOption("-d");
                resp = client.compileOrc(orc);
                System.out.println("compile_orc: " + (resp.ok() ? "OK" : "FAILED"));
                client.createChannel("freq", 440.0);
                System.out.println("create_channel(freq): OK");
                client.createChannel("amp", 0.5);
                System.out.println("create_channel(amp): OK");

                AutomationPoint[] linearPoints = {
                    new AutomationPoint(2.0, 440.0),
                    new AutomationPoint(4.0, 880.0)
                };
                AutomationResponse autoResp = client.createAutomation("freq", CURVE_LINEAR, linearPoints, false);
                System.out.println("create_automation (LINEAR): " + (autoResp.ok() ? "OK" : "FAILED") + ", ID=" + autoResp.id());

                resp = client.readScore("i1 0 6");
                System.out.println("read_score: " + (resp.ok() ? "OK" : "FAILED"));
                resp = client.start();
                System.out.println("start: " + (resp.ok() ? "OK" : "FAILED"));

                System.out.println("Playing for 2 seconds with automation disabled (steady 440Hz)...");
                Thread.sleep(2000);

                System.out.println("Enabling LINEAR automation (440Hz -> 880Hz over 2 seconds)...");
                resp = client.enableAutomation("freq");
                System.out.println("enable_automation: " + (resp.ok() ? "OK" : "FAILED"));

                Thread.sleep(2500);

                client.stop();
                System.out.println("stop: OK");
            }

            if (selectedTest == 0 || selectedTest == 3) {
                // Test 3: STEP curve
                System.out.println("\n=== Test 3: STEP Curve Automation ===");
                client.destroyEngine();
                client.createEngine();
                client.setOption("-odac");
                client.setOption("-d");
                client.compileOrc(orc);
                client.createChannel("freq", 440.0);
                client.createChannel("amp", 0.5);

                AutomationPoint[] stepPoints = {
                    new AutomationPoint(2.0, 440.0),
                    new AutomationPoint(2.5, 550.0),
                    new AutomationPoint(3.0, 660.0),
                    new AutomationPoint(3.5, 880.0),
                    new AutomationPoint(4.0, 660.0)
                };
                AutomationResponse autoResp = client.createAutomation("freq", CURVE_STEP, stepPoints, false);
                System.out.println("create_automation (STEP): " + (autoResp.ok() ? "OK" : "FAILED") + ", ID=" + autoResp.id());

                client.readScore("i1 0 6");
                client.start();

                System.out.println("Waiting 2 seconds before enabling STEP automation...");
                Thread.sleep(2000);

                System.out.println("Enabling STEP automation (frequency jumps every 0.5 seconds)...");
                Response resp = client.enableAutomation("freq");
                System.out.println("enable_automation: " + (resp.ok() ? "OK" : "FAILED"));

                Thread.sleep(2500);

                client.stop();
                System.out.println("stop: OK");
            }

            if (selectedTest == 0 || selectedTest == 4) {
                // Test 4: EXPONENTIAL curve
                System.out.println("\n=== Test 4: EXPONENTIAL Curve Automation ===");
                client.destroyEngine();
                client.createEngine();
                client.setOption("-odac");
                client.setOption("-d");
                client.compileOrc(orc);
                client.createChannel("freq", 440.0);
                client.createChannel("amp", 0.5);

                AutomationPoint[] expPoints = {
                    new AutomationPoint(2.0, 220.0),
                    new AutomationPoint(4.0, 880.0)
                };
                AutomationResponse autoResp = client.createAutomation("freq", CURVE_EXPONENTIAL, expPoints, false);
                System.out.println("create_automation (EXPONENTIAL): " + (autoResp.ok() ? "OK" : "FAILED") + ", ID=" + autoResp.id());

                client.readScore("i1 0 6");
                client.start();

                System.out.println("Waiting 2 seconds before enabling EXPONENTIAL automation...");
                Thread.sleep(2000);

                System.out.println("Enabling EXPONENTIAL automation (220Hz -> 880Hz exponential curve)...");
                Response resp = client.enableAutomation("freq");
                System.out.println("enable_automation: " + (resp.ok() ? "OK" : "FAILED"));

                Thread.sleep(2500);

                client.stop();
                System.out.println("stop: OK");

                // List and clear automations
                System.out.println("\n=== Listing Automations ===");
                resp = client.listAutomations();
                System.out.println("list_automations: " + (resp.ok() ? "OK" : "FAILED"));

                System.out.println("\nClearing all automations...");
                resp = client.clearAutomations();
                System.out.println("clear_automations: " + (resp.ok() ? "OK" : "FAILED"));

                // Final cleanup
                client.destroyEngine();
                System.out.println("destroy_engine: OK");
            }

            if (selectedTest == 0 || selectedTest == 5) {
                // Test 5: LINEAR automation with resolution (quantization)
                System.out.println("\n=== Test 5: LINEAR Automation with Resolution ===");
                Response resp = client.createEngine();
                System.out.println("create_engine: " + (resp.ok() ? "OK" : "FAILED"));
                client.setOption("-odac");
                client.setOption("-d");
                resp = client.compileOrc(orc);
                System.out.println("compile_orc: " + (resp.ok() ? "OK" : "FAILED"));
                client.createChannel("freq", 220.0);
                System.out.println("create_channel(freq): OK");
                client.createChannel("amp", 0.5);
                System.out.println("create_channel(amp): OK");

                AutomationPoint[] quantPoints = {
                    new AutomationPoint(2.0, 220.0),
                    new AutomationPoint(6.0, 880.0)
                };

                String resolution = "100";
                AutomationResponse autoResp = client.createAutomation(
                        "freq",
                        CURVE_LINEAR,
                        quantPoints,
                        false,
                        resolution
                );
                System.out.println(
                        "create_automation (LINEAR + resolution=" + resolution + "): "
                                + (autoResp.ok() ? "OK" : "FAILED") + ", ID=" + autoResp.id()
                );

                resp = client.readScore("i1 0 8");
                System.out.println("read_score: " + (resp.ok() ? "OK" : "FAILED"));
                resp = client.start();
                System.out.println("start: " + (resp.ok() ? "OK" : "FAILED"));

                System.out.println("Waiting 2 seconds before enabling quantized automation...");
                Thread.sleep(2000);

                System.out.println("Enabling quantized LINEAR automation (listen for stepped pitch changes)...");
                resp = client.enableAutomation("freq");
                System.out.println("enable_automation: " + (resp.ok() ? "OK" : "FAILED"));

                Thread.sleep(4500);

                client.stop();
                System.out.println("stop: OK");

                client.destroyEngine();
                System.out.println("destroy_engine: OK");
            }

        }

        System.out.println("\nAll tests completed!");
    }
}
