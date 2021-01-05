/*
 * blue - object composition environment for csound
 * Copyright (C) 2021
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
package blue.ui.core.score;

import blue.score.ScoreObject;
import blue.soundObject.SoundObject;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;
import java.util.List;

/**
 * Copy of ScoreObject contents from timeline
 * 
 * @author stevenyi
 */
public class ScoreObjectCopy implements Transferable {
    
    public static final DataFlavor DATA_FLAVOR = new DataFlavor(ScoreObjectCopy.class, "Blue ScoreObject Copy");
    public static final DataFlavor[] flavors = new DataFlavor[] { DATA_FLAVOR };
    
    public final List<Integer> layerIndices;
    public final List<ScoreObject> scoreObjects;
    

    public ScoreObjectCopy(List<ScoreObject> scoreObjects, List<Integer> layerIndices) {
        this.scoreObjects = scoreObjects;
        this.layerIndices = layerIndices;
    }
    
    public boolean isOnlySoundObjects() {
        return scoreObjects.stream().allMatch(s -> s instanceof SoundObject);
    }

    @Override
    public DataFlavor[] getTransferDataFlavors() {
        return flavors;
    }

    @Override
    public boolean isDataFlavorSupported(DataFlavor flavor) {
        return DATA_FLAVOR.equals(flavor);
    }

    @Override
    public Object getTransferData(DataFlavor flavor) throws UnsupportedFlavorException, IOException {
        return isDataFlavorSupported(flavor) ? this : null;
    }
    
}
