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
package blue.soundObject.pattern;

import java.io.Serializable;

import org.apache.commons.lang.builder.EqualsBuilder;
import org.apache.commons.lang.builder.ToStringBuilder;

import electric.xml.Element;
import electric.xml.Elements;

public class Pattern implements Serializable {
    public boolean[] values;

    String patternName = "pattern";

    String patternScore = "";

    boolean muted = false;

    boolean solo = false;

    public Pattern(int beats) {
        values = new boolean[beats];

        for (int i = 0; i < values.length; i++) {
            values[i] = false;
        }
    }

    public String getPatternName() {
        return patternName;
    }

    public void setPatternName(String patternName) {
        this.patternName = patternName;
    }

    public String getPatternScore() {
        return patternScore;
    }

    public void setPatternScore(String patternString) {
        this.patternScore = patternString;
    }

    public boolean isMuted() {
        return muted;
    }

    public void setMuted(boolean muted) {
        this.muted = muted;
    }

    public boolean isSolo() {
        return solo;
    }

    public void setSolo(boolean solo) {
        this.solo = solo;
    }

    public Element saveAsXML() {
        Element retVal = new Element("pattern");

        retVal.addElement("patternName").setText(patternName);
        retVal.addElement("patternScore").setText(patternScore);
        retVal.addElement("muted").setText(Boolean.toString(muted));
        retVal.addElement("solo").setText(Boolean.toString(solo));

        StringBuffer buffer = new StringBuffer();

        for (int i = 0; i < values.length; i++) {
            if (values[i]) {
                buffer.append("1");
            } else {
                buffer.append("0");
            }
        }

        retVal.addElement("values").setText(buffer.toString());

        return retVal;
    }

    public static Pattern loadFromXML(Element data) {
        String name = "";
        String score = "";
        boolean muted = false;
        boolean solo = false;
        boolean[] values = new boolean[16];

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("patternName")) {
                name = node.getTextString();
            } else if (nodeName.equals("patternScore")) {
                score = node.getTextString();
            } else if (nodeName.equals("muted")) {
                muted = node.getTextString().equals("true");
            } else if (nodeName.equals("solo")) {
                solo = node.getTextString().equals("true");
            } else if (nodeName.equals("values")) {
                String valStr = node.getTextString();
                values = new boolean[valStr.length()];

                for (int i = 0; i < valStr.length(); i++) {
                    values[i] = (valStr.charAt(i) == '1');
                }

            }
        }

        Pattern retVal = new Pattern(values.length);
        retVal.setPatternName(name);
        retVal.setPatternScore(score);
        retVal.setMuted(muted);
        retVal.setSolo(solo);
        retVal.values = values;

        return retVal;
    }

    /**
     * @see java.lang.Object#equals(Object)
     */
    public boolean equals(Object object) {
        return EqualsBuilder.reflectionEquals(this, object);
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }
}