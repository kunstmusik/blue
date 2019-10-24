/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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

import blue.jfx.BlueFX;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.score.layers.audio.core.AudioClip;
import blue.soundObject.editor.ScoreObjectEditor;
import java.awt.BorderLayout;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import javafx.application.Platform;
import javafx.embed.swing.JFXPanel;
import javafx.fxml.FXMLLoader;
import javafx.scene.Node;
import javafx.scene.Scene;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
@ScoreObjectEditorPlugin(scoreObjectType = AudioClip.class)
public class AudioClipEditor extends ScoreObjectEditor {

    AudioClipEditorController controller = null;
    /**
     * Creates new form AudioClipEditor
     */
    public AudioClipEditor() {
        this.setLayout(new BorderLayout());

        JFXPanel panel = new JFXPanel();
        this.add(panel, BorderLayout.CENTER);
        final CountDownLatch latch = new CountDownLatch(1);
        Platform.runLater(() -> {

            FXMLLoader loader = new FXMLLoader(getClass().getResource(
                    "AudioClipEditor.fxml"));

            try {
                loader.load();
                controller = loader.getController();
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
            final Scene scene = new Scene(loader.getRoot());
            BlueFX.style(scene);
            Node root = loader.getRoot();
//            root.setStyle("-fx-base: rgba(38, 51, 76, 1.0);"
//                    + "-fx-background: rgba(38, 51, 76, 1.0);"
//                    + "-fx-control-inner-background: black");
            panel.setScene(scene);
            latch.countDown();
        });
        
        try {
            latch.await();
        } catch (InterruptedException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 522, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 239, Short.MAX_VALUE)
        );
    }// </editor-fold>//GEN-END:initComponents


    // Variables declaration - do not modify//GEN-BEGIN:variables
    // End of variables declaration//GEN-END:variables

    @Override
    public void editScoreObject(ScoreObject sObj) {
        AudioClip newClip = (AudioClip) sObj;
        controller.setAudioClip(newClip);
    }
}