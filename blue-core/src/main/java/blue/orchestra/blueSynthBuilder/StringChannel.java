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
import java.util.Objects;

/**
 *
 * @author stevenyi
 */
public class StringChannel implements PropertyChangeListener {

    public boolean dirty = true;
    String value = "";
    String channelName = null;

    public StringChannel() {
    }

    public StringChannel(StringChannel chan) {
        this.dirty = chan.dirty;
        this.value = chan.value;
        this.channelName = chan.channelName;
    }

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
        if (value != null && !Objects.equals(this.value, value)) {
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
        if (Objects.equals(evt.getPropertyName(), "stringChannelValue")) {
            setValue((String) evt.getNewValue());
        }
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (!(obj instanceof StringChannel other)) {
            return false;
        }
        return this.dirty == other.dirty
                && Objects.equals(this.value, other.value)
                && Objects.equals(this.channelName, other.channelName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(dirty, value, channelName);
    }

}
