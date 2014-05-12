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
package blue.score;

import blue.score.layers.LayerGroup;
import java.util.List;

/**
 *
 * @author stevenyi
 */
public class ScoreDataEvent {
     public static final int DATA_ADDED = 0;
    public static final int DATA_REMOVED = 1;
    public static final int DATA_CHANGED = 2;
    private int startIndex;
    private int endIndex;
    private int type;
    private Score source;
    private List<LayerGroup> layerGroups;

//    public ScoreDataEvent(Score source, int type, int startIndex, int endIndex) {
//        this(source, type, startIndex, endIndex, null);
//    }
    
     public ScoreDataEvent(Score source, int type, int startIndex,
            int endIndex, List<LayerGroup> layers) {
        this.source = source;
        this.type = type;
        this.startIndex = Math.min(startIndex, endIndex);
        this.endIndex = Math.max(startIndex, endIndex);
        this.layerGroups = layers;
    }

    public int getEndIndex() {
        return endIndex;
    }

    public Score getSource() {
        return source;
    }

    public int getStartIndex() {
        return startIndex;
    }

    public int getType() {
        return type;
    }

    public List<LayerGroup> getLayerGroups() {
        return layerGroups;
    }
}
