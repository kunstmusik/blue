/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
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

import blue.score.layers.audio.core.FadeType;

/**
 *
 * @author stevenyi
 */
public class FadeRenderer {

    private static double[] SYMMETRIC_IN_POINTS;
    private static double[][] SYMMETRIC_IN_COEFS;
    private static double[] SYMMETRIC_OUT_POINTS;
    private static double[][] SYMMETRIC_OUT_COEFS;

    private static double PI_2 = Math.PI * 0.5;

    /**
     * Calculates amplitude value for given decibel
     *
     * @param v
     */
    protected static double ampdb(double db) {
        return Math.pow(10.0, db * 0.05);
    }

    protected static double dbamp(double amp) {
        return 20 * Math.log10(amp);
    }

    protected static double[] getSymmetricCurvePoints() {
        double[] points = new double[20];
        points[0] = 0.0;
        points[1] = 1.0;
        points[2] = 0.5;
        points[3] = 0.6;

        for (int i = 2; i < 9; i++) {
            double coef = 0.3 * Math.pow(0.5, i);
            double ix = (0.7 + (0.3 * (i / 9.0)));
            int indx = i * 2;
            points[indx] = ix;
            points[indx + 1] = coef;
        }

        points[18] = 1.0;
        points[19] = 0.0000001;

        return points;
    }

    protected static double[] reverseCurve(double[] points) {
        int len = points.length;
        double[] retVal = new double[len];
        double dur = points[len - 2];
        
        for (int i = 0; i < len; i += 2) {
            int inIndx = len - i - 2;
            retVal[i] = dur - points[inIndx];
            retVal[i + 1] = points[inIndx + 1];
        }
        return retVal;
    }

    protected static double[][] calcCubicCoefficients(double[] points) {
        int len = points.length / 2;
        double[][] retVal = new double[len - 1][4];

        double ifplast = 0.0;

        for (int i = 0; i < len; i++) {

            if (i == 0) {
                double ilp0 = (points[2] - points[0]) / (points[3] - points[1]);
                double ilp1 = (points[4] - points[2]) / (points[5] - points[3]);
                double ifpone = ((ilp0 * ilp1) < 0) ? 0 : (2.0 / (ilp1 + ilp0));

                ifplast = ((3.0 * (points[3] - points[1])
                        / (2.0 * (points[2] - points[0])))
                        - (ifpone * 0.5));
            } else {
                int indx2 = i * 2;
                double ixdelta = points[indx2] - points[indx2 - 2];
                double ixdelta2 = ixdelta * ixdelta;
                double iydelta = points[indx2 + 1] - points[indx2 - 1];
                double ifpi;

                if (i == len - 1) {
                    ifpi = ((3 * iydelta) / (2 * ixdelta)) - (ifplast * 0.5);
                } else {
                    double islope_before = ((points[indx2 + 2] - points[indx2])
                            / (points[indx2 + 3] - points[indx2 + 1]));
                    double islope_after = (ixdelta / iydelta);

                    ifpi = ((islope_after * islope_before) < 0.0) ? 0.0 : 2 / (islope_after + islope_before);
                }
                /* compute second derivative for either side of control point `i' */

                double ifppL = (((-2 * (ifpi + (2 * ifplast))) / (ixdelta)))
                        + ((6 * iydelta) / ixdelta2);

                double ifppR = (2 * ((2 * ifpi) + ifplast) / ixdelta)
                        - ((6 * iydelta) / ixdelta2);

                double id = (ifppR - ifppL) / (6 * ixdelta);
                double ic = ((points[indx2] * ifppL) - (points[indx2 - 2] * ifppR)) / (2 * ixdelta);

                double ixim1 = points[indx2 - 2];
                double ixi = points[indx2];
                double iyim1 = points[indx2 - 1];
                double ixim12 = ixim1 * ixim1;
                /* "x[i-1] squared" */
                double ixim13 = ixim12 * ixim1;
                /* "x[i-1] cubed" */
                double ixi2 = ixi * ixi;
                /* "x[i] squared" */
                double ixi3 = ixi2 * ixi;
                /* "x[i] cubed" */

                double ib = (iydelta - (ic * (ixi2 - ixim12)) - (id * (ixi3 - ixim13))) / ixdelta;

                int ioff = i - 1;
                retVal[ioff][0] = iyim1 - (ib * ixim1) - (ic * ixim12) - (id * ixim13);
                retVal[ioff][1] = ib;
                retVal[ioff][2] = ic;
                retVal[ioff][3] = id;
                ifplast = ifpi;
            }
        }
        return retVal;
    }

