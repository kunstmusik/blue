package blue.soundObject.editor;

import blue.*;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;

import blue.gui.BlueEditorPane;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.soundObject.Instance;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import org.openide.util.Exceptions;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

public class InstanceEditor extends SoundObjectEditor {

    Instance instance;

    JLabel editorLabel = new JLabel();

    BlueEditorPane scoreEditPane = new BlueEditorPane();

    JButton testButton = new JButton();

    JPanel topPanel = new JPanel();

    public InstanceEditor() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {

        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        editorLabel.setText("generic editor");
        this.setLayout(new BorderLayout());

        scoreEditPane.setEditable(false);

        testButton.setText(BlueSystem.getString("common.test"));
        testButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                testSoundObject();
            }
        });

        topPanel.setLayout(new BorderLayout());
        topPanel.add(editorLabel, BorderLayout.CENTER);
        topPanel.add(testButton, BorderLayout.EAST);

        this.add(scoreEditPane, BorderLayout.CENTER);
        this.add(topPanel, BorderLayout.NORTH);

    }

    public void editSoundObject(SoundObject sObj) {
        if (sObj == null) {
            instance = null;
            return;
        }
        if (!sObj.getClass().getName().equals("blue.soundObject.Instance")) {
            instance = null;
            return;
        }
        this.instance = (Instance) sObj;
        editorLabel.setText(BlueSystem.getString("instanceObject.instanceOf")
                + " " + instance.getSoundObject().getName());

        String generatedNoteText = null;

        try {
            SoundObject clone = (SoundObject) instance.getSoundObject().clone();

            generatedNoteText = clone.generateForCSD(CompileData.createEmptyCompileData(), 
                    0.0f, -1.0f).toString();
        } catch (Exception e) {
            Exceptions.printStackTrace(e);
            generatedNoteText = "Could not generate notes"; // TODO - TRANSLATE
        }
        
        scoreEditPane.setText(BlueSystem
                .getString("instanceObject.scoreGenMessage")
                + "\n\n" + generatedNoteText);
    }

    public final void testSoundObject() {
        if (this.instance == null) {
            return;
        }

        NoteList notes = null;

        try {

            SoundObject clone = (SoundObject) instance.getSoundObject().clone();

            notes = clone.generateForCSD(CompileData.createEmptyCompileData(), 
                    0.0f, -1.0f);
        } catch (Exception e) {
            Exceptions.printStackTrace(e);
            notes = null;
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                            .getString("soundObject.generatedScore"));
        }
    }

}