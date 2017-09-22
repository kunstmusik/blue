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
package blue.ui.core.score.layers.soundObject;

import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.soundObject.SoundObject;
import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.ui.core.score.ScoreObjectView;
import blue.ui.core.score.ScoreTopComponent;
import blue.ui.core.soundObject.renderer.BarRenderer;
import blue.ui.core.soundObject.renderer.BarRendererCache;
import java.awt.BorderLayout;
import java.awt.Graphics;
import java.util.Collection;
import javax.swing.JComponent;
import org.openide.util.Lookup;
import org.openide.util.LookupEvent;
import org.openide.util.LookupListener;
import org.openide.windows.WindowManager;

/**
 * Title: blue (Object Composition Environment)
 * <p>
 * Description:
 * <p>
 * Copyright: Copyright (c) steven yi
 * <p>
 * Company: steven yi music
 * <p>
 *
 * @author steven yi
 * @version 1.0
 */
public final class SoundObjectView extends JComponent implements Comparable<SoundObjectView>,
        ScoreObjectListener, LookupListener, ScoreObjectView<SoundObject> {

    private SoundObject sObj;
    boolean selected = false;
    private TimeState timeState;
    BarRenderer renderer = null;
    Lookup.Result<SoundObject> result = null;

    public SoundObjectView(SoundObject sObj, TimeState timeState) {
        this.sObj = sObj;
        this.timeState = timeState;

        renderer = BarRendererCache.getInstance().getBarRenderer(
                this.sObj.getClass());

        this.sObj.addScoreObjectListener(this);

        try {
            init();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    void cleanup() {
        if (this.sObj != null) {
            this.sObj.removeScoreObjectListener(this);

            renderer.cleanup(this);
            this.timeState = null;
            this.sObj = null;
        }
    }

    private void init() {
        this.setBounds(-1, 0, (int) (sObj.getSubjectiveDuration() * timeState
                .getPixelSecond()), Layer.LAYER_HEIGHT);
        this.setLayout(new BorderLayout());
        this.setDoubleBuffered(true);
    }

    private void updateView() {
        updateView(this.getY(), this.getHeight());
    }

    public void updateView(int newY, int newHeight) {
        this.setLocation(
                (int) (this.getStartTime() * timeState.getPixelSecond()),
                newY);
        this.setSize((int) (this.getSubjectiveDuration() * timeState
                .getPixelSecond()), newHeight);
    }

    /**
     * ***************************
     */
    public void setStartTime(double yo) {
        sObj.setStartTime(yo);
    }

    public double getStartTime() {
        return sObj.getStartTime();
    }

    public double getSubjectiveDuration() {
        return sObj.getSubjectiveDuration();
    }

    public void setSubjectiveTime(double yo) {
        sObj.setSubjectiveDuration(yo);
    }

    public SoundObject getSoundObject() {
        return sObj;
    }

    public boolean isSelected() {
        return selected;
    }

    @Override
    public void paintComponent(Graphics graphics) {
        if (renderer != null && timeState != null) {
            renderer.render(graphics, this, timeState.getPixelSecond());
        }
    }

    @Override
    public int compareTo(SoundObjectView sObjView) {

        int x1 = this.getX();
        int x2 = sObjView.getX();

        if (x1 > x2) {
            return 1;
        } else if (x1 < x2) {
            return -1;
        }
        return 0;
    }

    @Override
    public void scoreObjectChanged(ScoreObjectEvent event) {
        if (event == null || event.getScoreObject() != this.sObj) {
            return;
        }

        switch (event.getPropertyChanged()) {
            case ScoreObjectEvent.NAME:
                repaint();
                break;
            case ScoreObjectEvent.START_TIME:
            // fall through
            case ScoreObjectEvent.DURATION:
                updateView();
                break;
            case ScoreObjectEvent.COLOR:
                repaint();
                break;
            case ScoreObjectEvent.REPEAT_POINT:
                repaint();
                break;

        }
    }

    public BarRenderer getRenderer() {
        return renderer;
    }

    @Override
    public void addNotify() {
        super.addNotify();

        ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                "ScoreTopComponent");
        result = scoreTopComponent.getLookup().lookupResult(
                SoundObject.class);
        result.addLookupListener(this);
        resultChanged(null);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        result.removeLookupListener(this);
        result = null;
    }

    @Override
    public void resultChanged(LookupEvent ev) {
        if (result != null) {
            Collection<? extends SoundObject> soundObjects = result.allInstances();
            boolean newSelected = soundObjects.contains(this.sObj);

            if (newSelected != selected) {
                selected = newSelected;
                repaint();
            }
        }
    }

    @Override
    public SoundObject getScoreObject() {
        return this.sObj;
    }
}