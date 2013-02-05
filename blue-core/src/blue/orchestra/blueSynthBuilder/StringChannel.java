/*
 * blue - object composition environment for csound
 * Copyright (c) 2012 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.blueSynthBuilder;

import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;

/**
 *
 * @author stevenyi
 */
public class StringChannel implements Serializable, PropertyChangeListener {

    public boolean dirty = true;
    String value = "";
    String channelName = null;

    public boolean isDirty() {
        return dirty;
    }
    
    public void setDirty(boolean value) {
        dirty = value;
    }

    public String getChannelName() {
        return channelName;
    }

    public void setChannelName(String channelName) {
        this.channelName = channelName;
    }
    
    
    public synchronized void setValue(String value) {
        if (value != null && !this.value.equals(value)) {
            this.value = value;
            dirty = true;
        }
    }

    public synchronized String getValue() {
        dirty = false;
        return value;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if(evt.getPropertyName().equals("stringChannelValue")) {
            setValue((String)evt.getNewValue());
        }
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null) {
            return false;
        }
        if (getClass() != obj.getClass()) {
            return false;
        }
        final StringChannel other = (StringChannel) obj;
        if (this.dirty != other.dirty) {
            return false;
        }
        if ((this.value == null) ? (other.value != null) : !this.value.equals(other.value)) {
            return false;
        }
        if ((this.channelName == null) ? (other.channelName != null) : !this.channelName.equals(other.channelName)) {
            return false;
        }
        return true;
    }
    
    
}
