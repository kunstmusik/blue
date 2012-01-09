/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue.orchestra;

import blue.Tables;
import blue.orchestra.flowGraph.FlowGraph;
import blue.udo.OpcodeList;
import electric.xml.Element;

public class FlowGraphInstrument extends AbstractInstrument {

    private FlowGraph flowGraph = new FlowGraph();

    public static Instrument loadFromXML(Element data) throws Exception {
        GenericInstrument instr = new GenericInstrument();

        InstrumentUtilities.initBasicFromXML(data, instr);

        return instr;
    }

    public Element saveAsXML() {
        // TODO Auto-generated method stub
        return null;
    }

    public void generateUserDefinedOpcodes(OpcodeList udos) {
    }

    public String generateInstrument() {
        // TODO Auto-generated method stub
        return null;
    }

    public void generateFTables(Tables tables) {
        // TODO Auto-generated method stub

    }

    public String generateGlobalOrc() {
        // TODO Auto-generated method stub
        return null;
    }

    public String generateGlobalSco() {
        // TODO Auto-generated method stub
        return null;
    }

    public FlowGraph getFlowGraph() {
        return flowGraph;
    }

    public void setFlowGraph(FlowGraph flowGraph) {
        this.flowGraph = flowGraph;
    }

}
