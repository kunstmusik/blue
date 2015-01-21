/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

package blue.score.layers.audio.ui;

import blue.score.layers.Layer;
import blue.score.layers.audio.core.AudioLayer;
import blue.score.layers.audio.core.AudioLayerGroup;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;

/**
 * 
 * @author steven
 */
public class AudioHeaderListLayout implements LayoutManager {

    AudioLayerGroup audioLayerGroup = null;

    public AudioHeaderListLayout() {
    }

    public void setAudioLayerGroup(AudioLayerGroup audioLayerGroup) {
        this.audioLayerGroup = audioLayerGroup;
    }

    @Override
    public void addLayoutComponent(String name, Component comp) {
    }

    @Override
    public void removeLayoutComponent(Component comp) {
    }

    @Override
    public Dimension preferredLayoutSize(Container parent) {
        return minimumLayoutSize(parent);
    }

    @Override
    public Dimension minimumLayoutSize(Container parent) {
        int count = parent.getComponentCount();

        if (count == 0) {
            return new Dimension(0, 0);
        }

        if (parent.getParent() == null) {
            return new Dimension(0, 0);
        }

        if (audioLayerGroup == null) {
            return new Dimension(0, 0);
        }

        int w = parent.getWidth();

        int h = audioLayerGroup.getTotalHeight();

        return new Dimension(w, h);
    }

    @Override
    public void layoutContainer(Container parent) {

        int count = parent.getComponentCount();
        if (count == 0) {
            return;
        }

        if (parent.getParent() == null) {
            return;
        }

        if (audioLayerGroup == null) {
            return;
        }

        int w = parent.getWidth();

        int runningY = 0;

        int size = Math.min(count, audioLayerGroup.size());

        for (int i = 0; i < size; i++) {
            Component temp = parent.getComponent(i);
            AudioLayer layer = audioLayerGroup.get(i);

            int h = (layer.getHeightIndex() + 1) * Layer.LAYER_HEIGHT;
            temp.setLocation(0, runningY);
            temp.setSize(w, h);

            runningY += h;
        }
    }

}
