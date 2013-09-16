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
package blue.ui.core.score.mouse;

import blue.ui.core.score.ScoreObjectView;
import blue.ui.core.score.ScoreTopComponent;
import blue.ui.core.score.layers.LayerGroupPanel;
import java.awt.event.MouseAdapter;
import org.openide.util.lookup.InstanceContent;

/**
 * Base class for Score mouse adapters. Uses static members for 
 * currentLayerGroupPanel and currentScoreObjectView for purpose of efficiency
 * so that lookup is done once and all mouse adapters can have access when 
 * calculating what to do.
 * 
 * Classes that extend this should be careful to mark mouseEvents as consumed or
 * not.  The primary ScoreMouseListener will check the value when iterating 
 * to know when to stop processing.
 * 
 * @author stevenyi
 */
public class BlueMouseAdapter extends MouseAdapter {
    
    public static LayerGroupPanel currentLayerGroupPanel = null;
    public static ScoreObjectView currentScoreObjectView = null;
    public static ScoreTopComponent scoreTC = null;
    public static InstanceContent content;
}
