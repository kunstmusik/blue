/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
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
package blue.soundObject;

import blue.noteProcessor.NoteProcessorChain;
import electric.xml.Element;
import java.awt.Color;
import java.util.List;

/**
 * @author steven
 *
 * Utility class for SoundObjects to use
 */
public class SoundObjectUtilities {

    public static Element getBasicXML(SoundObject sObj) {
        Element retVal = new Element("soundObject");
        retVal.setAttribute("type", sObj.getClass().getName());

        retVal.addElement("subjectiveDuration").setText(
                Double.toString(sObj.getSubjectiveDuration()));
        retVal.addElement("startTime").setText(
                Double.toString(sObj.getStartTime()));
        retVal.addElement("name").setText(sObj.getName());

        String colorStr = Integer.toString(sObj.getBackgroundColor().getRGB());

        retVal.addElement("backgroundColor").setText(colorStr);

        if (sObj.getTimeBehavior() != TimeBehavior.NOT_SUPPORTED) {
            retVal.addElement("timeBehavior").setText(
                    Integer.toString(sObj.getTimeBehavior().getType()));
            retVal.addElement("repeatPoint").setText(
                    Double.toString(sObj.getRepeatPoint()));
        }

        if (sObj.getNoteProcessorChain() != null) {
            retVal.addElement(sObj.getNoteProcessorChain().saveAsXML());
        }

        return retVal;
    }

    public static void initBasicFromXML(Element data, SoundObject sObj)
            throws Exception {
        sObj.setSubjectiveDuration(Double.parseDouble(data
                .getTextString("subjectiveDuration")));
        sObj.setStartTime(Double.parseDouble(data.getTextString("startTime")));

        String name = data.getTextString("name");

        if (name == null) {
            sObj.setName("");
        } else {
            sObj.setName(name);
        }

        if (data.getElement("backgroundColor") != null) {
            String colorStr = data.getTextString("backgroundColor");

            sObj.setBackgroundColor(new Color(Integer.parseInt(colorStr)));
        }

        if (data.getElement("timeBehavior") != null) {
            int type = Integer.parseInt(data
                    .getTextString("timeBehavior"));
            sObj.setTimeBehavior(TimeBehavior.valueByType(type));
        }

        if (data.getElement("repeatPoint") != null) {
            sObj.setRepeatPoint(Double.parseDouble(data
                    .getTextString("repeatPoint")));
        }

        if (data.getElement("noteProcessorChain") != null) {
            sObj.setNoteProcessorChain(NoteProcessorChain.loadFromXML(data
                    .getElement("noteProcessorChain")));
        }
    }

    public static boolean isOrContainsInstance(SoundObject sObj) {
        if (sObj instanceof Instance) {
            return true;
        }

        if (sObj instanceof PolyObject) {
            PolyObject pObj = (PolyObject) sObj;
            for (SoundObject soundObject : pObj.getSoundObjects(true)) {
                if (isOrContainsInstance(soundObject)) {
                    return true;
                }
            }
        }

        return false;
    }
}
