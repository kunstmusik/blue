/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.components.lines;

import blue.soundObject.SoundObject;

/** Used to replace Lines within Parameters by Sound SoundObject.
 *
 * @author stevenyi
 */
public class SoundObjectParameterLine extends Line {
    
    SoundObject source = null;

    public SoundObjectParameterLine(SoundObject source, Line line) {
        super(true);
        this.channel = line.getChannel();
        this.color = line.getColor();
        this.endPointsLinked = line.isEndPointsLinked();
        this.isZak = line.isZak();
        this.max = line.getMax();
        this.min = line.getMin();
        this.points = line.getObservableList();
        this.uniqueID = line.getUniqueID();
        this.varName = line.getVarName();
        this.source = source;
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        super.setValueAt(aValue, rowIndex, columnIndex);
    }

    @Override
    public double getValue(double time) {
        double start = source.getStartTime();
        if (time < start) {
            return points.get(0).getY();
        } else if (time > start + source.getSubjectiveDuration()) {
            return points.get(points.size() - 1).getY();
        }
        double t = (time - start) / source.getSubjectiveDuration();
        return super.getValue(t);
    }
   
    public double getSourceStart() {
        return source.getStartTime();
    }

    public double getSourceDuration(){
        return source.getSubjectiveDuration();
    }
}
