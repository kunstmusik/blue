/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.jfxcontrolstest;

import blue.jfx.BlueFX;
import blue.jfx.controls.Knob;
import javafx.application.Application;
import javafx.embed.swing.SwingNode;
import javafx.geometry.Insets;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;

/**
 *
 * @author stevenyi
 */
public class BlueJFXControlsApplication extends Application {

    @Override
    public void start(Stage stage) throws Exception {

        TabPane root = new TabPane();


        root.getTabs().add(new Tab("Knob", new Knob()));
        
        HBox hbox = new HBox();
        hbox.setSpacing(10.0);
        
        Knob knob = new Knob();
        knob.setStyle("-fx-track-fill: purple;");

        Knob knob2 = new Knob();
        knob2.setStyle("-fx-track-fill: green;");
        hbox.getChildren().addAll(new Knob(), knob, knob2);
        
        root.getTabs().add(new Tab("Knobs", hbox));

        ScrollPane pane = new ScrollPane();
        pane.setHbarPolicy(ScrollPane.ScrollBarPolicy.ALWAYS);
        pane.setVbarPolicy(ScrollPane.ScrollBarPolicy.ALWAYS);
        root.getTabs().add(new Tab("ScrollPane", pane));

        SwingNode swingNode = new SwingNode();
        SwingUtilities.invokeLater(() -> swingNode.setContent(new JTextField("Text 2")));
        GridPane gp = new GridPane();
        gp.addRow(0, new Label("JavaFX"), new TextField("Text 1"));
        gp.addRow(1, new Label("Swing"), swingNode);
        gp.setVgap(5.0);
        gp.setHgap(5.0);
        gp.setPadding(new Insets(5,5,5,5));
        root.getTabs().add(new Tab("Text Fields", new BorderPane(gp)));

        Scene scene = new Scene(new BorderPane(root));
        BlueFX.style(scene);
        stage.setScene(scene);
        stage.show();

        SimpleCSSEditor.editCSS(root);
    }

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) {
        launch(args);
    }

}
