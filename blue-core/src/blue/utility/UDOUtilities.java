/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

import java.util.HashMap;
import java.util.Iterator;
import java.util.StringTokenizer;

import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;

/**
 * @author Steven Yi
 */
public class UDOUtilities {

    public static OpcodeList parseUDOText(final String udoText) {
        OpcodeList retVal = new OpcodeList();

        String cleanedText = TextUtilities.stripMultiLineComments(udoText);

        StringTokenizer st = new StringTokenizer(cleanedText, "\n");
        String line = "";
        int state = 0;

        UserDefinedOpcode currentUDO = null;
        StringBuffer codeBody = null;

        while (st.hasMoreTokens()) {
            line = st.nextToken();

            switch (state) {
                case 0:
                    if (line.trim().startsWith("opcode")) {

                        line = TextUtilities.stripSingleLineComments(line
                                .trim());

                        String[] parts = line.substring(6).split(",");

                        if (parts.length == 3) {

                            currentUDO = new UserDefinedOpcode();
                            currentUDO.opcodeName = parts[0].trim();
                            currentUDO.outTypes = parts[1].trim();
                            currentUDO.inTypes = parts[2].trim();

                            codeBody = new StringBuffer();

                            state = 1;
                        }
                    }

                    break;
                case 1:

                    if (line.trim().startsWith("opcode")) {
                        currentUDO = null;
                        state = 0;
                    } else if (line.trim().startsWith("endop")) {
                        currentUDO.codeBody = codeBody.toString();

                        retVal.add(currentUDO);

                        // System.out.println(currentUDO);

                        currentUDO = null;
                        state = 0;
                        // } else if(line.indexOf("setksmps") > -1) {
                        // line =
                        // TextUtilities.stripSingleLineComments(line.trim());
                        //
                        // String ksmpsString = line.substring(8).trim();
                        // int ksmps = Integer.parseInt(ksmpsString);
                        //
                        // currentUDO.useLocalKsmps = true;
                        // currentUDO.localKsmps = ksmps;
                        //
                        // } else if(line.indexOf("xin") > -1) {
                        // line =
                        // TextUtilities.stripSingleLineComments(line.trim());
                        //
                        // String args = line.substring(0,line.indexOf("xin"));
                        //
                        // currentUDO.inArgs = args;
                        //
                        // } else if(line.indexOf("xout") > -1) {
                        // line =
                        // TextUtilities.stripSingleLineComments(line.trim());
                        //
                        // String args = line.substring(line.indexOf("xout") +
                        // 4).trim();
                        //
                        // currentUDO.outArgs = args;
                    } else {
                        codeBody.append(line).append("\n");
                    }

                    break;
            }
        }

        return retVal;
    }

    /**
     * Given a list of Opcodes, append them to the passed in master list. A
     * hashmap filled with key-value pairs of old UDO names to newly assigned
     * UDO names will be returned. The returned map may not contain any values
     * if no replacement of names are needed.
     * 
     * @param newList
     * @param masterList
     * @return
     */

    public static HashMap appendUserDefinedOpcodes(OpcodeList newList,
            OpcodeList masterList) {
        HashMap keyValues = new HashMap();

        for (Iterator iter = newList.iterator(); iter.hasNext();) {
            UserDefinedOpcode udo = (UserDefinedOpcode) iter.next();

            if (keyValues.size() > 0) {
                udo.codeBody = TextUtilities.replaceOpcodeNames(keyValues,
                        udo.codeBody);
            }

            String oldName = udo.getOpcodeName();
            String newName = masterList.getNameOfEquivalentCopy(udo);

            if (newName == null) {

                if (!masterList.isNameUnique(oldName)) {
                    newName = masterList.getUniqueName();
                    udo.setOpcodeName(newName);
                }

                masterList.addOpcode(udo);
            }

            if (newName != null && !newName.equals(oldName)) {
                keyValues.put(oldName, newName);
            }
        }

        return keyValues;
    }

}
