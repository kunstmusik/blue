/*
 * blue - object composition environment for csound
 * Copyright (C) 2020
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
package blue.utilities.scales;

import java.util.HashSet;
import java.util.Set;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/**
 *
 * @author Steven Yi
 */
public class ScaleLinear {

    private double domainStart;
    private double domainEnd;
    private double domainRange;
    private double rangeStart;
    private double rangeEnd;
    private double rangeRange;

    boolean clamp = true;
    
    transient Set<ChangeListener> listeners = null;
    ChangeEvent ce = new ChangeEvent(this);

    public ScaleLinear(double domainStart, double domainEnd, double rangeStart, double rangeEnd) {
        setDomain(domainStart, domainEnd);
        setRange(rangeStart, rangeEnd);
    }
    
    public void setDomain(double domainStart, double domainEnd) {
        this.domainStart = domainStart;
        this.domainEnd = domainEnd;
        this.domainRange = this.domainEnd - this.domainStart;
        fireChange();
    }
    
    public void setRange(double rangeStart, double rangeEnd) {
        this.rangeStart = rangeStart;
        this.rangeEnd = rangeEnd;
        this.rangeRange = this.rangeEnd - this.rangeStart;
        fireChange();
    }

    public double getDomainStart() {
        return domainStart;
    }

    public double getDomainEnd() {
        return domainEnd;
    }

    public double getDomainRange() {
        return domainRange;
    }

    public double getRangeStart() {
        return rangeStart;
    }

    public double getRangeEnd() {
        return rangeEnd;
    }

    public double getRangeRange() {
        return rangeRange;
    }
    
    private double clamp(double value, double bound1, double bound2) {
        return (bound1 < bound2) ?
            Math.max(Math.min(value, bound2), bound1) : 
            Math.max(Math.min(value, bound1), bound2);
    }
    
    public double calc(final double domainInput) {
        final var input = clamp
                ? clamp(domainInput, domainStart, domainEnd)
                : domainInput;

        final var m = (input - domainStart) / domainRange;
        final var out = m * rangeRange + rangeStart;
        
        return out;
    }
    
    /** calculates reverse mapping from range to domain value */
    public double calcReverse(final double rangeInput) {
        final var input = clamp
                ? clamp(rangeInput, rangeStart, rangeEnd)
                : rangeInput;
        
        final var m = (input - rangeStart) / rangeRange;
                
        final var out = m * domainRange + domainStart;
        
        return out;
    }
    

    public synchronized void addChangeListener(ChangeListener cl) {
        if(listeners == null) {
            listeners = new HashSet<>();
        }
        listeners.add(cl);
    }
    
    public synchronized void removeChangeListener(ChangeListener cl) {
        if(listeners != null) {
            listeners.remove(cl);
        }
    }
    
    
    protected void fireChange() {
        if(listeners != null) {
            for(var l : listeners) {
                l.stateChanged(ce);
            }
        }
    }
}
