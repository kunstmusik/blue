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
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObjectException;
import blue.soundObject.TrackerObject;
import blue.soundObject.editor.tracker.TracksEditor;
import blue.soundObject.tracker.Track;
import blue.soundObject.tracker.TrackList;
import blue.ui.utilities.BlueCommonIcons;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JSpinner;
import javax.swing.KeyStroke;
import javax.swing.SpinnerModel;
import javax.swing.SpinnerNumberModel;
import javax.swing.SwingUtilities;
import javax.swing.border.BevelBorder;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import skt.swing.SwingUtil;

@ScoreObjectEditorPlugin(scoreObjectType = TrackerObject.class)
public class TrackerEditor extends ScoreObjectEditor {

    private static final String SHORTCUT_TEXT = "ctrl-space             clear or duplicate previous note\n"
            + "ctrl-shift-space       set to OFF note\n"
            + "ctrl-up                increment value\n"
            + "ctrl-down              decrement value\n"
            + "ctrl-t                 toggle note tie\n"
            + "ctrl-x                 cut selected notes\n"
            + "ctrl-c                 copy selected notes\n"
            + "ctrl-v                 paste notes from copy buffer\n"
            + "del                    delete selected notes\n"
            + "\nctrl-k               toggle keyboard note shortcuts\n"
            + "ctrl-shift-up          raise keyboard octave by one\n"
            + "ctrl-shift-down        lower keyboard octave by one";

    TracksEditor tracksEditor = new TracksEditor();

    TrackerObject tracker = null;

    JSpinner stepsSpinner;

    JSpinner stepsPerBeatSpinner;    

    JSpinner octaveSpinner;

    JCheckBox useKeyboardNotes;

    public TrackerEditor() {
        Box menuPanel = getMenuPanel();

        this.setLayout(new BorderLayout());
        this.add(menuPanel, BorderLayout.NORTH);
        this.add(tracksEditor, BorderLayout.CENTER);

        SwingUtil.installActions(this, new Action[] { new TestAction(),
                new UseKeyboardNotesAction(), new IncrementOctaveAction(),
                new DecrementOctaveAction() },
                WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
    }

    private Box getMenuPanel() {
        Box panel = Box.createHorizontalBox();

        // panel.setLayout(new FlowLayout(FlowLayout.LEADING));

        JButton addButton = new JButton(BlueCommonIcons.ADD);
        addButton.addActionListener((ActionEvent e) -> {
            if (tracker != null) {
                Track t = new Track();
                TrackList trackList = tracker.getTracks();
                
                t.setName(trackList.getNextTrackName());
                
                trackList.addTrack(t);
            }
        });

        addButton.setToolTipText("Add New Track");
        addButton.setFocusPainted(false);

        JLabel label = new JLabel("Tracker");
        label.setFont(label.getFont().deriveFont(Font.BOLD, 16));

        JButton button = new JButton("Test");
        button.addActionListener((ActionEvent e) -> {
            testSoundObject();
        });
        button.setFocusPainted(false);

        JButton helpButton = new JButton("[ ? ]");
        helpButton.addActionListener((ActionEvent e) -> {
            showHelpText();
        });
        helpButton.setFocusPainted(false);

        stepsSpinner = new JSpinner();
        stepsSpinner.setModel(new SpinnerNumberModel(16, 1, Integer.MAX_VALUE, 1));
        stepsSpinner.addChangeListener((ChangeEvent e) -> {
            if (tracker != null) {
                tracker.setSteps(((Integer) stepsSpinner.getValue()).intValue());
                tracksEditor.revalidate();
                tracksEditor.repaint();
            }
        });

        Dimension d = new Dimension(50, 20);
        stepsSpinner.setSize(d);
        stepsSpinner.setPreferredSize(d);
        stepsSpinner.setMaximumSize(d);
        
        stepsPerBeatSpinner = new JSpinner();
        stepsPerBeatSpinner.setModel(new SpinnerNumberModel(4, 1, Integer.MAX_VALUE, 1));
        stepsPerBeatSpinner.addChangeListener((ChangeEvent e) -> {
            if (tracker != null) {
                tracker.setStepsPerBeat(((Integer) stepsPerBeatSpinner.getValue()).intValue());
            }
        });

        stepsPerBeatSpinner.setSize(d);
        stepsPerBeatSpinner.setPreferredSize(d);
        stepsPerBeatSpinner.setMaximumSize(d);        

        useKeyboardNotes = new JCheckBox("Use Keyboard Notes");
        useKeyboardNotes.addActionListener((ActionEvent e) -> {
            tracksEditor.useKeyboardNoteShortcuts(useKeyboardNotes
                    .isSelected());
        });

        octaveSpinner = new JSpinner();
        octaveSpinner.setModel(new SpinnerNumberModel(0, -8, 8, 1));
        octaveSpinner.addChangeListener((ChangeEvent e) -> {
            if (tracker != null) {
                int oct = ((Integer) octaveSpinner.getValue()).intValue();
                tracksEditor.setKeyboardOctave(oct);
            }
        });
        octaveSpinner.setSize(d);
        octaveSpinner.setPreferredSize(d);
        octaveSpinner.setMaximumSize(d);

        // Laying out
        panel.add(label);
        panel.add(Box.createHorizontalStrut(5));
        panel.add(addButton);
        panel.add(Box.createHorizontalStrut(10));
        panel.add(new JLabel("Steps"));
        panel.add(Box.createHorizontalStrut(5));
        panel.add(stepsSpinner);
        panel.add(Box.createHorizontalStrut(10));
        panel.add(new JLabel("Steps per Beat"));
        panel.add(Box.createHorizontalStrut(5));
        panel.add(stepsPerBeatSpinner);
        panel.add(Box.createHorizontalStrut(10));        
        panel.add(useKeyboardNotes);
        panel.add(Box.createHorizontalStrut(5));
        panel.add(new JLabel("Octave"));
        panel.add(Box.createHorizontalStrut(5));
        panel.add(octaveSpinner);
        panel.add(Box.createHorizontalGlue());
        panel.add(button);
        panel.add(Box.createHorizontalStrut(5));
        panel.add(helpButton);

        panel.setBorder(BorderFactory.createCompoundBorder(BorderFactory
                .createBevelBorder(BevelBorder.RAISED), BorderFactory
                .createEmptyBorder(3, 3, 3, 3)));

        return panel;
    }

    @Override
    public void editScoreObject(ScoreObject sObj) {
        if (sObj == null) {
            System.err
                    .println("[TrackerEditor::editSoundObject()] ERROR: null SoundObject");
            tracker = null;

            return;
        }

        if (!(sObj instanceof TrackerObject)) {
            System.err
                    .println("[PolyObjectEditor::editSoundObject()] ERROR: not an instance of TrackerObject");
            tracker = null;
            // sObjTableModel.setSoundObjects(null);
            return;
        }

        this.tracker = null;

        TrackerObject newTracker = (TrackerObject) sObj;

        stepsSpinner.setValue(new Integer(newTracker.getSteps()));
        stepsPerBeatSpinner.setValue(new Integer(newTracker.getStepsPerBeat()));        

        this.tracker = newTracker;

        tracksEditor.setTrackerObject(tracker);
        // this.clear();
    }

    private void testSoundObject() {
        if (this.tracker == null) {
            return;
        }

        NoteList notes = null;

        try {
            notes = tracker.generateNotes(0.0f, -1.0f);
        } catch (SoundObjectException e) {
            ExceptionDialog
                    .showExceptionDialog(SwingUtilities.getRoot(this), e);
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                            .getString("soundObject.generatedScore"));
        }
    }

