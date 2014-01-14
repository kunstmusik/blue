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
package blue.event;

import blue.orchestra.blueSynthBuilder.GridSettings;
import java.awt.Point;
import java.util.ArrayList;
import java.util.Iterator;
import javax.swing.JComponent;

/**
 * @author steven
 */
public class GroupMovementSelectionList extends SelectionList implements
        GroupMovementListener {

    ArrayList originPoints = new ArrayList();

    int minOffsetX = 0;

    int minOffsetY = 0;

    int gridOffsetX = 0;
    int gridOffsetY = 0;

    GridSettings gridSettings = null;

    public void setGridSettings(GridSettings gridSettings) {
        this.gridSettings = gridSettings;
    }

    public void initiateMovement(JComponent source) {
        originPoints.clear();

        minOffsetX = Integer.MAX_VALUE;
        minOffsetY = Integer.MAX_VALUE;

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            JComponent comp = (JComponent) iter.next();

            Point p = comp.getLocation();

            originPoints.add(p);

            if (p.x < minOffsetX) {
                minOffsetX = p.x;
            }

            if (p.y < minOffsetY) {
                minOffsetY = p.y;
            }
        }

        minOffsetX = -minOffsetX;
        minOffsetY = -minOffsetY;

        if(gridSettings != null && gridSettings.isSnapEnabled()) {
            gridOffsetX = source.getX() % gridSettings.getWidth();
            gridOffsetY = source.getY() % gridSettings.getHeight();
        } else {
            gridOffsetX = gridOffsetY = 0;
        }
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.event.GroupMovementListener#move(java.awt.Point)
     */
    public void move(int offsetX, int offsetY) {

        if(gridSettings != null && gridSettings.isSnapEnabled()) {
            int w = gridSettings.getWidth();
            int h = gridSettings.getHeight();
                    
            offsetX = (Math.round((float)offsetX / w) * w) - gridOffsetX;
            offsetY = (Math.round((float)offsetY / h) * h) - gridOffsetY;
        }
        
        int xVal = (offsetX < minOffsetX) ? minOffsetX : offsetX;
        int yVal = (offsetY < minOffsetY) ? minOffsetY : offsetY;

        for (int i = 0; i < originPoints.size(); i++) {
            JComponent comp = (JComponent) this.get(i);
            Point origin = (Point) originPoints.get(i);

            int newX = origin.x + xVal;
            int newY = origin.y + yVal;

            comp.setLocation(newX, newY);
        }
    }

    public void nudgeUp(int amount) {
        boolean canNudge = true;

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            JComponent comp = (JComponent) iter.next();

            if (comp.getY() <= amount) {
                canNudge = false;
                break;
            }

        }

        if (canNudge) {

            for (Iterator iter = this.iterator(); iter.hasNext();) {
                JComponent comp = (JComponent) iter.next();

                comp.setLocation(comp.getX(), comp.getY() - amount);

            }
        }
    }

    public void nudgeDown(int amount) {
        for (Iterator iter = this.iterator(); iter.hasNext();) {
            JComponent comp = (JComponent) iter.next();

            comp.setLocation(comp.getX(), comp.getY() + amount);

        }
    }

    public void nudgeLeft(int amount) {
        boolean canNudge = true;

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            JComponent comp = (JComponent) iter.next();

            if (comp.getX() < amount) {
                canNudge = false;
                break;
            }

        }

        if (canNudge) {

            for (Iterator iter = this.iterator(); iter.hasNext();) {
                JComponent comp = (JComponent) iter.next();

                comp.setLocation(comp.getX() - amount, comp.getY());

            }
        }
    }

    public void nudgeRight(int amount) {
        for (Iterator iter = this.iterator(); iter.hasNext();) {
            JComponent comp = (JComponent) iter.next();

            comp.setLocation(comp.getX() + amount, comp.getY());

        }

    }
}