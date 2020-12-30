/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.utility;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.Map;
import java.util.Queue;

/**
 *
 * @author syyigmmbp
 */
public class TempFileManager {

    private static TempFileManager INSTANCE = null;

    private int directoryTempFileLimit = 3;

    private final Map<File, Queue<File>> dirTempFiles = new HashMap<>();

    public static TempFileManager getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new TempFileManager();
        }
        return INSTANCE;
    }

    private TempFileManager() {
    }

    public int getDirectoryTempFileLimit() {
        return directoryTempFileLimit;
    }

    public void setDirectoryTempFileLimit(int directoryTempFileLimit) {
        this.directoryTempFileLimit = Math.max(1, directoryTempFileLimit);

        dirTempFiles.values().forEach(queue -> {
            while (queue.size() > directoryTempFileLimit) {
                var tempFile = queue.poll();
                tempFile.delete();
            }
        });
    }

    public File createTempTextFile(String prefix, String suffix,
            File directory, String text) {
        File f;
        try {
            if (directory == null) {
                f = File.createTempFile(prefix, suffix);
            } else {
                f = File.createTempFile(prefix, suffix, directory);

                var queue = dirTempFiles.get(directory);
                if (queue == null) {
                    queue = new LinkedList<File>();
                    dirTempFiles.put(directory, queue);
                }
                while (queue.size() >= directoryTempFileLimit) {
                    var tempFile = queue.poll();
                    tempFile.delete();
                }
                queue.add(f);
            }

            f.deleteOnExit();
            try (PrintWriter out = new PrintWriter(new BufferedWriter(
                    new FileWriter(f)))) {
                out.print(text);
                out.flush();
            }

        } catch (IOException e) {
            return null;
        }

        return f;
    }

}
