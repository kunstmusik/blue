/*
 * blue - object composition environment for csound
 * Copyright (C) 2016 stevenyi
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
package blue.orchestra.editor.blueSynthBuilder.jfx.editors;

import blue.orchestra.blueSynthBuilder.BSBDropdownItemList;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Optional;
import javafx.scene.Node;
import org.controlsfx.control.PropertySheet;
import org.controlsfx.property.editor.DefaultPropertyEditorFactory;
import org.controlsfx.property.editor.Editors;
import org.controlsfx.property.editor.PropertyEditor;

/**
 *
 * @author stevenyi
 */
public class BSBPropertyEditorFactory extends DefaultPropertyEditorFactory {

    @Override
    public PropertyEditor<?> call(PropertySheet.Item item) {
        Class<?> type = item.getType();

        if (item.getPropertyEditorClass().isPresent()) {
            Optional<PropertyEditor<?>> ed = Editors.createCustomEditor(item);
            if (ed.isPresent()) {
                return ed.get();
            }
        }

        if (type == String.class) {
            return new PropertyEditor<String>() {
                StringPropertyEditor tf = new StringPropertyEditor(item);

                @Override
                public Node getEditor() {
                    return tf;
                }

                @Override
                public String getValue() {
                    return tf.getText();
                }

                @Override
                public void setValue(String value) {
                    tf.setText(value);
                }

            };
        } else if (isNumber(type)) {
            
            return new PropertyEditor<Number>() {
                NumberPropertyEditor tf = new NumberPropertyEditor(item);

                @Override
                public Node getEditor() {
                    return tf;
                }

                @Override
                public Number getValue() {
                    return tf.getValueAsNumber();
                }

                @Override
                public void setValue(Number value) {
                    tf.setText(value.toString());
                }

            };
        } else if (type == BSBDropdownItemList.class) {
            
            return new PropertyEditor<BSBDropdownItemList>() {
                BSBDropdownItemListEditor tf = new BSBDropdownItemListEditor();

                @Override
                public Node getEditor() {
                    return tf;
                }

                @Override
                public BSBDropdownItemList getValue() {
                    return tf.getBSBDropdownItemList();
                }

                @Override
                public void setValue(BSBDropdownItemList value) {
                    tf.setBSBDropdownItemList(value);
                }

            };
        }

        return super.call(item);
    }

    private static Class<?>[] numericTypes = new Class[]{
        byte.class, Byte.class,
        short.class, Short.class,
        int.class, Integer.class,
        long.class, Long.class,
        float.class, Float.class,
        double.class, Double.class,
        BigInteger.class, BigDecimal.class
    };

    // there should be better ways to do this
    private static boolean isNumber(Class<?> type) {
        if (type == null) {
            return false;
        }
        for (Class<?> cls : numericTypes) {
            if (type == cls) {
                return true;
            }
        }
        return false;
    }
}
