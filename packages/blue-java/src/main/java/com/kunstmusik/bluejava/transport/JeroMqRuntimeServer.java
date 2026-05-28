package com.kunstmusik.bluejava.transport;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kunstmusik.bluejava.cli.RuntimeOptions;
import com.kunstmusik.bluejava.clojure.ClojureLibraryLoader;
import com.kunstmusik.bluejava.clojure.ClojureSession;
import com.kunstmusik.bluejava.errors.ClojureEvaluationException;
import com.kunstmusik.bluejava.protocol.RuntimeErrorEnvelope;
import com.kunstmusik.bluejava.protocol.RuntimeMethod;
import com.kunstmusik.bluejava.protocol.RuntimeRequestEnvelope;
import com.kunstmusik.bluejava.protocol.RuntimeResponseEnvelope;
import com.kunstmusik.bluejava.session.DependencySpec;
import com.kunstmusik.bluejava.session.ProjectSession;
import org.zeromq.SocketType;
import org.zeromq.ZContext;
import org.zeromq.ZMQ;

import java.io.File;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class JeroMqRuntimeServer {
    private final RuntimeOptions options;
    private final ObjectMapper objectMapper;
    private final ClojureLibraryLoader clojureLibraryLoader;
    private volatile boolean running = true;
    private ProjectSession projectSession = null;
    private int namespaceCounter = 0;

    public JeroMqRuntimeServer(RuntimeOptions options) {
        this.options = options;
        this.objectMapper = new ObjectMapper();
        this.clojureLibraryLoader = new ClojureLibraryLoader();
    }

    public void run() throws Exception {
        try (ZContext context = new ZContext()) {
            ZMQ.Socket controlSocket = context.createSocket(SocketType.REP);
            controlSocket.bind(options.getControlEndpoint());
            controlSocket.setReceiveTimeOut(250);

            ZMQ.Socket eventSocket = null;
            if (options.getEventEndpoint() != null && !options.getEventEndpoint().isBlank()) {
                eventSocket = context.createSocket(SocketType.PUB);
                eventSocket.bind(options.getEventEndpoint());
            }

            try {
                while (running && !Thread.currentThread().isInterrupted()) {
                    byte[] requestBytes = controlSocket.recv(0);
                    if (requestBytes == null) {
                        continue;
                    }

                    RuntimeResponseEnvelope<?> response = handleRequest(requestBytes);
                    byte[] responseBytes = objectMapper.writeValueAsBytes(response);
                    controlSocket.send(responseBytes, 0);
                }
            } finally {
                if (eventSocket != null) {
                    eventSocket.close();
                }
                controlSocket.close();
            }
        }
    }

    private RuntimeResponseEnvelope<?> handleRequest(byte[] requestBytes) {
        long startedAt = System.nanoTime();
        RuntimeRequestEnvelope request;

        try {
            request = objectMapper.readValue(requestBytes, RuntimeRequestEnvelope.class);
        } catch (Exception ex) {
            return RuntimeResponseEnvelope.error(
                    null,
                    new RuntimeErrorEnvelope("PROTOCOL_ERROR", "Malformed runtime request"),
                    elapsedMs(startedAt));
        }

        if (request.authToken == null || !request.authToken.equals(options.getAuthToken())) {
            return RuntimeResponseEnvelope.error(
                    request.id,
                    new RuntimeErrorEnvelope("AUTH_FAILED", "Invalid auth token"),
                    elapsedMs(startedAt));
        }

        try {
            RuntimeMethod method = RuntimeMethod.fromValue(request.method);
            return switch (method) {
                case RUNTIME_HEALTH -> RuntimeResponseEnvelope.success(
                        request.id,
                        createHealthResult(),
                        elapsedMs(startedAt));
                case RUNTIME_SHUTDOWN -> {
                    running = false;
                    Map<String, Object> accepted = new LinkedHashMap<>();
                    accepted.put("accepted", true);
                    yield RuntimeResponseEnvelope.success(request.id, accepted, elapsedMs(startedAt));
                }
                case SESSION_INIT -> RuntimeResponseEnvelope.success(
                        request.id,
                        initializeSession(request),
                        elapsedMs(startedAt));
                case CLOJURE_EVAL -> {
                    RequestResult result = evaluateClojure(request);
                    yield RuntimeResponseEnvelope.success(
                                    request.id,
                                    result.result(),
                                    elapsedMs(startedAt))
                            .withOutput(result.stdout(), result.stderr());
                }
                case CLOJURE_EVAL_SCORE_OBJECT -> {
                    RequestResult result = evaluateClojureScoreObject(request);
                    yield RuntimeResponseEnvelope.success(
                                    request.id,
                                    result.result(),
                                    elapsedMs(startedAt))
                            .withOutput(result.stdout(), result.stderr());
                }
                case CLOJURE_REINITIALIZE -> RuntimeResponseEnvelope.success(
                        request.id,
                        reinitializeClojure(),
                        elapsedMs(startedAt));
                default -> RuntimeResponseEnvelope.error(
                        request.id,
                        new RuntimeErrorEnvelope("METHOD_NOT_IMPLEMENTED", "Method not implemented in this helper phase: " + request.method),
                        elapsedMs(startedAt));
            };
        } catch (ClojureEvaluationException ex) {
            RuntimeErrorEnvelope error = new RuntimeErrorEnvelope("CLOJURE_EVALUATION_ERROR", ex.getMessage());
            error.stack = stackTraceToString(ex.getCause() != null ? ex.getCause() : ex);
            error.line = ex.getLine();
            error.column = ex.getColumn();
            return RuntimeResponseEnvelope.error(request.id, error, elapsedMs(startedAt))
                    .withOutput(ex.getStdout(), ex.getStderr());
        } catch (IllegalArgumentException ex) {
            return RuntimeResponseEnvelope.error(
                    request.id,
                    new RuntimeErrorEnvelope("PROTOCOL_ERROR", ex.getMessage()),
                    elapsedMs(startedAt));
        } catch (Throwable ex) {
            RuntimeErrorEnvelope error = new RuntimeErrorEnvelope(
                    "INTERNAL_SERVER_ERROR",
                    ex.getMessage() != null ? ex.getMessage() : "Unexpected Java runtime helper error");
            error.stack = stackTraceToString(ex);
            return RuntimeResponseEnvelope.error(request.id, error, elapsedMs(startedAt));
        }
    }

    private Map<String, Object> initializeSession(RuntimeRequestEnvelope request) {
        SessionInitParams params = objectMapper.convertValue(request.params, SessionInitParams.class);
        List<DependencySpec> dependencies = params.clojureDependencies != null
                ? params.clojureDependencies
                : Collections.emptyList();
        ClojureSession session = new ClojureSession(nextNamespace());
        projectSession = new ProjectSession(params.projectSessionId, params.projectDir, dependencies, session);
        List<Map<String, Object>> dependencyResults = clojureLibraryLoader.loadDependencies(session, dependencies);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("projectSessionId", params.projectSessionId);
        result.put("clojureNamespace", session.getNamespace());
        result.put("dependenciesLoaded", dependencyResults);
        return result;
    }

    private RequestResult evaluateClojure(RuntimeRequestEnvelope request) {
        ensureProjectSession();
        ClojureEvalParams params = objectMapper.convertValue(request.params, ClojureEvalParams.class);
        ClojureSession.ClojureEvaluationResult evaluation = projectSession.getClojureSession().evalWithOutput(
                params.code,
                params.bindings != null ? params.bindings : Map.of(),
                params.returnVariableName);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("value", evaluation.value());
        result.put("namespace", projectSession.getClojureSession().getNamespace());
        return new RequestResult(result, evaluation.stdout(), evaluation.stderr());
    }

    private RequestResult evaluateClojureScoreObject(RuntimeRequestEnvelope request) {
        ensureProjectSession();
        ClojureEvalScoreObjectParams params = objectMapper.convertValue(request.params, ClojureEvalScoreObjectParams.class);
        ClojureSession.ClojureEvaluationResult evaluation = projectSession.getClojureSession().evaluateScoreObjectWithOutput(
                params.code,
                params.blueDuration,
                params.blueProjectDir != null ? params.blueProjectDir : projectSession.getProjectDir());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scoreText", evaluation.value());
        result.put("namespace", projectSession.getClojureSession().getNamespace());
        return new RequestResult(result, evaluation.stdout(), evaluation.stderr());
    }

    private Map<String, Object> reinitializeClojure() {
        ensureProjectSession();
        ClojureSession session = new ClojureSession(nextNamespace());
        projectSession.setClojureSession(session);
        clojureLibraryLoader.loadDependencies(session, projectSession.getClojureDependencies());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("clojureNamespace", session.getNamespace());
        return result;
    }

    private void ensureProjectSession() {
        if (projectSession == null) {
            throw new IllegalArgumentException("Project session has not been initialized");
        }
    }

    private String nextNamespace() {
        String namespace = "user" + namespaceCounter;
        namespaceCounter += 1;
        return namespace;
    }

    private Map<String, Object> createHealthResult() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("version", "0.0.1");
        result.put("capabilities", Arrays.asList("clojure"));
        result.put("cwd", new File(".").getAbsoluteFile().toPath().normalize().toString());
        result.put("methods", Arrays.stream(RuntimeMethod.values()).map(RuntimeMethod::getValue).toList());
        return result;
    }

    private static long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000L;
    }

    private static String stackTraceToString(Throwable throwable) {
        StringWriter writer = new StringWriter();
        throwable.printStackTrace(new PrintWriter(writer));
        return writer.toString();
    }

    private record RequestResult(Map<String, Object> result, String stdout, String stderr) {
    }

    public static final class SessionInitParams {
        public int projectSessionId;
        public String projectDir;
        public List<DependencySpec> clojureDependencies = Collections.emptyList();
    }

    public static final class ClojureEvalParams {
        public String code;
        public Map<String, Object> bindings = Collections.emptyMap();
        public String returnVariableName;
    }

    public static final class ClojureEvalScoreObjectParams {
        public String code;
        public double blueDuration;
        public String blueProjectDir;
    }
}
