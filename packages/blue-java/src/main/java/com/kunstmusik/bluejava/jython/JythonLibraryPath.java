package com.kunstmusik.bluejava.jython;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class JythonLibraryPath {
    private JythonLibraryPath() {
    }

    public static List<String> resolveLibraryPaths(String packagedLibraryRoot, String userLibraryRoot) {
        List<String> libraryPaths = new ArrayList<>();

        if (packagedLibraryRoot != null && !packagedLibraryRoot.isBlank()) {
            Path packagedRootPath = Path.of(packagedLibraryRoot).toAbsolutePath().normalize();
            if (!Files.isDirectory(packagedRootPath)) {
                throw new JythonEvaluationException(
                        "JYTHON_LIBRARY_PATH_ERROR",
                        "Packaged Jython library root is missing: " + packagedRootPath,
                        null,
                        null,
                        null,
                        "",
                        "");
            }

            Path packagedBluePath = packagedRootPath.resolve("blue");
            if (!Files.isDirectory(packagedBluePath)) {
                throw new JythonEvaluationException(
                        "JYTHON_LIBRARY_PATH_ERROR",
                        "Packaged Jython blue library is missing: " + packagedBluePath,
                        null,
                        null,
                        null,
                        "",
                        "");
            }

            libraryPaths.add(packagedBluePath.toString());
        }

        if (userLibraryRoot != null && !userLibraryRoot.isBlank()) {
            Path userRootPath = Path.of(userLibraryRoot).toAbsolutePath().normalize();
            try {
                Files.createDirectories(userRootPath);
            } catch (IOException ex) {
                throw new JythonEvaluationException(
                        "JYTHON_LIBRARY_PATH_ERROR",
                        "Unable to create Jython user library root: " + userRootPath,
                        ex,
                        null,
                        null,
                        "",
                        "");
            }

            libraryPaths.add(userRootPath.toString());
        }

        if (packagedLibraryRoot != null && !packagedLibraryRoot.isBlank()) {
            Path packagedRootPath = Path.of(packagedLibraryRoot).toAbsolutePath().normalize();
            if (Files.isDirectory(packagedRootPath)) {
                libraryPaths.add(packagedRootPath.toString());
            }
        }

        if (libraryPaths.isEmpty()) {
            throw new JythonEvaluationException(
                    "JYTHON_LIBRARY_PATH_ERROR",
                    "No Jython library roots were provided",
                    null,
                    null,
                    null,
                    "",
                    "");
        }

        return List.copyOf(libraryPaths);
    }
}
