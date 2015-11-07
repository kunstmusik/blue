/* EMP
 Copyright (C) 2010

 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 2 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */
package blue.orchestra.editor.blueSynthBuilder;

import com.l2fprod.common.beans.editor.*;
import java.lang.reflect.InvocationTargetException;

import javax.swing.JComboBox;

// TODO: Auto-generated Javadoc
/**
 * The Class EnumComboBoxPropertyEditor.
 *
 * Original found here:
 *
 * http://cgu-emp.googlecode.com/svn/trunk/EMP/src/edu/cgu/emp/swing/EnumComboBoxPropertyEditor.java
 *
 * Code modified to remove logging
 *
 * @author yccheok
 * @author stevenyi
 */
public class EnumComboBoxPropertyEditor extends ComboBoxPropertyEditor {

    /**
     * Creates a new instance of EnumComboBoxPropertyEditor.
     */
    public EnumComboBoxPropertyEditor() {

    }
    
    /* (non-Javadoc)
     * @see com.l2fprod.common.beans.editor.ComboBoxPropertyEditor#setValue(java.lang.Object)
     */
    @Override
    public void setValue(Object value) {

        JComboBox box = (JComboBox) editor;

        // We need to remove the previous items. This is because if a 
        // property panel is having more than 1 enum type property, we
        // may display wrong type of enum.
        box.removeAllItems();

        if (box.getItemCount() == 0) {

            try {

                java.lang.reflect.Method m = value.getClass().getMethod("values");

                Enum[] array = (Enum[]) m.invoke(null);

                this.setAvailableValues(array);

            } catch (NoSuchMethodException | IllegalAccessException | 
                    InvocationTargetException exp) {
                exp.printStackTrace();
            }

        }

        super.setValue(value);

    }

}
