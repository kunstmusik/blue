/*
 * blue - object composition environment for csound
 * Copyright (C) 2018 stevenyi
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
package blue.automation;

import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import javafx.collections.transformation.FilteredList;

/**
 * LineVerticalShift handles ctrl-drag constrained modification of points to
 * only shift values up/down. This class's methods, setup(), shift(), and
 * cleanup(), should be called when a mouse is pressed, dragged, and released.
 *
 * The shifter will take care to analyze whether synthetic points are necessary
 * at boundaries of selection. When setup() is called, analysis is done to find
 * points that exist at the boundary times. If none or one are found, synthetic
 * points will be necessary.
 *
 * A list of of LinePointOrigins is tracked in setup(). Synthetic points for
 * inner boundaries will be included in this list. shift() will adjust the times
 * for the list of affected points, including synthetic points. shift() will
 * also check whether to add or remove the synthetic points.
 *
 * @author stevenyi
 */
public class LineVerticalShifter {

    private Parameter param = null;
    private Line line = null;
    private double start = -1.0;
    private double end = -1.0;

    private final List<LinePointOrigin> linePointOrigins = new ArrayList<>();
    private final List<LinePoint> syntheticPoints = new ArrayList<>();

    private double maxShift = Double.NEGATIVE_INFINITY;
    private double minShift = Double.POSITIVE_INFINITY;

    /**
     * Called to analyze line for vertical shift
     */
    public void setup(final Parameter param, final double start, final double end) {
        if (param == null || end <= start || start < 0.0 || end < 0.0) {
            cleanup();
            return;
        }
        this.param = param;
        this.line = param.getLine();
        this.start = start;
        this.end = end;

        List<LinePoint> pts = line.getObservableList().stream()
                .filter(lp -> lp.getX() >= start && lp.getX() <= end)
                .collect(Collectors.toList());

        List<LinePoint> startPts = pts.stream()
                .filter(lp -> lp.getX() == start)
                .collect(Collectors.toList());

        List<LinePoint> endPts = pts.stream()
                .filter(lp -> lp.getX() == end)
                .collect(Collectors.toList());

        if (startPts.isEmpty()) {
            LinePoint outer = new LinePoint(start, line.getValue(start, true));
            LinePoint inner = new LinePoint(start, line.getValue(start, false));

            linePointOrigins.add(new LinePointOrigin(param, inner));

            syntheticPoints.add(outer);
            syntheticPoints.add(inner);
        } else if (startPts.size() == 1) {
            LinePoint outer = new LinePoint(start, line.getValue(start, true));
            syntheticPoints.add(outer);
        } else {
            for (int i = 0; i < startPts.size() - 1; i++) {
                pts.remove(0);
            }
        }

        if (endPts.isEmpty()) {
            LinePoint outer = new LinePoint(end, line.getValue(end, false));
            LinePoint inner = new LinePoint(end, line.getValue(end, true));

            linePointOrigins.add(new LinePointOrigin(param, inner));

            syntheticPoints.add(inner);
            syntheticPoints.add(outer);
        } else if (startPts.size() == 1) {
            LinePoint outer = new LinePoint(end, line.getValue(end, false));
            syntheticPoints.add(outer);
        } else {
            for (int i = endPts.size() - 2; i >= 0; i--) {
                pts.remove(pts.size() - 1);
            }
        }

        for (LinePoint lp : pts) {
            linePointOrigins.add(new LinePointOrigin(param, lp));
        }


        double max = Double.NEGATIVE_INFINITY;
        double min = Double.POSITIVE_INFINITY;

        for(LinePointOrigin lpo : linePointOrigins) {
            max = Math.max(max, lpo.linePoint.getY());
            min = Math.min(min, lpo.linePoint.getY());
        }

        maxShift = param.getMax() - max;
        minShift = param.getMin() - min;

    }

    public void processVShift(double amount) {

        // constrain shift amount 
        final double shift = Math.max(minShift, Math.min(maxShift, amount));

        BigDecimal resolution = param.getResolution();
        boolean doResolution = resolution.doubleValue() > 0.0;

        for (LinePointOrigin lpo : linePointOrigins) {
            LinePoint lp = lpo.linePoint;
            Parameter param = lpo.param;
            double newY = lpo.originY + shift;

            if (doResolution) {
                BigDecimal v = new BigDecimal(newY).setScale(resolution.scale(),
                        RoundingMode.HALF_UP);
                newY = v.subtract(v.remainder(resolution)).doubleValue();
            }

            lp.setLocation(lp.getX(), newY);
        }

        if (!syntheticPoints.isEmpty()) {
            if (shift == 0.0) {
                line.getObservableList().removeAll(syntheticPoints);
            } else if (!line.getObservableList().contains(syntheticPoints.get(0))) {
                for(LinePoint lp: syntheticPoints) {
                    line.insertLinePoint(lp);
                }
            }
        }
    }

    public void cleanup() {
        this.line = null;
        start = -1.0;
        end = -1.0;
        maxShift = Double.NEGATIVE_INFINITY;
        minShift = Double.POSITIVE_INFINITY;
        linePointOrigins.clear();
        syntheticPoints.clear();
    }

    /**
     * Utility class to track origin y-value of LinePoint.
     */
    class LinePointOrigin {

        private final double originY;
        private final Parameter param;
        private final LinePoint linePoint;

        public LinePointOrigin(Parameter p, LinePoint lp) {
            this.originY = lp.getY();
            this.param = p;
            this.linePoint = lp;
        }

    }
}
