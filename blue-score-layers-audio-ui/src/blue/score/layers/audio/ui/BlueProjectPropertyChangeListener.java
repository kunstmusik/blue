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
package blue.score.layers.audio.ui;

import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.score.ScoreDataEvent;
import blue.score.ScoreListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

/**
 *
 * @author stevenyi
 */
public class BlueProjectPropertyChangeListener implements PropertyChangeListener {

    protected BlueProject currentProject = null;
    protected ScoreListener scoreListener;
    
    public BlueProjectPropertyChangeListener() {
        scoreListener = new ScoreListener() {

            @Override
            public void layerGroupsChanged(ScoreDataEvent sde) {
                switch(sde.getType()) {
                    case ScoreDataEvent.DATA_ADDED:
                        break;
                    case ScoreDataEvent.DATA_REMOVED:
                        break;
                    case ScoreDataEvent.DATA_CHANGED:
                        break;
                }
            }
        };
    }


    
    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (BlueProjectManager.CURRENT_PROJECT.equals(
                evt.getPropertyName())) {
            BlueProject oldProject = (BlueProject) evt.getOldValue();
            BlueProject newProject = (BlueProject) evt.getNewValue();

            if(oldProject == newProject) {
                return;
            }

            if(oldProject != null) {
                detachListeners(oldProject);
            }

            if(newProject != null) {
                attachListeners(newProject);
            }
            currentProject = newProject;
        }
    }

    protected void detachListeners(BlueProject project) {
//        System.out.println("Detach listeners to project: " + project);
        if(project == null) {
            return;
        }

        project.getData().getScore().removeScoreListener(scoreListener);
    }

    protected void attachListeners(BlueProject project) {
//        System.out.println("Attach listeners to project: " + project);
        if(project == null) {
            return;
        }
        
        project.getData().getScore().addScoreListener(scoreListener);
    }

    
}
