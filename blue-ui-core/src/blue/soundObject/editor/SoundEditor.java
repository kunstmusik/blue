/*
 * blue - object composition environment for csound Copyright (c) 2001-2017
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.soundObject.editor;

import blue.Arrangement;
import blue.BlueSystem;
import blue.CompileData;
import blue.Tables;
import blue.automation.LineColors;
import blue.automation.Parameter;
import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.components.lines.LinePoint;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.jfx.BlueFX;
import blue.orchestra.editor.blueSynthBuilder.jfx.LineSelector;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.soundObject.NoteList;
import blue.soundObject.Sound;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.sound.ParameterLineView;
import blue.soundObject.editor.sound.TimeBar;
import blue.ui.core.orchestra.editor.BlueSynthBuilderEditor;
import java.awt.BorderLayout;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import javafx.embed.swing.JFXPanel;
import javafx.geometry.Insets;
import javafx.scene.Scene;
import javafx.scene.control.MenuButton;
import javafx.scene.control.MenuItem;
import javafx.scene.control.TextArea;
import javafx.scene.layout.Background;
import javafx.scene.layout.BackgroundFill;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.CornerRadii;
import javafx.scene.layout.Pane;
import javafx.scene.paint.Color;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import org.openide.util.Exceptions;

/**
 * Editor for Sound SoundObject.
 *
 * @author steven yi
 * @version 1.0
 */
@ScoreObjectEditorPlugin(scoreObjectType = Sound.class)
public class SoundEditor extends ScoreObjectEditor {

    Sound sObj;

    JLabel editorLabel = new JLabel();

    JPanel topPanel = new JPanel();

    JButton testButton = new JButton();

    LineList lineList = new LineList();

    BlueSynthBuilderEditor editor = new BlueSynthBuilderEditor();

    ParameterLineView lineView;
    LineSelector lineSelector;
    private TextArea commentTextArea;
    ScoreObjectListener sObjListener;

