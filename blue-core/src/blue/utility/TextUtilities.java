/**
 * Title:        NoUnit - Identify Classes that are not being unit Tested
 *
 * Copyright (C) 2001  Paul Browne , FirstPartners.net
 *
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
 *
 * @author Paul Browne
 * @version 0.6
 *
 * renamed to textUtilities and added to blue by steven yi
 */

package blue.utility;

import java.io.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Performs common , but tricky tasks. e.g. Stripping of spaces from Files
 */
public class TextUtilities {

    /**
     * Replace the first occurrence of <code>oldSubstring</code> in
     * <code>string</code>, if there is one, with <code>newSubstring</code>.
     * 
     * @param string -
     *            Replace a substring of this String
     * @param oldSubstring -
     *            The substring of <code>string</code> to be replaced
     * @param newSubstring -
     *            The string to put into <code> string</code>
     * @return A new String which is a copy of <code>string</code> with the
     *         first occurrence of <code>oldSubstring</code> in
     *         <code>string</code>, if there is one, with
     *         <code>newSubstring</code>. Returns null if <code>string</code>
     *         is null. Returns <code>string</code> if either substring is
     *         null or <code>oldSubstring</code> is empty
     */

    // TODO - remove and replace in calling code with Java's String replace
    public static String replace(String string, String oldSubstring,
            String newSubstring) {
        String result = string;

        if ((string != null) && (string.length() > 0) && (oldSubstring != null)
                && (oldSubstring.length() > 0) && (newSubstring != null)) {
            int pos = string.indexOf(oldSubstring);
            result = string.substring(0, pos) + newSubstring
                    + string.substring(pos + oldSubstring.length());
        }

        // result.replaceFirst(oldSubstring, newSubstring);

        return result;
    }

    /**
     * Replaces all occurrences of <code>oldSubstring</code> in
     * <code>string</code>, if there are any, with <code>newSubstring</code>.
     * 
     * @param string -
     *            Replace substrings of this String
     * @param oldSubstring -
     *            The substring of <code>string</code> to be replaced
     * @param newSubstring -
     *            The string to put into <code> string</code>
     * @return A new String which is a copy of <code>string</code> with all
     *         occurrences of <code>oldSubstring</code> in <code>string</code>,
     *         if there are any, with <code>newSubstring</code>. Returns null
     *         if <code>string</code> is null. Returns <code>string</code>
     *         if either substring is null or <code>oldSubstring</code> is
     *         empty
     */
    // TODO - remove and replace in calling code with Java's String replaceAll
    public static String replaceAll(String string, String oldSubstring,
            String newSubstring) {
        // Local Variables
        String result = string;

        if ((result != null) && (result.length() > 0)
                && (result.contains(oldSubstring))
                && (oldSubstring.length() > 0)
                && (!oldSubstring.equals(newSubstring))
                && (newSubstring != null)) {

            while (result.contains(oldSubstring)) {
                result = replace(result, oldSubstring, newSubstring);
            }
        }

        // result.replaceAll(oldSubstring, newSubstring);

        return result;
    }

    /**
     * Finds (start and end) markers in piece of text extracts text (note
     * including markers) in between
     * 
     * @param fullText
     *            to search in
     * @param startIndex
     *            ignore text before this point
     * @param startMarker
     *            start marker for the piece of text to extract
     * @param endMarker
     *            end marker
     * @return foundText , empty String if nothing found
     * 
     * public static String find( String fullText, int startIndex, String
     * startMarker, String endMarker) {
     * 
     * //Local Variables int startPlace = 0; int endPlace = 0; String foundText =
     * "";
     * 
     * //Find the first instance of text startPlace =
     * fullText.indexOf(startMarker, startIndex) + startMarker.length();
     * 
     * //Find the first instance of end marker after this if (startPlace >
     * startIndex) { startIndex = startPlace; } endPlace =
     * fullText.indexOf(endMarker, startIndex);
     * 
     * //Copy and return try { if ((startPlace > -1) || (endPlace > -1)) {
     * foundText = fullText.substring(startPlace, endPlace); } } catch
     * (java.lang.StringIndexOutOfBoundsException sioobe) { // do nothing - will
     * return default of empty string }
     * 
     * //Ensure that there are no dodgy strings.. if (startPlace < startIndex) {
     * foundText = ""; }
     * 
     * return foundText; }
     * 
     * /** Remove all instances of input string from Output
     * @param inputString
     * @param removeString
     * @return updateString
     */
    public static String removeAll(String inputString, String removeString) {

        // Internal Variables
        StringBuilder updateString = new StringBuilder();
        String tmpString;

        for (int a = 0; a < inputString.length(); a++) {

            tmpString = inputString.substring(a, a + 1);
            if (!tmpString.equals(removeString)) {
                updateString.append(tmpString);
            }

        }

        return updateString.toString();

    }

