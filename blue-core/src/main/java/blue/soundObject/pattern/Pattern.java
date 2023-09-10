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

import electric.xml.Element;
import electric.xml.Elements;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Pattern {
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

    public Pattern(Pattern p) {
        values = p.values.clone();
        patternName = p.patternName;
        patternScore = p.patternScore;
        muted = p.muted;
        solo = p.solo;
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

        StringBuilder buffer = new StringBuilder();

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
            switch (nodeName) {
                case "patternName":
                    name = node.getTextString();
                    break;
                case "patternScore":
                    score = node.getTextString();
                    break;
                case "muted":
                    muted = node.getTextString().equals("true");
                    break;
                case "solo":
                    solo = node.getTextString().equals("true");
                    break;
                case "values":
                    String valStr = node.getTextString();
                    values = new boolean[valStr.length()];
                    for (int i = 0; i < valStr.length(); i++) {

                        values[i] = (valStr.charAt(i) == '1');
                    }
                    break;
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

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }
}