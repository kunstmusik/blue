/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.udo;

import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;
import org.openide.nodes.Children;
import org.openide.nodes.Node;

/**
 *
 * @author syi
 */
public class OpcodeListChildren extends Children.Keys<OpcodeList> {
    private final OpcodeList opcodeList;

    public OpcodeListChildren(OpcodeList opcodeList) {
        this.opcodeList = opcodeList;
    }

    @Override
    protected void addNotify() {
        setKeys(new OpcodeList[]{opcodeList});
    }

    @Override
    protected Node[] createNodes(OpcodeList key) {
        Node[] returnNodes = new Node[key.size()];
        for (int i = 0; i < returnNodes.length; i++) {
            final UserDefinedOpcode udo = key.get(i);
            returnNodes[i] = new UDONode(udo);
            returnNodes[i].setDisplayName(udo.getOpcodeName());
            System.out.println(udo.getOpcodeName());
        }
        return returnNodes;
    }
}
