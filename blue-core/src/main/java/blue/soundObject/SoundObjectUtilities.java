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
import blue.time.TimeUnit;
import electric.xml.Element;
import java.awt.Color;

/**
 * @author steven
 *
 * Utility class for SoundObjects to use
 */
public class SoundObjectUtilities {

    public static Element getBasicXML(SoundObject sObj) {
        Element retVal = new Element("soundObject");
        retVal.setAttribute("type", sObj.getClass().getName());

        // Save as TimeUnit (new format)
        retVal.addElement(sObj.getStartTimeUnit().saveAsXML().setName("startTimeUnit"));
        retVal.addElement(sObj.getSubjectiveDurationUnit().saveAsXML().setName("durationUnit"));
        
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
        
        // Migration: Try new TimeUnit format first, fall back to old double format
        Element startTimeUnitElement = data.getElement("startTimeUnit");
        Element durationUnitElement = data.getElement("durationUnit");
        
        // Load start time
        if (startTimeUnitElement != null) {
            // New format: TimeUnit
            Element timeUnitData = startTimeUnitElement.getElement("timeUnit");
            if (timeUnitData != null) {
                sObj.setStartTimeUnit(TimeUnit.loadFromXML(timeUnitData));
            } else {
                throw new Exception("Invalid startTimeUnit element: missing timeUnit child");
            }
        } else if (data.getElement("startTime") != null) {
            // Old format: double (migrate to BeatTime)
            double startTime = Double.parseDouble(data.getTextString("startTime"));
            sObj.setStartTime(startTime);  // Uses double API which creates BeatTime
        } else {
            throw new Exception("Missing both startTimeUnit and startTime elements");
        }
        
        // Load duration
        if (durationUnitElement != null) {
            // New format: TimeUnit
            Element timeUnitData = durationUnitElement.getElement("timeUnit");
            if (timeUnitData != null) {
                sObj.setSubjectiveDurationUnit(TimeUnit.loadFromXML(timeUnitData));
            } else {
                throw new Exception("Invalid durationUnit element: missing timeUnit child");
            }
        } else if (data.getElement("subjectiveDuration") != null) {
            // Old format: double (migrate to BeatTime)
            double duration = Double.parseDouble(data.getTextString("subjectiveDuration"));
            sObj.setSubjectiveDuration(duration);  // Uses double API which creates BeatTime
        } else {
            throw new Exception("Missing both durationUnit and subjectiveDuration elements");
        }

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

        if (sObj instanceof PolyObject pObj) {
            for (SoundObject soundObject : pObj.getSoundObjects(true)) {
                if (isOrContainsInstance(soundObject)) {
                    return true;
                }
            }
        }

        return false;
    }
}
