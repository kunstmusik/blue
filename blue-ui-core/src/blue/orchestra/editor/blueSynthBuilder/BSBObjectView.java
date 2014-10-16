/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder;

import javax.swing.JComponent;

import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectListener;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public abstract class BSBObjectView extends JComponent {
    BSBObject bsbObj;

    public String getObjectName() {
        return bsbObj.getObjectName();
    }

    public void setObjectName(String objectName) {
        bsbObj.setObjectName(objectName);
    }

    protected void setBSBObject(BSBObject bsbObj) {
        this.bsbObj = bsbObj;
    }

    protected BSBObject getBSBObject() {
        return bsbObj;
    }

    /*
     * public int getX() { return getParent().getX(); }
     * 
     * public int getY() { return getParent().getY(); }
     * 
     * public void setX(int x) { getParent().setLocation(x, this.getY());
     * //this.bsbObj.setX(x); //repaint(); }
     * 
     * public void setY(int y) { getParent().setLocation(this.getX(), y);
     * //this.bsbObj.setY(y); //repaint(); }
     */

    protected void setNewLocation(int x, int y) {

        if (bsbObj != null) {
            bsbObj.setX(x);
            bsbObj.setY(y);
        }
    }

    public void addBSBObjectListener(BSBObjectListener listener) {
        bsbObj.addListener(listener);
    }

    public void removeBSBObjectListener(BSBObjectListener listener) {
        bsbObj.removeListener(listener);
    }

    public abstract void cleanup();
}
