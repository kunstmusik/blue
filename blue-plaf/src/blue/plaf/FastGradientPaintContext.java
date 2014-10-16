/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 *
 * This file uses code from FastGradientPaintContext.java by Taoufik Romdhane
 *
 */
package blue.plaf;

import java.awt.PaintContext;
import java.awt.Rectangle;
import java.awt.image.ColorModel;
import java.awt.image.Raster;
import java.awt.image.WritableRaster;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.WeakHashMap;

public class FastGradientPaintContext implements PaintContext {
    private static WeakHashMap<GradientInfo,WeakReference> gradientCache
            = new WeakHashMap<GradientInfo,WeakReference>();

    private static LinkedList<GradientInfo> recentInfos = new LinkedList<GradientInfo>();

    private GradientInfo info;

    private int parallelDevicePos;

    private Gradient gradient;

    public FastGradientPaintContext(ColorModel cm, Rectangle r, int sc, int ec,
            boolean ver, boolean asc) {
        info = new GradientInfo();
        info.isAscending = asc;

        if ((((sc & ec) >> 24) & 0xFF) != 0xFF) {
            info.model = ColorModel.getRGBdefault();
        } else {
            info.model = cm;
        }
        info.startColor = sc;
        info.endColor = ec;
        if (info.isVertical == ver) {
            parallelDevicePos = r.y;
            info.parallelLength = r.height;
        } else {
            parallelDevicePos = r.x;
            info.parallelLength = r.width;
        }
        recentInfos.remove(info);
        recentInfos.add(0, info);
        if (recentInfos.size() > 16) {
            recentInfos.removeLast();
        }
        Object o = gradientCache.get(info);
        if (o != null) {
            o = ((WeakReference) o).get();
        }
        if (o != null) {
            gradient = (Gradient) o;
        } else {
            gradientCache.put(info, new WeakReference(gradient = new Gradient(
                    info)));
            // System.out.println( "Storing gradient in cache. Info: " +
            // info.toString() );
        }
    }

    public void dispose() {
        gradient.dispose();
    }

    public ColorModel getColorModel() {
        return info.model;
    }

    public synchronized Raster getRaster(int x, int y, int w, int h) {
        if (info.isVertical) {
            return gradient.getRaster(y - parallelDevicePos, w, h);
        } else {
            return gradient.getRaster(x - parallelDevicePos, h, w);
        }
    }
}

class Gradient {
    private GradientInfo info;

    private int perpendicularLength = 0;

    private WritableRaster raster;

    private HashMap<Integer,Raster> childRasterCache;

    Gradient(GradientInfo i) {
        info = i;
    }

    Raster getRaster(int parallelPos, int perpendicularLength,
            int parallelLength) {
        // System.out.println("Gradient.getRaster");
        if (raster == null || (this.perpendicularLength < perpendicularLength)) {
            createRaster(perpendicularLength);
        }

        Integer key = new Integer(parallelPos);
        Object o = childRasterCache.get(key);
        if (o != null) {
            return (Raster) o;
        } else {
            Raster r;
            if (info.isVertical) {
                r = raster.createChild(0, parallelPos,
                        this.perpendicularLength, info.parallelLength
                                - parallelPos, 0, 0, null);
            } else {
                r = raster.createChild(parallelPos, 0, info.parallelLength
                        - parallelPos, this.perpendicularLength, 0, 0, null);
            }
            childRasterCache.put(key, r);
            // System.out.println( "Storing child raster in cache. Position: " +
            // Integer.toString(parallelPos) );
            return r;
        }

    }

    public void dispose() {
        // raster = null;
    }

    private void createRaster(int perpendicularLength) {
        // System.out.println("Gradient.createRaster");
        int gradientWidth, gradientHeight;
        if (info.isVertical) {
            gradientHeight = info.parallelLength;
            gradientWidth = this.perpendicularLength = perpendicularLength;
        } else {
            gradientWidth = info.parallelLength;
            gradientHeight = this.perpendicularLength = perpendicularLength;
        }

        int sa = (info.startColor >> 24) & 0xFF;
        int sr = (info.startColor >> 16) & 0xFF;
        int sg = (info.startColor >> 8) & 0xFF;
        int sb = info.startColor & 0xFF;
        int da = ((info.endColor >> 24) & 0xFF) - sa;
        int dr = ((info.endColor >> 16) & 0xFF) - sr;
        int dg = ((info.endColor >> 8) & 0xFF) - sg;
        int db = (info.endColor & 0xFF) - sb;

        raster = info.model.createCompatibleWritableRaster(gradientWidth,
                gradientHeight);

        Object c = null;
        int pl = info.parallelLength;
        for (int i = 0; i < pl; i++) {
            int factor;
            int alpha;
            if (info.isAscending) {
                factor = (2 * (3 - i));
                alpha = ((i > 3) ? 0 : (sa + (130 * factor) / pl) << 24);
            } else {
                factor = (2 * (4 - (pl - i)));
                alpha = ((i < pl - 4) ? 0 : (sa + (2 * factor * da) / pl) << 24);
            }
            c = info.model.getDataElements(alpha
                    | (sr + (factor * dr) / pl) << 16
                    | (sg + (factor * dg) / pl) << 8
                    | (sb + (factor * db) / pl), c);

            for (int j = 0; j < perpendicularLength; j++) {
                if (info.isVertical) {
                    raster.setDataElements(j, i, c);
                } else {
                    raster.setDataElements(i, j, c);
                }
            }
        }
        childRasterCache = new HashMap<Integer,Raster>();

    }
}

class GradientInfo {
    ColorModel model;

    int parallelLength, startColor, endColor;

    boolean isVertical;

    boolean isAscending;

    public boolean equals(Object o) {
        // Fix for BUG 528602:
        if (!(o instanceof GradientInfo) || (model == null)) {
            return false;
        } else {
            GradientInfo info = (GradientInfo) o;
            return info.model.equals(model)
                    && (info.parallelLength == parallelLength)
                    && (info.startColor == startColor)
                    && (info.endColor == endColor)
                    && (info.isVertical == isVertical);
        }
    }

    public int hashCode() {
        return parallelLength;
    }

    public static void main(String[] args) {
        GradientInfo info = new GradientInfo();
        System.out.println("oops " + info.equals(null));
    }
}
