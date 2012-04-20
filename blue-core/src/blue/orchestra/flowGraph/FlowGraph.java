package blue.orchestra.flowGraph;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;

public class FlowGraph implements Serializable {

    private ArrayList units;

    private ArrayList cables;

    private String name;

    public FlowGraph() {

        units = new ArrayList();
        cables = new ArrayList();
    }

    public String generateInstrument() {
        StringBuilder buffer = new StringBuilder();

        Collections.sort(units, new GraphUnitComparator());

        VariableManager varManager = new VariableManager();

        varManager.setupOutPorts(units);

        for (Iterator it = units.iterator(); it.hasNext();) {
            GraphUnit graphUnit = (GraphUnit) it.next();

            if (!(graphUnit.getInputs().size() == 0 && graphUnit.getOutputs()
                    .size() == 0)) {
                buffer.append(processGraphUnit(graphUnit, varManager)).append(
                        "\n");
            }

        }

        return buffer.toString();
    }

    private String processGraphUnit(GraphUnit graphUnit,
            VariableManager varManager) {
        Unit unit = graphUnit.unit;

        String code = varManager.getCodeWithReplacedOutputs(graphUnit);

        PortList inputs = graphUnit.getInputs();

        for (int i = 0; i < inputs.size(); i++) {
            Port port = inputs.getPort(i);

            Cable[] connections = getInConnections(graphUnit, i);

            if (connections.length == 0) {
                code = code.replaceAll("\\$" + port.name, port.defaultValue);
            } else if (port.allowsMultiple) {

            } else {
                Cable c = connections[0];

                String newVarName = varManager.getVariableForPort(c
                        .getsendUnit(), c.sendPortIndex);

                code = code.replaceAll("\\$" + port.name, newVarName);
            }

        }

        return code;
    }

    private Cable[] getInConnections(GraphUnit graphUnit, int portNum) {
        ArrayList temp = new ArrayList();

        for (int i = 0; i < cables.size(); i++) {
            Cable cable = (Cable) cables.get(i);

            if (cable.getToUnit() == graphUnit
                    && cable.receivePortIndex == portNum) {
                temp.add(cable);
            }
        }

        Cable[] conn = new Cable[temp.size()];

        for (int i = 0; i < temp.size(); i++) {
            conn[i] = (Cable) temp.get(i);
        }

        return conn;
    }

    public void addGraphUnit(GraphUnit newUnit) {
        units.add(newUnit);
    }

    /*
     * n is the Unit's position on the array
     */
    public void removeUnit(int n) {
        units.remove(n);
    }

    public void removeUnit(GraphUnit u) {
        units.remove(u);
    }

    public void addCable(Cable newCable) {
        cables.add(newCable);
    }

    public void removeCable(int n) {
        cables.remove(n);
    }

    public String createCsoundCode() {

        return null;
    }

    public int getNumUnits() {
        return units.size();
    }

    //
    public int getNumCables() {
        return cables.size();
    }

    /*
     * @require i < numUnits
     */
    public GraphUnit getGraphUnit(int i) {
        return (GraphUnit) units.get(i);
    }

    public Cable getCable(int i) {
        return (Cable) cables.get(i);
    }

    public String getName() {
        return name;
    }

    public void setName(String str) {
        this.name = str;
    }

    private class VariableManager {

        // must be synced with Port types
        private final String[] VAR_PREFIXES = new String[] { "i", "k", "a",
                "S", "f", "w" };

        int[] portCounters;

        private HashMap portMappings = new HashMap();

        public VariableManager() {
            portCounters = new int[VAR_PREFIXES.length];
            for (int i = 0; i < portCounters.length; i++) {
                portCounters[i] = 0;
            }
        }

        public String getCodeWithReplacedOutputs(GraphUnit graphUnit) {
            if (!portMappings.containsKey(graphUnit)) {
                return null;
            }

            PortMapping mapping = (PortMapping) portMappings.get(graphUnit);

            Unit unit = graphUnit.unit;
            PortList outs = unit.getOutputs();

            String code = unit.getCode();

            for (int i = 0; i < mapping.portVarNames.length; i++) {
                Port p = outs.getPort(i);

                code = code.replaceAll("\\$" + p.name, mapping.portVarNames[i]);
            }

            return code;
        }

        public void setupOutPorts(ArrayList units) {
            for (Iterator iter = units.iterator(); iter.hasNext();) {
                GraphUnit graphUnit = (GraphUnit) iter.next();

                PortList outs = graphUnit.getOutputs();

                PortMapping mapping = new PortMapping();
                mapping.graphUnit = graphUnit;
                mapping.portVarNames = new String[outs.size()];

                for (int i = 0; i < outs.size(); i++) {
                    Port p = outs.getPort(i);

                    mapping.portVarNames[i] = getVariable(p.rate);
                }

                portMappings.put(graphUnit, mapping);
            }
        }

        private String getVariable(int portType) {
            int counter = portCounters[portType]++;

            return VAR_PREFIXES[portType] + counter;
        }

        public String getVariableForPort(GraphUnit unit, int portNum) {
            if (!portMappings.containsKey(unit)) {
                return null;
            }

            PortMapping mapping = (PortMapping) portMappings.get(unit);

            return mapping.portVarNames[portNum];
        }

    }

    private static class PortMapping {
        GraphUnit graphUnit = null;

        String[] portVarNames = null;
    }
}
