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
package blue.ui.core.score.mouse;

import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.ui.core.score.ScoreController;
import blue.utility.ScoreUtilities;
import java.awt.Cursor;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.util.Collection;

/**
 *
 * @author stevenyi
 */
public class ResizeScoreObjectsListener extends BlueMouseAdapter {
    
    protected enum ResizeMode {
        
        RESIZE_RIGHT, RESIZE_LEFT
    };
    
    private static final int EDGE = 5;
    
    private Point startPoint;
    float[] startTimes = null;
    float[] endTimes = null;
    ResizeMode resizeMode = ResizeMode.RESIZE_LEFT;
    private ScoreObject[] selectedScoreObjects;
    private float minDiffTime;
    
    @Override
    public void mousePressed(MouseEvent e) {
        Cursor c = scoreTC.getScorePanel().getCursor();
        if (currentScoreObjectView == null
                || c == null
                || !(c.getType() == Cursor.E_RESIZE_CURSOR || c.getType() == Cursor.W_RESIZE_CURSOR)) {
            return;
        }
        e.consume();
        
        ScoreObject scoreObj = currentScoreObjectView.getScoreObject();
        Collection<? extends ScoreObject> temp
                = ScoreController.getInstance().getSelectedScoreObjects();
        
        if (temp.size() != 1) {
            // skip if trying to stretch more than one object for now, should 
            // revisit to do more than one in the future
            return;
        }
        
        switch (c.getType()) {
            case Cursor.W_RESIZE_CURSOR:
                resizeMode = ResizeMode.RESIZE_RIGHT;
                break;
            case Cursor.E_RESIZE_CURSOR:
                resizeMode = ResizeMode.RESIZE_LEFT;
                break;
            default:
                throw new RuntimeException(
                        "Error: Unknown resize type: " + c.getType());
        }
        
        startPoint = e.getPoint();
        selectedScoreObjects = temp.toArray(new ScoreObject[0]);
        startTimes = new float[selectedScoreObjects.length];
        endTimes = new float[selectedScoreObjects.length];
        
        minDiffTime = Float.MAX_VALUE;
        
        for (int i = 0; i < selectedScoreObjects.length; i++) {
            startTimes[i] = selectedScoreObjects[i].getStartTime();
            endTimes[i] = startTimes[i] + selectedScoreObjects[i].getSubjectiveDuration();
            if (startTimes[i] < minDiffTime) {
                minDiffTime = startTimes[i];
            }
        }
        minDiffTime = -minDiffTime;
    }
    
    @Override
    public void mouseDragged(MouseEvent e) {
        if (resizeMode == ResizeMode.RESIZE_LEFT) {
            resizeScoreObjectLeft(e);
        } else if (resizeMode == ResizeMode.RESIZE_RIGHT) {
            resizeScoreObjectRight(e);
        }
        e.consume();
    }
    
    @Override
    public void mouseReleased(MouseEvent e) {
        e.consume();
        startPoint = null;
        startTimes = null;
        endTimes = null;
        selectedScoreObjects = null;
    }
    
    private void resizeScoreObjectRight(MouseEvent e) {
        if (selectedScoreObjects == null) {
            return;
        }
        
        TimeState timeState = scoreTC.getTimeState();
        int xVal = e.getX();
        float newDuration;
        
        if (timeState.isSnapEnabled()) {
            final float snapValue = timeState.getSnapValue();
            
            float endTime = ScoreUtilities.getSnapValueMove(
                    xVal / (float) timeState.getPixelSecond(), snapValue);
            
            float minTime = ScoreUtilities.getSnapValueMove(
                    startTimes[0] + snapValue / 2, snapValue);
            
            endTime = (endTime < minTime) ? minTime : endTime;
            
            newDuration = endTime - startTimes[0];
            
        } else {
            
            float endTime = (float) xVal / timeState.getPixelSecond();
            float minTime = (float) EDGE / timeState.getPixelSecond();
            newDuration = endTime - startTimes[0];
            
            if (newDuration < minTime) {
                newDuration = minTime;
            }
        }
        
        selectedScoreObjects[0].setSubjectiveDuration(newDuration);
    }
    
    private void resizeScoreObjectLeft(MouseEvent e) {
        
        if (selectedScoreObjects == null) {
            return;
        }
        
        TimeState timeState = scoreTC.getTimeState();
        int xVal = e.getX();
        float newStart;
        
        if (timeState.isSnapEnabled()) {
            float snapValue = timeState.getSnapValue();
            float endTime = ScoreUtilities.getSnapValueMove(
                        endTimes[0] - (snapValue * .5001f), snapValue);
            
            newStart = ScoreUtilities.getSnapValueMove(
                    xVal / (float) timeState.getPixelSecond(),
                    snapValue);

            newStart = (newStart < 0.0f) ? 0.0f : newStart;
            
            if (newStart > endTime) {
                newStart = endTime;
            }
        } else {
            
            float maxTime = endTimes[0] - ((float) EDGE / timeState.getPixelSecond());            
            
            if (xVal < 0) {
                xVal = 0;
            }
            
            newStart = (float) xVal / timeState.getPixelSecond();
            
            if (newStart > maxTime) {
                newStart = maxTime;
            }
            
        }
        
        selectedScoreObjects[0].setStartTime(newStart);
        selectedScoreObjects[0].setSubjectiveDuration(endTimes[0] - newStart);
    }

}
