package com.kunstmusik.bluejava;

import com.kunstmusik.bluejava.cli.RuntimeOptions;
import com.kunstmusik.bluejava.transport.JeroMqRuntimeServer;

public final class BlueJavaMain {
    private BlueJavaMain() {
    }

    public static void main(String[] args) throws Exception {
        RuntimeOptions options;

        try {
            options = RuntimeOptions.parse(args);
        } catch (IllegalArgumentException ex) {
            System.err.println(ex.getMessage());
            System.err.println();
            System.err.println(RuntimeOptions.helpText());
            System.exit(2);
            return;
        }

        if (options.isHelp()) {
            System.out.println(RuntimeOptions.helpText());
            return;
        }

        new JeroMqRuntimeServer(options).run();
    }
}