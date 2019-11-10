/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.ui.core.score.layers;

import blue.score.layers.LayerGroup;
import blue.ui.core.score.ScoreObjectView;
import java.awt.Graphics2D;
import java.awt.Point;
import javax.swing.Action;

/**
 *
 * @author stevenyi
 */
public interface LayerGroupPanel<T extends LayerGroup> {
    void marqueeSelectionPerformed(SelectionMarquee marquee);
    
    void paintNavigatorView(Graphics2D g2d);

    ScoreObjectView<?> getScoreObjectViewAtPoint(Point p);

    Action[] getLayerActions();

    T getLayerGroup();
}
