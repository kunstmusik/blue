/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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

import blue.score.layers.Layer;
import blue.ui.utilities.ResizeMode;
import blue.utilities.scales.ScaleLinear;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

/**
 * @author stevenyi
 */
public class MultiLineScoreSelection {

    public enum UpdateType {
        SELECTION, TRANSLATION_START, TRANSLATION, TRANSLATION_COMPLETE,
        SCALE_START, SCALE, SCALE_COMPLETE,
        CLEAR
    }

    double startTime = -1.0;
    double endTime = -1.0;

    ScaleLinear scale = new ScaleLinear(-1.0, -1.0, -1.0, -1.0);

    ResizeMode scaleDirection = ResizeMode.NONE;
    Collection<? extends Layer> selectedLayers = new HashSet<>();

    private Set<MultiLineScoreSelectionListener> listeners = new HashSet<>();

    private static MultiLineScoreSelection INSTANCE = null;

    public static synchronized MultiLineScoreSelection getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new MultiLineScoreSelection();
        }
        return INSTANCE;
    }

    public void updateSelection(double startTime, double endTime, Collection<? extends Layer> selectedLayers) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.selectedLayers = selectedLayers;
        fireUpdate(UpdateType.SELECTION);
    }

    public void startTranslation() {
        scale.setDomain(startTime, endTime);
        scale.setRange(startTime, endTime);
        fireUpdate(UpdateType.TRANSLATION_START);
    }

    public void updateTranslation(double translationTime) {
        scale.setRange(scale.getDomainStart() + translationTime,
                scale.getDomainEnd() + translationTime);
        fireUpdate(UpdateType.TRANSLATION);
    }

    public void endTranslation() {
        this.startTime = scale.getRangeStart();
        this.endTime = scale.getRangeEnd();
        fireUpdate(UpdateType.TRANSLATION_COMPLETE);
    }

    public void startScale(ResizeMode direction) {
        this.scaleDirection = direction;
        scale.setDomain(startTime, endTime);
        scale.setRange(startTime, endTime);

        fireUpdate(UpdateType.SCALE_START);

        System.out.println("Scale_Start: " + direction);
    }

    public void updateScale(double newScaleTime) {
        if (scaleDirection == ResizeMode.LEFT) {
            scale.setRange(newScaleTime, scale.getRangeEnd());
        } else {
            scale.setRange(scale.getRangeStart(), newScaleTime);
        }

        fireUpdate(UpdateType.SCALE);

        System.out.println("Scale_update: " + newScaleTime);
    }

    public void endScale() {
        this.scaleDirection = ResizeMode.NONE;
        this.startTime = scale.getRangeStart();
        this.endTime = scale.getRangeEnd();
        fireUpdate(UpdateType.SCALE_COMPLETE);

        System.out.println("endScale: ");

    }

    public void reset() {
        startTime = -1.0f;
        endTime = -1.0f;
        selectedLayers = null;
        fireUpdate(UpdateType.CLEAR);
    }

    // GETTERS
    public double getStartTime() {
        return startTime;
    }

    public double getEndTime() {
        return endTime;
    }

    public Collection<? extends Layer> getSelectedLayers() {
        return selectedLayers;
    }

    public ScaleLinear getScale() {
        return scale;
    }

    public ResizeMode getScaleDirection() {
        return scaleDirection;
    }

    // LISTENER CODE
    public void addListener(MultiLineScoreSelectionListener listener) {
        listeners.add(listener);
    }

    public void removeListener(MultiLineScoreSelectionListener listener) {
        listeners.remove(listener);
    }

    public void fireUpdate(UpdateType updateType) {
        for (MultiLineScoreSelectionListener listener : listeners) {
            listener.multiLineSelectionUpdated(updateType);
        }
    }
}
