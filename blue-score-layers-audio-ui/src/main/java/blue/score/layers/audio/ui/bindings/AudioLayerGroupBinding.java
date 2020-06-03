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

import blue.mixer.ChannelList;
import blue.score.layers.audio.core.AudioLayerGroup;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

/**
 *
 * @author stevenyi
 */
public class AudioLayerGroupBinding implements PropertyChangeListener {

    private final AudioLayerGroup alg;
    private final ChannelList channelList;
    boolean processing = false;

    public AudioLayerGroupBinding(AudioLayerGroup alg, ChannelList channelList) {
        this.alg = alg;
        this.channelList = channelList;
        
        this.alg.addPropertyChangeListener(this);
        this.channelList.addPropertyChangeListener(this);
    }
    
    public void clearBinding() {
        this.alg.removePropertyChangeListener(this);
        this.channelList.removePropertyChangeListener(this);
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (!processing) {
            processing = true;

            try {
                if (evt.getSource() == alg) {
                    if ("name".equals(evt.getPropertyName())) {
                        channelList.setListName((String)evt.getNewValue());
                    }
                } else if (evt.getSource() == channelList) {
                    if ("listName".equals(evt.getPropertyName())) {
                        alg.setName((String)evt.getNewValue());
                    }
                }
            } finally {
                processing = false;
            }
        }

    }
}
