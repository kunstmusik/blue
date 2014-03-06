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
    WeakReference<Score> scoreRef;
    List<WeakReference<LayerGroup>> layerGroups = new ArrayList<>();

    public ScorePath(Score score) {
        this.scoreRef = new WeakReference<>(score);
    }

    public Score getScore() {
        return scoreRef.get();
    }

    public List<WeakReference<LayerGroup>> getLayerGroups() {
        return layerGroups;
    }

}
