/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
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
package blue.clojure.project;

import blue.BlueData;
import blue.jfx.BlueFX;
import blue.plugin.ProjectPluginEditorItem;
import blue.project.ProjectPluginEditor;
import blue.project.ProjectPluginUtils;
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
@ProjectPluginEditorItem(displayName  = "Clojure", position = 10)
public class ClojureProjectPluginEditor extends ProjectPluginEditor {

    ClojureProjectDataEditorController controller;

    public ClojureProjectPluginEditor() {
        this.setLayout(new BorderLayout());

        JFXPanel panel = new JFXPanel();
        this.add(panel, BorderLayout.CENTER);
        final CountDownLatch latch = new CountDownLatch(1);
        Platform.runLater(() -> {

            FXMLLoader loader = new FXMLLoader(getClass().getResource(
                    "ClojureProjectDataEditor.fxml"));

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

    @Override
    public void edit(BlueData data) {
        ClojureProjectData projData = ProjectPluginUtils.findPluginData(
                data.getPluginData(), ClojureProjectData.class);

        if(projData == null) {
            projData = new ClojureProjectData();
            data.getPluginData().add(projData);
        }

        controller.setClojureProjectData(projData);
    }
    
}
