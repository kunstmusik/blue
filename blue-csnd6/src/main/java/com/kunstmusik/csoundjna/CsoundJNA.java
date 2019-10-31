/*
 * CsoundJNA.java 
 * Copyright (c) 2018 Steven Yi (stevenyi@gmail.com)
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
package com.kunstmusik.csoundjna;

import java.nio.DoubleBuffer;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 *
 * @author stevenyi
 */
public class CsoundJNA {

    public static void main(String args[]) {
        Csound csound = new Csound();
        System.out.println("Csound Version: " + csound.getVersion());

        csound.setOption("-odac");
        csound.setOption("-b1024");
        csound.setOption("-b4096");
        csound.compileOrc("sr=48000\nksmps=64\nnchnls=2\n0dbfs=1\n"
                + "instr 1\n"
                + "asig = vco2(0.25, p4)\n"
                + "asig = diode_ladder(asig, expon(10000, p3, 100), 4)\n"
                + "outc(asig, asig)\n"
                + "endin\n"
                + "schedule(1,0,10, 440)\n"
                + "schedule(1,0,10, 880)\n"
                + "event_i(\"e\",11,11)\n"
        );

        csound.setMessageCallback((cs,attr,msg) -> {
            System.out.print(">> " + msg); 
        });

        csound.start();

        Thread t = new Thread(() -> {

            DoubleBuffer output = csound.getSpout();
            while (csound.performKsmps() == 0) {
                System.out.println(output.get(0));
            }
            csound.stop();

            csound.cleanup();

            csound.reset();
        });
        t.start();

        try {
            t.join();
        } catch (InterruptedException ex) {
            Logger.getLogger(CsoundJNA.class.getName()).log(Level.SEVERE, null, ex);
        }

    }
}
