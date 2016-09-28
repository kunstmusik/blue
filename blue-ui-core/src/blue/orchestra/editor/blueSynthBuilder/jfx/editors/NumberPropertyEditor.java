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

import java.math.BigInteger;
import java.util.function.Predicate;
import javafx.beans.value.ChangeListener;
import javafx.scene.control.TextField;
import org.controlsfx.control.PropertySheet;

/**
 *
 * @author stevenyi
 */
public class NumberPropertyEditor extends TextField {

    Predicate<String> validator = null;
    PropertySheet.Item item;

    boolean editing = false;

    public NumberPropertyEditor(PropertySheet.Item item) {
        this.item = item;
        this.setOnAction(e -> updateTextFromTextField());
        this.focusedProperty().addListener((obs, o, n) -> {
            if (o && !n) {
                editing = false;
                this.setText(item.getValue().toString());
            } else {
                editing = true;
            }
        });

        ChangeListener<Object> listener = (obs, old, newVal) -> {
            if (!editing) {
                setText(newVal.toString());
            }
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                if (item.getObservableValue().isPresent()) {
                    item.getObservableValue().get().removeListener(listener);
                }
            } else if (item.getObservableValue().isPresent()) {
                item.getObservableValue().get().addListener(listener);
            }
        });
    }

    private void updateTextFromTextField() {
        String newValue = this.getText();
        if (validator == null || validator.test(newValue)) {
            try {
                item.setValue(getValueAsNumber());
            } catch (Exception e) {
                e.printStackTrace();;
                setText(item.getValue().toString());
            }
        }
    }

    public void setValidator(Predicate<String> validator) {
        this.validator = validator;
    }

    public Number getValueAsNumber() {
        Class<?> type = item.getType();
        if (type == byte.class || type == Byte.class){
            return new Byte(getText()); 
        }else if(type == short.class || type == Short.class){
            return new Short(getText());
        } else if(type == int.class || type == Integer.class){
            return new Integer(getText());
        } else if(type == long.class || type == Long.class){
            return new Long(getText());
        } else if(type == BigInteger.class) {
            return new BigInteger(getText());  
        } else if(type == float.class || type == Float.class) {
            return new Float(getText());  
        } else if(type == double.class || type == Double.class) {
            return new Double(getText());  
        }

        return null;
    }
}
