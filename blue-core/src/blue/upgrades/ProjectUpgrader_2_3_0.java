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

import blue.BlueData;
import blue.score.Score;
import blue.score.TimeState;
import blue.soundObject.PolyObject;
import electric.xml.Element;

/**
 * Changes:
 * <ul><li>Root PolyObject moved as sub-object of Score</li>
 * <li>Tempo object moved to sub-object of Score</li>
 * <li>Time values in PolyObject encapsulated into TimeState object</li>
 * <li>Grab Root polyObject's timestate to use as Score's timestate</li>
 * </ul>
 * 
 * 
 * @author stevenyi
 */
public class ProjectUpgrader_2_3_0 extends ProjectUpgrader {

    public ProjectUpgrader_2_3_0() {
        super("2.3.0");
    }

    @Override
    public boolean performUpgrade(Element data) {
        Element element = data.getElement("soundObject");
        Element tempoNode = data.getElement("tempo");
        
        if(element == null && tempoNode == null) {
            return false;
        }
        
        Element score = data.addElement("score");
        
        if(element != null) {
            Element elem = data.removeElement("soundObject");
            
            TimeState timeState = TimeState.loadFromXML(elem);
            score.addElement(timeState.saveAsXML());
            
            score.addElement((Element)elem.clone());
        }
        
        if(tempoNode != null) {
            Element elem = data.removeElement("tempo");
            score.addElement((Element)elem.clone());
        }
        
        return true;
    }
    
}
