package blue.parity;

import blue.automation.Parameter;
import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import blue.components.lines.LineUtils;
import blue.ui.core.render.CSDRender;
import blue.utility.NumberUtilities;
import electric.xml.Document;
import electric.xml.Element;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * Repository-owned Java oracle that produces the canonical automation parity
 * corpus. All expectations come from invoking actual Java Blue classes:
 *
 * - realtime rows call blue.components.lines.Line#getValue(double)
 * - resolution rows call Parameter.loadFromXML/saveAsXML, BigDecimal
 *   normalization, and LineUtils.snapToResolution
 * - offline rows call CSDRender#appendParameterScore (reflection) and the
 *   NumberUtilities.formatDouble initialization formatting
 *
 * Output is deterministic: a fixed SplitMix64 seed derives the seeded realtime
 * section, curated rows use fixed inputs, and files are written in stable
 * ASCII caseId order with LF endings and no machine-local metadata.
 */
public final class FixtureGenerator {

    public static final String GENERATOR_ID = "java-blue-automation-fixtures";
    public static final String GENERATOR_VERSION = "1.0.0";
    public static final long SEED = 0x243F6A8885A308D3L;
    public static final String SEED_HEX = "243f6a8885a308d3";
    public static final int SEEDED_REALTIME_COUNT = 2048;

    /** Java Blue reference files recorded with SHA-256 in the manifest. */
    static final String[] REFERENCE_FILES = {
        "blue-core/src/main/java/blue/components/lines/Line.java",
        "blue-core/src/main/java/blue/components/lines/LinePoint.java",
        "blue-core/src/main/java/blue/components/lines/LineUtils.java",
        "blue-core/src/main/java/blue/automation/Parameter.java",
        "blue-core/src/main/java/blue/utility/NumberUtilities.java",
        "blue-ui-core/src/main/java/blue/ui/core/render/CSDRender.java",
    };

    static final String[] REFERENCE_METHODS = {
        "blue.components.lines.Line#getValue(double)",
        "blue.components.lines.Line#loadFromXML(electric.xml.Element)",
        "blue.components.lines.Line#saveAsXML()",
        "blue.automation.Parameter#loadFromXML(electric.xml.Element)",
        "blue.automation.Parameter#saveAsXML()",
        "blue.components.lines.LineUtils#snapToResolution(double,double,double,java.math.BigDecimal)",
        "blue.ui.core.render.CSDRender#appendParameterScore(blue.automation.Parameter,int,java.lang.StringBuilder,double,double)",
        "blue.utility.NumberUtilities#formatDouble(double)",
    };

    // ------------------------------------------------------------------------
    // Row models
    // ------------------------------------------------------------------------

    record RealtimeRow(
            String caseId,
            String origin,
            String category,
            String resolutionText,
            String curve,
            String pointsBits,
            String evaluationTimeBits,
            String expectedKind,
            String expectedBits,
            String expectedCategory,
            String sampleRateBits,
            String sampleNumberBits) {
    }

    record ResolutionRow(
            String caseId,
            String origin,
            String category,
            String operation,
            String parameterBdText,
            String parameterLegacyText,
            String lineBdText,
            String lineLegacyText,
            String snapValueBits,
            String snapMinBits,
            String snapMaxBits,
            String expectedCoefficient,
            String expectedScale,
            String expectedCanonicalText,
            String expectedDoubleBits,
            String expectedActivation,
            String expectedParameterSaveBase64,
            String expectedLineSaveBase64,
            String expectedSnapBits,
            String expectedLinePointsBits,
            String expectedKind,
            String expectedCategory) {
    }

    record OfflineRow(
            String caseId,
            String origin,
            String category,
            String resolutionText,
            String pointsBits,
            String renderStartBits,
            String renderEndBits,
            String instrumentId,
            String expectedInitialBits,
            String expectedInitializationBase64,
            String expectedScoreBase64,
            String expectedKind,
            String expectedCategory) {
    }

    // ------------------------------------------------------------------------
    // Entry point
    // ------------------------------------------------------------------------

