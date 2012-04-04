/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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
 */

package blue.ui.core.score;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

import java.util.ArrayList;

import blue.SoundLayer;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;

public final class SoundObjectBuffer {

    ArrayList buffer = new ArrayList();

    ArrayList xValues = new ArrayList();

    ArrayList yValues = new ArrayList();

    private static SoundObjectBuffer instance = null;

    private SoundObjectBuffer() {
    }

    public static SoundObjectBuffer getInstance() {
        if (instance == null) {
            instance = new SoundObjectBuffer();
        }
        return instance;
    }

    public SoundObject getSoundObject(int i) {
        return (SoundObject) buffer.get(i);
    }

    public int getX(int i) {
        return ((Integer) xValues.get(i)).intValue();
    }

    public int getY(int i) {
        return ((Integer) yValues.get(i)).intValue();
    }

    public void addSoundObject(SoundObject sObj, int x, int y) {
        this.buffer.add(sObj);
        this.xValues.add(new Integer(x));
        this.yValues.add(new Integer(y));
    }

    public void setBufferedObject(SoundObject sObj, int x, int y) {
        this.buffer.clear();
        this.addSoundObject(sObj, x, y);
    }

    public int size() {
        return this.buffer.size();
    }

    public void copySoundObjects(MotionBuffer mBuffer) {
        SoundObjectView temp;

        this.buffer.clear();
        this.xValues.clear();
        this.yValues.clear();

        for (int i = 0; i < mBuffer.size(); i++) {
            temp = (SoundObjectView) (mBuffer.get(i));

            SoundObject sObjClone = (SoundObject) (temp.getSoundObject()
                    .clone());
            int x = temp.getX();
            int y = temp.getY();

            this.addSoundObject(sObjClone, x, y);
        }

    }

    public SoundObject getBufferedSoundObject() {
        if (buffer.size() == 0) {
            return null;
        } else if (buffer.size() == 1) {
            return (SoundObject) getSoundObject(0).clone();
        }

        return convertToPolyObject();

    }

    public PolyObject getBufferedPolyObject() {
        return convertToPolyObject();
    }

    private PolyObject convertToPolyObject() {
        int size = buffer.size();
        PolyObject temp = new PolyObject();

        SoundLayer sLayer;

        for (int i = 0; i < size; i++) {
            sLayer = (SoundLayer)temp.newLayerAt(-1);
            sLayer.addSoundObject((SoundObject) this.getSoundObject(i).clone());
        }

        temp.normalizeSoundObjects();
        return temp;
    }

    /**
     * @return
     */
    public boolean hasBufferedSoundObject() {
        return buffer.size() > 0;
    }

}