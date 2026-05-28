package com.kunstmusik.bluejava.cli;

public final class RuntimeOptions {
    private final boolean help;
    private final String controlEndpoint;
    private final String eventEndpoint;
    private final String authToken;

    private RuntimeOptions(boolean help, String controlEndpoint, String eventEndpoint, String authToken) {
        this.help = help;
        this.controlEndpoint = controlEndpoint;
        this.eventEndpoint = eventEndpoint;
        this.authToken = authToken;
    }

    public static RuntimeOptions parse(String[] args) {
        boolean help = false;
        String controlEndpoint = null;
        String eventEndpoint = null;
        String authToken = null;

        for (int index = 0; index < args.length; index += 1) {
            String arg = args[index];

            switch (arg) {
                case "--help":
                case "-h":
                    help = true;
                    break;
                case "--control-endpoint":
                    controlEndpoint = requireValue(args, ++index, arg);
                    break;
                case "--event-endpoint":
                    eventEndpoint = requireValue(args, ++index, arg);
                    break;
                case "--auth-token":
                    authToken = requireValue(args, ++index, arg);
                    break;
                default:
                    throw new IllegalArgumentException("Unknown option: " + arg);
            }
        }

        if (!help) {
            if (isBlank(controlEndpoint)) {
                throw new IllegalArgumentException("Missing required option: --control-endpoint");
            }
            if (isBlank(authToken)) {
                throw new IllegalArgumentException("Missing required option: --auth-token");
            }
            validateTcpEndpoint("--control-endpoint", controlEndpoint);
            if (!isBlank(eventEndpoint)) {
                validateTcpEndpoint("--event-endpoint", eventEndpoint);
            }
        }

        return new RuntimeOptions(help, controlEndpoint, eventEndpoint, authToken);
    }

    private static String requireValue(String[] args, int index, String optionName) {
        if (index >= args.length) {
            throw new IllegalArgumentException("Missing value for option: " + optionName);
        }
        return args[index];
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static void validateTcpEndpoint(String optionName, String value) {
        if (!value.startsWith("tcp://")) {
            throw new IllegalArgumentException(optionName + " must use a tcp:// endpoint");
        }
    }

    public static String helpText() {
        return String.join(System.lineSeparator(),
                "Blue Java Runtime Helper",
                "",
                "Options:",
                "  --control-endpoint <tcp://host:port>   Request/response endpoint",
                "  --event-endpoint <tcp://host:port>     Optional pub/sub endpoint",
                "  --auth-token <token>                   Shared token for request validation",
                "  --help                                 Show this help text");
    }

    public boolean isHelp() {
        return help;
    }

    public String getControlEndpoint() {
        return controlEndpoint;
    }

    public String getEventEndpoint() {
        return eventEndpoint;
    }

    public String getAuthToken() {
        return authToken;
    }
}
