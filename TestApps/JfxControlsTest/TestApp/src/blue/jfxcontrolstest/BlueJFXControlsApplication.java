/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.jfxcontrolstest;

import blue.jfx.BlueFX;
import blue.jfx.controls.Knob;
import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.GridPane;
import javafx.stage.Stage;

/**
 *
 * @author stevenyi
 */
public class BlueJFXControlsApplication extends Application {
    
    @Override
    public void start(Stage stage) throws Exception {

        TabPane root = new TabPane();
        root.getTabs().add(new Tab("Knob", new Knob()));

        ScrollPane pane = new ScrollPane();
        pane.setHbarPolicy(ScrollPane.ScrollBarPolicy.ALWAYS);
        pane.setVbarPolicy(ScrollPane.ScrollBarPolicy.ALWAYS);
        root.getTabs().add(new Tab("ScrollPane", pane));
       
        GridPane gp = new GridPane();
        gp.addRow(0, new Label("Label 1"), new TextField("Text 1"));
        gp.addRow(1, new Label("Label 2"), new TextField("Text 2"));
        gp.setVgap(5.0);
        gp.setHgap(5.0);
        root.getTabs().add(new Tab("Text Fields", new BorderPane(gp)    ));
        
        Scene scene = new Scene(new BorderPane(root));
        BlueFX.style(scene);
        stage.setScene(scene);
        stage.show();

        
        
//        SimpleCSSEditor.editCSS(root);
    }

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) {
        launch(args);
    }
    
}
