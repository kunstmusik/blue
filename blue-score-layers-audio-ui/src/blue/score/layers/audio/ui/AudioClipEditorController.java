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

import blue.score.layers.audio.core.AudioClip;
import java.net.URL;
import java.util.ResourceBundle;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.AnchorPane;

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

    private AudioClip audioClip;

    FloatBinder<AudioClip> startTimeBinder;
    FloatBinder<AudioClip> durationBinder;
    FloatBinder<AudioClip> fileStartBinder;
    FloatBinder<AudioClip> fadeInBinder;
    FloatBinder<AudioClip> fadeOutBinder;

    /**
     * Initializes the controller class.
     */
    @Override
    public void initialize(URL url, ResourceBundle rb) {
        startTimeBinder = new FloatBinder<>(startTimeText,
                (AudioClip ac, Float val) -> {
                    if (val < 0.0f) {
                        return null;
                    }
                    return val;
                }
        );
        durationBinder = new FloatBinder<>(durationText,
                (AudioClip ac, Float val) -> {
                    if (val <= 0.0f || val > ac.getAudioDuration()) {
                        return null;
                    }
                    return val;
                }
        );
        fileStartBinder = new FloatBinder<>(fileStartText,
                (AudioClip ac, Float val) -> {
                    if (val < 0.0f || val >= ac.getAudioDuration()) {
                        return null;
                    }
                    return val;
                }
        );
        fadeInBinder = new FloatBinder<>(fadeInText,
                (AudioClip ac, Float val) -> {
                    if (val < 0.0f || val >= ac.getDuration() - ac.getFadeOut()) {
                        return null;
                    }
                    return val;
                }
        );
        fadeOutBinder = new FloatBinder<>(fadeOutText,
                (AudioClip ac, Float val) -> {
                    if (val < 0.0f || val >= ac.getDuration() - ac.getFadeIn()) {
                        return null;
                    }
                    return val;
                }
        );
    }

    public void setAudioClip(AudioClip audioClip) {
        audioDurationText.setText(Float.toString(audioClip.getAudioDuration()));
        audioFileText.setText(audioClip.getAudioFile().getAbsolutePath());

        startTimeBinder.setFloatProperty(audioClip, audioClip.startProperty());
        durationBinder.setFloatProperty(audioClip, audioClip.durationProperty());
        fileStartBinder.setFloatProperty(audioClip,
                audioClip.fileStartTimeProperty());
        fadeInBinder.setFloatProperty(audioClip, audioClip.fadeInProperty());
        fadeOutBinder.setFloatProperty(audioClip, audioClip.fadeOutProperty());
    }
}