    public SoundEditor() {

        sObjListener = evt -> {
            if(evt.getPropertyChanged() == ScoreObjectEvent.START_TIME ) {
                lineView.setStartTime(evt.getScoreObject().getStartTime());
            } else if (evt.getPropertyChanged() == ScoreObjectEvent.DURATION) {
                lineView.setDuration(evt.getScoreObject().getSubjectiveDuration());
            }
        };
        
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {

        this.setLayout(new BorderLayout());
        this.add(editor);
        editor.setLabelText("[ Sound ]");

        JFXPanel jfxPanel = new JFXPanel();
        CountDownLatch latch = new CountDownLatch(1);
        JFXPanel jfxCommentPanel = new JFXPanel();

        BlueFX.runOnFXThread(() -> {

            try {

                MenuButton btn = new MenuButton("Automations");

                BorderPane mainPane = new BorderPane();
                lineView = new ParameterLineView(lineList);
                lineSelector = new LineSelector(lineList);

                lineView.widthProperty().bind(mainPane.widthProperty());
                lineView.heightProperty().bind(mainPane.heightProperty().subtract(lineSelector.heightProperty()));

                lineSelector.getChildren().add(0, btn);
                lineSelector.setSpacing(5.0);
                lineView.selectedLineProperty().bind(lineSelector.selectedLineProperty());
                
                TimeBar tb = new TimeBar();
                tb.startTimeProperty().bind(lineView.startTimeProperty());
                tb.durationProperty().bind(lineView.durationProperty());
                
                Pane p = new Pane(lineView, tb);
                p.setBackground(new Background(
                        new BackgroundFill(
                                Color.BLACK, CornerRadii.EMPTY, Insets.EMPTY)));
                lineView.widthProperty().bind(p.widthProperty().subtract(20));
                lineView.heightProperty().bind(p.heightProperty().subtract(40));
                lineView.setLayoutX(10);
                lineView.setLayoutY(30);
                tb.widthProperty().bind(lineView.widthProperty());
                tb.setHeight(20);
                tb.setLayoutX(10);
                tb.setLayoutY(10);

                mainPane.setCenter(p);
                mainPane.setTop(lineSelector);

                btn.showingProperty().addListener((obs, old, newVal) -> {
                    if (newVal) {
                        if (sObj != null) {
                            sObj.getBlueSynthBuilder().getParameterList().sorted()
                                    .forEach((param) -> {
                                        MenuItem m = new MenuItem(param.getName());
                                        m.setOnAction(e -> {
                                            param.setAutomationEnabled(!param.isAutomationEnabled());
                                            if (param.isAutomationEnabled()) {
                                                Line line = param.getLine();
                                                line.setVarName(param.getName());
                                                List<LinePoint> points = line.getObservableList();
                                                if (points.size() < 2) {
                                                    LinePoint lp = new LinePoint();
                                                    lp.setLocation(1.0, points.get(0).getY());
                                                    points.add(lp);
                                                }
                                                lineList.add(line);
                                            } else {
                                                lineList.remove(param.getLine());
                                            }

                                            int colorCount = 0;
                                            for (Line line : lineList) {
                                                line.setColor(LineColors.getColor(colorCount++));
                                            }
                                        });
                                        if (param.isAutomationEnabled()) {
                                            m.setStyle("-fx-text-fill: green;");
                                        }
                                        btn.getItems().add(m);
                                    });
                        }
                    } else {
                        btn.getItems().clear();
                    }
                });

                final Scene scene = new Scene(mainPane);
                BlueFX.style(scene);
                jfxPanel.setScene(scene);

                commentTextArea = new TextArea();
                commentTextArea.setWrapText(true);

                final Scene scene2 = new Scene(commentTextArea);
                BlueFX.style(scene2);
                jfxCommentPanel.setScene(scene2);
            } finally {
                latch.countDown();
            }
        });

        try {
            latch.await();
        } catch (InterruptedException ex) {
            Exceptions.printStackTrace(ex);
        }

        editor.getTabs().insertTab("Automation", null, jfxPanel, "", 1);
        editor.getTabs().addTab("Comments", jfxCommentPanel);

    }

    @Override
    public final void editScoreObject(ScoreObject sObj) {
        if (sObj == null) {
            this.sObj = null;
            editorLabel.setText("no editor available");
            editor.editInstrument(null);
            return;
        }

        if (!(sObj instanceof Sound)) {
            this.sObj = null;
            editorLabel.setText("no editor available");
            editor.editInstrument(null);

            return;
        }

        if (this.sObj != null) {
            final Sound temp = this.sObj;
            BlueFX.runOnFXThread(() -> {
                temp.commentProperty().unbind();
                temp.removeScoreObjectListener(sObjListener);
            });
        }

        this.sObj = (Sound) sObj;
        editor.editInstrument(this.sObj.getBlueSynthBuilder());

        BlueFX.runOnFXThread(() -> {
            lineList.clear();
            int colorCount = 0;
            for (Parameter p : this.sObj.getBlueSynthBuilder().getParameterList().sorted()) {
                if (p.isAutomationEnabled()) {
                    p.getLine().setVarName(p.getName());
                    p.getLine().setColor(LineColors.getColor(colorCount++));
                    List<LinePoint> points = p.getLine().getObservableList();
                    if (points.size() < 2) {
                        LinePoint lp = new LinePoint();
                        lp.setLocation(1.0, points.get(0).getY());
                        points.add(lp);
                    }
                    lineList.add(p.getLine());
                }
            }
            lineView.setStartTime(this.sObj.getStartTime());
            lineView.setDuration(this.sObj.getSubjectiveDuration());
            commentTextArea.setText(this.sObj.getComment());
            this.sObj.commentProperty().bind(commentTextArea.textProperty());
            this.sObj.addScoreObjectListener(sObjListener);
        });
    }

    public final void testSoundObject() {
        if (this.sObj == null) {
            return;
        }

        NoteList notes = null;

        try {
            notes = ((SoundObject) this.sObj).generateForCSD(new CompileData(new Arrangement(), new Tables()), 0.0f, -1.0f);
        } catch (Exception e) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this), e);
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                    .getString("soundObject.generatedScore"));
        }
    }
}
