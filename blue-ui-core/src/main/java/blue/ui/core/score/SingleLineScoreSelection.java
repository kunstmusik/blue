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
package blue.ui.core.score;

import blue.components.lines.Line;
import blue.ui.utilities.ResizeMode;
import blue.utilities.scales.ScaleLinear;
import java.util.HashSet;
import java.util.Set;

/**
 *
 * @author stevenyi
 */
public class SingleLineScoreSelection {

    private Line sourceLine = null;
    
    ScaleLinear scale = new ScaleLinear(-1.0, -1.0, -1.0, -1.0);

    ResizeMode scaleDirection = ResizeMode.NONE;
    
    Set<SingleLineScoreSelectionListener> listeners = 
            new HashSet<SingleLineScoreSelectionListener>();
    
    private static final SingleLineScoreSelection INSTANCE;

    static {
        INSTANCE= new SingleLineScoreSelection();
    }

    private SingleLineScoreSelection(){}
    
    public static synchronized SingleLineScoreSelection getInstance() {
        return INSTANCE;
    }

    public Line getSourceLine() {
        return sourceLine;
    }

    public double getStartTime() {
        return scale.getDomainStart();
    }

    public double getEndTime() {
        return scale.getDomainEnd();
    }
    
    public double getRangeStartTime() {
        return scale.getRangeStart();
    }
    
    public double getRangeEndTime() {
        return scale.getRangeEnd();
    }
        
    public ScaleLinear getScale() {
        return scale;
    }

    public ResizeMode getScaleDirection() {
        return scaleDirection;
    }
    
    public void updateSelection(Line sourceLine, double startTime, double endTime) {
        this.sourceLine = sourceLine;
        scale.setDomain(startTime, endTime);
        scale.setRange(startTime, endTime);
        notifyListeners();
    }
    
    public void updateTranslation(double translation) {
        scale.setRange(scale.getDomainStart() + translation, scale.getDomainEnd() + translation);
        notifyListeners();
    }
    
    public void endTranslation() {
        updateSelection(sourceLine, scale.getRangeStart(), scale.getRangeEnd());
    }
    
     public void startScale(ResizeMode direction) {
        this.scaleDirection = direction;

        notifyListeners();
    }

    public void updateScale(double newScaleTime) {
        if (scaleDirection == ResizeMode.LEFT) {
            scale.setRange(newScaleTime, scale.getRangeEnd());
        } else {
            scale.setRange(scale.getRangeStart(), newScaleTime);
        }

        notifyListeners();
    }

    public void endScale() {
        this.scaleDirection = ResizeMode.NONE;
        updateSelection(sourceLine, scale.getRangeStart(), scale.getRangeEnd());
    }

    
    public void clear() {
        updateSelection(null, -1.0, -1.0);
    } 
    
    
    public void addListener(SingleLineScoreSelectionListener listener) {
        listeners.add(listener);
    }
    
    public void removeListener(SingleLineScoreSelectionListener listener) {
        listeners.remove(listener);
    }
    
    protected void notifyListeners() {
        for(SingleLineScoreSelectionListener listener : listeners) {
            listener.singleLineScoreSelectionPerformed(this);
        }
    }
    
    public interface SingleLineScoreSelectionListener {
        void singleLineScoreSelectionPerformed(SingleLineScoreSelection selection);
    }
}
