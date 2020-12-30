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
package blue.score.layers.audio.ui;

import blue.BlueSystem;
import blue.jfx.BlueFX;
import blue.jfx.binding.ChoiceBinder;
import blue.jfx.binding.DoubleBinder;
import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.FadeType;
import java.net.URL;
import java.util.ResourceBundle;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.ChoiceBox;
import javafx.scene.control.TextField;

/**
 * FXML Controller class
 *
 * @author stevenyi
 */
public class AudioClipEditorController implements Initializable {

    @FXML
    private TextField audioFileText;
    @FXML
    private TextField startTimeText;
    @FXML
    private TextField durationText;
    @FXML
    private TextField fileStartText;
    @FXML
    private TextField audioDurationText;
    @FXML
    private TextField fadeInText;
    @FXML
    private TextField fadeOutText;
    @FXML
    private ChoiceBox<FadeType> fadeInChoiceBox;
    @FXML
    private ChoiceBox<FadeType> fadeOutChoiceBox;

    private AudioClip audioClip;

    DoubleBinder<AudioClip> startTimeBinder;
    DoubleBinder<AudioClip> durationBinder;
    DoubleBinder<AudioClip> fileStartBinder;
    DoubleBinder<AudioClip> fadeInBinder;
    DoubleBinder<AudioClip> fadeOutBinder;
    ChoiceBinder<FadeType> fadeInTypeBinder;
    ChoiceBinder<FadeType> fadeOutTypeBinder;

    /**
     * Initializes the controller class.
     */
    @Override
    public void initialize(URL url, ResourceBundle rb) {
        startTimeBinder = new DoubleBinder<>(startTimeText,
                (AudioClip ac, Double val) -> {
                    if (val < 0.0) {
                        return null;
                    }
                    return val;
                }
        );
        durationBinder = new DoubleBinder<>(durationText,
                (AudioClip ac, Double val) -> {
                    if (val <= 0.0 || val > ac.getAudioDuration()) {
                        return null;
                    }
                    return val;
                }
        );
        fileStartBinder = new DoubleBinder<>(fileStartText,
                (AudioClip ac, Double val) -> {
                    if (val < 0.0 || val >= ac.getAudioDuration()) {
                        return null;
                    }
                    return val;
                }
        );
        fadeInBinder = new DoubleBinder<>(fadeInText,
                (AudioClip ac, Double val) -> {
                    if (val < 0.0 || val >= ac.getDuration() - ac.getFadeOut()) {
                        return null;
                    }
                    return val;
                }
        );
        fadeOutBinder = new DoubleBinder<>(fadeOutText,
                (AudioClip ac, Double val) -> {
                    if (val < 0.0 || val >= ac.getDuration() - ac.getFadeIn()) {
                        return null;
                    }
                    return val;
                }
        );

        fadeInChoiceBox.getItems().addAll(FadeType.values());
        fadeOutChoiceBox.getItems().addAll(FadeType.values());
      
        fadeInTypeBinder = new ChoiceBinder<>(fadeInChoiceBox);
        fadeOutTypeBinder = new ChoiceBinder<>(fadeOutChoiceBox);
        
    }

    public void setAudioClip(AudioClip audioClip) {

        BlueFX.runOnFXThread(() -> {
            audioDurationText.setText(Double.toString(
                    audioClip.getAudioDuration()));
            
            String path = BlueSystem.getRelativePath(
                    audioClip.getAudioFile().getAbsolutePath());
            audioFileText.setText(path);

            startTimeBinder.setDoubleProperty(audioClip,
                    audioClip.startProperty());
            durationBinder.setDoubleProperty(audioClip,
                    audioClip.durationProperty());
            fileStartBinder.setDoubleProperty(audioClip,
                    audioClip.fileStartTimeProperty());
            fadeInBinder.setDoubleProperty(audioClip, audioClip.fadeInProperty());
            fadeOutBinder.setDoubleProperty(audioClip,
                    audioClip.fadeOutProperty());

            fadeInTypeBinder.setObjectProperty(audioClip.fadeInTypeProperty());
            fadeOutTypeBinder.setObjectProperty(audioClip.fadeOutTypeProperty());
        });
    }
}
