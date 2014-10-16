/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

import java.io.*;

/**
 * @author steven
 * 
 */
public class FileUtilities {

    public static void copyFile(File source, File dest) throws IOException {
        BufferedInputStream in = null;
        BufferedOutputStream out = null;
        try {
            in = new BufferedInputStream(new FileInputStream(source));
            out = new BufferedOutputStream(new FileOutputStream(dest));
            copyStream(in, out);
        } finally {
            if (out != null) {
                out.close();
            }
            if (in != null) {
                in.close();
            }
        }
    }

    private static void copyStream(InputStream in, OutputStream out)
            throws IOException {
        byte[] buffer = new byte[1024];
        int numberRead;
        while ((numberRead = in.read(buffer)) >= 0) {
            out.write(buffer, 0, numberRead);
        }
    }

    public static boolean ensureDirectoryExists(String userPythonPath) {
        return ensureDirectoryExists(new File(userPythonPath));
    }

    public static boolean ensureDirectoryExists(File dir) {
        boolean didExist = dir.exists();
        if (!didExist) {
            dir.mkdirs();
        }
        return didExist;
    }

    public static boolean copyIfNotThere(File src, File dest) {
        if (!dest.exists() && src.exists()) {
            try {
                FileUtilities.copyFile(src, dest);
            } catch (IOException e) {
                e.printStackTrace();
            }
            return true;
        }
        return false;
    }

    public static File createTempTextFile(String prefix, String suffix,
            File directory, String text) {
        File f;
        try {
            if (directory == null) {
                f = File.createTempFile(prefix, suffix);
            } else {
                f = File.createTempFile(prefix, suffix, directory);
            }

            f.deleteOnExit();

            PrintWriter out = new PrintWriter(new BufferedWriter(
                    new FileWriter(f)));
            out.print(text);
            out.flush();
            out.close();

        } catch (IOException e) {
            return null;
        }

        return f;
    }
}
