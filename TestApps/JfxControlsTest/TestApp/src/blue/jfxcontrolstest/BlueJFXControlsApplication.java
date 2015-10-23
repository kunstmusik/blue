/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.jfxcontrolstest;

import blue.jfx.BlueFX;
import javafx.application.Application;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.layout.BorderPane;
import javafx.stage.Stage;

/**
 *
 * @author stevenyi
 */
public class BlueJFXControlsApplication extends Application {
    
    @Override
    public void start(Stage stage) throws Exception {
        Node root = new Knob();
        
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
