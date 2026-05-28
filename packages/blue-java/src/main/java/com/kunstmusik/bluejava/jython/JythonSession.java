package com.kunstmusik.bluejava.jython;

import org.python.core.Py;
import org.python.core.PyException;
import org.python.core.PyObject;
import org.python.core.Options;
import org.python.core.PySystemState;
import org.python.util.InteractiveInterpreter;

import java.io.File;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public final class JythonSession {
    private static final Pattern SAFE_MODULE_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*");
    private static final Pattern SAFE_RETURN_VARIABLE = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private final String packagedLibraryRoot;
    private final String userLibraryRoot;
    private InteractiveInterpreter interpreter;
    private List<String> libraryPaths = List.of();

    public JythonSession(String packagedLibraryRoot, String userLibraryRoot) {
        this.packagedLibraryRoot = packagedLibraryRoot;
        this.userLibraryRoot = userLibraryRoot;
    }

    public List<String> initialize() {
        if (interpreter != null) {
            return getLibraryPaths();
        }

        List<String> resolvedLibraryPaths = JythonLibraryPath.resolveLibraryPaths(packagedLibraryRoot, userLibraryRoot);
        Options.dont_write_bytecode = true;
        PySystemState systemState = new PySystemState();
        for (String libraryPath : resolvedLibraryPaths) {
            systemState.path.append(Py.newString(libraryPath));
        }

        InteractiveInterpreter initializedInterpreter = new InteractiveInterpreter(null, systemState);
        initializedInterpreter.exec("import site");

        interpreter = initializedInterpreter;
        libraryPaths = resolvedLibraryPaths;
        return getLibraryPaths();
    }

    public List<String> reinitialize() {
        interpreter = null;
        libraryPaths = List.of();
        return initialize();
    }

    public List<String> getLibraryPaths() {
        return List.copyOf(libraryPaths);
    }

    public JythonImportCheckResult importCheckWithOutput(List<String> modules) {
        InteractiveInterpreter activeInterpreter = ensureInterpreter();
        StringWriter stdout = new StringWriter();
        StringWriter stderr = new StringWriter();
        activeInterpreter.setOut(stdout);
        activeInterpreter.setErr(stderr);

        try {
            List<String> importedModules = new ArrayList<>();
            for (String module : modules) {
                if (module == null || !SAFE_MODULE_NAME.matcher(module).matches()) {
                    throw new IllegalArgumentException("Invalid Jython module name: " + module);
                }
                activeInterpreter.exec("from " + module + " import *");
                importedModules.add(module);
            }
            return new JythonImportCheckResult(List.copyOf(importedModules), getLibraryPaths(), stdout.toString(), stderr.toString());
        } catch (PyException ex) {
            throw toEvaluationException(ex, "JYTHON_IMPORT_ERROR", "Unable to import Jython modules", stdout.toString(), stderr.toString());
        }
    }

    public JythonScriptResult evalWithOutput(
            String code,
            Map<String, ? extends Object> bindings,
            String returnVariableName
    ) {
        InteractiveInterpreter activeInterpreter = ensureInterpreter();
        StringWriter stdout = new StringWriter();
        StringWriter stderr = new StringWriter();
        activeInterpreter.setOut(stdout);
        activeInterpreter.setErr(stderr);

        try {
            if (bindings != null) {
                for (Map.Entry<String, ? extends Object> entry : bindings.entrySet()) {
                    activeInterpreter.set(entry.getKey(), entry.getValue());
                }
            }

            activeInterpreter.exec(code);

            String value = "";
            if (returnVariableName != null) {
                if (!SAFE_RETURN_VARIABLE.matcher(returnVariableName).matches()) {
                    throw new IllegalArgumentException("Invalid Jython return variable: " + returnVariableName);
                }

                PyObject result = activeInterpreter.get(returnVariableName);
                if (result != null) {
                    value = result.toString();
                }
            }

            return new JythonScriptResult(value, stdout.toString(), stderr.toString());
        } catch (PyException ex) {
            throw toEvaluationException(ex, "JYTHON_EVALUATION_ERROR", "Unable to evaluate Jython code", stdout.toString(), stderr.toString());
        }
    }

    public JythonScriptResult evaluateScoreObjectWithOutput(String code, double blueDuration, String projectDir) {
        Map<String, Object> bindings = new LinkedHashMap<>();
        bindings.put("score", "");
        bindings.put("blueDuration", blueDuration);
        bindings.put("blueProjectDir", toProjectDirBinding(projectDir));
        return evalWithOutput(code, bindings, "score");
    }

    public JythonScriptResult evaluateObjectBuilderWithOutput(
            String code,
            double blueDuration,
            String commandline,
            String projectDir
    ) {
        Map<String, Object> bindings = new LinkedHashMap<>();
        bindings.put("score", "");
        bindings.put("blueDuration", blueDuration);
        bindings.put("commandline", commandline != null ? commandline : "");
        bindings.put("blueProjectDir", toProjectDirBinding(projectDir));
        return evalWithOutput(code, bindings, "score");
    }

    public JythonScriptResult evaluateInstrumentWithOutput(String code) {
        Map<String, Object> bindings = new LinkedHashMap<>();
        bindings.put("instrument", "");
        return evalWithOutput(code, bindings, "instrument");
    }

    public JythonNoteListResult processNoteListWithOutput(String code, JythonNoteList noteList) {
        InteractiveInterpreter activeInterpreter = ensureInterpreter();
        StringWriter stdout = new StringWriter();
        StringWriter stderr = new StringWriter();
        activeInterpreter.setOut(stdout);
        activeInterpreter.setErr(stderr);

        try {
            activeInterpreter.set("noteList", noteList);
            activeInterpreter.exec(code);
            return new JythonNoteListResult(noteList, stdout.toString(), stderr.toString());
        } catch (PyException ex) {
            throw toEvaluationException(ex, "JYTHON_EVALUATION_ERROR", "Unable to evaluate Jython code", stdout.toString(), stderr.toString());
        }
    }

    private InteractiveInterpreter ensureInterpreter() {
        if (interpreter == null) {
            initialize();
        }
        return interpreter;
    }

    private JythonEvaluationException toEvaluationException(
            PyException ex,
            String defaultCode,
            String defaultMessage,
            String stdout,
            String stderr
    ) {
        String code = ex.match(Py.SyntaxError) ? "JYTHON_SYNTAX_ERROR" : defaultCode;
        String message = ex.value != null ? ex.value.toString() : ex.getMessage();
        if (message == null || message.isBlank()) {
            message = defaultMessage;
        }

        return new JythonEvaluationException(
                code,
                message,
                ex,
                extractIntegerAttribute(ex.value, "lineno"),
                extractIntegerAttribute(ex.value, "offset"),
                stdout,
                stderr);
    }

    private static Integer extractIntegerAttribute(PyObject value, String attributeName) {
        if (value == null) {
            return null;
        }

        PyObject attribute = value.__findattr__(attributeName);
        if (attribute == null) {
            return null;
        }

        try {
            return Integer.parseInt(attribute.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String toProjectDirBinding(String projectDir) {
        if (projectDir == null || projectDir.isBlank()) {
            return "";
        }

        if (projectDir.endsWith(File.separator)) {
            return projectDir;
        }

        return projectDir + File.separator;
    }

    public record JythonScriptResult(String value, String stdout, String stderr) {
    }

    public record JythonImportCheckResult(
            List<String> importedModules,
            List<String> libraryPaths,
            String stdout,
            String stderr
    ) {
    }

    public record JythonNoteListResult(JythonNoteList notes, String stdout, String stderr) {
    }
}