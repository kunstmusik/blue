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
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;

/**
 * @author stevenyi
 */
public class MultiLineScoreSelection {
    
    public enum UpdateType {
        SELECTION, TRANSLATION_START, TRANSLATION, TRANSLATION_COMPLETE,
        CLEAR
    }
    
    double startTime = -1.0f;
    double endTime = -1.0f;
    Collection<Layer> selectedLayers = new HashSet<>();
    double translationTime = 0.0f;
    
    private List<MultiLineScoreSelectionListener> listeners = new ArrayList<>();
    
    private static MultiLineScoreSelection INSTANCE = null;
    
    public static synchronized MultiLineScoreSelection getInstance() {
        if(INSTANCE == null) {
            INSTANCE = new MultiLineScoreSelection();
        }
        return INSTANCE;
    }
    
    public void startSelection(double startTime, double endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
    }
    
    public void updateSelection(double startTime, double endTime, Collection<Layer> selectedLayers) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.selectedLayers = selectedLayers;
        fireUpdate(UpdateType.SELECTION);
    }
    
    public void startTranslation() {
        this.translationTime = 0.0f;
        fireUpdate(UpdateType.TRANSLATION_START);
    }
    
    public void updateTranslation(double translationTime) {
        this.translationTime = translationTime;
        fireUpdate(UpdateType.TRANSLATION);
    }
    
    public void endTranslation() {
        this.startTime += this.translationTime;
        this.endTime += this.translationTime;
        this.translationTime = 0.0f;        
        fireUpdate(UpdateType.TRANSLATION_COMPLETE);
    }
    
    public void reset() {
        startTime = -1.0f;
        endTime = -1.0f;
        translationTime = 0.0f;
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

    public Collection<Layer> getSelectedLayers() {
        return selectedLayers;
    }

    public double getTranslationTime() {
        return translationTime;
    }
    
    // LISTENER CODE
    public void addListener(MultiLineScoreSelectionListener listener) {
        listeners.add(listener);
    }
    
    public void removeListener(MultiLineScoreSelectionListener listener) {
        listeners.remove(listener);
    }
    
    public void fireUpdate(UpdateType updateType) {
        for(MultiLineScoreSelectionListener listener : listeners) {
            listener.multiLineSelectionUpdated(updateType);
        }
    }
}
