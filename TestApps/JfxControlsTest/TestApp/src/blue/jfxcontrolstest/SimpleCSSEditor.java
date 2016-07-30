/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.jfxcontrolstest;

import java.io.IOException;
import javafx.fxml.FXMLLoader;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.layout.AnchorPane;
import javafx.stage.Stage;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class SimpleCSSEditor {
   public static void editCSS(Node node) {

       //StyleManager.getInstance().addUserAgentStylesheet(null);
       
       FXMLLoader loader = new FXMLLoader(
               SimpleCSSEditor.class.getResource("SimpleCSSEditor.fxml"));

       try {
           AnchorPane pane = loader.load();
           SimpleCSSEditorController controller = loader.getController();
           Stage stage = new Stage();
           stage.setScene(new Scene(pane));
           stage.setAlwaysOnTop(true);
           stage.show();
           controller.setNode(node);
       } catch (IOException ex) {
           Exceptions.printStackTrace(ex);
       }
   } 
}
