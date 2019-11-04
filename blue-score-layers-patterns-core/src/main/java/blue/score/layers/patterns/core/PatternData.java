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
package blue.score.layers.patterns.core;

import electric.xml.Element;
import java.util.Arrays;

/**
 *
 * @author stevenyi
 */
public class PatternData {

    protected static final int BLOCK_SIZE = 16;

    boolean[] patterns = new boolean[BLOCK_SIZE];
    int maxSelected = -1;

    public PatternData() {
    }

    public PatternData(PatternData pd) {
        patterns = pd.patterns.clone();
        maxSelected = pd.maxSelected;
    }

    public boolean isPatternSet(int index) {
        if (index < 0 || index >= patterns.length) {
            return false;
        }
        return patterns[index];
    }

    public void setPattern(int index, boolean selected) {
        if (index < 0 || isPatternSet(index) == selected) {
            return;
        }
        if (index >= patterns.length) {
            if (selected) {
                resizePatterns(index);
            } else {
                return;
            }
        }
        patterns[index] = selected;

        if (index >= maxSelected) {
            if (selected) {
                maxSelected = index;
            } else {
                maxSelected = calculateMaxSelected();
            }
        }
    }

    public int getSize() {
        return patterns.length;
    }

    public int getMaxSelected() {
        return maxSelected;
    }

    protected int calculateMaxSelected() {
        for (int i = patterns.length - 1; i >= 0; i--) {
            if (patterns[i]) {
                return i;
            }
        }
        return -1;
    }

    protected void resizePatterns(int index) {
        int newSize = ((index / BLOCK_SIZE) + 1) * BLOCK_SIZE;

        if (newSize == patterns.length) {
            return;
        }

        boolean[] newPatterns = new boolean[newSize];

        int length = Math.min(patterns.length, newPatterns.length);

        System.arraycopy(patterns, 0, newPatterns, 0, length);

        patterns = newPatterns;
    }

    public Element saveAsXML() {
        Element retVal = new Element("patternData");

        // resize array for efficiency
        resizePatterns(calculateMaxSelected());

        StringBuilder buffer = new StringBuilder();

        for (int i = 0; i < patterns.length; i++) {
            if (patterns[i]) {
                buffer.append("1");
            } else {
                buffer.append("0");
            }
        }

        retVal.setText(buffer.toString());

        return retVal;
    }

    public static PatternData loadFromXML(Element data) {
        PatternData patternData = new PatternData();

        String valStr = data.getTextString();
        patternData.patterns = new boolean[valStr.length()];

        for (int i = 0; i < valStr.length(); i++) {
            patternData.patterns[i] = (valStr.charAt(i) == '1');
        }

        return patternData;
    }
}
