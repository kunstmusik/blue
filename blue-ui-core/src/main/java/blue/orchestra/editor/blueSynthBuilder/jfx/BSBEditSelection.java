/*
 * blue - object composition environment for csound
 * Copyright (C) 2016 stevenyi
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
package blue.orchestra.editor.blueSynthBuilder.jfx;

import blue.orchestra.blueSynthBuilder.BSBGroup;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.GridSettings;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.collections.ObservableSet;
import javafx.scene.Node;
import javafx.scene.layout.Pane;

/**
 *
 * @author stevenyi
 */
public class BSBEditSelection {

    private static final ObservableSet<BSBObject> copyBuffer = FXCollections.observableSet();
    
    public final ObservableSet<BSBObject> selection;
    private final Map<BSBObject, Point> startPositions;
    private double minX = 0.0;
    private double minY = 0.0;
    private int gridOffsetX = 0;
    private int gridOffsetY = 0;
    
    private boolean processingMove = false;
    GridSettings gridSettings = null;
    private final ObservableList<Node> nodeList;
    private ObservableList<BSBGroup> groupList;

    public BSBEditSelection(ObservableList<Node> children) {
        selection = FXCollections.observableSet();
        startPositions = new HashMap<>();
        nodeList = children;
    }

    public ObservableSet<BSBObject> copyBufferProperty() {
        return copyBuffer;
    }

    public void initialize(ObservableList<BSBGroup> groupList,
            GridSettings gridSettings) {
        this.groupList = groupList;
        this.gridSettings = gridSettings;
        selection.clear();
    }

    public void initiateMove(BSBObject sourceDragObject) {
        startPositions.clear();
        minX = Double.MAX_VALUE;
        minY = Double.MAX_VALUE;
        for (BSBObject bsbObj : selection) {
            double x = bsbObj.getX();
            double y = bsbObj.getY();
            startPositions.put(bsbObj, new Point(x, y));
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
        }

        if (gridSettings != null && gridSettings.isSnapEnabled()) {
            gridOffsetX = sourceDragObject.getX() % gridSettings.getWidth();
            gridOffsetY = sourceDragObject.getY() % gridSettings.getHeight();
        } else {
            gridOffsetX = gridOffsetY = 0;
        }

        processingMove = true;
    }

    public void move(double xDiff, double yDiff) {
        if (!processingMove) {
            return;
        }

        if (gridSettings != null && gridSettings.isSnapEnabled()) {
            int w = gridSettings.getWidth();
            int h = gridSettings.getHeight();

            xDiff = (Math.round(xDiff / w) * w) - gridOffsetX;
            yDiff = (Math.round(yDiff / h) * h) - gridOffsetY;
        }

        double xDiffAdj = Math.max(-minX, xDiff);
        double yDiffAdj = Math.max(-minY, yDiff);

        for (Map.Entry<BSBObject, Point> entry : startPositions.entrySet()) {
            BSBObject obj = entry.getKey();
            Point pt = entry.getValue();

            obj.setX((int) Math.round(pt.x + xDiffAdj));
            obj.setY((int) Math.round(pt.y + yDiffAdj));
        }
    }

    public void endMove() {
        startPositions.clear();
        minX = 0.0;
        minY = 0.0;
        processingMove = false;
    }

    void cut() {
        if (groupList != null) {
            copy();
            remove();
        }
    }

    void copy() {
        if (groupList != null) {
            copyBuffer.clear();
            copyBuffer.addAll(
                    selection.stream().
                            map(b -> b.deepCopy())
                            .collect(Collectors.toList()));
        }
    }

    void remove() {
        if (groupList != null) {
            groupList.get(groupList.size() - 1).
                    interfaceItemsProperty().removeAll(selection);
            selection.clear();
        }
    }

    void nudgeHorizontal(int val) {
        if (selection.isEmpty()
                || selection.stream()
                        .mapToInt(BSBObject::getX)
                        .summaryStatistics().getMin() + val <= 0) {
            return;
        }
        for (BSBObject obj : selection) {
            obj.setX(obj.getX() + val);
        }
    }

    void nudgeVertical(int val) {
        if (selection.isEmpty()
                || selection.stream()
                        .mapToInt(BSBObject::getY)
                        .summaryStatistics().getMin() + val <= 0) {
            return;
        }
        for (BSBObject obj : selection) {
            obj.setY(obj.getY() + val);
        }
    }

    private class Point {

        public final double x;
        public final double y;

        public Point(double x, double y) {
            this.x = x;
            this.y = y;
        }
    }

    public List<Pane> getSelectedNodes() {
        ArrayList<Pane> retVal = new ArrayList<>();
        for (Node n : nodeList) {
            Pane p = (Pane) n;
            if (selection.contains(p.getUserData())) {
                retVal.add(p);
            }
        }
        return retVal;
    }

    public GridSettings getGridSettings(){
        return gridSettings;
    }
}
