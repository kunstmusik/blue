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
package blue.ui.core.midi;

import blue.midi.MidiInputManager;
import java.net.URL;
import java.util.ResourceBundle;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.event.ActionEvent;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.VBox;

/**
 * FXML Controller class
 *
 * @author stevenyi
 */
public class VirtualKeyboardController implements Initializable {

    @FXML 
    private VBox root;
    @FXML
    private Spinner<Integer> channelSpinner;
    @FXML
    private Spinner<Integer> velocitySpinner;
    @FXML
    private Spinner<Integer> octaveSpinner;

    private static final int KEY_OFFSET = 21;
    private AtomicBoolean[] keyStates = new AtomicBoolean[88];
    private AtomicBoolean[] changedKeyStates = new AtomicBoolean[88];
    private int[] whiteKeys = new int[7];
    private int lastMidiKey = -1;
    private int octave = 5;
    private int channel = 0;
    private int velocity = 127;
    private MidiInputManager midiEngine = MidiInputManager.getInstance();

    /**
     * Initializes the controller class.
     */
    @Override
    public void initialize(URL url, ResourceBundle rb) {
        channelSpinner.setValueFactory(
                new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 16, 1));
        velocitySpinner.setValueFactory(
                new SpinnerValueFactory.IntegerSpinnerValueFactory(0, 127, 127));
        octaveSpinner.setValueFactory(
                new SpinnerValueFactory.IntegerSpinnerValueFactory(0, 7, 5));
    }

    @FXML
    private void allNotesOff(ActionEvent event) {
        System.out.println("all notes off");
    }

    @FXML
    private void handleKeyPressed(KeyEvent event) {
        System.out.println("Event Press: " + event.getCode());
    }

    @FXML
    private void handleKeyReleased(KeyEvent event) {
    }

}
