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

import blue.orchestra.blueSynthBuilder.BSBObject;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import javafx.scene.layout.Pane;

/**
 *
 * @author stevenyi
 */
public class AlignmentUtils {

    private static Comparator<Pane> leftComparator, horizontalCenterComparator,
            rightComparator, topComparator, verticalCenterComparator,
            bottomComparator;

    static {
        leftComparator = new Comparator<Pane>() {

            @Override
            public int compare(Pane a, Pane b) {
                return Double.compare(a.getLayoutX(), b.getLayoutX());
            }
        };

        horizontalCenterComparator = new Comparator<Pane>() {

            @Override
            public int compare(Pane a, Pane b) {
                double center1 = a.getLayoutX() + (a.getWidth() / 2);
                double center2 = b.getLayoutX() + (b.getWidth() / 2);

                return Double.compare(center1, center2);
            }
        };

        rightComparator = new Comparator<Pane>() {

            @Override
            public int compare(Pane a, Pane b) {
                double right1 = a.getLayoutX() + a.getWidth();
                double right2 = b.getLayoutX() + b.getWidth();
                return Double.compare(right1, right2);
            }
        };

        topComparator = new Comparator<Pane>() {

            @Override
            public int compare(Pane a, Pane b) {
                return Double.compare(a.getLayoutY(), b.getLayoutY());
            }
        };

        verticalCenterComparator = new Comparator<Pane>() {

            @Override
            public int compare(Pane a, Pane b) {
                double center1 = a.getLayoutY() + (a.getHeight() / 2);
                double center2 = b.getLayoutY() + (b.getHeight() / 2);

                return Double.compare(center1, center2);
            }
        };

        bottomComparator = new Comparator<Pane>() {

            @Override
            public int compare(Pane a, Pane b) {
                double bottom1 = a.getLayoutY() + a.getHeight();
                double bottom2 = b.getLayoutY() + b.getHeight();
                return Double.compare(bottom1, bottom2);
            }
        };
    }

    public static void align(List<? extends Pane> panes, Alignment type) {
        double left, right, top, bottom, center;

        switch (type) {
            case LEFT:
                Optional<? extends Pane> leftPane = panes.stream().min(
                        (o1, o2) -> Double.compare(o1.getLayoutX(),
                                o2.getLayoutX()));

                if (leftPane.isPresent()) {
                    int x = (int) leftPane.get().getLayoutX();
                    for (Pane pane : panes) {
                        BSBObject bsbObj = (BSBObject) pane.getUserData();
                        bsbObj.setX(x);
                    }
                }
                break;
            case HORIZONTAL_CENTER:
                left = Integer.MAX_VALUE;
                right = 0;

                for (Pane comp : panes) {
                    if (comp.getLayoutX() < left) {
                        left = comp.getLayoutX();
                    }
                    double rightSide = comp.getLayoutX()
                            + comp.getWidth();
                    if (rightSide > right) {
                        right = rightSide;
                    }
                }

                center = ((right - left) / 2) + left;

                for (Pane pane : panes) {
                    BSBObject bsbObj = (BSBObject) pane.getUserData();
                    int newX = (int) (center - (pane.getWidth() / 2));
                    bsbObj.setX(newX);
                }

                break;
            case RIGHT:
                right = 0;

                for (Pane comp : panes) {
                    double rightSide = comp.getLayoutX() + comp.getWidth();
                    if (rightSide > right) {
                        right = rightSide;
                    }
                }

                for (Pane pane : panes) {
                    BSBObject bsbObj = (BSBObject) pane.getUserData();
                    bsbObj.setX((int) (right - pane.getWidth()));
                }

                break;
            case TOP:
                Optional<? extends Pane> topPane = panes.stream().min(
                        (o1, o2) -> Double.compare(o1.getLayoutY(),
                                o2.getLayoutY()));

                if (topPane.isPresent()) {
                    int y = (int) topPane.get().getLayoutY();
                    for (Pane pane : panes) {
                        BSBObject bsbObj = (BSBObject) pane.getUserData();
                        bsbObj.setY(y);
                    }
                }

                break;
            case VERTICAL_CENTER:
                top = Integer.MAX_VALUE;
                bottom = 0;

                for (Pane comp : panes) {
                    if (comp.getLayoutY() < top) {
                        top = comp.getLayoutY();
                    }
                    double bottomSide = comp.getLayoutY()
                            + comp.getHeight();
                    if (bottomSide > bottom) {
                        bottom = bottomSide;
                    }
                }

                center = ((bottom - top) / 2) + top;

                for (Pane pane : panes) {
                    BSBObject bsbObj = (BSBObject) pane.getUserData();
                    int newY = (int) (center - (pane.getHeight() / 2));
                    bsbObj.setY(newY);
                }
                break;
            case BOTTOM:
                bottom = 0;

                for (Pane comp : panes) {
                    double bottomSide = comp.getLayoutY() + comp.getHeight();
                    if (bottomSide > bottom) {
                        bottom = bottomSide;
                    }
                }

                for (Pane pane : panes) {
                    BSBObject bsbObj = (BSBObject) pane.getUserData();
                    bsbObj.setY((int) (bottom - pane.getHeight()));
                }
                break;

        }
    }

