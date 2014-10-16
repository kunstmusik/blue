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
 */
package blue.orchestra.flowGraph;

public class Port {

    /*
     * Definitions for Port types
     */
    public static final int INPUT = 0;

    public static final int OUTPUT = 1;

    /*
     * Definitions of variable rates
     */
    public static final int I_RATE = 0;

    public static final int K_RATE = 1;

    public static final int A_RATE = 2;

    public static final int S_RATE = 3;

    public static final int F_RATE = 4;

    public static final int W_RATE = 5;

    public int rate; // a-rate, k-rate, etc... A, K or I

    public String name; // asig, kenv...

    /**
     * Used by Input ports
     */
    public boolean allowsMultiple;

    public String description;

    public String defaultValue = "0";

    public Port() {
        this.rate = K_RATE;
        this.name = "Port";
        allowsMultiple = false;
    }

}
