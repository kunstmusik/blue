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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.orchestra.blueSynthBuilder.BSBObject;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 *
 * @author stevenyi
 */
public class AlignmentUtils {

    private static final Comparator<BSBObjectViewHolder> leftComparator;
    private static final Comparator<BSBObjectViewHolder> horizontalCenterComparator;
    private static final Comparator<BSBObjectViewHolder> rightComparator;
    private static final Comparator<BSBObjectViewHolder> topComparator;
    private static final Comparator<BSBObjectViewHolder> verticalCenterComparator;
    private static final Comparator<BSBObjectViewHolder> bottomComparator;

    static {
        leftComparator = new Comparator<BSBObjectViewHolder>() {

            @Override
            public int compare(BSBObjectViewHolder a, BSBObjectViewHolder b) {
                return Double.compare(a.getX(), b.getX());
            }
        };

        horizontalCenterComparator = new Comparator<BSBObjectViewHolder>() {

            @Override
            public int compare(BSBObjectViewHolder a, BSBObjectViewHolder b) {
                double center1 = a.getX() + (a.getWidth() / 2);
                double center2 = b.getX() + (b.getWidth() / 2);

                return Double.compare(center1, center2);
            }
        };

        rightComparator = new Comparator<BSBObjectViewHolder>() {

            @Override
            public int compare(BSBObjectViewHolder a, BSBObjectViewHolder b) {
                double right1 = a.getX() + a.getWidth();
                double right2 = b.getX() + b.getWidth();
                return Double.compare(right1, right2);
            }
        };

        topComparator = new Comparator<BSBObjectViewHolder>() {

            @Override
            public int compare(BSBObjectViewHolder a, BSBObjectViewHolder b) {
                return Double.compare(a.getY(), b.getY());
            }
        };

        verticalCenterComparator = new Comparator<BSBObjectViewHolder>() {

            @Override
            public int compare(BSBObjectViewHolder a, BSBObjectViewHolder b) {
                double center1 = a.getY() + (a.getHeight() / 2);
                double center2 = b.getY() + (b.getHeight() / 2);

                return Double.compare(center1, center2);
            }
        };

        bottomComparator = new Comparator<BSBObjectViewHolder>() {

            @Override
            public int compare(BSBObjectViewHolder a, BSBObjectViewHolder b) {
                double bottom1 = a.getY() + a.getHeight();
                double bottom2 = b.getY() + b.getHeight();
                return Double.compare(bottom1, bottom2);
            }
        };
    }

    public static void align(List<? extends BSBObjectViewHolder> panes, Alignment type) {
        double left, right, top, bottom, center;

        switch (type) {
            case LEFT:
                Optional<? extends BSBObjectViewHolder> leftBSBObjectViewHolder = panes.stream().min(
                        (o1, o2) -> Double.compare(o1.getX(),
                                o2.getX()));

                if (leftBSBObjectViewHolder.isPresent()) {
                    int x = (int) leftBSBObjectViewHolder.get().getX();
                    for (BSBObjectViewHolder pane : panes) {
                        var bsbObj = pane.getBSBObjectView().getBSBObject();
                        bsbObj.setX(x);
                    }
                }
                break;
            case HORIZONTAL_CENTER:
                left = Integer.MAX_VALUE;
                right = 0;

                for (BSBObjectViewHolder comp : panes) {
                    if (comp.getX() < left) {
                        left = comp.getX();
                    }
                    double rightSide = comp.getX()
                            + comp.getWidth();
                    if (rightSide > right) {
                        right = rightSide;
                    }
                }

                center = ((right - left) / 2) + left;

                for (BSBObjectViewHolder pane : panes) {
                    var bsbObj = pane.getBSBObjectView().getBSBObject();
                    int newX = (int) (center - (pane.getWidth() / 2));
                    bsbObj.setX(newX);
                }

                break;
            case RIGHT:
                right = 0;

                for (BSBObjectViewHolder comp : panes) {
                    double rightSide = comp.getX() + comp.getWidth();
                    if (rightSide > right) {
                        right = rightSide;
                    }
                }

                for (BSBObjectViewHolder pane : panes) {
                    var bsbObj = pane.getBSBObjectView().getBSBObject();
                    bsbObj.setX((int) (right - pane.getWidth()));
                }

                break;
            case TOP:
                Optional<? extends BSBObjectViewHolder> topBSBObjectViewHolder = panes.stream().min(
                        (o1, o2) -> Double.compare(o1.getY(),
                                o2.getY()));

                if (topBSBObjectViewHolder.isPresent()) {
                    int y = (int) topBSBObjectViewHolder.get().getY();
                    for (BSBObjectViewHolder pane : panes) {
                        var bsbObj = pane.getBSBObjectView().getBSBObject();
                        bsbObj.setY(y);
                    }
                }

                break;
            case VERTICAL_CENTER:
                top = Integer.MAX_VALUE;
                bottom = 0;

                for (BSBObjectViewHolder comp : panes) {
                    if (comp.getY() < top) {
                        top = comp.getY();
                    }
                    double bottomSide = comp.getY()
                            + comp.getHeight();
                    if (bottomSide > bottom) {
                        bottom = bottomSide;
                    }
                }

                center = ((bottom - top) / 2) + top;

                for (BSBObjectViewHolder pane : panes) {
                    var bsbObj = pane.getBSBObjectView().getBSBObject();
                    int newY = (int) (center - (pane.getHeight() / 2));
                    bsbObj.setY(newY);
                }
                break;
            case BOTTOM:
                bottom = 0;

                for (BSBObjectViewHolder comp : panes) {
                    double bottomSide = comp.getY() + comp.getHeight();
                    if (bottomSide > bottom) {
                        bottom = bottomSide;
                    }
                }

                for (BSBObjectViewHolder pane : panes) {
                    var bsbObj = pane.getBSBObjectView().getBSBObject();
                    bsbObj.setY((int) (bottom - pane.getHeight()));
                }
                break;

        }
    }

