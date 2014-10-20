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

package blue.ui.core.render;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.StringTokenizer;

public class CommandProcessor {

    private static final int COMMAND_SEARCH = 0;

    private static final int COMMAND_ARG_FIND = 1;

    private static final int COMMAND_SEARCH_FINISH = 2;

    public static String processCommandBlocks(String string) {
        StringTokenizer st = new StringTokenizer(string, "\n");
        StringBuffer buffer = new StringBuffer();

        StringBuffer preBuffer = new StringBuffer();

        ArrayList onceList = new ArrayList();

        int mode = COMMAND_SEARCH;

        String command = "";
        StringBuffer commandArgument = new StringBuffer();

        while (st.hasMoreTokens()) {
            String line = st.nextToken();
            String trimLine = line.trim();

            switch (mode) {
                case COMMAND_SEARCH:
                    if (trimLine.startsWith(";[") && trimLine.endsWith("]{")) {
                        command = trimLine.substring(2, trimLine.indexOf("]{"));

                        mode = COMMAND_ARG_FIND;
                        commandArgument = new StringBuffer();

                    } else {
                        buffer.append(line).append("\n");
                    }

                    break;
                case COMMAND_ARG_FIND:
                    if (trimLine.startsWith(";}")) {
                        mode = COMMAND_SEARCH;

                        String commandString = commandArgument.toString();

                        if (command.equals("pre")) {
                            preBuffer.append(commandString).append("\n");
                        } else if (command.equals("once")) {
                            if (!containsString(onceList, commandString)) {
                                onceList.add(commandString);
                                buffer.append(commandString).append("\n");
                            }
                        }

                    } else {
                        commandArgument.append(line).append("\n");
                    }
                    break;
                default:
                    buffer.append(line).append("\n");
            }
        }

        preBuffer.append(buffer);

        return preBuffer.toString();
    }

    private static boolean containsString(ArrayList list, String string) {
        for (Iterator iter = list.iterator(); iter.hasNext();) {
            String element = (String) iter.next();
            if (element.equals(string)) {
                return true;
            }

        }
        return false;
    }

    private static final int STRIP_READ = 0;

    private static final int STRIP_ICONDITION_TRUE = 1;

    private static final int STRIP_ICONDITION_FALSE = 2;

    /**
     * Searches for code that should only be included if that instrument is
     * enabled
     *
     * @param string
     * @param instrumentNumbers
     * @return
     */

    private static String stripInstrumentConditionals(String string,
            ArrayList instrumentNumbers) {
        StringTokenizer st = new StringTokenizer(string, "\n");
        StringBuffer buffer = new StringBuffer();

        int mode = STRIP_READ;

        while (st.hasMoreTokens()) {
            String line = st.nextToken();

            switch (mode) {
                case STRIP_READ:
                    if (line.startsWith(";[i") && line.endsWith("]{")) {
                        Integer iNum = new Integer(line.substring(3, line
                                .length() - 2));
                        if (instrumentNumbers.contains(iNum)) {
                            mode = STRIP_ICONDITION_TRUE;
                        } else {
                            mode = STRIP_ICONDITION_FALSE;
                        }
                    } else {
                        buffer.append(line).append("\n");
                    }

                    break;
                case STRIP_ICONDITION_TRUE:
                    if (line.equals(";}")) {
                        mode = STRIP_READ;
                    } else {
                        buffer.append(line).append("\n");
                    }
                    break;
                case STRIP_ICONDITION_FALSE:
                    if (line.equals(";}")) {
                        mode = STRIP_READ;
                    }
                    break;
            }
        }

        return buffer.toString();
    }
}
