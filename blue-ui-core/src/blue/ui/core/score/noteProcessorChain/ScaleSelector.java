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
package blue.ui.core.score.noteProcessorChain;

import java.io.File;
import java.io.FilenameFilter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import javax.swing.JOptionPane;

import blue.BlueSystem;

/**
 * @author steven
 */
public class ScaleSelector {

    static FilenameFilter fileNameFilter = new FilenameFilter() {
        public boolean accept(File dir, String name) {
            return name.toLowerCase().endsWith(".scl");
        }
    };

    public static String selectScale() {
        File scaleDir = new File(BlueSystem.getUserConfigurationDirectory()
                + File.separator + "scl");

        if (!scaleDir.exists()) {
            scaleDir.mkdir();
        }

        String[] fileNames = scaleDir.list(fileNameFilter);

        List scales = new ArrayList(fileNames.length);

        scales.addAll(Arrays.asList(fileNames));

        Collections.sort(scales);

        Object[] options = scales.toArray();

        if (fileNames.length == 0) {
            JOptionPane.showMessageDialog(null, BlueSystem
                    .getString("scales.noneFound.message"), BlueSystem
                    .getString("scales.noneFound.title"),
                    JOptionPane.ERROR_MESSAGE);
            return "";
        }

        Object retVal = JOptionPane.showInputDialog(null, BlueSystem
                .getString("scales.select.message"), BlueSystem
                .getString("scales.select.title"), JOptionPane.PLAIN_MESSAGE,
                null, options, options[0]);

        return (retVal == null) ? "" : (String) retVal;
    }
}