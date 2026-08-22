#pragma once

#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace blue {
namespace parity {

/** Loads the canonical Java Blue automation parity corpus for CTest. */
class FixtureCorpus {
public:
    struct RealtimePoint {
        double time;
        double value;
    };

    struct RealtimeCase {
        std::string caseId;
        std::string origin;
        std::string category;
        std::string resolutionText;
        std::string curve;
        std::vector<RealtimePoint> points;
        double evaluationTime = 0.0;
        std::string expectedKind;
        std::string expectedBits;
        std::string expectedCategory;
        bool hasSampleRate = false;
        double sampleRate = 0.0;
        double sampleNumber = 0.0;
    };

    struct ResolutionCase {
        std::string caseId;
        std::string origin;
        std::string category;
        std::string operation;
        std::string parameterBdText;
        std::string parameterLegacyText;
        std::string lineBdText;
        std::string lineLegacyText;
        double snapValue = 0.0;
        double snapMin = 0.0;
        double snapMax = 0.0;
        bool hasSnap = false;
        std::string expectedCoefficient;
        int expectedScale = 0;
        bool hasExpectedScale = false;
        std::string expectedCanonicalText;
        std::string expectedDoubleBits;
        bool expectedActivation = false;
        bool hasExpectedActivation = false;
        std::string expectedParameterSave;   // decoded base64
        std::string expectedLineSave;        // decoded base64
        std::string expectedSnapBits;
        std::vector<RealtimePoint> expectedLinePoints;
        std::string expectedKind;
        std::string expectedCategory;
    };

    struct OfflineCase {
        std::string caseId;
        std::string origin;
        std::string category;
        std::string resolutionText;
        std::vector<RealtimePoint> points;
        double renderStart = 0.0;
        double renderEnd = 0.0;
        int instrumentId = 0;
        std::string expectedInitialBits;
        std::string expectedInitialization;
        std::string expectedScore;
        std::string expectedKind;
        std::string expectedCategory;
    };

    struct Manifest {
        int schemaVersion = 0;
        std::string javaBlueCommit;
        std::string seedAlgorithm;
        std::string seedValue;
        std::string generatorId;
        std::string generatorVersion;
        int javaRelease = 0;
        long long total = 0;
        std::unordered_map<std::string, long long> bySection;
        std::unordered_map<std::string, long long> byOrigin;
        std::unordered_map<std::string, long long> byCategory;
    };

    /** Loads and validates the corpus rooted at dir (schema, counts). */
    static const FixtureCorpus& load(const std::string& dir);

    const Manifest& manifest() const { return manifest_; }
    const std::vector<RealtimeCase>& realtime() const { return realtime_; }
    const std::vector<ResolutionCase>& resolution() const { return resolution_; }
    const std::vector<OfflineCase>& offline() const { return offline_; }

private:
    FixtureCorpus() = default;
    void loadFrom(const std::string& dir);

    Manifest manifest_;
    std::vector<RealtimeCase> realtime_;
    std::vector<ResolutionCase> resolution_;
    std::vector<OfflineCase> offline_;
};

/** Decodes 16 lowercase hexadecimal raw IEEE 754 bits into a double. */
double bitsToDouble(const std::string& hex);

/** Encodes a double as 16 lowercase hexadecimal raw bits. */
std::string doubleToBits(double value);

/** Decodes standard base64 into raw bytes (fixture text fields). */
std::string decodeBase64(const std::string& text);

}  // namespace parity
}  // namespace blue
