/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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
package blue.score.tempo;

import blue.components.lines.Line;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.Iterator;
import java.util.Vector;

public class Tempo implements Serializable {

    private boolean enabled = false;
    private boolean visible = false;
    private Line line = new Line(false);
    private transient Vector listeners = null;

    public Tempo() {
        line.setMax(240.0f, true);
        line.setMin(30.0f, true);
        line.getLinePoint(0).setLocation(0.0f, 60.0f);
    }
    
    
    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        if(this.enabled != enabled) {
            PropertyChangeEvent pce = new PropertyChangeEvent(this, "enabled", 
                    Boolean.valueOf(this.enabled), Boolean.valueOf(enabled));
        
            this.enabled = enabled;
            
            firePropertyChangeEvent(pce);
        }
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        if(this.visible != visible) {
            PropertyChangeEvent pce = new PropertyChangeEvent(this, "visible", 
                    Boolean.valueOf(this.visible), Boolean.valueOf(visible));
        
            this.visible = visible;
            
            firePropertyChangeEvent(pce);
        }
    }

    public Line getLine() {
        return line;
    }

    public void setLine(Line line) {
        this.line = line;
    }

   
    
    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (listeners == null) {
            return;
        }

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();

            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector();
        }

        listeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            return;
        }
        listeners.remove(pcl);
    }
    
    public Element saveAsXML() {
        Element retVal = new Element("tempo");
        
        retVal.addElement(XMLUtilities.writeBoolean("enabled", enabled));
        retVal.addElement(XMLUtilities.writeBoolean("visible", visible));
        retVal.addElement(line.saveAsXML());
        
        return retVal;
    }
    
    public static Tempo loadFromXML(Element data) {
        Tempo retVal = new Tempo();

        Elements nodes = data.getElements();

        while(nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            
            if (nodeName.equals("enabled")) {
                retVal.enabled = Boolean.valueOf(node.getTextString()).booleanValue();
            } else if (nodeName.equals("visible")) {
                retVal.visible = Boolean.valueOf(node.getTextString()).booleanValue();
            } else if (nodeName.equals("line")) {
                retVal.line = Line.loadFromXML(node);
            }
        }
        
        return retVal;
    }
}