    private void showHelpText() {
        InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                SHORTCUT_TEXT, "Shortcuts");

    }

    // ACTIONS

    class TestAction extends AbstractAction {

        public TestAction() {
            super("test-button");
            putValue(Action.SHORT_DESCRIPTION, "Test Button");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_T, BlueSystem.getMenuShortcutKey()));
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            testSoundObject();
        }
    }

    class UseKeyboardNotesAction extends AbstractAction {

        public UseKeyboardNotesAction() {
            super("useKeyboardNotesAction");
            putValue(Action.SHORT_DESCRIPTION, "useKeyboardNotesAction");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_K, BlueSystem.getMenuShortcutKey()));
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            useKeyboardNotes.doClick();
        }
    }

    class IncrementOctaveAction extends AbstractAction {

        public IncrementOctaveAction() {
            super("increment-octave");
            putValue(Action.SHORT_DESCRIPTION, "increment-octave");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_UP, BlueSystem.getMenuShortcutKey()
                            | InputEvent.SHIFT_DOWN_MASK));
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            SpinnerModel model = octaveSpinner.getModel();
            if (model.getNextValue() != null) {
                model.setValue(model.getNextValue());
            }
        }
    }

    class DecrementOctaveAction extends AbstractAction {

        public DecrementOctaveAction() {
            super("decrement-octave");
            putValue(Action.SHORT_DESCRIPTION, "decrement-octave");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_DOWN, BlueSystem.getMenuShortcutKey()
                            | InputEvent.SHIFT_DOWN_MASK));
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            SpinnerModel model = octaveSpinner.getModel();
            if (model.getPreviousValue() != null) {
                model.setValue(model.getPreviousValue());
            }
        }
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        TrackerEditor trackerEditor = new TrackerEditor();

        trackerEditor.editScoreObject(new TrackerObject());

        GUI.showComponentAsStandalone(trackerEditor, "Tracker Editor", true);
    }

}