    public static void main(String[] args) throws Exception {
        Path output = null;
        Path javaBlueRoot = null;
        String commit = null;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--output" -> output = Path.of(args[++i]);
                case "--java-blue-root" -> javaBlueRoot = Path.of(args[++i]);
                case "--commit" -> commit = args[++i];
                default -> throw new IllegalArgumentException("unknown argument: " + args[i]);
            }
        }
        if (output == null || javaBlueRoot == null || commit == null) {
            throw new IllegalArgumentException(
                    "usage: FixtureGenerator --output <dir> --java-blue-root <dir> --commit <sha>");
        }
        new FixtureGenerator(javaBlueRoot, commit).generate(output);
    }

    private final Path javaBlueRoot;
    private final String commit;
    private final List<RealtimeRow> realtime = new ArrayList<>();
    private final List<ResolutionRow> resolution = new ArrayList<>();
    private final List<OfflineRow> offline = new ArrayList<>();

    private FixtureGenerator(Path javaBlueRoot, String commit) {
        this.javaBlueRoot = javaBlueRoot;
        this.commit = commit;
    }

    private void generate(Path output) throws Exception {
        buildRealtime();
        buildResolution();
        buildOffline();

        realtime.sort(Comparator.comparing(RealtimeRow::caseId));
        resolution.sort(Comparator.comparing(ResolutionRow::caseId));
        offline.sort(Comparator.comparing(OfflineRow::caseId));

        Files.createDirectories(output);

        Map<String, Object> manifest = buildManifest();
        StringBuilder json = new StringBuilder();
        appendJson(json, manifest, 0);
        Files.writeString(output.resolve("manifest.json"), json + "\n", StandardCharsets.UTF_8);

        writeTsv(output.resolve("realtime.tsv"), List.of(
                "caseId", "origin", "category", "resolutionText", "curve", "pointsBits",
                "evaluationTimeBits", "expectedKind", "expectedBits", "expectedCategory",
                "sampleRateBits", "sampleNumberBits"), realtime.stream()
                .map(r -> List.of(r.caseId(), r.origin(), r.category(), r.resolutionText(),
                        r.curve(), r.pointsBits(), r.evaluationTimeBits(), r.expectedKind(),
                        r.expectedBits(), r.expectedCategory(), r.sampleRateBits(),
                        r.sampleNumberBits()))
                .toList());

        writeTsv(output.resolve("resolution.tsv"), List.of(
                "caseId", "origin", "category", "operation",
                "parameterBdText", "parameterLegacyText", "lineBdText", "lineLegacyText",
                "snapValueBits", "snapMinBits", "snapMaxBits",
                "expectedCoefficient", "expectedScale", "expectedCanonicalText",
                "expectedDoubleBits", "expectedActivation",
                "expectedParameterSaveBase64", "expectedLineSaveBase64",
                "expectedSnapBits", "expectedLinePointsBits",
                "expectedKind", "expectedCategory"), resolution.stream()
                .map(r -> List.of(r.caseId(), r.origin(), r.category(), r.operation(),
                        r.parameterBdText(), r.parameterLegacyText(), r.lineBdText(),
                        r.lineLegacyText(), r.snapValueBits(), r.snapMinBits(),
                        r.snapMaxBits(), r.expectedCoefficient(), r.expectedScale(),
                        r.expectedCanonicalText(), r.expectedDoubleBits(), r.expectedActivation(),
                        r.expectedParameterSaveBase64(), r.expectedLineSaveBase64(),
                        r.expectedSnapBits(), r.expectedLinePointsBits(), r.expectedKind(),
                        r.expectedCategory()))
                .toList());

        writeTsv(output.resolve("offline.tsv"), List.of(
                "caseId", "origin", "category", "resolutionText", "pointsBits",
                "renderStartBits", "renderEndBits", "instrumentId",
                "expectedInitialBits", "expectedInitializationBase64",
                "expectedScoreBase64", "expectedKind", "expectedCategory"), offline.stream()
                .map(r -> List.of(r.caseId(), r.origin(), r.category(), r.resolutionText(),
                        r.pointsBits(), r.renderStartBits(), r.renderEndBits(), r.instrumentId(),
                        r.expectedInitialBits(), r.expectedInitializationBase64(),
                        r.expectedScoreBase64(), r.expectedKind(), r.expectedCategory()))
                .toList());
    }

    private static void writeTsv(Path file, List<String> header, List<List<String>> rows)
            throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append(String.join("\t", header)).append('\n');
        for (List<String> row : rows) {
            sb.append(String.join("\t", row.stream().map(f -> f == null ? "" : f).toList()))
                    .append('\n');
        }
        Files.writeString(file, sb.toString(), StandardCharsets.UTF_8);
    }

    // ------------------------------------------------------------------------
    // Manifest
    // ------------------------------------------------------------------------

    private Map<String, Object> buildManifest() throws Exception {
        List<Map<String, String>> sourceFiles = new ArrayList<>();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (String relative : REFERENCE_FILES) {
            byte[] bytes = Files.readAllBytes(javaBlueRoot.resolve(relative));
            byte[] hash = digest.digest(bytes);
            Map<String, String> entry = new LinkedHashMap<>();
            entry.put("path", relative);
            entry.put("sha256", HexFormat.of().formatHex(hash));
            sourceFiles.add(entry);
        }

        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("schemaVersion", 1);
        Map<String, Object> generator = new LinkedHashMap<>();
        generator.put("id", GENERATOR_ID);
        generator.put("version", GENERATOR_VERSION);
        manifest.put("generator", generator);
        Map<String, Object> java = new LinkedHashMap<>();
        java.put("release", Runtime.version().feature());
        manifest.put("java", java);
        Map<String, Object> javaBlue = new LinkedHashMap<>();
        javaBlue.put("repository", "https://github.com/kunstmusik/blue.git");
        javaBlue.put("commit", commit);
        javaBlue.put("sourceFiles", sourceFiles);
        manifest.put("javaBlue", javaBlue);
        manifest.put("referenceMethods", List.of(REFERENCE_METHODS));
        Map<String, Object> seed = new LinkedHashMap<>();
        seed.put("algorithm", "SplitMix64");
        seed.put("value", SEED_HEX);
        manifest.put("seed", seed);
        manifest.put("generationCommand",
                "pnpm fixtures:java-automation -- --java-blue-root \"$JAVA_BLUE_ROOT\"");

        Map<String, Object> counts = new LinkedHashMap<>();
        int total = realtime.size() + resolution.size() + offline.size();
        counts.put("total", total);
        Map<String, Object> bySection = new LinkedHashMap<>();
        bySection.put("realtime", realtime.size());
        bySection.put("resolution", resolution.size());
        bySection.put("offline", offline.size());
        counts.put("bySection", bySection);
        Map<String, Object> byOrigin = new LinkedHashMap<>();
        byOrigin.put("seeded", countOrigin(realtime, resolution, offline, "seeded"));
        byOrigin.put("curated", countOrigin(realtime, resolution, offline, "curated"));
        counts.put("byOrigin", byOrigin);
        Map<String, Object> byCategory = new TreeMap<>();
        TreeMap<String, Integer> merged = new TreeMap<>();
        for (RealtimeRow r : realtime) {
            merged.merge(r.category(), 1, Integer::sum);
        }
        for (ResolutionRow r : resolution) {
            merged.merge(r.category(), 1, Integer::sum);
        }
        for (OfflineRow r : offline) {
            merged.merge(r.category(), 1, Integer::sum);
        }
        byCategory.putAll(merged);
        counts.put("byCategory", byCategory);
        manifest.put("counts", counts);
        return manifest;
    }

    private static int countOrigin(List<RealtimeRow> realtime, List<ResolutionRow> resolution,
            List<OfflineRow> offline, String origin) {
        int count = 0;
        count += realtime.stream().filter(r -> r.origin().equals(origin)).count();
        count += resolution.stream().filter(r -> r.origin().equals(origin)).count();
        count += offline.stream().filter(r -> r.origin().equals(origin)).count();
        return count;
    }

    @SuppressWarnings("unchecked")
    private static void appendJson(StringBuilder sb, Object value, int indent) {
        String pad = "  ".repeat(indent);
        String innerPad = "  ".repeat(indent + 1);
        if (value instanceof Map<?, ?> map) {
            sb.append("{\n");
            int i = 0;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                sb.append(innerPad).append('"').append(entry.getKey()).append("\": ");
                appendJson(sb, entry.getValue(), indent + 1);
                if (++i < map.size()) {
                    sb.append(',');
                }
                sb.append('\n');
            }
            sb.append(pad).append('}');
        } else if (value instanceof List<?> list) {
            if (list.isEmpty()) {
                sb.append("[]");
                return;
            }
            boolean allScalars = list.stream().allMatch(v -> v instanceof String || v instanceof Number);
            if (allScalars) {
                sb.append('[');
                for (int i = 0; i < list.size(); i++) {
                    if (i > 0) {
                        sb.append(", ");
                    }
                    appendJson(sb, list.get(i), indent);
                }
                sb.append(']');
            } else {
                sb.append("[\n");
                for (int i = 0; i < list.size(); i++) {
                    sb.append(innerPad);
                    appendJson(sb, list.get(i), indent + 1);
                    if (i < list.size() - 1) {
                        sb.append(',');
                    }
                    sb.append('\n');
                }
                sb.append(pad).append(']');
            }
        } else if (value instanceof String s) {
            sb.append('"').append(s.replace("\\", "\\\\").replace("\"", "\\\"")).append('"');
        } else {
            sb.append(value);
        }
    }

    // ------------------------------------------------------------------------
    // Java Blue invocation helpers
    // ------------------------------------------------------------------------

    private static final Field LINE_RESOLUTION_FIELD;
    private static final Field PARAMETER_RESOLUTION_FIELD;
    private static final Method APPEND_PARAMETER_SCORE;
    private static final java.lang.reflect.Constructor<Line> EMPTY_LINE_CTOR;
    private static final CSDRender CSD_RENDER;

    static {
        try {
            LINE_RESOLUTION_FIELD = Line.class.getDeclaredField("resolution");
            LINE_RESOLUTION_FIELD.setAccessible(true);
            PARAMETER_RESOLUTION_FIELD = Parameter.class.getDeclaredField("resolution");
            PARAMETER_RESOLUTION_FIELD.setAccessible(true);
            // the private constructor used by Line.loadFromXML: no default points
            EMPTY_LINE_CTOR = Line.class.getDeclaredConstructor(boolean.class, boolean.class);
            EMPTY_LINE_CTOR.setAccessible(true);
            APPEND_PARAMETER_SCORE = CSDRender.class.getDeclaredMethod("appendParameterScore",
                    Parameter.class, int.class, StringBuilder.class, double.class, double.class);
            APPEND_PARAMETER_SCORE.setAccessible(true);
            CSD_RENDER = new CSDRender();
        } catch (ReflectiveOperationException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    /**
     * Builds a Line whose resolution is exactly {@code resolutionText} without
     * the point-snapping side effect of Line.setResolution, matching the field
     * assignment Line.loadFromXML performs. The line starts empty exactly like
     * a loaded line (no default constructor points).
     */
    private static Line lineOf(String resolutionText, double[][] points) throws Exception {
        Line line = EMPTY_LINE_CTOR.newInstance(false, false);
        for (double[] point : points) {
            line.addLinePoint(new LinePoint(point[0], point[1]));
        }
        LINE_RESOLUTION_FIELD.set(line, new BigDecimal(resolutionText));
        return line;
    }

    private record EvalOutcome(String kind, String bits, String category) {
        static EvalOutcome ofValue(double value) {
            return new EvalOutcome("bits", Bits.toBits(value), "");
        }

        static EvalOutcome ofException(RuntimeException e) {
            return new EvalOutcome("exception", "", diagnosticOf(e));
        }
    }

    /** Maps a Java BigDecimal exception to a stable product diagnostic category. */
    static String diagnosticOf(RuntimeException e) {
        String message = e.getMessage() == null ? "" : e.getMessage().toLowerCase(Locale.ROOT);
        if (message.contains("infinite") || message.contains("nan")) {
            return "NON_FINITE_AUTOMATION_INPUT";
        }
        if (message.contains("scale out of range") || message.contains("exponent overflow")) {
            return "DECIMAL_SCALE_OVERFLOW";
        }
        return "INVALID_DECIMAL_SYNTAX";
    }

    /** Calls the actual Java Line.getValue(double) and captures the outcome. */
    private static EvalOutcome evaluate(Line line, double time) {
        try {
            return EvalOutcome.ofValue(line.getValue(time));
        } catch (NumberFormatException | ArithmeticException e) {
            return EvalOutcome.ofException(e);
        }
    }

    private static String pointsBits(Line line) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < line.size(); i++) {
            if (i > 0) {
                sb.append(';');
            }
            LinePoint p = line.getLinePoint(i);
            sb.append(Bits.toBits(p.getX())).append(':').append(Bits.toBits(p.getY()));
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------------
    // Realtime section
    // ------------------------------------------------------------------------

    private static final String[] SEEDED_RESOLUTION_POOL = {
        "-1", "0", "0.00", "0.001", "0.01", "0.1", "0.10", "0.2", "0.25", "0.5",
        "1", "5", "1E+3", "1E-7", "0.123456789012345678901", "1E-400",
    };

    private void buildRealtime() throws Exception {
        buildSeededRealtime();
        buildCuratedRealtime();
    }

    private void buildSeededRealtime() throws Exception {
        SplitMix64 rng = new SplitMix64(SEED);
        double[][] ranges = {
            {0.0, 1.0}, {0.0, 127.0}, {-1.0, 1.0}, {0.0, 1000.0}, {-100.0, 100.0},
        };
        for (int i = 1; i <= SEEDED_REALTIME_COUNT; i++) {
            String resolutionText = SEEDED_RESOLUTION_POOL[rng.nextInt(SEEDED_RESOLUTION_POOL.length)];
            int pointCount = 2 + rng.nextInt(4);
            double[] range = ranges[rng.nextInt(ranges.length)];

            List<double[]> points = new ArrayList<>(pointCount);
            double t = 0.0;
            for (int j = 0; j < pointCount; j++) {
                double value = range[0] + (range[1] - range[0]) * rng.nextUnit();
                points.add(new double[] {t, value});
                t += 0.5 + rng.nextInt(200) / 8.0;
            }
            double lastTime = points.get(points.size() - 1)[0];

            double time;
            int choice = rng.nextInt(12);
            if (choice == 0) {
                time = 0.0;
            } else if (choice == 1) {
                time = points.get(rng.nextInt(pointCount))[0];
            } else if (choice == 2) {
                time = lastTime + 1.0 + rng.nextInt(64);
            } else {
                time = lastTime * rng.nextUnit();
            }

            double[][] pointArray = points.toArray(new double[0][]);
            Line line = lineOf(resolutionText, pointArray);
            EvalOutcome outcome = evaluate(line, time);
            realtime.add(new RealtimeRow(
                    String.format("rt-seed-%04d", i), "seeded", "seeded-linear",
                    resolutionText, "LINEAR", pointsBits(line), Bits.toBits(time),
                    outcome.kind(), outcome.bits(), outcome.category(), "", ""));
        }
    }

    private void buildCuratedRealtime() throws Exception {
        curated("c-rt-empty-line", "empty-line", "-1", new double[0][], 1.0);
        curated("c-rt-single-point", "single-point", "0.01", new double[][] {{0.0, 0.373}}, 0.7);
        curated("c-rt-time-zero", "time-zero", "0.01", new double[][] {{0.0, 0.11}, {1.0, 0.9}}, 0.0);
        // -0.0 == 0.0 in Java, so negative zero time also returns the first point
        Line negZeroLine = lineOf("0.01", new double[][] {{0.0, 0.11}, {1.0, 0.9}});
        addCuratedRealtime("c-rt-time-negative-zero", "time-zero", negZeroLine, -0.0);

        curated("c-rt-direct-point", "direct-point", "0.01",
                new double[][] {{0.0, 0.2}, {1.0, 0.373}, {2.0, 0.8}}, 1.0);
        curated("c-rt-direct-point-last", "direct-point", "0.01",
                new double[][] {{0.0, 0.1}, {1.0, 0.777}}, 1.0);
        curated("c-rt-duplicate-time-mid", "duplicate-time",
                "0.01", new double[][] {{0.0, 0.1}, {2.0, 0.2}, {2.0, 0.777}, {3.0, 0.4}}, 2.0);
        curated("c-rt-duplicate-time-last", "duplicate-time",
                "0.01", new double[][] {{0.0, 0.1}, {1.0, 0.2}, {1.0, 0.888}}, 1.0);
        curated("c-rt-after-last", "after-last", "0.01",
                new double[][] {{0.0, 0.1}, {1.0, 0.993}}, 5.0);
        curated("c-rt-after-last-quantized", "after-last", "0.1",
                new double[][] {{0.0, 0.1}, {1.0, 0.9577}}, 5.0);
        curated("c-rt-before-first", "before-first", "-1",
                new double[][] {{1.0, 0.5}, {2.0, 1.5}}, 0.5);
        curated("c-rt-before-first-quantized", "before-first", "0.1",
                new double[][] {{1.0, 0.5}, {2.0, 1.5}}, 0.5);
        curated("c-rt-flat", "flat", "0.1",
                new double[][] {{0.0, 0.5}, {2.0, 0.5}}, 1.0);
        curated("c-rt-ascending", "ascending", "0.1",
                new double[][] {{0.0, 0.0}, {1.0, 1.0}}, 0.46);
        curated("c-rt-descending", "descending", "0.1",
                new double[][] {{0.0, 1.0}, {1.0, 0.0}}, 0.46);
        curated("c-rt-zero-crossing", "zero-crossing", "0.1",
                new double[][] {{0.0, -1.0}, {2.0, 1.0}}, 1.0);
        curated("c-rt-exact-grid", "exact-grid", "0.1",
                new double[][] {{0.0, 0.0}, {1.0, 0.5}}, 0.6);
        curated("c-rt-adjacent-below", "adjacent-grid", "0.1",
                new double[][] {{0.0, 0.0}, {1.0, 1.0}}, Bits.nextAfter(0.25, 0.0));
        curated("c-rt-adjacent-above", "adjacent-grid", "0.1",
                new double[][] {{0.0, 0.0}, {1.0, 1.0}}, Bits.nextAfter(0.25, 1.0));
        curated("c-rt-signed-zero-values", "special-values", "-1",
                new double[][] {{0.0, 0.0}, {1.0, -0.0}}, 0.5);
        curated("c-rt-subnormal-values", "special-values", "-1",
                new double[][] {{0.0, Double.MIN_VALUE}, {1.0, 2.0 * Double.MIN_VALUE}}, 0.5);
        curated("c-rt-subnormal-quantized", "special-values", "0.0000000000000000001",
                new double[][] {{0.0, Double.MIN_VALUE}, {1.0, 2.0 * Double.MIN_VALUE}}, 0.5);
        curated("c-rt-near-overflow", "special-values", "-1",
                new double[][] {{0.0, 1.0e308}, {1.0, 1.7e308}}, 0.5);
        curated("c-rt-overflow-to-infinite", "non-finite",
                "0.1", new double[][] {{0.0, 1.7e308}, {1.0, -1.7e308}}, 0.25);
        curated("c-rt-nan-time", "non-finite", "0.1",
                new double[][] {{0.0, 0.1}, {1.0, 0.9}}, Double.NaN);
        curated("c-rt-nan-point-value", "non-finite", "-1",
                new double[][] {{0.0, Double.NaN}, {1.0, 0.9}}, 0.5);
        curated("c-rt-infinite-time", "special-values", "0.1",
                new double[][] {{0.0, 0.1}, {1.0, 0.9}}, Double.POSITIVE_INFINITY);
        curated("c-rt-negative-infinite-time", "non-finite", "-1",
                new double[][] {{1.0, 0.5}, {2.0, 1.5}}, Double.NEGATIVE_INFINITY);

        // Resolution identity variants on one descending segment
        String[] variantResolutions = {
            "1", "1E+3", "0.10", "1E-7", "0.0000000000000000001", "1E-400",
            "0.123456789012345678901234", "0.00", "-1", "-0.5", "0.25", "2.5E-2",
        };
        for (int i = 0; i < variantResolutions.length; i++) {
            curated("c-rt-resolution-" + (i + 1), "resolution-variant", variantResolutions[i],
                    new double[][] {{0.0, 0.77}, {2.0, 0.13}}, 1.0);
        }

        // Manager-level subset: the production elapsed-time boundary converts a
        // sample position and rate into the evaluation time (IEEE 754 division).
        managerCurated("c-rt-mgr-48000", "manager-boundary", "0.1",
                new double[][] {{0.0, 0.0}, {2.0, 1.0}}, 48000.0, 16000.0);
        managerCurated("c-rt-mgr-44100", "manager-boundary", "0.01",
                new double[][] {{0.0, 0.0}, {2.0, 1.0}}, 44100.0, 4410.0);
        managerCurated("c-rt-mgr-96000", "manager-boundary", "0.1",
                new double[][] {{0.0, 1.0}, {2.0, 0.0}}, 96000.0, 24000.0);
        managerCurated("c-rt-mgr-unquantized", "manager-boundary", "-1",
                new double[][] {{0.0, 0.0}, {3.0, 1.0}}, 48000.0, 16000.0);
    }

    private void curated(String caseId, String category, String resolutionText, double[][] points,
            double time) throws Exception {
        Line line = lineOf(resolutionText, points);
        addCuratedRealtime(caseId, category, line, time);
    }

    private void addCuratedRealtime(String caseId, String category, Line line, double time) {
        EvalOutcome outcome = evaluate(line, time);
        realtime.add(new RealtimeRow(
                caseId, "curated", category, bdText(LINE_RESOLUTION_FIELD, line), "LINEAR",
                pointsBits(line), Bits.toBits(time), outcome.kind(), outcome.bits(),
                outcome.category(), "", ""));
    }

    private void managerCurated(String caseId, String category, String resolutionText,
            double[][] points, double sampleRate, double sampleNumber) throws Exception {
        double time = sampleNumber / sampleRate;
        Line line = lineOf(resolutionText, points);
        EvalOutcome outcome = evaluate(line, time);
        realtime.add(new RealtimeRow(
                caseId, "curated", category, resolutionText, "LINEAR", pointsBits(line),
                Bits.toBits(time), outcome.kind(), outcome.bits(), outcome.category(),
                Bits.toBits(sampleRate), Bits.toBits(sampleNumber)));
    }

    private static String bdText(Field field, Object owner) {
        try {
            return ((BigDecimal) field.get(owner)).toString();
        } catch (IllegalAccessException e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------------------
    // Resolution section
    // ------------------------------------------------------------------------

    private void buildResolution() throws Exception {
        buildParseRows();
        buildLegacyRows();
        buildParameterRows();
        buildSnapRows();
    }

    private void buildParseRows() {
        String[] texts = {
            "0.1", "0.10", "1e-7", "1E+3", "0.00", ".5", "5.", "+3.25", "-0.0", "0", "007",
            "0.000005678", "5.678e-6", "1E-2147483647", "1E+2147483648", "12345.6789",
            "-0.000000000000000000000001",
            // invalid syntax
            "abc", "1.2.3", "", " 0.1", "0.1 ", "+", ".", "e5", "0x10", "1_000", "NaN",
            "Infinity", "1e", "1e+", "--1",
            // scale overflow
            "1E-2147483648", "1E+2147483649", "0.00000000000000000000000000000001e-2147483647",
        };
        for (int i = 0; i < texts.length; i++) {
            String text = texts[i];
            ResolutionRow row;
            try {
                BigDecimal value = new BigDecimal(text);
                row = expectDecimal("c-res-parse-" + (i + 1), "parse", "parse", text, value);
            } catch (NumberFormatException e) {
                row = expectFailure("c-res-parse-" + (i + 1), diagnosticOf(e), "parse", text);
            }
            resolution.add(row);
        }
    }

    private ResolutionRow expectDecimal(String caseId, String category, String operation,
            String inputText, BigDecimal value) {
        BigDecimal canonical = new BigDecimal(value.toString());
        return new ResolutionRow(caseId, "curated", category, operation, inputText, "", "", "",
                "", "", "", canonical.unscaledValue().toString(), Integer.toString(canonical.scale()),
                canonical.toString(), Bits.toBits(value.doubleValue()),
                value.doubleValue() > 0.0 ? "1" : "0", "", "", "", "", "bits", "");
    }

    private ResolutionRow expectFailure(String caseId, String category, String operation,
            String inputText) {
        return new ResolutionRow(caseId, "curated", category, operation, inputText, "", "", "",
                "", "", "", "", "", "", "", "", "", "", "", "", "exception", category);
    }

    private void buildLegacyRows() {
        String[] legacyTexts = {
            "0", "0.0", "-0.0", "0.1", "0.10", "0.05", "0.15", "-0.1", "0.000001", "-0.000001",
            "0.123456789", "1234567.89", "1.0E7", "1e22", "3.7e-8", "0.999999", "1.5", "2.675",
            "-2.675", "1e-3", "0.07",
        };
        for (int i = 0; i < legacyTexts.length; i++) {
            String text = legacyTexts[i];
            ResolutionRow row;
            try {
                // The exact Java legacy normalization:
                // new BigDecimal(double).setScale(5, HALF_UP).stripTrailingZeros()
                double legacyDouble = Double.parseDouble(text);
                BigDecimal value = new BigDecimal(legacyDouble)
                        .setScale(5, java.math.RoundingMode.HALF_UP)
                        .stripTrailingZeros();
                row = new ResolutionRow("c-res-legacy-" + (i + 1), "curated",
                        "legacy-normalize", "legacy-normalize", "", text, "", "", "", "", "",
                        value.unscaledValue().toString(), Integer.toString(value.scale()), value.toString(),
                        Bits.toBits(value.doubleValue()), value.doubleValue() > 0.0 ? "1" : "0",
                        "", "", "", "", "bits", "");
            } catch (NumberFormatException e) {
                row = expectFailure("c-res-legacy-" + (i + 1), diagnosticOf(e),
                        "legacy-normalize", text);
            }
            resolution.add(row);
        }
    }

    private static String parameterXml(String bdresolution, String legacyResolution,
            String lineBd, String lineLegacy) {
        StringBuilder sb = new StringBuilder();
        sb.append("<parameter uniqueId=\"11111111-1111-1111-1111-111111111111\" ")
                .append("name=\"testParam\" label=\"\" min=\"0.0\" max=\"1.0\" ");
        if (legacyResolution != null) {
            sb.append("resolution=\"").append(legacyResolution).append("\" ");
        }
        if (bdresolution != null) {
            sb.append("bdresolution=\"").append(bdresolution).append("\" ");
        }
        sb.append("automationEnabled=\"true\" value=\"0.5\">");
        sb.append("<line name=\"\" version=\"2\" max=\"1.0\" min=\"0.0\" ");
        if (lineLegacy != null) {
            sb.append("resolution=\"").append(lineLegacy).append("\" ");
        }
        if (lineBd != null) {
            sb.append("bdresolution=\"").append(lineBd).append("\" ");
        }
        sb.append("color=\"-1\" rightBound=\"false\" endPointsLinked=\"false\">");
        sb.append("<linePoint x=\"0.0\" y=\"0.13\"/>");
        sb.append("<linePoint x=\"0.5\" y=\"0.47\"/>");
        sb.append("<linePoint x=\"1.0\" y=\"0.91\"/>");
        sb.append("</line></parameter>");
        return sb.toString();
    }

    private void buildParameterRows() throws Exception {
        record Case(String id, String paramBd, String paramLegacy, String lineBd,
                String lineLegacy) {
        }
        List<Case> cases = List.of(
                new Case("c-res-param-bd-both-equal", "0.1", null, "0.1", null),
                new Case("c-res-param-legacy-only", null, "0.1", null, null),
                new Case("c-res-param-legacy-and-bd", "0.10", "0.05", null, null),
                new Case("c-res-param-default-line-only", null, null, "0.25", null),
                new Case("c-res-param-neg-scale", "1E+3", null, null, "0.1"),
                new Case("c-res-param-conflicting-scales", "0.1", null, "0.10", null),
                new Case("c-res-param-line-legacy-only", null, null, null, "0.2"),
                new Case("c-res-param-scale-19", "0.0000000000000000001", null, null, null),
                new Case("c-res-param-negative", "-1", null, null, null),
                new Case("c-res-param-zero", "0", null, null, null),
                new Case("c-res-param-malformed", "abc", null, null, null),
                new Case("c-res-param-line-malformed", "0.1", null, "xyz", null));
        for (Case c : cases) {
            String xml = parameterXml(c.paramBd(), c.paramLegacy(), c.lineBd(), c.lineLegacy());
            try {
                Document document = new Document(xml);
                Parameter parameter = Parameter.loadFromXML(document.getRoot());
                Element saved = parameter.saveAsXML();
                String parameterSave = saved.getAttributeValue("bdresolution");
                String lineSave = saved.getElement("line").getAttributeValue("bdresolution");
                BigDecimal value = parameter.getResolution();
                Line line = parameter.getLine();
                resolution.add(new ResolutionRow(c.id(), "curated", "parameter-load-save",
                        "parameter-load-save",
                        c.paramBd() == null ? "" : c.paramBd(),
                        c.paramLegacy() == null ? "" : c.paramLegacy(),
                        c.lineBd() == null ? "" : c.lineBd(),
                        c.lineLegacy() == null ? "" : c.lineLegacy(),
                        "", "",
                        "", value.unscaledValue().toString(), Integer.toString(value.scale()), value.toString(),
                        Bits.toBits(value.doubleValue()), value.doubleValue() > 0.0 ? "1" : "0",
                        base64(parameterSave), base64(lineSave), "", pointsBits(line),
                        "bits", ""));
            } catch (NumberFormatException e) {
                resolution.add(new ResolutionRow(c.id(), "curated", diagnosticOf(e),
                        "parameter-load-save",
                        c.paramBd() == null ? "" : c.paramBd(),
                        c.paramLegacy() == null ? "" : c.paramLegacy(),
                        c.lineBd() == null ? "" : c.lineBd(),
                        c.lineLegacy() == null ? "" : c.lineLegacy(),
                        "", "", "", "", "", "", "", "", "", "", "", "", "exception",
                        diagnosticOf(e)));
            }
        }
    }

    private void buildSnapRows() throws Exception {
        record Case(String id, String resolution, double value, double min, double max) {
        }
        List<Case> cases = List.of(
                new Case("c-res-snap-basic", "0.1", 0.37, 0.0, 1.0),
                new Case("c-res-snap-at-max", "0.1", 1.4, 0.0, 1.0),
                new Case("c-res-snap-at-max-equal", "0.1", 1.0, 0.0, 1.0),
                new Case("c-res-snap-at-min", "0.1", -0.2, 0.0, 1.0),
                new Case("c-res-snap-unquantized", "-1", 0.37, 0.0, 1.0),
                new Case("c-res-snap-zero-resolution", "0", 0.37, 0.0, 1.0),
                new Case("c-res-snap-tie", "0.5", 0.25, 0.0, 1.0),
                new Case("c-res-snap-negative-min", "0.1", -0.03, -1.0, 1.0),
                new Case("c-res-snap-scale-19", "0.00000000000000000001", 0.1234567890123456789,
                        0.0, 1.0),
                new Case("c-res-snap-negative-scale", "1E+3", 1234.0, 0.0, 5000.0),
                new Case("c-res-snap-underflow-resolution", "1E-400", 0.123, 0.0, 1.0),
                new Case("c-res-snap-neg-value", "0.25", -0.3, -1.0, 1.0));
        for (Case c : cases) {
            double snapped = LineUtils.snapToResolution(c.value(), c.min(), c.max(),
                    new BigDecimal(c.resolution()));
            resolution.add(new ResolutionRow(c.id(), "curated", "snap", "snap", c.resolution(),
                    "", "", "", Bits.toBits(c.value()), Bits.toBits(c.min()),
                    Bits.toBits(c.max()), "", "", "", "", "", "", "", Bits.toBits(snapped), "",
                    "bits", ""));
        }
    }

    private static String base64(String text) {
        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }

    // ------------------------------------------------------------------------
    // Offline section
    // ------------------------------------------------------------------------

    private void buildOffline() throws Exception {
        record Case(String id, String category, String resolution, double[][] points,
                double renderStart, double renderEnd, int instrId, boolean automationEnabled) {
        }
        List<Case> cases = List.of(
                new Case("c-off-stepped-ascending", "stepped-ascending", "0.1",
                        new double[][] {{0.0, 0.0}, {2.0, 0.55}}, 0.0, 0.0, 1, true),
                new Case("c-off-stepped-descending", "stepped-descending", "0.1",
                        new double[][] {{0.0, 0.55}, {2.0, 0.0}}, 0.0, 0.0, 1, true),
                new Case("c-off-stepped-flat", "stepped-flat", "0.1",
                        new double[][] {{0.0, 0.5}, {2.0, 0.5}}, 0.0, 0.0, 1, true),
                new Case("c-off-line-path", "line-path", "0",
                        new double[][] {{0.0, 0.0}, {2.0, 1.0}}, 0.0, 0.0, 1, true),
                new Case("c-off-negative-resolution", "line-path", "-1",
                        new double[][] {{0.0, 0.1}, {2.0, 0.9}}, 0.0, 0.0, 3, true),
                new Case("c-off-render-clip-start", "render-clip", "0.1",
                        new double[][] {{0.0, 0.0}, {2.0, 0.55}}, 1.0, 0.0, 1, true),
                new Case("c-off-render-clip-start-unquantized", "render-clip", "-1",
                        new double[][] {{0.0, 0.0}, {2.0, 1.0}}, 1.0, 0.0, 1, true),
                new Case("c-off-render-clip-end", "render-clip", "0",
                        new double[][] {{0.0, 0.0}, {2.0, 1.0}}, 0.0, 1.0, 1, true),
                new Case("c-off-sentinel-open", "sentinel", "0",
                        new double[][] {{0.0, 0.0}, {2.0, 1.0}}, 0.0, 0.0, 1, true),
                new Case("c-off-repeat-times", "repeat-times", "0.1",
                        new double[][] {{0.0, 0.0}, {1.0, 0.5}, {1.0, 0.9}, {2.0, 0.95}},
                        0.0, 0.0, 1, true),
                new Case("c-off-zero-step-clipped", "zero-step", "0.1",
                        new double[][] {{0.0, 0.04}, {1.0, 0.049}, {2.0, 0.5}}, 0.0, 3.0, 1,
                        true),
                new Case("c-off-zero-step-open", "zero-step", "0.1",
                        new double[][] {{0.0, 0.04}, {1.0, 0.049}, {2.0, 0.5}}, 0.0, 0.0, 1,
                        true),
                new Case("c-off-multi-segment", "line-path", "0",
                        new double[][] {{0.0, 0.1}, {1.0, 0.6}, {2.0, 0.2}}, 0.0, 0.0, 1, true),
                new Case("c-off-final-note", "final-note", "0",
                        new double[][] {{0.0, 0.2}, {1.0, 0.8}}, 0.0, 0.0, 1, true),
                new Case("c-off-negative-scale", "stepped-negative-scale", "1E+3",
                        new double[][] {{0.0, 0.0}, {2000.0, 1500.0}}, 0.0, 0.0, 1, true),
                new Case("c-off-tiny-values", "stepped-tiny", "1E-7",
                        new double[][] {{0.0, 0.0}, {1.0, 0.0000003}}, 0.0, 0.0, 1, true),
                new Case("c-off-disabled-parameter", "disabled", "0.1",
                        new double[][] {{0.0, 0.1}}, 0.0, 0.0, 1, false),
                new Case("c-off-init-quantized", "init-value", "0.1",
                        new double[][] {{0.0, 0.0}, {2.0, 0.55}}, 1.0, 0.0, 1, true),
                new Case("c-off-init-negative", "init-value", "0.1",
                        new double[][] {{0.0, -0.4}, {2.0, 0.4}}, 0.5, 0.0, 1, true),
                new Case("c-off-init-subnormal", "init-value", "0.0000000000000000001",
                        new double[][] {{0.0, Double.MIN_VALUE}, {1.0, 2.0 * Double.MIN_VALUE}},
                        0.5, 0.0, 1, true));

        for (Case c : cases) {
            Parameter parameter = new Parameter();
            parameter.setName("testParam");
            parameter.setAutomationEnabled(c.automationEnabled());
            parameter.setCompilationVarName("gk_blue_auto" + c.instrId());
            Line line = EMPTY_LINE_CTOR.newInstance(false, false);
            for (double[] point : c.points()) {
                line.addLinePoint(new LinePoint(point[0], point[1]));
            }
            parameter.setLine(line);
            // assign resolution fields directly (no snapping), matching
            // loadFromXML's field assignment
            BigDecimal resolution = new BigDecimal(c.resolution());
            PARAMETER_RESOLUTION_FIELD.set(parameter, resolution);
            LINE_RESOLUTION_FIELD.set(line, resolution);

            // initialization text exactly as CSDRender.handleParameters emits it
            double initialVal = c.automationEnabled()
                    ? line.getValue(c.renderStart())
                    : parameter.getFixedValue();
            String initialization = parameter.getCompilationVarName() + " init "
                    + NumberUtilities.formatDouble(initialVal) + "\n";

            StringBuilder paramScore = new StringBuilder();
            APPEND_PARAMETER_SCORE.invoke(CSD_RENDER, parameter, c.instrId(), paramScore,
                    c.renderStart(), c.renderEnd());

            offline.add(new OfflineRow(c.id(), "curated", c.category(), c.resolution(),
                    pointsBits(line), Bits.toBits(c.renderStart()), Bits.toBits(c.renderEnd()),
                    Integer.toString(c.instrId()), Bits.toBits(initialVal),
                    base64(initialization), base64(paramScore.toString()), "bits", ""));
        }
    }
}
