/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.editor;

import blue.BlueSystem;
import blue.CompileData;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.jfx.BlueFX;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import blue.orchestra.editor.blueSynthBuilder.swing.BSBInterfaceEditor;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.NoteList;
import blue.soundObject.ObjectBuilder;
import blue.soundObject.ObjectBuilderRegistry;
import blue.soundObject.SoundObjectException;
import blue.soundObject.editor.objectBuilder.ObjectBuilderCodeEditor;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import javafx.embed.swing.JFXPanel;
import javafx.scene.Scene;
import javafx.scene.control.TextArea;
import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTabbedPane;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;

@ScoreObjectEditorPlugin(scoreObjectType = ObjectBuilder.class)
public class ObjectBuilderEditor extends ScoreObjectEditor {

    private ObjectBuilder objectBuilder;

    private final BSBInterfaceEditor interfaceEditor = new BSBInterfaceEditor(
            ObjectBuilderRegistry.getBSBObjects(), false);

    private final ObjectBuilderCodeEditor codeEditor = new ObjectBuilderCodeEditor();

    private TextArea commentTextArea;

    public ObjectBuilderEditor() {
        JTabbedPane tabs = new JTabbedPane();
        tabs.add(BlueSystem.getString("instrument.interface"), interfaceEditor);
        tabs.add(BlueSystem.getString("instrument.code"), codeEditor);

        JPanel topPanel = new JPanel(new BorderLayout());
        JLabel label = new JLabel("[ Object Builder ]");

        JButton testButton = new JButton(BlueSystem.getString("common.test"));

        testButton.addActionListener((ActionEvent e) -> {
            testSoundObject();
        });

        topPanel.add(label, BorderLayout.WEST);
        topPanel.add(testButton, BorderLayout.EAST);

        this.setLayout(new BorderLayout());
        this.add(topPanel, BorderLayout.NORTH);
        this.add(tabs, BorderLayout.CENTER);

        JFXPanel jfxCommentPanel = new JFXPanel();

        BlueFX.runOnFXThread(() -> {
            commentTextArea = new TextArea();
            commentTextArea.setWrapText(true);

            final Scene scene2 = new Scene(commentTextArea);
            BlueFX.style(scene2);
            jfxCommentPanel.setScene(scene2);

        });

        tabs.addTab("Comments", jfxCommentPanel);

        initActions();
    }

    private void initActions() {
        InputMap inputMap = this
                .getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        ActionMap actions = this.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_T, BlueSystem
                .getMenuShortcutKey()), "testSoundObject");

        actions.put("testSoundObject", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                testSoundObject();
            }

        });

    }

    @Override
    public void editScoreObject(ScoreObject sObj) {
        if (sObj == null || !(sObj instanceof ObjectBuilder)) {
            this.objectBuilder = null;
            System.err.println("[ERROR] ObjectBuilder::editSoundObject - "
                    + "not instance of ObjectBuilder");
            return;
        }

        if (this.objectBuilder != null) {
            final ObjectBuilder temp = this.objectBuilder;
            BlueFX.runOnFXThread(()
                    -> temp.commentProperty().unbind());
        }

        this.objectBuilder = (ObjectBuilder) sObj;

        PresetGroup presetGroup = objectBuilder.getPresetGroup();
        BSBGraphicInterface graphicInterface = objectBuilder
                .getGraphicInterface();
        this.interfaceEditor.editInterface(graphicInterface, presetGroup);
        this.codeEditor.editObjectBuilder(objectBuilder);

        BlueFX.runOnFXThread(() -> {
            commentTextArea.setText(this.objectBuilder.getComment());
            this.objectBuilder.commentProperty().bind(commentTextArea.textProperty());
        });
    }

    public final void testSoundObject() {
        if (this.objectBuilder == null) {
            return;
        }

        NoteList notes = null;

        try {
            notes = this.objectBuilder.generateForCSD(CompileData.createEmptyCompileData(),
                    0.0f, -1.0f);
        } catch (SoundObjectException e) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this), e);
            notes = null;
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                    .getString("soundObject.generatedScore"));
        }

    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        ObjectBuilderEditor objBuilderEditor = new ObjectBuilderEditor();
        objBuilderEditor.editScoreObject(new ObjectBuilder());
        GUI.showComponentAsStandalone(objBuilderEditor, "ObjectBuilder Editor",
                true);
    }

}
