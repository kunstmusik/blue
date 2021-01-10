/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.orchestra.blueSynthBuilder;

import java.awt.Font;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javafx.scene.text.FontWeight;

/**
 *
 * @author stevenyi
 */
public class SwingHTMLFontParser {

    static final Pattern SIZE_REGEX = Pattern.compile("size=\"([^\"]*)\"",
            Pattern.CASE_INSENSITIVE);
    static final int[] SIZE_MAP = {8, 10, 12, 14, 18, 24, 36};

    public static Font parseFont(String text) {
        Matcher m = SIZE_REGEX.matcher(text);
        int retVal = 2;
        if (m.find()) {
            try {
                String t = m.group(1);
                int v = Integer.parseInt(m.group(1));

                if (t.charAt(0) == '+'
                        || t.charAt(0) == '-') {
                    retVal += v + 1;
                } else {
                    retVal = v - 1;
                }
            } catch (NumberFormatException nfe) {
                nfe.printStackTrace();
                retVal = 0;
            }
        }
        retVal = Math.min(Math.max(0, retVal), 6);

        int weight = Font.PLAIN;

        if (text.contains("<b>") || retVal > 2) {
            weight = Font.BOLD;
        }
        Font f = new Font(Font.DIALOG, weight, SIZE_MAP[retVal]);
        return f;
    }

    protected static String stripHTML(String text) {
        return text.replaceAll("\\<[^>]*?>", "");
    }
}
