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

import java.io.File;
import java.io.IOException;

import javax.sound.sampled.UnsupportedAudioFileException;

import blue.utility.SoundFileUtilities;
import electric.xml.Element;

public class CFileIn extends CeciliaObject {

    private String fileName;

    private int offset;

    /**
     * @return Returns the offset.
     */
    public int getOffset() {
        return offset;
    }

    /**
     * @param offset
     *            The offset to set.
     */
    public void setOffset(int offset) {
        this.offset = offset;
    }

    // private String objectName;

    public CFileIn() {
        // objectName = "";
        fileName = "";
        offset = 0;
    }

    /**
     * @return Returns the fileName.
     */
    public String getFileName() {
        return fileName.replace('\\', '/');
    }

    /**
     * @param fileName
     *            The fileName to set.
     */
    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#processText(java.lang.String)
     */
    public String processText(String ceciliaText) {
        // TODO Auto-generated method stub
        return null;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#initialize(java.lang.String[])
     */
    public void initialize(String[] tokens) {
        this.setObjectName(tokens[1]);
        for (int i = 2; i < tokens.length; i += 2) {
            if (tokens[i].equals("-label")) {
                // ignore
            } else {

            }
        }
    }

    public static CeciliaObject loadFromXML(Element data) {
        CFileIn cObj = new CFileIn();

        CeciliaObject.initBasicFromXML(data, cObj);

        cObj.setFileName(data.getTextString("fileName"));
        try {
            cObj.setOffset(Integer.parseInt(data.getTextString("offset")));
        } catch (Exception e) {
            // eat exception, for backwards compatibility during testing
            // safe to remove after release
        }

        return cObj;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = CeciliaObject.getBasicXML(this);

        retVal.addElement("fileName").setText(this.getFileName());
        retVal.addElement("offset").setText(Integer.toString(this.offset));

        return retVal;
    }

    /**
     * @return
     */
    public boolean isAudioFile() {
        if (this.fileName == null || this.fileName.equals("")) {
            return false;
        }

        File f = new File(this.fileName);

        if (!f.exists()) {
            return false;
        }

        try {
            SoundFileUtilities.getDurationInSeconds(this.fileName);
            return true;
        } catch (IOException e) {
            return false;
        } catch (UnsupportedAudioFileException e) {
            return false;
        }

    }

    /**
     * Used by Offset Slider to figure out how many ticks to set for range
     * 
     * @return
     */
    public int getMaxTicks() {
        try {
            float dur = SoundFileUtilities.getDurationInSeconds(this.fileName);
            return (int) (dur * 10);
        } catch (Exception e) {
            return -1;
        }
    }

    public float getDuration() {
        try {
            return SoundFileUtilities.getDurationInSeconds(this.getFileName());
        } catch (IOException e) {
            return -1.0f;
        } catch (UnsupportedAudioFileException e) {
            return -1.0f;
        }
    }

    public int getChannels() {
        try {
            return SoundFileUtilities.getNumberOfChannels(this.getFileName());
        } catch (IOException e) {
            return -1;
        } catch (UnsupportedAudioFileException e) {
            return -1;
        }
    }

    public int getFrames() {
        try {
            return SoundFileUtilities.getNumberOfFrames(this.getFileName());
        } catch (IOException e) {
            return -1;
        } catch (UnsupportedAudioFileException e) {
            return -1;
        }
    }

    public float getSampleRate() {
        try {
            return SoundFileUtilities.getSampleRate(this.getFileName());
        } catch (IOException e) {
            return -1.0f;
        } catch (UnsupportedAudioFileException e) {
            return -1.0f;
        }
    }

}