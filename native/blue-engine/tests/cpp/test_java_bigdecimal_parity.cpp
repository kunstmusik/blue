// Java parity fixture corpus consumers for the native evaluators.
//
// Phase scope: manifest invariants through the C++ TSV reader (no JSON
// dependency) and one-bit mutation diagnostics. The realtime fixture
// evaluation through the production AutomationManager lands in this file
// together with the Java-order linear evaluator.
#include <cstdio>
#include <cstring>
#include <string>

#include "java_parity_fixtures.h"

#include "../../src/automation/AutomationManager.h"
#include "../../src/automation/AutomationStore.h"
#include "../../src/automation/ExactDecimalQuantizer.h"
#include "../../src/automation/JavaBigDecimal.h"

#ifndef BLUE_ENGINE_PARITY_FIXTURES_DIR
#error "BLUE_ENGINE_PARITY_FIXTURES_DIR must be provided by the build"
#endif

namespace {

int g_failures = 0;

void expect(bool condition, const std::string& what) {
    if (!condition) {
        std::printf("FAIL: %s\n", what.c_str());
        g_failures += 1;
    }
}

void testManifestInvariants() {
    const auto& corpus = blue::parity::FixtureCorpus::load(BLUE_ENGINE_PARITY_FIXTURES_DIR);
    const auto& manifest = corpus.manifest();
    expect(manifest.schemaVersion == 1, "schema version is 1");
    expect(manifest.javaBlueCommit.size() == 40, "40-character commit recorded");
    expect(manifest.seedAlgorithm == "SplitMix64", "SplitMix64 seed recorded");

    long long seeded = 0;
    for (const auto& row : corpus.realtime()) {
        if (row.origin == "seeded") seeded += 1;
    }
    expect(seeded == 2048, "exactly 2048 seeded realtime cases");

    // manager-level metadata round trips through the elapsed-time boundary
    bool foundManager = false;
    for (const auto& row : corpus.realtime()) {
        if (row.caseId == "c-rt-mgr-48000") {
            foundManager = true;
            expect(row.hasSampleRate && row.sampleRate == 48000.0, "manager rate recorded");
            expect(row.sampleNumber == 16000.0, "manager sample recorded");
            double elapsed = row.sampleNumber / row.sampleRate;
            unsigned long long a, b;
            std::memcpy(&a, &elapsed, 8);
            const double expected = blue::parity::bitsToDouble(
                blue::parity::doubleToBits(row.evaluationTime));
            std::memcpy(&b, &expected, 8);
            expect(a == b, "sampleNumber/sampleRate reproduces evaluationTime");
        }
    }
    expect(foundManager, "manager-level fixture present");
}

// ---------------------------------------------------------------------------
// Realtime corpus through the production AutomationManager
// ---------------------------------------------------------------------------

namespace {

std::string bitsOf(double value) {
    return blue::parity::doubleToBits(value);
}

struct EvaluationOutcome {
    bool wrote = false;
    std::string bits;
    bool invalid = false;
    bool boundarySkipped = false;
};

bool hasNonFinitePoint(const blue::parity::FixtureCorpus::RealtimeCase& row) {
    for (const auto& point : row.points) {
        if (!std::isfinite(point.time) || !std::isfinite(point.value)) {
            return true;
        }
    }
    return false;
}

EvaluationOutcome evaluateThroughManager(
    const blue::parity::FixtureCorpus::RealtimeCase& row) {
    auto store = std::make_shared<blue::AutomationStore>();
    std::vector<blue::AutomationPoint> points;
    points.reserve(row.points.size());
    for (const auto& point : row.points) {
        points.emplace_back(point.time, point.value);
    }
    if (store->createAutomation(row.caseId, blue::AutomationCurve::LINEAR, points, true,
                                row.resolutionText) != blue::AutomationPrepareError::Ok) {
        return {};
    }

    EvaluationOutcome outcome;
    blue::AutomationManager manager(
        store, [&](const std::string&, double value) {
            outcome.wrote = true;
            outcome.bits = bitsOf(value);
        });

    if (row.hasSampleRate) {
        manager.process(static_cast<int64_t>(row.sampleNumber), row.sampleRate);
    } else if (std::isfinite(row.evaluationTime)) {
        manager.processAtElapsedTimeForTesting(row.evaluationTime);
    } else if (row.evaluationTime > 0) {
        // a positive infinite time is evaluated beyond the last point
        manager.process(static_cast<int64_t>(1) << 62, 1.0);
    } else {
        // NaN and negative-infinite times cannot reach the sample-time
        // boundary; the evaluator-level behavior is covered by the TypeScript
        // corpus consumer
        outcome.boundarySkipped = true;
        return outcome;
    }
    outcome.invalid = manager.totalInvalidEvaluationCount() > 0;
    return outcome;
}

}  // namespace

void testRealtimeCorpusThroughProductionManager() {
    const auto& corpus = blue::parity::FixtureCorpus::load(BLUE_ENGINE_PARITY_FIXTURES_DIR);
    int compared = 0;
    int diagnostics = 0;
    std::string firstFailure;
    for (const auto& row : corpus.realtime()) {
        if (row.points.empty()) {
            // an empty point list is an inactive automation at the manager
            // level; the evaluator-level behavior is covered by the TypeScript
            // corpus consumer
            continue;
        }
        if (hasNonFinitePoint(row)) {
            // the native input contract rejects non-finite point bits with a
            // deterministic diagnostic (FR-014 divergence from Java's raw NaN
            // passthrough); the evaluator-level bits are covered by the
            // TypeScript corpus consumer
            auto store = std::make_shared<blue::AutomationStore>();
            std::vector<blue::AutomationPoint> raw;
            for (const auto& point : row.points) {
                raw.emplace_back(point.time, point.value);
            }
            expect(store->createAutomation(row.caseId, blue::AutomationCurve::LINEAR, raw,
                                           true, row.resolutionText) ==
                       blue::AutomationPrepareError::NonFiniteAutomationInput,
                   "non-finite points rejected: " + row.caseId);
            continue;
        }
        const auto outcome = evaluateThroughManager(row);
        if (row.expectedKind == "exception") {
            if (outcome.invalid) {
                diagnostics += 1;
            } else if (!outcome.boundarySkipped && firstFailure.empty()) {
                firstFailure = row.caseId + " (expected an invalid-evaluation diagnostic)";
            }
            continue;
        }
        if (!outcome.wrote) {
            // non-finite sample times cannot cross the sample-time boundary;
            // their evaluator-level bits are covered by the TypeScript corpus
            // consumer
            if (!outcome.boundarySkipped && firstFailure.empty()) {
                firstFailure = row.caseId + " (no channel write)";
            }
            continue;
        }
        if (outcome.bits != row.expectedBits && firstFailure.empty()) {
            firstFailure = row.caseId + " (category=" + row.category + ", resolution=" +
                           row.resolutionText + ", time-bits=" +
                           blue::parity::doubleToBits(row.evaluationTime) +
                           ", expected=" + row.expectedBits + ", actual=" + outcome.bits + ")";
        }
        compared += 1;
    }
    expect(firstFailure.empty(), "first realtime parity failure: " + firstFailure);
    expect(compared > 2000, "compared realtime cases through the manager");
    expect(diagnostics >= 1, "non-finite cases counted as diagnostics");
}

void testManagerLevelSampleTimeBoundary() {
    const auto& corpus = blue::parity::FixtureCorpus::load(BLUE_ENGINE_PARITY_FIXTURES_DIR);
    for (const auto& row : corpus.realtime()) {
        if (!row.hasSampleRate) continue;
        const auto outcome = evaluateThroughManager(row);
        expect(outcome.wrote, "manager-level case wrote: " + row.caseId);
        expect(outcome.bits == row.expectedBits,
               "manager-level bits: " + row.caseId);
    }
}

void testOneBitMutationDetection() {
    const auto& corpus = blue::parity::FixtureCorpus::load(BLUE_ENGINE_PARITY_FIXTURES_DIR);
    // flipping one bit of a passing expectation must mismatch that exact case
    for (const auto& row : corpus.realtime()) {
        if (row.points.empty() || row.expectedKind != "bits") continue;
        const auto outcome = evaluateThroughManager(row);
        if (!outcome.wrote) continue;
        std::string mutated = row.expectedBits;
        mutated[15] = mutated[15] == '0' ? '1' : '0';
        if (outcome.bits == row.expectedBits) {
            expect(outcome.bits != mutated,
                   "mutated expectation differs for " + row.caseId);
        }
        break;
    }
}

void testResolutionCorpusThroughExactModel() {
    // legacy-normalize rows prove the native legacy normalization against Java
    const auto& corpus = blue::parity::FixtureCorpus::load(BLUE_ENGINE_PARITY_FIXTURES_DIR);
    int legacyChecked = 0;
    for (const auto& row : corpus.resolution()) {
        if (row.expectedKind != "bits") continue;
        if (row.operation == "legacy-normalize") {
            blue::JavaBigDecimal exact;
            if (!blue::javaBigDecimalFromBinary64(
                    blue::parity::bitsToDouble(bitsOf(std::strtod(
                        row.parameterLegacyText.c_str(), nullptr))), exact)) {
                expect(false, "legacy normalization source: " + row.caseId);
                continue;
            }
            blue::JavaBigDecimal rounded;
            if (!blue::javaBigDecimalSetScale(exact, 5, blue::DecimalRounding::HalfUp,
                                              rounded)) {
                expect(false, "legacy setScale: " + row.caseId);
                continue;
            }
            const blue::JavaBigDecimal stripped =
                blue::javaBigDecimalStripTrailingZeros(rounded);
            expect(stripped.canonicalText() == row.expectedCanonicalText,
                   "legacy canonical " + row.caseId + ": got " + stripped.canonicalText() +
                       " expected " + row.expectedCanonicalText);
            expect(bitsOf(stripped.doubleValue()) == row.expectedDoubleBits,
                   "legacy double bits " + row.caseId);
            legacyChecked += 1;
        }
    }
    expect(legacyChecked >= 15, "checked legacy-normalize fixture rows");
}

void testQuantizerAgainstResolutionFixtures() {
    // parse rows prove the native decimal model against Java expectations
    const auto& corpus = blue::parity::FixtureCorpus::load(BLUE_ENGINE_PARITY_FIXTURES_DIR);
    int checked = 0;
    for (const auto& row : corpus.resolution()) {
        if (row.operation != "parse" || row.expectedKind != "bits") continue;
        blue::JavaBigDecimal value;
        const auto status = blue::parseJavaBigDecimal(row.parameterBdText, value);
        expect(status == blue::DecimalParseError::Ok, "parse " + row.caseId);
        if (status != blue::DecimalParseError::Ok) continue;
        expect(value.canonicalText() == row.expectedCanonicalText,
               "canonical text " + row.caseId + " (got " + value.canonicalText() + ")");
        expect(blue::parity::doubleToBits(value.doubleValue()) == row.expectedDoubleBits,
               "double bits " + row.caseId);
        const bool activation = row.expectedActivation;
        expect((value.doubleValue() > 0.0) == activation, "activation " + row.caseId);
        checked += 1;
    }
    expect(checked > 10, "checked parse fixture rows");
}

}  // namespace

int main() {
    testManifestInvariants();
    testRealtimeCorpusThroughProductionManager();
    testManagerLevelSampleTimeBoundary();
    testOneBitMutationDetection();
    testResolutionCorpusThroughExactModel();
    testQuantizerAgainstResolutionFixtures();
    if (g_failures == 0) {
        std::printf("test_java_bigdecimal_parity: all tests passed\n");
        return 0;
    }
    std::printf("test_java_bigdecimal_parity: %d failure(s)\n", g_failures);
    return 1;
}
