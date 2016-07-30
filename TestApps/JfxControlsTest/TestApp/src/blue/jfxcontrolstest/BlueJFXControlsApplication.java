/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.jfxcontrolstest;

import blue.jfx.BlueFX;
import blue.jfx.controls.Knob;
import blue.jfx.controls.ValuePanel;
import java.util.Vector;
import javafx.application.Application;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.embed.swing.SwingNode;
import javafx.geometry.Insets;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import javax.swing.table.DefaultTableModel;
import org.openide.LifecycleManager;

/**
 *
 * @author stevenyi
 */
public class BlueJFXControlsApplication extends Application {
    
    @Override
    public void start(Stage stage) throws Exception {
        
        TabPane root = new TabPane();
        
        root.getTabs().add(new Tab("Knob", new Knob()));
        root.getTabs().add(new Tab("ValuePanel", new ValuePanel()));
        
        setupKnobs(root);
        setupTextFieldsTest(root);
        setupButtonsTest(root);
        setTablesTest(root);
        
        Scene scene = new Scene(new BorderPane(root));
        BlueFX.style(scene);
        stage.setScene(scene);
        stage.show();
    
        stage.onHiddenProperty().addListener(a -> LifecycleManager.getDefault().exit());
        //SimpleCSSEditor.editCSS(root);
    }

    private void setupKnobs(TabPane root) {
        HBox hbox = new HBox();
        hbox.setSpacing(10.0);
        
        Knob knob = new Knob();
        knob.setStyle("-fx-track-fill: purple;"
                + "-fx-track-background-fill: #333344;");
        
        Knob knob2 = new Knob();
        knob2.setStyle("-fx-track-fill: green;"
                + "-fx-track-background-fill: purple;");
        hbox.getChildren().addAll(new Knob(), knob, knob2);
        
        root.getTabs().add(new Tab("Knobs", hbox));
    }
    
    private void setupTextFieldsTest(TabPane root) {
        SwingNode swingNode = new SwingNode();
        SwingUtilities.invokeLater(() -> swingNode.setContent(new JTextField(
                "Text 2")));
        GridPane gp = new GridPane();
        gp.addRow(0, new Label("JavaFX"), new TextField("Text 1"));
        gp.addRow(1, new Label("Swing"), swingNode);
        gp.setVgap(5.0);
        gp.setHgap(5.0);
        gp.setPadding(new Insets(5, 5, 5, 5));
        root.getTabs().add(new Tab("Text Fields", new BorderPane(gp)));
    }

    private void setupButtonsTest(TabPane root) {
        SwingNode swingNode = new SwingNode();
        SwingUtilities.invokeLater(() -> swingNode.setContent(new JButton(
                "Text 2")));
        GridPane gp = new GridPane();
        gp.addRow(0, new Label("JavaFX"), new Button("Text 1"));
        gp.addRow(1, new Label("Swing"), swingNode);
        gp.setVgap(5.0);
        gp.setHgap(5.0);
        gp.setPadding(new Insets(5, 5, 5, 5));
        root.getTabs().add(new Tab("Buttons", new BorderPane(gp)));
    }
    
    private void setTablesTest(TabPane root) {
        TableView<Person> jfxTable = new TableView<>();
        ObservableList<Person> people = FXCollections.observableArrayList();
        for (int i = 0; i < 20; i++) {
            Person p = new Person();
            p.setFirstName("test");
            p.setLastName(Integer.toString(i));
            people.add(p);
        }
        TableColumn<Person, String> firstNameCol = new TableColumn<Person, String>(
                "First Name");
        firstNameCol.setCellValueFactory(new PropertyValueFactory("firstName"));
        TableColumn<Person, String> lastNameCol = new TableColumn<Person, String>(
                "Last Name");
        lastNameCol.setCellValueFactory(new PropertyValueFactory("lastName"));
        
        jfxTable.getColumns().addAll(firstNameCol, lastNameCol);
        jfxTable.setItems(people);
        
        SwingNode swingNode = new SwingNode();
        
        Vector v = new Vector();
        for (int i = 0; i < 20; i++) {
            Vector t = new Vector();
            t.add("test");
            t.add(Integer.toString(i));
            v.add(t);
        }
        
        Vector labels = new Vector();
        labels.add("First Name");
        labels.add("Last Name");
        SwingUtilities.invokeLater(() -> {            
            DefaultTableModel tm = new DefaultTableModel(v, labels);
            JTable table = new JTable(tm);
            table.updateUI();
            JScrollPane scrollPane = new JScrollPane(table);
            scrollPane.setBorder(BorderFactory.createEmptyBorder());
            swingNode.setContent(
                    scrollPane);
        });
        
        root.getTabs().add(new Tab("Tables", new SplitPane(jfxTable, swingNode)));
    }

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) {
        launch(args);
    }
    
}
