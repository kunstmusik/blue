/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

import blue.BlueSystem;
import java.io.*;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.openide.util.Exceptions;

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
        return TempFileManager.getInstance().createTempTextFile(prefix, suffix,
                directory, text);
    }

    /** Utility for copying files to media folder.  
     * Will check contents of files with same base names and optionall reuse 
     * file found in target folder. Returned file points to where file was 
     * actually copied to. 
     */
    public static File copyToMediaFolder(File src, File target) {
        final var fParent = target.getParentFile();

        File retVal = target;

        if (src.exists() && src.isFile() && !target.equals(fParent)) {

            if (!fParent.exists()) {
                fParent.mkdir();
            }

            try {
                if (target.exists()) {
                    if (FileUtils.contentEquals(src, target)) {

                    } else {
                        var fName = target.getName();
                        var parent = target.getParent();
                        var base = FilenameUtils.getBaseName(fName);
                        var ext = FilenameUtils.getExtension(fName);

                        for (int i = 1; i < 1000; i++) {
                            var indexStr = StringUtils.leftPad(Integer.toString(i), 3, '0');
                            var newTarget = new File(parent, String.format("%s-%s.%s", base, indexStr, ext));
                            if (!newTarget.exists()) {
                                retVal = target = newTarget;
                                FileUtilities.copyFile(src, target);
                                break;
                            }
                        }
                    }
                } else {
                    FileUtilities.copyFile(src, target);
                }

            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
                retVal = null;
            }
            return retVal;
        }
        return null;
    }
}
