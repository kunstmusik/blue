/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.utilities;

import java.io.File;

/**
 *
 * @author syi
 */
public class JythonUtils {

    public static String getBluePythonLib() {
        String val = System.getProperty("netbeans.dirs");
        String[] vals = val.split(File.pathSeparator);

        for (String path : vals) {
            File f = new File(path + File.separator + "pythonLib");
            if (f.isDirectory()) {
                return path + File.separator + "pythonLib";
            }
        }

        return null;
    }
}
