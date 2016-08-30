/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
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
package blue.clojure.project;

import java.net.URL;
import java.util.ResourceBundle;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Button;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.scene.control.cell.TextFieldTableCell;

/**
 *
 * @author stevenyi
 */
public class ClojureProjectDataEditorController implements Initializable {

    @FXML
    TableView<ClojureLibraryEntry> table;
    @FXML
    Button addButton;
    @FXML
    Button removeButton;
    @FXML
    Button pushUpButton;
    @FXML
    Button pushDownButton;

    private ClojureProjectData data = null;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        TableView.TableViewSelectionModel<ClojureLibraryEntry> model = 
                table.getSelectionModel();
        
        pushUpButton.disableProperty().bind(
                model.selectedItemProperty().isNull().or(
                        model.selectedIndexProperty().isEqualTo(0)));
        // FIXME - add .or() clause 
        pushDownButton.disableProperty().bind(
                model.selectedItemProperty().isNull());
        removeButton.disableProperty().bind(model.selectedItemProperty().isNull());

        table.setEditable(true);
        
        TableColumn<ClojureLibraryEntry, String> col1 = 
                new TableColumn<>("Library Coordinates");
        col1.setCellValueFactory(new PropertyValueFactory<>("dependencyCoordinates"));
        col1.setCellFactory(TextFieldTableCell.forTableColumn());
        col1.setOnEditCommit(cet -> {
            cet.getRowValue().setDependencyCoordinates(cet.getNewValue());
        });
        col1.setEditable(true);
        col1.setPrefWidth(300.0);

        TableColumn<ClojureLibraryEntry, String> col2 = 
                new TableColumn<>("Version");
        col2.setCellValueFactory(new PropertyValueFactory<>("version"));
        col2.setCellFactory(TextFieldTableCell.forTableColumn());
        col2.setOnEditCommit(cet -> {
            cet.getRowValue().setVersion(cet.getNewValue());
        });
        col2.setEditable(true);

        table.getColumns().clear();
        table.getColumns().addAll(col1, col2);
    }

    public void setClojureProjectData(ClojureProjectData data) {
        this.data = data;
        table.setItems(data.libraryList());
    }

    @FXML
    public void addEntry() {
        if(data == null) return;
        data.libraryList.add(new ClojureLibraryEntry());
    }

    @FXML
    public void removeEntry() {
        if(data == null) return;
        ClojureLibraryEntry item = table.getSelectionModel().getSelectedItem();
        data.libraryList().remove(item);
    }

    @FXML
    public void pushUpEntry() {
        if(data == null) return;
        
        int index = table.getSelectionModel().getSelectedIndex();
        ClojureLibraryEntry item = data.libraryList().remove(index);
        data.libraryList().add(index - 1, item);
    }

    @FXML
    public void pushDownEntry() {
        if(data == null) return;

        int index = table.getSelectionModel().getSelectedIndex();
        ClojureLibraryEntry item = data.libraryList().remove(index);
        data.libraryList().add(index + 1, item);
    }
}