    public static String getTextFromFile(File textFile)
            throws FileNotFoundException, IOException {
        StringBuilder buffer = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new FileReader(textFile))) {
            String line;
            while ((line = br.readLine()) != null) {
                buffer.append(line).append("\n");
            }
        }

        return buffer.toString();
    }

    /**
     * Get the contents of a text file as a list of lines.
     * 
     * @author Dave Seidel
     * @param input
     *            file
     * @param if
     *            true, each line will be trim()'ed
     * @return ArrayList containing all lines in the file (including empty
     *         lines).
     */
    public static ArrayList getLinesFromFile(File textFile, boolean trim)
            throws FileNotFoundException, IOException {
        ArrayList lines = new ArrayList();
        try (BufferedReader br = new BufferedReader(new FileReader(textFile))) {
            String line;
            while ((line = br.readLine()) != null) {
                lines.add(trim ? line.trim() : line);
            }
        }

        return lines;
    }

    public static String getTextFromSystemResource(Class c, String resource) {
        try {
            BufferedReader br = new BufferedReader(new InputStreamReader(
                    c.getResourceAsStream(resource)));

            String buffer;
            StringBuilder text = new StringBuilder();
            while ((buffer = br.readLine()) != null) {
                text.append(buffer).append("\n");
            }
            return text.toString();
        } catch (Exception e) {
            return "Error getting resource: " + resource;
        }
    }

    public static String getTextBetweenTags(String tag, String searchText) {
        String startTag = "<" + tag + ">";
        String endTag = "</" + tag + ">";

        int index1 = searchText.indexOf(startTag);
        int index2 = searchText.indexOf(endTag);

        if (index1 == -1 || index2 == -1) {
            return null;
        }

        index1 = index1 + startTag.length();

        return searchText.substring(index1, index2);
    }

    public static String[] splitStringWithQuotes(String in) {
        char[] chars = in.trim().toCharArray();
        int state = 0;

        ArrayList wordList = new ArrayList();
        StringBuffer buffer = new StringBuffer();

        for (int i = 0; i < chars.length; i++) {
            switch (state) {
                case 0:
                    if (chars[i] == '\t' || chars[i] == ' ') {
                        continue;
                    } else if (chars[i] == '\"') {
                        state = 2;
                    } else if (chars[i] == '{') {
                        state = 3;
                    } else {
                        buffer.append(chars[i]);
                        state = 1;
                    }
                    break;
                case 1:
                    if (chars[i] == ' ' || chars[i] == '\t') {
                        wordList.add(buffer.toString());
                        buffer = new StringBuffer();
                        state = 0;
                    } else {
                        buffer.append(chars[i]);
                    }
                    break;
                case 2:
                    if (chars[i] == '\"') {
                        wordList.add(buffer.toString());
                        buffer = new StringBuffer();
                        state = 0;
                    } else {
                        buffer.append(chars[i]);
                    }
                    break;
                case 3:
                    if (chars[i] == '}') {
                        wordList.add(buffer.toString());
                        buffer = new StringBuffer();
                        state = 0;
                    } else {
                        buffer.append(chars[i]);
                    }
                    break;
            }

        }
        wordList.add(buffer.toString());

        String[] retVal = new String[wordList.size()];

        int i = 0;
        for (Iterator iter = wordList.iterator(); iter.hasNext();) {
            String element = (String) iter.next();
            retVal[i] = element;
            i++;
        }
        return retVal;
    }

    public static String stripSingleLineComments(String in) {

        String retVal = in.replaceAll("(//|;).*", "");

        return retVal;
    }

    public static String stripMultiLineComments(String in) {
        Pattern p = Pattern.compile("/\\*.*\\*/", Pattern.MULTILINE
                | Pattern.DOTALL);
        Matcher m = p.matcher(in);
        String retVal = m.replaceAll("\n");

        return retVal;
    }

    public static String replaceOpcodeNames(HashMap replacementValues,
            final String input) {

        String retVal = input;

        for (Iterator iter = replacementValues.entrySet().iterator(); iter
                .hasNext();) {
            Map.Entry entry = (Entry) iter.next();

            String key = (String) entry.getKey();
            String value = (String) entry.getValue();

            retVal = retVal.replaceAll("(^|\\s)" + key + "($|\\s)", "$1"
                    + value + "$2");
        }

        return retVal;
    }

}
