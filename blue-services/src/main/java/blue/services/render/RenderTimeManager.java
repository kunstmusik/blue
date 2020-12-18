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
package blue.services.render;

import blue.noteProcessor.TempoMapper;
import java.beans.PropertyChangeListener;

/**
 *
 * @author stevenyi
 */
public interface RenderTimeManager {

    String RENDER_START = "renderStart";
    String TIME_POINTER = "timePointer";
    
    String RENDER_STATE = "renderState";

    // Property Change Methods
    void addPropertyChangeListener(PropertyChangeListener pcl);

    void addRenderTimeManagerListener(RenderTimeManagerListener listener);

    void endRender();

    double getRenderStartTime();

    double getRenderTime();

    TempoMapper getTempoMapper();

    void initiateRender(double renderStart);

    boolean isCurrentProjectRendering();

    void removePropertyChangeListener(PropertyChangeListener pcl);

    void removeRenderTimeManagerListener(RenderTimeManagerListener listener);

    void setTempoMapper(TempoMapper tempoMapper);

    void updateTimePointer(double timePointer);
    
    RenderState getRenderState();
}
