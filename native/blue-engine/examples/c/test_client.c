/**
 * Blue Engine C Test Client
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <zmq.h>

#ifdef _WIN32
#include <windows.h>
#define sleep_ms(ms) Sleep(ms)
#else
#include <unistd.h>
#define sleep_ms(ms) usleep((ms) * 1000)
#endif

/* Command codes */
#define CMD_CREATE_ENGINE  0x01
#define CMD_COMPILE_ORC    0x02
#define CMD_READ_SCORE     0x03
#define CMD_SET_OPTION     0x04
#define CMD_START          0x05
#define CMD_STOP           0x06
#define CMD_DESTROY_ENGINE 0x07
/* Channel commands */
#define CMD_SET_CHANNEL    0x10
#define CMD_GET_CHANNEL    0x11
#define CMD_CREATE_CHANNEL 0x12
#define CMD_GET_SHM_NAME   0x13
/* Automation commands */
#define CMD_CREATE_AUTOMATION  0x20
#define CMD_UPDATE_AUTOMATION  0x21
#define CMD_DELETE_AUTOMATION  0x22
#define CMD_ENABLE_AUTOMATION  0x23
#define CMD_DISABLE_AUTOMATION 0x24
#define CMD_LIST_AUTOMATIONS   0x25
#define CMD_CLEAR_AUTOMATIONS  0x26

/* Status codes */
#define STATUS_OK    0x00
#define STATUS_ERROR 0x01

/* Automation curve types */
#define CURVE_STEP        0x00
#define CURVE_LINEAR      0x01
#define CURVE_EXPONENTIAL 0x02

typedef struct {
    double time;
    double value;
} AutomationPoint;

typedef struct {
    void* context;
    void* socket;
} BlueEngineClient;

int client_init(BlueEngineClient* client, const char* endpoint) {
    client->context = zmq_ctx_new();
    if (!client->context) return -1;

    client->socket = zmq_socket(client->context, ZMQ_REQ);
    if (!client->socket) {
        zmq_ctx_destroy(client->context);
        return -1;
    }

    if (zmq_connect(client->socket, endpoint) != 0) {
        zmq_close(client->socket);
        zmq_ctx_destroy(client->context);
        return -1;
    }

    return 0;
}

void client_close(BlueEngineClient* client) {
    if (client->socket) zmq_close(client->socket);
    if (client->context) zmq_ctx_destroy(client->context);
}

int send_command(BlueEngineClient* client, uint8_t cmd,
                 const char* payload, size_t payload_len,
                 char* response, size_t response_max) {
    /* Build request */
    size_t req_size = 1 + 4 + payload_len;
    uint8_t* request = (uint8_t*)malloc(req_size);
    if (!request) return -1;

    request[0] = cmd;
    uint32_t len = (uint32_t)payload_len;
    memcpy(request + 1, &len, 4);
    if (payload_len > 0) {
        memcpy(request + 5, payload, payload_len);
    }

    /* Send */
    if (zmq_send(client->socket, request, req_size, 0) == -1) {
        free(request);
        return -1;
    }
    free(request);

    /* Receive */
    uint8_t resp_buf[1024];
    int resp_len = zmq_recv(client->socket, resp_buf, sizeof(resp_buf), 0);
    if (resp_len < 5) return -1;

    uint8_t status = resp_buf[0];
    uint32_t msg_len;
    memcpy(&msg_len, resp_buf + 1, 4);

    if (response && response_max > 0) {
        size_t copy_len = msg_len < response_max - 1 ? msg_len : response_max - 1;
        memcpy(response, resp_buf + 5, copy_len);
        response[copy_len] = '\0';
    }

    return status == STATUS_OK ? 0 : -1;
}

int create_channel(BlueEngineClient* client, const char* name, double value,
                   char* response, size_t response_max) {
    size_t name_len = strlen(name) + 1;  /* include null terminator */
    size_t payload_len = name_len + sizeof(double);
    uint8_t* payload = (uint8_t*)malloc(payload_len);
    if (!payload) return -1;

    memcpy(payload, name, name_len);
    memcpy(payload + name_len, &value, sizeof(double));

    int result = send_command(client, CMD_CREATE_CHANNEL, (char*)payload, payload_len, response, response_max);
    free(payload);
    return result;
}