    static {
        SYMMETRIC_OUT_POINTS = getSymmetricCurvePoints();
        SYMMETRIC_IN_POINTS = reverseCurve(SYMMETRIC_OUT_POINTS);
        SYMMETRIC_IN_COEFS = calcCubicCoefficients(SYMMETRIC_IN_POINTS);
        SYMMETRIC_OUT_COEFS = calcCubicCoefficients(SYMMETRIC_OUT_POINTS);
    }

    protected static double calcSymmetric(double x, double[][] coefs, double[] points) {

        int numPoints = points.length / 2;
        double[] cubicCoefs = coefs[0];
        for(int i = 1;  i < numPoints && x > points[i * 2]; i++) {
            cubicCoefs = coefs[i];
        }

        double x2 = x * x;
        double x3 = x2 * x;
        double retVal = cubicCoefs[0] + (x * cubicCoefs[1])
                + (x2 * cubicCoefs[2]) + (x3 * cubicCoefs[3]);
        return retVal;
    }

    /**
     * Calculates y(x) for given fadeType and whether it is a fadeIn or fadeOut.
     *
     * @param x
     * @param fadeType
     * @param fadeIn
     * @return calculated value for x
     */
    public static double getValue(double x, FadeType fadeType,
            boolean fadeIn) {
        double retVal = 0.0;
        double coef, coef2;

        // Not pretty to have these switches...
        if (fadeIn) {
            switch (fadeType) {
                case LINEAR:
                    retVal = x;
                    break;
                case CONSTANT_POWER:
                    retVal = Math.sin(x * PI_2);
                    break;
                case SYMMETRIC:
                    retVal = calcSymmetric(x, SYMMETRIC_IN_COEFS, SYMMETRIC_IN_POINTS);
                    break;
                case FAST:
                    retVal = 0.001 * Math.pow(ampdb(60.0), x);
                    break;
                case SLOW:
                    coef = ampdb(-1.0) * Math.pow(ampdb(1.0), x);
                    coef2 = ampdb(-80) * Math.pow(ampdb(80.0), x);
                    retVal = ampdb(dbamp(coef) * x + dbamp(coef2) * (1 - x));
                    break;
            }
        } else {
            switch (fadeType) {
                case LINEAR:
                    retVal = 1.0 - x;
                    break;
                case CONSTANT_POWER:
                    retVal = Math.cos(x * PI_2);
                    break;
                case SYMMETRIC:
                    retVal = calcSymmetric(x, SYMMETRIC_OUT_COEFS, SYMMETRIC_OUT_POINTS);
                    break;
                case FAST:
                    retVal = Math.pow(ampdb(-60.0), x);
                    break;
                case SLOW:
                    coef = Math.pow(ampdb(-1.0), x);
                    coef2 = Math.pow(ampdb(-80.0), x);
                    retVal = ampdb(dbamp(coef) * (1 - x) + dbamp(coef2) * x);
                    break;
            }
        }
        return retVal;
    }

    protected static double inversePower(double x) {
        return Math.sqrt(1 - Math.pow(x, 2));
    }

    /**
     * Calculates inverse of y(x) for given fadeType and whether it is a fadeIn
     * or fadeOut.
     *
     * @param x
     * @param fadeType
     * @param fadeIn
     * @return calculated value for x
     */
    public static float getInverseValue(float x, FadeType fadeType, boolean fadeIn) {

        double retVal;
        switch (fadeType) {
            case LINEAR:
            case CONSTANT_POWER:
            case SYMMETRIC:
                retVal = getValue(x, fadeType, !fadeIn);
                break;
            case FAST:
            case SLOW:
                retVal = inversePower(getValue(x, fadeType, fadeIn));
                break;
        }
        return 0.0f;
    }
}
