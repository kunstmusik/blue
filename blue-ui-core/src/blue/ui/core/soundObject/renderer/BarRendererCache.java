/*
 * blue - object composition environment for csound
 *  Copyright (c) 2000-2009 Steven Yi (stevenyi@gmail.com)
 * 
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published
 *  by  the Free Software Foundation; either version 2 of the License or
 *  (at your option) any later version.
 * 
 *  This program is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 * 
 *  You should have received a copy of the GNU General Public License
 *  along with this program; see the file COPYING.LIB.  If not, write to
 *  the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 *  Boston, MA  02111-1307 USA
 */
package blue.ui.core.soundObject.renderer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;

/**
 *
 * @author steven
 */
public class BarRendererCache {

    private static BarRendererCache instance = null;

    private Map<Class, BarRenderer> barRenderers = new HashMap<>();
    private List<BarRenderer> renderers = new ArrayList<>();

    private BarRendererCache() {
    }

    public static BarRendererCache getInstance() {
        if (instance == null) {
            instance = new BarRendererCache();

            FileObject rendererFObjs[] = FileUtil.getConfigFile(
                    "blue/score/barRenderers").getChildren();

            List<FileObject> orderedRendererFObjs = FileUtil.getOrder(
                    Arrays.asList(rendererFObjs), true);

            for (FileObject fObj : orderedRendererFObjs) {
                BarRenderer barRenderer = FileUtil.getConfigObject(
                        fObj.getPath(),
                        BarRenderer.class);
                instance.renderers.add(barRenderer);
            }
        }
        return instance;
    }

    public BarRenderer getBarRenderer(Class clazz) {

        BarRenderer renderer = barRenderers.get(clazz);

        if (renderer == null) {

            for (BarRenderer temp : renderers) {
                Class c = temp.getSoundObjectClass();
                if (c.isAssignableFrom(clazz)) {
                    renderer = temp;
                    barRenderers.put(clazz, temp);
                }
            }
        }

        return renderer;
    }
}