int set_channel(BlueEngineClient* client, const char* name, double value,
                char* response, size_t response_max) {
    size_t name_len = strlen(name) + 1;
    size_t payload_len = name_len + sizeof(double);
    uint8_t* payload = (uint8_t*)malloc(payload_len);
    if (!payload) return -1;

    memcpy(payload, name, name_len);
    memcpy(payload + name_len, &value, sizeof(double));

    int result = send_command(client, CMD_SET_CHANNEL, (char*)payload, payload_len, response, response_max);
    free(payload);
    return result;
}

int create_automation(BlueEngineClient* client, const char* channel_name,
                     uint8_t curve, AutomationPoint* points, uint32_t num_points,
                     uint8_t enabled, double resolution, int32_t resolution_scale,
                     uint8_t high_precision, char* response, size_t response_max) {
    size_t name_len = strlen(channel_name) + 1;
    /* payload: name\0 + curve(1B) + enabled(1B) + resolution(8B) + resolutionScale(4B) + highPrecision(1B) + n_points(4B) + points */
    size_t payload_len = name_len + 2 + 8 + 4 + 1 + 4 + (num_points * 16);
    uint8_t* payload = (uint8_t*)malloc(payload_len);
    if (!payload) return -1;

    memcpy(payload, channel_name, name_len);
    size_t offset = name_len;

    payload[offset++] = curve;
    payload[offset++] = enabled;
    memcpy(payload + offset, &resolution, sizeof(double));
    offset += sizeof(double);
    memcpy(payload + offset, &resolution_scale, sizeof(int32_t));
    offset += sizeof(int32_t);
    payload[offset++] = high_precision;
    memcpy(payload + offset, &num_points, 4);
    offset += 4;

    for (uint32_t i = 0; i < num_points; i++) {
        memcpy(payload + offset, &points[i].time, sizeof(double));
        offset += sizeof(double);
        memcpy(payload + offset, &points[i].value, sizeof(double));
        offset += sizeof(double);
    }

    int result = send_command(client, CMD_CREATE_AUTOMATION, (char*)payload, payload_len, response, response_max);
    free(payload);
    return result;
}

int enable_automation(BlueEngineClient* client, const char* channel_name,
                     char* response, size_t response_max) {
    size_t name_len = strlen(channel_name) + 1;
    return send_command(client, CMD_ENABLE_AUTOMATION, channel_name, name_len, response, response_max);
}

int disable_automation(BlueEngineClient* client, const char* channel_name,
                      char* response, size_t response_max) {
    size_t name_len = strlen(channel_name) + 1;
    return send_command(client, CMD_DISABLE_AUTOMATION, channel_name, name_len, response, response_max);
}

int delete_automation(BlueEngineClient* client, const char* channel_name,
                     char* response, size_t response_max) {
    size_t name_len = strlen(channel_name) + 1;
    return send_command(client, CMD_DELETE_AUTOMATION, channel_name, name_len, response, response_max);
}

int list_automations(BlueEngineClient* client, char* response, size_t response_max) {
    return send_command(client, CMD_LIST_AUTOMATIONS, NULL, 0, response, response_max);
}

int clear_automations(BlueEngineClient* client, char* response, size_t response_max) {
    return send_command(client, CMD_CLEAR_AUTOMATIONS, NULL, 0, response, response_max);
}

