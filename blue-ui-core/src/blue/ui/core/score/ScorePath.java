/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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
package blue.ui.core.score;

import blue.score.Score;
import blue.score.layers.LayerGroup;
import java.awt.Point;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Path of the current item being edited, whether it's the root score, or a
 * sub-LayerGroup of the score
 *
 * @author stevenyi
 */
public class ScorePath {

    private WeakReference<Score> scoreRef;
    private List<WeakReference<LayerGroup>> layerGroups = new ArrayList<>();
    private List<Point> scrollLocations = new ArrayList<>();

    public ScorePath(Score score) {
        this.scoreRef = new WeakReference<>(score);
        scrollLocations.add(new Point(0, 0));
    }

    public Score getScore() {
        return scoreRef.get();
    }

    /**
     * Modifies the Score Path. Can pass in null to edit the root score. Returns
     * if an actual path change has occurred.
     *
     * @param layerGroup
     * @return whether the path has changed
     */
    public boolean editLayerGroup(LayerGroup layerGroup) {

        if (layerGroup == null) {
            if (layerGroups.isEmpty()) {
                return false;
            }
            layerGroups.clear();
            Point p = scrollLocations.get(0);
            scrollLocations.clear();
            scrollLocations.add(p);
            
            return true;
        } else if (getLastLayerGroup() == layerGroup) {
            // ignore... nothing has changed
            return false;
        } else {
            boolean found = false;

            for(WeakReference<LayerGroup> ref : layerGroups) {
                if(ref.get() == layerGroup) {
                    found = true;
                    break;
                } 
            }
           
            if(found) {
            for (int i = layerGroups.size() - 1; i >= 0; i--) {
                if (layerGroups.get(i).get() == layerGroup) {
                    break;
                }
                layerGroups.remove(i);
                scrollLocations.remove(i);
            }
            } else {
                layerGroups.add(new WeakReference<>(layerGroup));
                scrollLocations.add(new Point(0,0));
            }
            return true;
        }
    }

//    public List<WeakReference<LayerGroup>> getLayerGroups() {
//        return layerGroups;
//    }
    public LayerGroup getLastLayerGroup() {
        if (layerGroups.isEmpty()) {
            return null;
        }
        return layerGroups.get(layerGroups.size() - 1).get();
    }

    public List<LayerGroup> getLayerGroups() {
        List<LayerGroup> retVal = new ArrayList<>();

        for(WeakReference<LayerGroup> ref : layerGroups) {
            retVal.add(ref.get()); 
        }

        return retVal;
    }

//    void setLayerGroups(List<WeakReference<LayerGroup>> subList) {
//        this.layerGroups = subList;
//    }
    protected Point getCurrentPoint() {
        Point p = layerGroups.isEmpty() ? scrollLocations.get(0)
                : scrollLocations.get(scrollLocations.size() - 1);
        return p;
    }

    public void setScrollX(int x) {
        getCurrentPoint().x = x;
    }

    public void setScrollY(int y) {
        getCurrentPoint().y = y;
    }

    public int getScrollX() {
        return getCurrentPoint().x;
    }

    public int getScrollY() {
        return getCurrentPoint().y;
    }

    boolean containsLayerGroup(LayerGroup layerGroup) {
        if(layerGroup == null) {
            return false; 
        }
        for(WeakReference<LayerGroup> ref : layerGroups) {
            if (ref.get() == layerGroup) {
                return true;
            }
        }
        return false;
    }
}
