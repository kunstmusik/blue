#include "java_parity_fixtures.h"

#include <cstdio>
#include <cstring>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace blue {
namespace parity {

std::vector<FixtureCorpus::RealtimePoint> parsePointsField(const std::string& field);

namespace {

std::string readFileOrThrow(const std::string& path) {
    std::ifstream stream(path, std::ios::binary);
    if (!stream) {
        throw std::runtime_error("cannot open fixture file: " + path);
    }
    std::ostringstream buffer;
    buffer << stream.rdbuf();
    return buffer.str();
}

std::vector<std::vector<std::string>> parseTsv(const std::string& path) {
    const std::string text = readFileOrThrow(path);
    if (!text.empty() && static_cast<unsigned char>(text[0]) == 0xfe) {
        throw std::runtime_error("fixture file must not contain a BOM: " + path);
    }
    std::vector<std::vector<std::string>> rows;
    std::size_t start = 0;
    std::size_t columns = 0;
    while (start <= text.size()) {
        std::size_t end = text.find('\n', start);
        if (end == std::string::npos) {
            if (start == text.size()) break;
            throw std::runtime_error("fixture file must end with a newline: " + path);
        }
        std::vector<std::string> fields;
        std::size_t fieldStart = start;
        while (true) {
            std::size_t fieldEnd = text.find('\t', fieldStart);
            if (fieldEnd == std::string::npos || fieldEnd > end) fieldEnd = end;
            fields.push_back(text.substr(fieldStart, fieldEnd - fieldStart));
            if (fieldEnd == end) break;
            fieldStart = fieldEnd + 1;
        }
        if (columns == 0) {
            columns = fields.size();
        } else if (fields.size() != columns) {
            throw std::runtime_error("inconsistent column count in " + path);
        }
        rows.push_back(std::move(fields));
        start = end + 1;
    }
    if (rows.empty()) {
        throw std::runtime_error("fixture file has no header: " + path);
    }
    return rows;
}

double parseBitsField(const std::string& hex) {
    return bitsToDouble(hex);
}

FixtureCorpus::RealtimeCase parseRealtimeRow(const std::vector<std::string>& f) {
    FixtureCorpus::RealtimeCase row;
    row.caseId = f[0];
    row.origin = f[1];
    row.category = f[2];
    row.resolutionText = f[3];
    row.curve = f[4];
    row.points = parsePointsField(f[5]);
    row.evaluationTime = parseBitsField(f[6]);
    row.expectedKind = f[7];
    row.expectedBits = f[8];
    row.expectedCategory = f[9];
    if (!f[10].empty()) {
        row.hasSampleRate = true;
        row.sampleRate = parseBitsField(f[10]);
        row.sampleNumber = parseBitsField(f[11]);
    }
    return row;
}

FixtureCorpus::ResolutionCase parseResolutionRow(const std::vector<std::string>& f) {
    FixtureCorpus::ResolutionCase row;
    row.caseId = f[0];
    row.origin = f[1];
    row.category = f[2];
    row.operation = f[3];
    row.parameterBdText = f[4];
    row.parameterLegacyText = f[5];
    row.lineBdText = f[6];
    row.lineLegacyText = f[7];
    if (!f[8].empty()) {
        row.hasSnap = true;
        row.snapValue = parseBitsField(f[8]);
        row.snapMin = parseBitsField(f[9]);
        row.snapMax = parseBitsField(f[10]);
    }
    row.expectedCoefficient = f[11];
    if (!f[12].empty()) {
        row.hasExpectedScale = true;
        row.expectedScale = std::stoi(f[12]);
    }
    row.expectedCanonicalText = f[13];
    row.expectedDoubleBits = f[14];
    if (!f[15].empty()) {
        row.hasExpectedActivation = true;
        row.expectedActivation = f[15] == "1";
    }
    if (!f[16].empty()) row.expectedParameterSave = decodeBase64(f[16]);
    if (!f[17].empty()) row.expectedLineSave = decodeBase64(f[17]);
    row.expectedSnapBits = f[18];
    if (!f[19].empty()) row.expectedLinePoints = parsePointsField(f[19]);
    row.expectedKind = f[20];
    row.expectedCategory = f[21];
    return row;
}

FixtureCorpus::OfflineCase parseOfflineRow(const std::vector<std::string>& f) {
    FixtureCorpus::OfflineCase row;
    row.caseId = f[0];
    row.origin = f[1];
    row.category = f[2];
    row.resolutionText = f[3];
    row.points = parsePointsField(f[4]);
    row.renderStart = parseBitsField(f[5]);
    row.renderEnd = parseBitsField(f[6]);
    row.instrumentId = std::stoi(f[7]);
    row.expectedInitialBits = f[8];
    row.expectedInitialization = decodeBase64(f[9]);
    row.expectedScore = decodeBase64(f[10]);
    row.expectedKind = f[11];
    row.expectedCategory = f[12];
    return row;
}

// Minimal manifest scanning for the generator-controlled flat layout: the
// native tests gain no JSON dependency; field order and shapes come from the
// schema-versioned generator.
long long extractIntAfter(const std::string& json, const std::string& key) {
    const std::size_t position = json.find("\"" + key + "\"");
    if (position == std::string::npos) {
        throw std::runtime_error("manifest key missing: " + key);
    }
    const std::size_t colon = json.find(':', position + key.size());
    if (colon == std::string::npos) {
        throw std::runtime_error("manifest key has no value: " + key);
    }
    return std::stoll(json.substr(colon + 1));
}

std::string extractStringAfter(const std::string& json, const std::string& key) {
    const std::size_t position = json.find("\"" + key + "\"");
    if (position == std::string::npos) {
        throw std::runtime_error("manifest key missing: " + key);
    }
    const std::size_t start = json.find('"', json.find(':', position + key.size()) + 1);
    const std::size_t end = json.find('"', start + 1);
    return json.substr(start + 1, end - start - 1);
}

void extractCounts(const std::string& json, const std::string& container,
                   std::unordered_map<std::string, long long>& out) {
    const std::string marker = "\"" + container + "\": {";
    const std::size_t start = json.find(marker);
    if (start == std::string::npos) {
        throw std::runtime_error("manifest counts container missing: " + container);
    }
    const std::size_t end = json.find('}', start);
    const std::string body = json.substr(start + marker.size(), end - start - marker.size());
    std::size_t position = 0;
    while (position < body.size()) {
        const std::size_t keyStart = body.find('"', position);
        if (keyStart == std::string::npos) break;
        const std::size_t keyEnd = body.find('"', keyStart + 1);
        const std::string key = body.substr(keyStart + 1, keyEnd - keyStart - 1);
        const std::size_t colon = body.find(':', keyEnd);
        std::size_t valueEnd = std::min(body.find(',', colon), body.find('}', colon));
        if (valueEnd == std::string::npos) valueEnd = body.size();
        out[key] = std::stoll(body.substr(colon + 1, valueEnd - colon - 1));
        position = valueEnd + 1;
    }
}

}  // namespace

double bitsToDouble(const std::string& hex) {
    if (hex.size() != 16) {
        throw std::runtime_error("invalid raw binary64 bits: " + hex);
    }
    const uint64_t bits = std::stoull(hex, nullptr, 16);
    double value;
    std::memcpy(&value, &bits, sizeof(value));
    return value;
}

std::string doubleToBits(double value) {
    uint64_t bits;
    std::memcpy(&bits, &value, sizeof(bits));
    char buffer[17];
    std::snprintf(buffer, sizeof(buffer), "%016llx", static_cast<unsigned long long>(bits));
    return buffer;
}

std::string decodeBase64(const std::string& text) {
    static const std::string kAlphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string output;
    output.reserve(text.size() / 4 * 3);
    uint32_t accumulator = 0;
    int bits = 0;
    for (char c : text) {
        if (c == '=' || c == '\n' || c == '\r') continue;
        const std::size_t value = kAlphabet.find(c);
        if (value == std::string::npos) {
            throw std::runtime_error("invalid base64 character");
        }
        accumulator = (accumulator << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            output.push_back(static_cast<char>((accumulator >> bits) & 0xff));
        }
    }
    return output;
}

std::vector<FixtureCorpus::RealtimePoint> parsePointsField(const std::string& field) {
    std::vector<FixtureCorpus::RealtimePoint> points;
    if (field.empty()) return points;
    std::size_t start = 0;
    while (true) {
        const std::size_t separator = field.find(';', start);
        const std::string entry =
            field.substr(start, separator == std::string::npos ? std::string::npos : separator - start);
        const std::size_t colon = entry.find(':');
        points.push_back({bitsToDouble(entry.substr(0, colon)), bitsToDouble(entry.substr(colon + 1))});
        if (separator == std::string::npos) break;
        start = separator + 1;
    }
    return points;
}

const FixtureCorpus& FixtureCorpus::load(const std::string& dir) {
    static FixtureCorpus corpus;
    static std::string loadedDir;
    if (loadedDir != dir) {
        corpus = FixtureCorpus();
        corpus.loadFrom(dir);
        loadedDir = dir;
    }
    return corpus;
}

void FixtureCorpus::loadFrom(const std::string& dir) {
    const std::string manifestJson = readFileOrThrow(dir + "/manifest.json");
    manifest_.schemaVersion = static_cast<int>(extractIntAfter(manifestJson, "schemaVersion"));
    manifest_.javaRelease = static_cast<int>(extractIntAfter(manifestJson, "release"));
    manifest_.javaBlueCommit = extractStringAfter(manifestJson, "commit");
    manifest_.generatorId = extractStringAfter(manifestJson, "id");
    manifest_.generatorVersion = extractStringAfter(manifestJson, "version");
    manifest_.seedAlgorithm = extractStringAfter(manifestJson, "algorithm");
    manifest_.seedValue = extractStringAfter(manifestJson, "value");
    extractIntAfter(manifestJson, "total");
    manifest_.total = extractIntAfter(manifestJson, "total");
    extractCounts(manifestJson, "bySection", manifest_.bySection);
    extractCounts(manifestJson, "byOrigin", manifest_.byOrigin);
    extractCounts(manifestJson, "byCategory", manifest_.byCategory);

    if (manifest_.schemaVersion != 1) {
        throw std::runtime_error("unsupported fixture schema version");
    }

    const auto realtimeRows = parseTsv(dir + "/realtime.tsv");
    const auto resolutionRows = parseTsv(dir + "/resolution.tsv");
    const auto offlineRows = parseTsv(dir + "/offline.tsv");
    for (std::size_t i = 1; i < realtimeRows.size(); i++) {
        realtime_.push_back(parseRealtimeRow(realtimeRows[i]));
    }
    for (std::size_t i = 1; i < resolutionRows.size(); i++) {
        resolution_.push_back(parseResolutionRow(resolutionRows[i]));
    }
    for (std::size_t i = 1; i < offlineRows.size(); i++) {
        offline_.push_back(parseOfflineRow(offlineRows[i]));
    }

    // manifest invariants: section counts must match the parsed rows
    if (manifest_.bySection["realtime"] != static_cast<long long>(realtime_.size()) ||
        manifest_.bySection["resolution"] != static_cast<long long>(resolution_.size()) ||
        manifest_.bySection["offline"] != static_cast<long long>(offline_.size())) {
        throw std::runtime_error("manifest section counts do not match fixture rows");
    }
    if (manifest_.total !=
        static_cast<long long>(realtime_.size() + resolution_.size() + offline_.size())) {
        throw std::runtime_error("manifest total does not match fixture rows");
    }
    std::unordered_map<std::string, long long> categories;
    for (const auto& row : realtime_) categories[row.category] += 1;
    for (const auto& row : resolution_) categories[row.category] += 1;
    for (const auto& row : offline_) categories[row.category] += 1;
    for (const auto& entry : manifest_.byCategory) {
        if (categories[entry.first] != entry.second) {
            throw std::runtime_error("manifest category count mismatch for " + entry.first);
        }
    }
    long long seeded = 0;
    for (const auto& row : realtime_) {
        if (row.origin == "seeded") seeded += 1;
    }
    if (manifest_.byOrigin["seeded"] < 2048 || seeded < 2048) {
        throw std::runtime_error("corpus must contain exactly 2048 seeded realtime cases");
    }
}

}  // namespace parity
}  // namespace blue
