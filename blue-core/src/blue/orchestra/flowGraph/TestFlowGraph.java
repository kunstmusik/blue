/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

import java.awt.geom.Point2D;

public class TestFlowGraph {

    public static void main(String[] args) {
        FlowGraph f = new FlowGraph();

        // Create oscil unit

        Unit oscil = new Unit();

        oscil.setCode("$aout oscil3 $amp, $kpch, $itable");

        PortList ins = oscil.getInputs();
        PortList outs = oscil.getOutputs();

        Port iamp = new Port();
        iamp.name = "amp";
        iamp.rate = Port.K_RATE;

        Port kpch = new Port();
        kpch.name = "kpch";
        kpch.rate = Port.K_RATE;

        Port itable = new Port();
        itable.name = "itable";
        itable.rate = Port.I_RATE;

        ins.addPort(iamp);
        ins.addPort(kpch);
        ins.addPort(itable);

        Port aout = new Port();
        aout.name = "aout";
        aout.rate = Port.A_RATE;

        outs.addPort(aout);

        // Create Out Unit
        Unit out = new Unit();
        out.setCode("outs $aleft, $aright");

        ins = out.getInputs();

        Port aleft = new Port();
        aleft.name = "aleft";
        aleft.rate = Port.A_RATE;

        Port aright = new Port();
        aright.name = "aright";
        aright.rate = Port.A_RATE;

        ins.addPort(aleft);
        ins.addPort(aright);

        // add to FlowGraph

        GraphUnit gOscil = new GraphUnit();
        gOscil.coordinate = new Point2D.Double(0, 0);
        gOscil.unit = oscil;

        GraphUnit gOut = new GraphUnit();
        gOut.coordinate = new Point2D.Double(1, 1);
        gOut.unit = out;

        f.addGraphUnit(gOscil);
        f.addGraphUnit(gOut);

        Cable cLeft = new Cable(gOscil, 0, gOut, 0, 0);
        Cable cRight = new Cable(gOscil, 0, gOut, 1, 0);

        f.addCable(cLeft);
        f.addCable(cRight);

        System.out.println(f.generateInstrument());

    }

}
