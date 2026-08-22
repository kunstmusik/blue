#pragma once

#include <cstdint>

// ============================================================================
// Csound Type Definitions
// Local definitions matching Csound's public API, allowing compilation
// without Csound headers. The actual library is loaded at runtime via dlopen.
// ============================================================================

namespace blue {
namespace csound {

// Opaque Csound instance pointer
struct CSOUND_;
typedef struct CSOUND_ CSOUND;

// Return codes
constexpr int CSOUND_SUCCESS = 0;
constexpr int CSOUND_ERROR = -1;

// Initialization flags (for csoundInitialize)
constexpr int CSOUNDINIT_NO_SIGNAL_HANDLER = 1;
constexpr int CSOUNDINIT_NO_ATEXIT = 2;

// Channel type flags
constexpr int32_t CSOUND_CONTROL_CHANNEL = 1;
constexpr int32_t CSOUND_AUDIO_CHANNEL = 2;
constexpr int32_t CSOUND_STRING_CHANNEL = 3;
constexpr int32_t CSOUND_PVS_CHANNEL = 4;
constexpr int32_t CSOUND_VAR_CHANNEL = 5;
constexpr int32_t CSOUND_ARRAY_CHANNEL = 6;
constexpr int32_t CSOUND_CHANNEL_TYPE_MASK = 15;
constexpr int32_t CSOUND_INPUT_CHANNEL = 16;
constexpr int32_t CSOUND_OUTPUT_CHANNEL = 32;

// String data structure (matches Csound's STRINGDAT)
// Used for string arguments in opcodes
struct STRINGDAT {
    char* data;
    int32_t size;
};

struct controlChannelHints_t {
    int32_t behav;
    double dflt;
    double min;
    double max;
    int32_t x;
    int32_t y;
    int32_t width;
    int32_t height;
    char* attributes;
};

struct controlChannelInfo_t {
    char* name;
    int32_t type;
    controlChannelHints_t hints;
};

// Device structures from Csound's public Csound 7 API. Keep these definitions
// local so the engine remains buildable without Csound development headers.
struct CS_AUDIODEVICE {
    char device_name[128];
    char device_id[128];
    char rt_module[128];
    int32_t max_nchnls;
    int32_t isOutput;
};

struct CS_MIDIDEVICE {
    char device_name[128];
    char interface_name[128];
    char device_id[128];
    char midi_module[128];
    int32_t isOutput;
};

// Function pointer types for Csound API
// These match the signatures from csound.h

// Core lifecycle
typedef int (*csoundGetVersion_t)();
typedef int (*csoundInitialize_t)(int flags);
typedef CSOUND* (*csoundCreate_t)(void* hostData, const char* opcodeDir);
typedef void (*csoundDestroy_t)(CSOUND* csound);
typedef void (*csoundReset_t)(CSOUND* csound);

// Configuration
typedef int (*csoundSetOption_t)(CSOUND* csound, const char* option);

// Compilation and performance
typedef int (*csoundCompileOrc_t)(CSOUND* csound, const char* orc, int async);
typedef int32_t (*csoundCompile_t)(CSOUND* csound, int32_t argc,
                                   const char** argv);
typedef int (*csoundStart_t)(CSOUND* csound);
typedef int (*csoundPerformKsmps_t)(CSOUND* csound);
typedef void (*csoundEventString_t)(CSOUND* csound, const char* message, int async);

// Runtime module, utility, and message services
typedef int32_t (*csoundGetModule_t)(CSOUND* csound, int32_t number,
                                     char** name, char** type);
typedef void (*csoundSetRTAudioModule_t)(CSOUND* csound, const char* module);
typedef void (*csoundSetMIDIModule_t)(CSOUND* csound, const char* module);
typedef int32_t (*csoundGetAudioDevList_t)(CSOUND* csound,
                                           CS_AUDIODEVICE* list,
                                           int32_t isOutput);
typedef int32_t (*csoundGetMIDIDevList_t)(CSOUND* csound,
                                          CS_MIDIDEVICE* list,
                                          int32_t isOutput);
typedef int32_t (*csoundRunUtility_t)(CSOUND* csound, const char* name,
                                      int32_t argc, char** argv);
typedef char** (*csoundListUtilities_t)(CSOUND* csound);
typedef void (*csoundDeleteUtilityList_t)(CSOUND* csound, char** list);
typedef void (*csoundCreateMessageBuffer_t)(CSOUND* csound, int32_t toStdOut);
typedef const char* (*csoundGetFirstMessage_t)(CSOUND* csound);
typedef void (*csoundPopFirstMessage_t)(CSOUND* csound);
typedef int32_t (*csoundGetMessageCnt_t)(CSOUND* csound);
typedef void (*csoundDestroyMessageBuffer_t)(CSOUND* csound);

// Audio parameters
typedef double (*csoundGetSr_t)(CSOUND* csound);
typedef int (*csoundGetKsmps_t)(CSOUND* csound);

// Channel access
typedef int32_t (*csoundGetChannelPtr_t)(CSOUND* csound, void** ptr,
                                         const char* name, int32_t type);
typedef int32_t (*csoundListChannels_t)(CSOUND* csound,
                                        controlChannelInfo_t** list);
typedef void (*csoundDeleteChannelList_t)(CSOUND* csound,
                                          controlChannelInfo_t* list);
typedef double (*csoundGetControlChannel_t)(CSOUND* csound,
                                            const char* name,
                                            int32_t* err);
typedef void (*csoundSetControlChannel_t)(CSOUND* csound, const char* name,
                                          double value);

}  // namespace csound
}  // namespace blue
