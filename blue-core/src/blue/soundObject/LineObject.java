/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject;

import blue.automation.LineColors;
import blue.components.lines.Line;
import blue.plugin.SoundObjectPlugin;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.Map;

/**
 * @author Steven Yi
 */

@SoundObjectPlugin(displayName = "LineObject", live=false, position = 60)
public class LineObject extends AbstractLineObject implements Serializable {
    public LineObject() {
        this.setName("LineObject");
    }

    protected String generateLineInstrument(Line line) {
        StringBuilder buffer = new StringBuilder();

        buffer.append("kphase line p4, p3, p5\n");
        buffer.append("gk").append(line.getVarName());
        buffer.append("\ttablei kphase, p6, 1");

        return buffer.toString();
    }

    /* SERIALIZATION */

    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {

        LineObject lObj = new LineObject();
        SoundObjectUtilities.initBasicFromXML(data, lObj);

        Elements lines = data.getElements();

        int counter = 0;

        while (lines.hasMoreElements()) {
            Element node = lines.next();
            if (node.getName().equals("line")) {
                Line l = Line.loadFromXML(node);
                lObj.getLines().add(l);

                if (l.getColor() == null) {
                    l.setColor(LineColors.getColor(counter));
                }
                counter++;
            }

        }

        return lObj;
    }
}
