/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.utilities.scales;

/**
 *
 * @author syyigmmbp
 */
public class ScaleLinear {

    private double domainStart;
    private double domainEnd;
    private double domainRange;
    private double rangeStart;
    private double rangeEnd;
    private double rangeRange;

    boolean clamp = true;

    public ScaleLinear(double domainStart, double domainEnd, double rangeStart, double rangeEnd) {
        setDomain(domainStart, domainEnd);
        setRange(rangeStart, rangeEnd);
    }
    
    public void setDomain(double domainStart, double domainEnd) {
        this.domainStart = domainStart;
        this.domainEnd = domainEnd;
        this.domainRange = this.domainEnd - this.domainStart;
    }
    
    public void setRange(double rangeStart, double rangeEnd) {
        this.rangeStart = rangeStart;
        this.rangeEnd = rangeEnd;
        this.rangeRange = this.rangeEnd - this.rangeStart;
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
    
    

    public double calc(final double domainInput) {
        final var input = clamp
                ? Math.max(Math.min(domainInput, domainEnd), domainStart)
                : domainInput;

        final var m = (input - domainStart) / domainRange;
        final var out = m * rangeRange + rangeStart;
        
        return out;
    }
}
