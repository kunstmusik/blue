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

package blue.udo;

import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;

/**
 * @author Steven Yi
 */
public class UserDefinedOpcode implements Serializable {

    public String opcodeName = "newOpcode";

    public String outTypes = "";

    public String inTypes = "";

    public String codeBody = "";

    public String comments = "";

    // public ArrayList getArgs() {
    // String args = inArgs + "," + outArgs;
    //
    // ArrayList values = new ArrayList();
    //
    // int startIndex = 0;
    //
    // for(int i = 0; i < args.length(); i++) {
    // if(args.charAt(i) == ',') {
    // String val = args.substring(startIndex, i).trim();
    //
    // if(val.length() > 0) {
    // values.add(val);
    // }
    //
    // startIndex = i + 1 ;
    // }
    // }
    //
    // String val = args.substring(startIndex).trim();
    //
    // if(val.length() > 0) {
    // values.add(val);
    // }
    //
    // return values;
    // }

    public static UserDefinedOpcode loadFromXML(Element data) {
        UserDefinedOpcode retVal = new UserDefinedOpcode();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            String val = node.getTextString();

            if (val == null) {
                val = "";
            }

            if (node.getName().equals("opcodeName")) {
                retVal.opcodeName = val;
            } else if (node.getName().equals("outTypes")) {
                retVal.outTypes = val;
            } else if (node.getName().equals("inTypes")) {
                retVal.inTypes = val;
            } else if (node.getName().equals("codeBody")) {
                retVal.codeBody = val;
            } else if (node.getName().equals("comments")) {
                retVal.comments = val;
            }
        }

        return retVal;
    }

    public electric.xml.Element saveAsXML() {
        Element retVal = new Element("udo");

        retVal.addElement("opcodeName").setText(opcodeName);
        retVal.addElement("outTypes").setText(outTypes);
        retVal.addElement("inTypes").setText(inTypes);
        retVal.addElement("codeBody").setText(codeBody);
        retVal.addElement("comments").setText(comments);

        return retVal;
    }

    public String generateCode() {
        StringBuilder buffer = new StringBuilder();

        buffer.append("\topcode ").append(opcodeName);
        buffer.append(",").append(outTypes);
        buffer.append(",").append(inTypes).append("\n");

        // if(inArgs.trim().length() > 0) {
        // buffer.append(inArgs).append(" xin\n");
        // }
        //
        // if(useLocalKsmps) {
        // buffer.append("setksmps ").append(localKsmps).append("\n");
        // }

        buffer.append("\n").append(codeBody).append("\n\n");

        // if(outArgs.trim().length() > 0) {
        // buffer.append("xout ").append(outArgs).append("\n");
        // }

        buffer.append("\tendop");

        return buffer.toString();

    }

    public String toString() {
        return opcodeName;
    }

    public String getOpcodeName() {
        return this.opcodeName;
    }

    public void setOpcodeName(String opcodeName) {
        this.opcodeName = opcodeName;
    }

    public static void main(String[] args) {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.opcodeName = "getFrequency";

        udo.outTypes = "i";
        udo.inTypes = "i";

        // udo.useLocalKsmps = false;
        // udo.localKsmps = 1;
        //
        // udo.inArgs = "ipch";
        // udo.outArgs = "iout";

        udo.codeBody = "ipch\t xin\niout	= (ipch < 15 ? cpspch(ipch) : ipch)\n\txout iout	";

        System.out.println(udo.toString());
        // System.out.println(udo.getArgs());
    }

    public boolean isEquivalent(UserDefinedOpcode udo) {
        if (udo == null) {
            return false;
        }
        return (this.inTypes.equals(udo.inTypes)
                && this.outTypes.equals(udo.outTypes) && this.codeBody
                .equals(udo.codeBody));
    }
}
