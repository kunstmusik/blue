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

import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.util.Collection;
import javax.swing.SwingUtilities;
import org.openide.util.Utilities;

/**
 *
 * @author stevenyi
 */
public class MoveScoreObjectsListener extends BlueMouseAdapter {

    Point startPoint;

    //Collection<? extends ScoreObject> selectedScoreObjects = null;
    //Map<ScoreObject, Float> startTimes = new HashMap<>();
    
    ScoreObject[] selectedScoreObjects = null;
    float[] startTimes = null;
    float minDiffTime = Float.MIN_VALUE;
    
    @Override
    public void mousePressed(MouseEvent e) {

        if (currentScoreObjectView == null || 
                !SwingUtilities.isLeftMouseButton(e) ||
                e.isAltDown() || e.isAltGraphDown() || 
                e.isControlDown() || e.isMetaDown() || e.isShiftDown()) {
            return;
        }    

        ScoreObject scoreObj = currentScoreObjectView.getScoreObject();
        Collection<? extends ScoreObject> temp =
                Utilities.actionsGlobalContext().lookupAll(ScoreObject.class);

        if(!temp.contains(scoreObj)) {
            return;
        }
        
        e.consume();

        startPoint = e.getPoint();
        selectedScoreObjects = temp.toArray(new ScoreObject[0]);
        startTimes = new float[selectedScoreObjects.length];

        minDiffTime = Float.MAX_VALUE;
        
        for (int i = 0; i < selectedScoreObjects.length; i++) {
            startTimes[i] = selectedScoreObjects[i].getStartTime();
            if(startTimes[i] < minDiffTime) {
                minDiffTime = startTimes[i];
            }
            System.out.println(i + ") " + startTimes[i]);
        }
        minDiffTime = -minDiffTime;
        
//        for (ScoreObject tempObj : temp) {
//           startTimes.put(tempObj, tempObj.getStartTime());
//        }
        
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        e.consume();

        float diffTime = e.getX() - startPoint.x;
        TimeState timeState = scoreTC.getTimeState();
        diffTime = diffTime / timeState.getPixelSecond();

        if(diffTime < minDiffTime) {
            diffTime = minDiffTime;
        }
        
        if (timeState.isSnapEnabled()) {

            float tempStart = -minDiffTime + diffTime;
            float snappedStart = ScoreUtilities.getSnapValueMove(tempStart,
                    timeState.getSnapValue());

            diffTime = snappedStart + minDiffTime;

        }


        for(int i = 0; i < selectedScoreObjects.length; i++) {
            selectedScoreObjects[i].setStartTime(startTimes[i] + diffTime);
        }
        
        System.out.println("Diff Time: " + diffTime);
    }

    @Override
    public void mouseReleased(MouseEvent e) {

        e.consume();
        selectedScoreObjects = null;
        startTimes = null;
    }


    // MOUSE DRAGGING CODE
    private void moveSoundObjects(MouseEvent e) {
        // FIXME
//        int xTrans = e.getX() - sCanvas.start.x;
//
//        int layerStart = sCanvas.pObj.getLayerNumForY(sCanvas.start.y);
//        int newLayer = sCanvas.pObj.getLayerNumForY(e.getY());
//
//        int yTranslation = -(layerStart - newLayer);
//
//        // snap to layer
//
//        int minLayer = sCanvas.pObj.getLayerNumForY(sCanvas.mBuffer.minY);
//        int maxLayer = sCanvas.pObj.getLayerNumForY(sCanvas.mBuffer.maxY);
//
//        if ((yTranslation + minLayer) < 0) {
//            yTranslation = -minLayer;
//        } else if ((yTranslation + maxLayer) >= sCanvas.pObj.getSize()) {
//            yTranslation = sCanvas.pObj.getSize() - maxLayer - 1;
//        }
//
//        float timeAdjust = (float) xTrans / timeState.getPixelSecond();
//
//        float initialStartTime = sCanvas.mBuffer.initialStartTimes[0];
//
//        if (timeAdjust < -initialStartTime) {
//            timeAdjust = -initialStartTime;
//        }
//
//        if (timeState.isSnapEnabled()) {
//
//
//            float tempStart = initialStartTime + timeAdjust;
//            float snappedStart = ScoreUtilities.getSnapValueMove(tempStart,
//                    timeState.getSnapValue());
//
//
//            timeAdjust = snappedStart - initialStartTime;
//
//        }
//
//
//
//        //FIXME - needs to use time instead of x value
//        sCanvas.automationPanel.setMultiLineTranslation(timeAdjust);
//
//        for (int i = 0; i < sCanvas.mBuffer.motionBuffer.length; i++) {
//
//
//            int originalLayer = sCanvas.pObj
//                    .getLayerNumForY(sCanvas.mBuffer.sObjYValues[i]);
//
//            int newY = sCanvas.pObj.getYForLayerNum(originalLayer + yTranslation);
//
//            SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[i];
//            SoundObject sObj = sObjView.getSoundObject();
//
//            float newStart = sCanvas.mBuffer.initialStartTimes[i] + timeAdjust;
//
//            sObjView.setLocation(sObjView.getX(), newY);
//
//            sObjView.setSize(sObjView.getWidth(), sCanvas.pObj
//                    .getSoundLayerHeight(originalLayer + yTranslation));
//
//            sObj.setStartTime(newStart);
//
//        }

    }
}