    public static void distribute(List<? extends BSBObjectViewHolder> panes, Alignment type) {
        if (panes == null || panes.size() < 3) {
            return;
        }

        int size = panes.size();
        double spacing, firstCenter, lastCenter;
        BSBObjectViewHolder first, last;

        switch (type) {
            case LEFT:
                Collections.sort(panes, leftComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                spacing = (last.getX() - first.getX()) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    BSBObjectViewHolder pane = panes.get(i);
                    var bsbObj = pane.getBSBObjectView().getBSBObject();
                    int newX = (int) ((i * spacing) + first.getX());
                    bsbObj.setX(newX);
                }

                break;
            case HORIZONTAL_CENTER:
                Collections.sort(panes, horizontalCenterComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                firstCenter = first.getX() + (first.getWidth() / 2);
                lastCenter = last.getX() + (last.getWidth() / 2);

                spacing = (lastCenter - firstCenter) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    BSBObjectViewHolder pane = panes.get(i);
                    var bsbObj = pane.getBSBObjectView().getBSBObject();

                    int newX = (int) ((i * spacing) + firstCenter);
                    newX = newX - (int) (pane.getWidth() / 2);

                    bsbObj.setX(newX);
                }

                break;
            case RIGHT:
                Collections.sort(panes, rightComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                spacing = ((last.getX() + last.getWidth())
                        - (first.getX() + first.getWidth()))
                        / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    BSBObjectViewHolder pane = panes.get(i);
                    var bsbObj = pane.getBSBObjectView().getBSBObject();

                    int newX = (int) ((i * spacing) + first.getX()
                            + first.getWidth());
                    newX = newX - (int) pane.getWidth();
                    bsbObj.setX(newX);
                }
                break;
            case TOP:
                Collections.sort(panes, topComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                spacing = (last.getY() - first.getY()) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    BSBObjectViewHolder pane = panes.get(i);
                    var bsbObj = pane.getBSBObjectView().getBSBObject();

                    int newY = (int) ((i * spacing) + first.getY());

                    bsbObj.setY(newY);
                }

                break;
            case VERTICAL_CENTER:
                Collections.sort(panes, verticalCenterComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                firstCenter = first.getY() + (first.getHeight() / 2);
                lastCenter = last.getY() + (last.getHeight() / 2);

                spacing = (lastCenter - firstCenter) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    BSBObjectViewHolder pane = panes.get(i);
                    var bsbObj = pane.getBSBObjectView().getBSBObject();

                    int newY = (int) ((i * spacing) + firstCenter);
                    newY = newY - (int) (pane.getHeight() / 2);

                    bsbObj.setY(newY);
                }
                break;
            case BOTTOM:
                Collections.sort(panes, bottomComparator);

                first = panes.get(0);
                last = panes.get(size - 1);

                spacing = ((last.getY() + last.getHeight()) - (first.getY() + first
                        .getHeight()))
                        / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    BSBObjectViewHolder pane = panes.get(i);
                    var bsbObj = pane.getBSBObjectView().getBSBObject();

                    int newY = (int) ((i * spacing) + first.getY()
                            + first.getHeight());
                    newY = newY - (int) pane.getHeight();

                    bsbObj.setY(newY);
                }
                break;

        }
    }
}
