/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package blue.ui.core.udo;

import blue.udo.UserDefinedOpcode;
import java.lang.reflect.InvocationTargetException;
import org.openide.nodes.AbstractNode;
import org.openide.nodes.Children;
import org.openide.nodes.PropertySupport;
import org.openide.nodes.Sheet;

/**
 *
 * @author syi
 */
public class UDONode extends AbstractNode {
    private UserDefinedOpcode udo;

    public UDONode(final UserDefinedOpcode udo) {
        super(Children.LEAF);
        this.udo = udo;
    }

    @Override
    public String getDisplayName() {
        return this.udo.getOpcodeName();
    }

    @Override
    protected Sheet createSheet() {
        Sheet result = super.createSheet();
        Sheet.Set set = Sheet.createPropertiesSet();

        PropertySupport.ReadWrite<String> opNameProp = new PropertySupport.ReadWrite<String>("opcodeName", String.class, "Opcode Name", "Name of User Defined Opcode") {

            @Override
            public String getValue() throws IllegalAccessException, InvocationTargetException {
                return udo.getOpcodeName();
            }

            @Override
            public void setValue(String val) throws IllegalAccessException, IllegalArgumentException, InvocationTargetException {
                if(val instanceof String) {
                    udo.setOpcodeName(val);
                }
            }
        };

        set.put(opNameProp);
        result.put(set);
        return result;
    }
}
