/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.jfxcontrolstest;

import java.net.URL;
import java.util.ResourceBundle;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.TextArea;

/**
 * FXML Controller class
 *
 * @author stevenyi
 */
public class SimpleCSSEditorController implements Initializable {

    @FXML
    private TextArea textArea;
    @FXML
    private Button getButton;
    @FXML
    private Button setButton;

    private Node node = null;
    
    /**
     * Initializes the controller class.
     */
    @Override
    public void initialize(URL url, ResourceBundle rb) {
        
    }    

    public void setNode(Node node) {
        this.node = node;
    }

    @FXML
    public void getStyles() {
        if(node != null) {
            textArea.setText(node.getStyle());
        }
    }
    
    @FXML
    public void setStyles() {
        if(node != null) {
            node.setStyle(textArea.getText());
        }
    }
}
