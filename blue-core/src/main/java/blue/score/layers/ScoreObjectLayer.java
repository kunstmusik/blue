/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.score.layers;

import blue.score.ScoreObject;
import java.util.List;

/**
 *
 * @author stevenyi
 */
public interface ScoreObjectLayer<T extends ScoreObject> extends Layer, List<T> {
    int HEIGHT_MAX_INDEX = 9;
    int getHeightIndex();
    void setHeightIndex(int heightLayerIndex);
    void setMuted(boolean muted);
    boolean isMuted();
    void setSolo(boolean muted);
    boolean isSolo();
    @Override
    ScoreObjectLayer<T> deepCopy();
}
