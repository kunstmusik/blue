/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
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
package blue.soundObject.ceciliaModule;

import electric.xml.Element;

public class CToggle extends CeciliaObject {

    private boolean isToggled = true;

    public static void main(String[] args) {
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#processText(java.lang.String)
     */
    @Override
    public String processText(String ceciliaText) {
        // TODO Auto-generated method stub
        return null;
    }

    /**
     * @return Returns the isToggled.
     */
    public boolean isToggled() {
        return isToggled;
    }

    /**
     * @param isToggled
     *            The isToggled to set.
     */
    public void setToggled(boolean isToggled) {
        this.isToggled = isToggled;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#initialize(java.lang.String[])
     */
    @Override
    public void initialize(String[] tokens) {
        this.setObjectName(tokens[1]);
        for (int i = 2; i < tokens.length; i += 2) {
            if (tokens[i].equals("-label")) {
                this.setLabel(tokens[i + 1]);
            } else if (tokens[i].equals("-init")) {
                this.setToggled(tokens[i + 1].equals("1"));
            }
        }

    }

    public String generateToggleText() {
        String val = isToggled() ? "1" : "0";
        String retVal = "gkpp" + this.getObjectName() + " init " + val + "\n";
        retVal += "gk" + this.getObjectName() + " init " + val + "\n";
        retVal += "gi" + this.getObjectName() + " init " + val + "\n";

        return retVal;
    }

    public static CeciliaObject loadFromXML(Element data) {
        CToggle ctoggle = new CToggle();

        CeciliaObject.initBasicFromXML(data, ctoggle);

        ctoggle.setToggled(Boolean.valueOf(data.getTextString("isToggled"))
                .booleanValue());

        return ctoggle;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#saveAsXML()
     */
    @Override
    public Element saveAsXML() {
        Element retVal = CeciliaObject.getBasicXML(this);

        retVal.addElement("isToggled").setText(
                Boolean.toString(this.isToggled()));

        return retVal;
    }
}