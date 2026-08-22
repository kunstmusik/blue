package com.kunstmusik.bluejava.transport;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kunstmusik.bluejava.cli.RuntimeOptions;
import com.kunstmusik.bluejava.clojure.ClojureLibraryLoader;
import com.kunstmusik.bluejava.clojure.ClojureSession;
import com.kunstmusik.bluejava.errors.ClojureEvaluationException;
import com.kunstmusik.bluejava.jython.JythonEvaluationException;
import com.kunstmusik.bluejava.jython.JythonNote;
import com.kunstmusik.bluejava.jython.JythonNoteList;
import com.kunstmusik.bluejava.jython.JythonSession;
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
                case JYTHON_IMPORT_CHECK -> {
                    RequestResult result = importCheck(request);
                    yield RuntimeResponseEnvelope.success(
                            request.id,
                            result.result(),
                            elapsedMs(startedAt))
                        .withOutput(result.stdout(), result.stderr());
                }
                case JYTHON_EVAL_SCRIPT -> {
                    RequestResult result = evaluateJythonScript(request);
                    yield RuntimeResponseEnvelope.success(
                            request.id,
                            result.result(),
                            elapsedMs(startedAt))
                        .withOutput(result.stdout(), result.stderr());
                }
                case JYTHON_EVAL_SCORE_OBJECT -> {
                    RequestResult result = evaluateJythonScoreObject(request);
                    yield RuntimeResponseEnvelope.success(
                            request.id,
                            result.result(),
                            elapsedMs(startedAt))
                        .withOutput(result.stdout(), result.stderr());
                }
                case JYTHON_EVAL_OBJECT_BUILDER -> {
                    RequestResult result = evaluateJythonObjectBuilder(request);
                    yield RuntimeResponseEnvelope.success(
                            request.id,
                            result.result(),
                            elapsedMs(startedAt))
                        .withOutput(result.stdout(), result.stderr());
                }
                case JYTHON_EVAL_INSTRUMENT -> {
                    RequestResult result = evaluateJythonInstrument(request);
                    yield RuntimeResponseEnvelope.success(
                            request.id,
                            result.result(),
                            elapsedMs(startedAt))
                        .withOutput(result.stdout(), result.stderr());
                }
                case JYTHON_PROCESS_NOTE_LIST -> {
                    RequestResult result = processJythonNoteList(request);
                    yield RuntimeResponseEnvelope.success(
                            request.id,
                            result.result(),
                            elapsedMs(startedAt))
                        .withOutput(result.stdout(), result.stderr());
                }
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
                case JYTHON_REINITIALIZE -> RuntimeResponseEnvelope.success(
                    request.id,
                    reinitializeJython(),
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
            } catch (JythonEvaluationException ex) {
                RuntimeErrorEnvelope error = new RuntimeErrorEnvelope(ex.getCode(), ex.getMessage());
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
        JythonSession jythonSession = new JythonSession(params.jythonPythonLibRoot, params.jythonUserPythonLibRoot);
        projectSession = new ProjectSession(params.projectSessionId, params.projectDir, dependencies, session, jythonSession);
        List<Map<String, Object>> dependencyResults = clojureLibraryLoader.loadDependencies(session, dependencies);

        boolean jythonReady = false;
        List<String> jythonLibraryPaths = Collections.emptyList();
        try {
            jythonLibraryPaths = jythonSession.initialize();
            jythonReady = true;
        } catch (JythonEvaluationException ignored) {
            // Preserve the Clojure session even when Jython assets are unavailable.
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("projectSessionId", params.projectSessionId);
        result.put("clojureNamespace", session.getNamespace());
        result.put("dependenciesLoaded", dependencyResults);
        result.put("jythonReady", jythonReady);
        result.put("jythonLibraryPaths", jythonLibraryPaths);
        return result;
    }

    private RequestResult importCheck(RuntimeRequestEnvelope request) {
        ensureProjectSession();
        JythonImportCheckParams params = objectMapper.convertValue(request.params, JythonImportCheckParams.class);
        JythonSession.JythonImportCheckResult evaluation = projectSession.getJythonSession().importCheckWithOutput(
                params.modules != null ? params.modules : Collections.emptyList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("importedModules", evaluation.importedModules());
        result.put("libraryPaths", evaluation.libraryPaths());
        return new RequestResult(result, evaluation.stdout(), evaluation.stderr());
    }

    private RequestResult evaluateJythonScript(RuntimeRequestEnvelope request) {
        ensureProjectSession();
        JythonEvalParams params = objectMapper.convertValue(request.params, JythonEvalParams.class);
        JythonSession.JythonScriptResult evaluation = projectSession.getJythonSession().evalWithOutput(
                params.code,
                params.bindings != null ? params.bindings : Map.of(),
                params.returnVariableName);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("value", evaluation.value());
        return new RequestResult(result, evaluation.stdout(), evaluation.stderr());
    }

    private RequestResult evaluateJythonScoreObject(RuntimeRequestEnvelope request) {
        ensureProjectSession();
        JythonEvalScoreObjectParams params = objectMapper.convertValue(request.params, JythonEvalScoreObjectParams.class);
        JythonSession.JythonScriptResult evaluation = projectSession.getJythonSession().evaluateScoreObjectWithOutput(
                params.code,
                params.blueDuration,
                params.blueProjectDir != null ? params.blueProjectDir : projectSession.getProjectDir());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scoreText", evaluation.value());
        return new RequestResult(result, evaluation.stdout(), evaluation.stderr());
    }

    private RequestResult evaluateJythonObjectBuilder(RuntimeRequestEnvelope request) {
        ensureProjectSession();
        JythonEvalObjectBuilderParams params = objectMapper.convertValue(request.params, JythonEvalObjectBuilderParams.class);
        JythonSession.JythonScriptResult evaluation = projectSession.getJythonSession().evaluateObjectBuilderWithOutput(
                params.code,
                params.blueDuration,
                params.commandline,
                params.blueProjectDir != null ? params.blueProjectDir : projectSession.getProjectDir());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scoreText", evaluation.value());
        return new RequestResult(result, evaluation.stdout(), evaluation.stderr());
    }

    private RequestResult evaluateJythonInstrument(RuntimeRequestEnvelope request) {
        ensureProjectSession();
        JythonEvalInstrumentParams params = objectMapper.convertValue(request.params, JythonEvalInstrumentParams.class);
        JythonSession.JythonScriptResult evaluation = projectSession.getJythonSession().evaluateInstrumentWithOutput(
                params.code);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("instrumentText", evaluation.value());
        return new RequestResult(result, evaluation.stdout(), evaluation.stderr());
    }

    private RequestResult processJythonNoteList(RuntimeRequestEnvelope request) {
        ensureProjectSession();
        JythonProcessNoteListParams params = objectMapper.convertValue(request.params, JythonProcessNoteListParams.class);
        JythonNoteList noteList = new JythonNoteList();

        if (params.notes != null) {
            for (JythonSerializedNote serializedNote : params.notes) {
                noteList.add(new JythonNote(
                        serializedNote.pfields != null ? serializedNote.pfields : Collections.emptyList(),
                        serializedNote.subjectiveDuration,
                        serializedNote.tied));
            }
        }

        JythonSession.JythonNoteListResult evaluation = projectSession.getJythonSession().processNoteListWithOutput(
                params.code,
                noteList);

        List<Map<String, Object>> serializedNotes = evaluation.notes().stream()
                .map(note -> {
                    Map<String, Object> serialized = new LinkedHashMap<>();
                    serialized.put("pfields", note.getPfields());
                    serialized.put("subjectiveDuration", note.getSubjectiveDuration());
                    serialized.put("tied", note.isTied());
                    return serialized;
                })
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("notes", serializedNotes);
        return new RequestResult(result, evaluation.stdout(), evaluation.stderr());
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
                params.blueProjectDir != null ? params.blueProjectDir : projectSession.getProjectDir(),
                params.commandline);

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

    private Map<String, Object> reinitializeJython() {
        ensureProjectSession();
        List<String> libraryPaths = projectSession.getJythonSession().reinitialize();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("libraryPaths", libraryPaths);
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
        result.put("capabilities", Arrays.asList("clojure", "jython"));
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
        public String jythonPythonLibRoot;
        public String jythonUserPythonLibRoot;
    }

    public static final class JythonImportCheckParams {
        public List<String> modules = Collections.emptyList();
    }

    public static final class JythonEvalParams {
        public String code;
        public Map<String, Object> bindings = Collections.emptyMap();
        public String returnVariableName;
    }

    public static final class JythonEvalScoreObjectParams {
        public String code;
        public double blueDuration;
        public String blueProjectDir;
    }

    public static final class JythonEvalObjectBuilderParams {
        public String code;
        public double blueDuration;
        public String commandline;
        public String blueProjectDir;
    }

    public static final class JythonEvalInstrumentParams {
        public String code;
    }

    public static final class JythonProcessNoteListParams {
        public String code;
        public List<JythonSerializedNote> notes = Collections.emptyList();
    }

    public static final class JythonSerializedNote {
        public List<String> pfields = Collections.emptyList();
        public double subjectiveDuration;
        public boolean tied;
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
        public String commandline;
    }
}
