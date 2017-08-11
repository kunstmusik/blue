/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.orchestra.editor.blueSynthBuilder.jfx;

import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.jfx.BlueFX;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.collections.ListChangeListener;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;

/**
 *
 * @author stevenyi
 */
public class LineSelector extends HBox {

    ObjectProperty<Line> selectedLine = new SimpleObjectProperty<>();
    public Button leftButton;
    public Button rightButton;
    private final LineList lineList;

    public LineSelector(LineList lineList) {
        this.lineList = lineList;
        Label label = new Label();
        leftButton = new Button();
        leftButton.getStyleClass().add("left-arrow");
        leftButton.setOnAction((e) -> previousLine());
        leftButton.setOnAction((e) -> previousLine());
        rightButton = new Button();
        rightButton.getStyleClass().add("right-arrow");
        rightButton.setOnAction((e) -> nextLine());
        label.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(label, Priority.ALWAYS);
        getChildren().addAll(label, leftButton, rightButton);
        selectedLine.addListener((obs, old, newVal) -> {
            String lblText = (newVal == null) ? "" : newVal.getVarName();
            label.setText(lblText);
        });
        if (lineList.size() > 0) {
            setSelectedLine(lineList.get(0));
        }

        ListChangeListener lcl = e -> {
            BlueFX.runOnFXThread(() -> {
                if (getSelectedLine() == null || !lineList.contains(getSelectedLine())) {
                    if (lineList.size() > 0) {
                        setSelectedLine(lineList.get(0));
                    } else {
                        setSelectedLine(null);
                    }
                }
            });
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                lineList.removeListener(lcl);
            } else {
                lineList.addListener(lcl);
            }
        });
    }

    private void nextLine() {
        Line line = getSelectedLine();
        if (line == null || lineList.size() < 2) {
            return;
        }
        int index = lineList.indexOf(line) + 1;
        if (index >= lineList.size()) {
            index = 0;
        }
        setSelectedLine(lineList.get(index));
    }

    private void previousLine() {
        Line line = getSelectedLine();
        if (line == null || lineList.size() < 2) {
            return;
        }
        int index = lineList.indexOf(line) - 1;
        if (index < 0) {
            index = lineList.size() - 1;
        }
        setSelectedLine(lineList.get(index));
    }

    public void setSelectedLine(Line line) {
        selectedLine.set(line);
    }

    public Line getSelectedLine() {
        return selectedLine.get();
    }

    public ObjectProperty<Line> selectedLineProperty() {
        return selectedLine;
    }

}
