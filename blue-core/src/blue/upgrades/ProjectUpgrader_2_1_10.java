/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
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
package blue.upgrades;

import blue.utility.TextUtilities;
import electric.xml.Element;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;

/**
 * Changes:
 * <ul><li>Parse 0dbfs from global orc if found and set nodes for
 * properties in projectProperties node</li>
 * </ul>
 * 
 * @author stevenyi
 */
class ProjectUpgrader_2_1_10 extends ProjectUpgrader {

    public ProjectUpgrader_2_1_10() {
        super("2.1.10");
    }

     /**
     * Added in 2.1.10 when 0dbfs added as a full property in UI
     */
    @Override
    public boolean performUpgrade(Element data) {
        Element element = data.getElement("globalOrcSco");
        Element projectPropsNode = data.getElement("projectProperties");
        
        if(element == null || projectPropsNode == null) {
            return false;
        }
        
        Element globalOrcNode = element.getElement("globalOrc");
        
        if(element == null) {
            return false;
        }
        
        String globalOrc = globalOrcNode.getTextString();
        
        
        if (globalOrc == null || !globalOrc.contains("0dbfs")) {
            return false;
        }
        
        StringBuilder buffer = new StringBuilder();
        BufferedReader reader = new BufferedReader(new StringReader(globalOrc));
        String str;
        
        try {
            while ((str = reader.readLine()) != null) {
                if (str.trim().startsWith("0dbfs") && str.contains("=")) {
                    str = TextUtilities.stripSingleLineComments(str);
                    str = str.substring(str.indexOf('=') + 1).trim();
           
                    projectPropsNode.addElement("useZeroDbFS").setText("true");
                    projectPropsNode.addElement("zeroDbFS").setText(str);
                    projectPropsNode.addElement("diskUseZeroDbFS").setText("true");
                    projectPropsNode.addElement("diskZeroDbFS").setText(str);
                } else {
                    buffer.append(str).append("\n");
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        
        globalOrcNode.setText(buffer.toString());
        return true;
    }
    
}