    public static void distribute(List<? extends Pane> panes, Alignment type) {
        if (panes == null || panes.size() < 3) {
            return;
        }

        int size = panes.size();
        double spacing, firstCenter, lastCenter;
        Pane first, last;

        switch (type) {
            case LEFT:
                Collections.sort(panes, leftComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                spacing = (last.getLayoutX() - first.getLayoutX()) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    Pane pane = panes.get(i);
                    BSBObject bsbObj = (BSBObject) pane.getUserData();
                    int newX = (int) ((i * spacing) + first.getLayoutX());
                    bsbObj.setX(newX);
                }

                break;
            case HORIZONTAL_CENTER:
                Collections.sort(panes, horizontalCenterComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                firstCenter = first.getLayoutX() + (first.getWidth() / 2);
                lastCenter = last.getLayoutX() + (last.getWidth() / 2);

                spacing = (lastCenter - firstCenter) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    Pane pane = panes.get(i);
                    BSBObject bsbObj = (BSBObject) pane.getUserData();

                    int newX = (int) ((i * spacing) + firstCenter);
                    newX = newX - (int) (pane.getWidth() / 2);

                    bsbObj.setX(newX);
                }

                break;
            case RIGHT:
                Collections.sort(panes, rightComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                spacing = ((last.getLayoutX() + last.getWidth()) - 
                        (first.getLayoutX() + first.getWidth()))
                        / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    Pane pane = panes.get(i);
                    BSBObject bsbObj = (BSBObject) pane.getUserData();

                    int newX = (int) ((i * spacing) + first.getLayoutX() 
                            + first.getWidth());
                    newX = newX - (int) pane.getWidth();
                    bsbObj.setX(newX);
                }
                break;
            case TOP:
                Collections.sort(panes, topComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                spacing = (last.getLayoutY() - first.getLayoutY()) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    Pane pane = panes.get(i);
                    BSBObject bsbObj = (BSBObject) pane.getUserData();

                    int newY = (int)((i * spacing) + first.getLayoutY());

                    bsbObj.setY(newY);
                }

                break;
            case VERTICAL_CENTER:
                Collections.sort(panes, verticalCenterComparator);

                first = (Pane) panes.get(0);
                last = (Pane) panes.get(size - 1);

                firstCenter = first.getLayoutY() + (first.getHeight() / 2);
                lastCenter = last.getLayoutY() + (last.getHeight() / 2);

                spacing = (lastCenter - firstCenter) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    Pane pane = panes.get(i);
                    BSBObject bsbObj = (BSBObject) pane.getUserData();

                    int newY = (int)((i * spacing) + firstCenter);
                    newY = newY - (int)(pane.getHeight() / 2);

                    bsbObj.setY(newY);
                }
                break;
            case BOTTOM:
                Collections.sort(panes, bottomComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                spacing = ((last.getLayoutY() + last.getHeight()) - (first.getLayoutY() + first
                        .getHeight()))
                        / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    Pane pane = panes.get(i);
                    BSBObject bsbObj = (BSBObject) pane.getUserData();

                    int newY = (int)((i * spacing) + first.getLayoutY() 
                            + first.getHeight());
                    newY = newY - (int)pane.getHeight();

                    bsbObj.setY(newY);
                }
                break;

        }
    }
}
