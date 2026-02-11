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
import blue.time.TimeDuration;
import blue.time.TimePosition;
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

        // Save start time as TimePosition and duration as TimeDuration
        retVal.addElement(sObj.getStartTime().saveAsXML().setName("startTimePosition"));
        retVal.addElement(sObj.getSubjectiveDuration().saveAsXML().setName("subjectiveDurationTD"));
        
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
        
        // Migration: Try new TimePosition format first, fall back to old double format
        Element startTimeUnitElement = data.getElement("startTimePosition");
        Element durationUnitElement = data.getElement("subjectiveDurationUnit");
        
        // Load start time
        if (startTimeUnitElement != null) {
            // New format: TimePosition (element is directly the timePosition)
            sObj.setStartTime(TimePosition.loadFromXML(startTimeUnitElement));
        } else if (data.getElement("startTime") != null) {
            // Old format: double (migrate to BeatTime)
            double startTime = Double.parseDouble(data.getTextString("startTime"));
            sObj.setStartTime(TimePosition.beats(startTime));
        } else {
            throw new Exception("Missing both startTimePosition and startTime elements");
        }
        
        // Load duration
        Element durationTDElement = data.getElement("subjectiveDurationTD");
        if (durationTDElement != null) {
            // New format: TimeDuration
            sObj.setSubjectiveDuration(TimeDuration.loadFromXML(durationTDElement));
        } else if (durationUnitElement != null) {
            // Legacy format: TimePosition (migrate to TimeDuration via beats)
            TimePosition legacyDur = TimePosition.loadFromXML(durationUnitElement);
            if (legacyDur instanceof TimePosition.BeatTime bt) {
                sObj.setSubjectiveDuration(TimeDuration.beats(bt.getCsoundBeats()));
            } else {
                // For non-BeatTime legacy durations, store as beats using a default context
                // This is a best-effort migration - precise conversion requires TimeContext
                sObj.setSubjectiveDuration(TimeDuration.beats(4.0));
            }
        } else if (data.getElement("subjectiveDuration") != null) {
            // Old format: double (migrate to DurationBeats)
            double duration = Double.parseDouble(data.getTextString("subjectiveDuration"));
            sObj.setSubjectiveDuration(TimeDuration.beats(duration));
        } else {
            throw new Exception("Missing subjectiveDurationTD, subjectiveDurationUnit, and subjectiveDuration elements");
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
