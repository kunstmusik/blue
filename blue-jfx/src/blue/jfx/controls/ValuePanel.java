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
//    TextField textField = new TextField();
//    Label label = new Label();
    Predicate<String> validator = null;

    public ValuePanel() {

//        label.setStyle("    -fx-background-color: linear-gradient(to bottom, derive(-fx-text-box-border, -10%), -fx-text-box-border),\n" +
//"        linear-gradient(from 0px 0px to 0px 5px, derive(-fx-control-inner-background, -9%), -fx-control-inner-background);\n" +
//"    -fx-background-insets: 0, 1;\n" +
//"    -fx-background-radius: 3, 2;"
//                + "    -fx-padding: 0.333333em 0.583em 0.333333em 0.583em; /* 4 7 4 7 */");
//        label.setTextOverrun(OverrunStyle.CLIP);
//        label.textProperty().bind(text);
//        text.setValue("value");
//
//        getChildren().addAll(label, textField);
//        textField.setVisible(false); 
//        this.setStyle("-fx-background-color: darkgray;");
        this.getStyleClass().add("value-panel");
        this.setEditable(false);
        this.setOnMouseClicked(e -> {
            if (!this.isEditable() && e.getClickCount() >= 2) {
//                label.setVisible(false);
//                textField.setVisible(true);
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
//                label.setVisible(true);
//                textField.setVisible(false);
                textProperty().unbind();
                this.setText(value.get());
                this.setEditable(false);
                textProperty().bind(value);
            }
        });

//        widthProperty().addListener((obs, o, n) -> {
//            textField.setPrefWidth(n.doubleValue());
//            label.setPrefWidth(n.doubleValue());
//        });
        textProperty().bind(value);
    }

    private void updateTextFromTextField() {
        String newValue = this.getText();
        if (validator == null || validator.test(newValue)) {
            value.setValue(newValue);
        }

//        label.setVisible(true);
//        textField.setVisible(false);
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
