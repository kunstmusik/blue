/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
 * Steven Yi <stevenyi@gmail.com>
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
package blue.jfx.controls;

import blue.jfx.BlueFX;
import java.util.function.Predicate;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.geometry.Pos;
import javafx.scene.control.TextField;

/**
 *
 * @author stevenyi
 */
public class ValuePanel extends TextField {

    StringProperty value = new SimpleStringProperty("") {

        @Override
        protected void fireValueChangedEvent() {
            BlueFX.runOnFXThread(() -> super.fireValueChangedEvent());
        }
        
    };

    Predicate<String> validator = null;

    public ValuePanel() {

        this.getStyleClass().add("value-panel");
        this.setEditable(false);
        this.setOnMouseClicked(e -> {
            if (!this.isEditable() && e.getClickCount() >= 2) {
                this.setEditable(true);
                textProperty().unbind();
                this.setText(value.getValue());
                this.requestFocus();
                this.selectAll();
            }
        });

        this.setOnAction(e -> updateTextFromTextField());
        this.focusedProperty().addListener((obs, o, n) -> {
            if (o && !n) {
                textProperty().unbind();
                this.setText(value.get());
                this.setEditable(false);
                textProperty().bind(value);
            }
        });

        textProperty().bind(value);
    }

    private void updateTextFromTextField() {
        String newValue = this.getText();

        textProperty().unbind();

        if (validator == null || validator.test(newValue)) {
            value.setValue(newValue);
        } 
        this.setEditable(false);
        textProperty().bind(value);
    }

    public void setValidator(Predicate<String> validator) {
        this.validator = validator;
    }

    public void setValue(String value) {
        this.value.set(value == null ? "" : value);
    }

    public String getValue() {
        return value.get();
    }

    public StringProperty valueProperty() {
        return value;
    }

    
}