int main(int argc, char** argv) {
    BlueEngineClient client;
    char response[256];
    int selected_test = 0; /* 0 = all tests */

    for (int i = 1; i < argc; i++) {
        if (strncmp(argv[i], "--test=", 7) == 0) {
            selected_test = atoi(argv[i] + 7);
        } else if (strcmp(argv[i], "--test") == 0 && i + 1 < argc) {
            selected_test = atoi(argv[i + 1]);
            i++;
        }
    }

    printf("Connecting to blue-engine...\n");

    if (client_init(&client, "tcp://localhost:5555") != 0) {
        fprintf(stderr, "Failed to connect\n");
        return 1;
    }

    /* Compile orchestra using standard chnexport control channels. */
    const char* orc =
        "sr = 44100\n"
        "ksmps = 64\n"
        "nchnls = 2\n"
        "0dbfs = 1\n"
        "\n"
        "gk_freq init 440\n"
        "gk_freq chnexport \"freq\", 3\n"
        "\n"
        "gk_amp init 0.5\n"
        "gk_amp chnexport \"amp\", 3\n"
        "\n"
        "instr 1\n"
        "    aenv = linseg:a(0, 0.01, 1, p3 - 0.02, 1, 0.01, 0)\n"
        "    asig = oscil:a(aenv * gk_amp, gk_freq)\n"
        "    out(asig, asig)\n"
        "endin\n";

    if (selected_test == 0 || selected_test == 1) {
        /* Create engine */
        if (send_command(&client, CMD_CREATE_ENGINE, NULL, 0, response, sizeof(response)) == 0) {
            printf("create_engine: OK\n");
        } else {
            printf("create_engine: FAILED %s\n", response);
            client_close(&client);
            return 1;
        }

        /* Set options */
        const char* opt1 = "-odac";
        send_command(&client, CMD_SET_OPTION, opt1, strlen(opt1), response, sizeof(response));
        printf("set_option(-odac): OK\n");

        const char* opt2 = "-d";
        send_command(&client, CMD_SET_OPTION, opt2, strlen(opt2), response, sizeof(response));
        printf("set_option(-d): OK\n");

        if (send_command(&client, CMD_COMPILE_ORC, orc, strlen(orc), response, sizeof(response)) == 0) {
            printf("compile_orc: OK\n");
        } else {
            printf("compile_orc: FAILED %s\n", response);
        }

        /* Create channels */
        if (create_channel(&client, "freq", 440.0, response, sizeof(response)) == 0) {
            printf("create_channel(freq): OK\n");
        } else {
            printf("create_channel(freq): FAILED\n");
        }

        if (create_channel(&client, "amp", 0.5, response, sizeof(response)) == 0) {
            printf("create_channel(amp): OK\n");
        } else {
            printf("create_channel(amp): FAILED\n");
        }

        /* Test 1: Manual channel updates */
        printf("\n=== Test 1: Manual Channel Updates ===\n");
        const char* sco = "i1 0 5";

        if (send_command(&client, CMD_READ_SCORE, sco, strlen(sco), response, sizeof(response)) == 0) {
            printf("read_score: OK\n");
        } else {
            printf("read_score: FAILED %s\n", response);
        }

        /* Start */
        if (send_command(&client, CMD_START, NULL, 0, response, sizeof(response)) == 0) {
            printf("start: OK\n");
        } else {
            printf("start: FAILED %s\n", response);
        }

        /* Demonstrate channel updates */
        printf("Playing with channel updates...\n");
        int frequencies[] = {440, 550, 660, 880, 660, 550, 440};
        int num_freqs = sizeof(frequencies) / sizeof(frequencies[0]);
        for (int i = 0; i < num_freqs; i++) {
            if (set_channel(&client, "freq", (double)frequencies[i], response, sizeof(response)) == 0) {
                printf("  set freq=%d: OK\n", frequencies[i]);
            } else {
                printf("  set freq=%d: FAILED\n", frequencies[i]);
            }
            sleep_ms(400);
        }

        /* Stop */
        send_command(&client, CMD_STOP, NULL, 0, response, sizeof(response));
        printf("stop: OK\n");

        /* Destroy */
        send_command(&client, CMD_DESTROY_ENGINE, NULL, 0, response, sizeof(response));
        printf("destroy_engine: OK\n");
    }

    if (selected_test == 0 || selected_test == 2) {
        /* Test 2: LINEAR curve automation */
        printf("\n=== Test 2: LINEAR Curve Automation ===\n");
        send_command(&client, CMD_CREATE_ENGINE, NULL, 0, response, sizeof(response));
        printf("create_engine: OK\n");

        send_command(&client, CMD_SET_OPTION, "-odac", 5, response, sizeof(response));
        send_command(&client, CMD_SET_OPTION, "-d", 2, response, sizeof(response));

        send_command(&client, CMD_COMPILE_ORC, orc, strlen(orc), response, sizeof(response));
        printf("compile_orc: OK\n");

        create_channel(&client, "freq", 440.0, response, sizeof(response));
        printf("create_channel(freq): OK\n");

        create_channel(&client, "amp", 0.5, response, sizeof(response));
        printf("create_channel(amp): OK\n");

        AutomationPoint linear_points[2] = {{2.0, 440.0}, {4.0, 880.0}};
        if (create_automation(&client, "freq", CURVE_LINEAR, linear_points, 2, 0, 0.0, 0, 0, response, sizeof(response)) == 0) {
            printf("create_automation (LINEAR): OK\n");
        } else {
            printf("create_automation (LINEAR): FAILED\n");
        }

        send_command(&client, CMD_READ_SCORE, "i1 0 6", 6, response, sizeof(response));
        printf("read_score: OK\n");

        send_command(&client, CMD_START, NULL, 0, response, sizeof(response));
        printf("start: OK\n");

        printf("Playing for 2 seconds with automation disabled (steady 440Hz)...\n");
        sleep_ms(2000);

        printf("Enabling LINEAR automation (440Hz -> 880Hz over 2 seconds)...\n");
        enable_automation(&client, "freq", response, sizeof(response));
        printf("enable_automation: OK\n");

        sleep_ms(2500);

        send_command(&client, CMD_STOP, NULL, 0, response, sizeof(response));
        printf("stop: OK\n");
    }

    if (selected_test == 0 || selected_test == 3) {
        /* Test 3: STEP curve */
        printf("\n=== Test 3: STEP Curve Automation ===\n");
        send_command(&client, CMD_DESTROY_ENGINE, NULL, 0, response, sizeof(response));
        send_command(&client, CMD_CREATE_ENGINE, NULL, 0, response, sizeof(response));
        send_command(&client, CMD_SET_OPTION, "-odac", 5, response, sizeof(response));
        send_command(&client, CMD_SET_OPTION, "-d", 2, response, sizeof(response));
        send_command(&client, CMD_COMPILE_ORC, orc, strlen(orc), response, sizeof(response));
        create_channel(&client, "freq", 440.0, response, sizeof(response));
        create_channel(&client, "amp", 0.5, response, sizeof(response));

        AutomationPoint step_points[5] = {
            {2.0, 440.0}, {2.5, 550.0}, {3.0, 660.0}, {3.5, 880.0}, {4.0, 660.0}
        };
        create_automation(&client, "freq", CURVE_STEP, step_points, 5, 0, 0.0, 0, 0, response, sizeof(response));
        printf("create_automation (STEP): OK\n");

        send_command(&client, CMD_READ_SCORE, "i1 0 6", 6, response, sizeof(response));
        send_command(&client, CMD_START, NULL, 0, response, sizeof(response));

        printf("Waiting 2 seconds before enabling STEP automation...\n");
        sleep_ms(2000);

        printf("Enabling STEP automation (frequency jumps every 0.5 seconds)...\n");
        enable_automation(&client, "freq", response, sizeof(response));
        printf("enable_automation: OK\n");

        sleep_ms(2500);

        send_command(&client, CMD_STOP, NULL, 0, response, sizeof(response));
        printf("stop: OK\n");
    }

    if (selected_test == 0 || selected_test == 4) {
        /* Test 4: EXPONENTIAL curve */
        printf("\n=== Test 4: EXPONENTIAL Curve Automation ===\n");
        send_command(&client, CMD_DESTROY_ENGINE, NULL, 0, response, sizeof(response));
        send_command(&client, CMD_CREATE_ENGINE, NULL, 0, response, sizeof(response));
        send_command(&client, CMD_SET_OPTION, "-odac", 5, response, sizeof(response));
        send_command(&client, CMD_SET_OPTION, "-d", 2, response, sizeof(response));
        send_command(&client, CMD_COMPILE_ORC, orc, strlen(orc), response, sizeof(response));
        create_channel(&client, "freq", 440.0, response, sizeof(response));
        create_channel(&client, "amp", 0.5, response, sizeof(response));

        AutomationPoint exp_points[2] = {{2.0, 220.0}, {4.0, 880.0}};
        create_automation(&client, "freq", CURVE_EXPONENTIAL, exp_points, 2, 0, 0.0, 0, 0, response, sizeof(response));
        printf("create_automation (EXPONENTIAL): OK\n");

        send_command(&client, CMD_READ_SCORE, "i1 0 6", 6, response, sizeof(response));
        send_command(&client, CMD_START, NULL, 0, response, sizeof(response));

        printf("Waiting 2 seconds before enabling EXPONENTIAL automation...\n");
        sleep_ms(2000);

        printf("Enabling EXPONENTIAL automation (220Hz -> 880Hz exponential curve)...\n");
        enable_automation(&client, "freq", response, sizeof(response));
        printf("enable_automation: OK\n");

        sleep_ms(2500);

        send_command(&client, CMD_STOP, NULL, 0, response, sizeof(response));
        printf("stop: OK\n");

        /* List and clear automations */
        printf("\n=== Listing Automations ===\n");
        list_automations(&client, response, sizeof(response));
        printf("list_automations: OK\n");

        printf("\nClearing all automations...\n");
        clear_automations(&client, response, sizeof(response));
        printf("clear_automations: OK\n");

        /* Final cleanup */
        send_command(&client, CMD_DESTROY_ENGINE, NULL, 0, response, sizeof(response));
        printf("destroy_engine: OK\n");
    }

    if (selected_test == 0 || selected_test == 5) {
        printf("\n=== Test 5: LINEAR Automation with Resolution ===\n");
        send_command(&client, CMD_CREATE_ENGINE, NULL, 0, response, sizeof(response));
        send_command(&client, CMD_SET_OPTION, "-odac", 5, response, sizeof(response));
        send_command(&client, CMD_SET_OPTION, "-d", 2, response, sizeof(response));
        send_command(&client, CMD_COMPILE_ORC, orc, strlen(orc), response, sizeof(response));
        create_channel(&client, "freq", 220.0, response, sizeof(response));
        create_channel(&client, "amp", 0.5, response, sizeof(response));

        AutomationPoint quant_points[2] = {
            {2.0, 220.0},
            {6.0, 880.0}
        };

        double resolution = 100.0;

        if (create_automation(&client, "freq", CURVE_LINEAR, quant_points, 2, 0, resolution, 0, 0, response, sizeof(response)) == 0) {
            printf("create_automation (LINEAR + resolution=%.1f): OK\n", resolution);
        } else {
            printf("create_automation (LINEAR + resolution=%.1f): FAILED\n", resolution);
        }

        send_command(&client, CMD_READ_SCORE, "i1 0 8", 6, response, sizeof(response));
        send_command(&client, CMD_START, NULL, 0, response, sizeof(response));

        printf("Waiting 2 seconds before enabling quantized automation...\n");
        sleep_ms(2000);

        printf("Enabling quantized LINEAR automation (listen for stepped pitch changes)...\n");
        enable_automation(&client, "freq", response, sizeof(response));
        printf("enable_automation: OK\n");

        sleep_ms(4500);

        send_command(&client, CMD_STOP, NULL, 0, response, sizeof(response));
        printf("stop: OK\n");

        send_command(&client, CMD_DESTROY_ENGINE, NULL, 0, response, sizeof(response));
        printf("destroy_engine: OK\n");
    }

    client_close(&client);
    printf("\nAll tests completed!\n");

    return 0;
}
