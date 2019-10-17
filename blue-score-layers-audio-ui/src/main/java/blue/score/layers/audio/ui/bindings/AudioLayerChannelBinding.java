/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
package blue.score.layers.audio.ui.bindings;

import blue.mixer.Channel;
import blue.score.layers.audio.core.AudioLayer;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

/**
 *
 * @author stevenyi
 */
public class AudioLayerChannelBinding implements PropertyChangeListener {

    private final Channel channel;
    private final AudioLayer al;
    private boolean processing = false;

    public AudioLayerChannelBinding(AudioLayer al, Channel channel) {
        this.al = al;
        this.channel = channel;
        
        this.al.addPropertyChangeListener(this);
        this.channel.addPropertyChangeListener(this);
    }

    public void clearBinding() {
        this.al.removePropertyChangeListener(this);
        this.channel.removePropertyChangeListener(this);
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (!processing) {
            processing = true;

            try {
                if (evt.getSource() == al) {
                    if ("name".equals(evt.getPropertyName())) {
                        channel.setName((String)evt.getNewValue());
                    }
                } else if (evt.getSource() == channel) {
                    if ("name".equals(evt.getPropertyName())) {
                        al.setName((String)evt.getNewValue());
                    }
                }
            } finally {
                processing = false;
            }
        }
    }
}
