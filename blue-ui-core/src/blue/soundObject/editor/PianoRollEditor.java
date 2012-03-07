package blue.soundObject.editor;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.BorderFactory;
import javax.swing.JPanel;
import javax.swing.JScrollBar;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JToggleButton;

import blue.BlueSystem;
import blue.components.IconFactory;
import blue.gui.MyScrollPaneLayout;
import blue.gui.ScrollerButton;
import blue.soundObject.PianoRoll;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.pianoRoll.NotePropertiesEditor;
import blue.soundObject.editor.pianoRoll.PianoRollCanvas;
import blue.soundObject.editor.pianoRoll.PianoRollCanvasHeader;
import blue.soundObject.editor.pianoRoll.PianoRollPropertiesEditor;
import blue.soundObject.editor.pianoRoll.TimeBar;
import blue.soundObject.editor.pianoRoll.TimelinePropertiesPanel;
import blue.utility.GUI;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class PianoRollEditor extends SoundObjectEditor implements
        PropertyChangeListener, ActionListener {

    PianoRollPropertiesEditor props = new PianoRollPropertiesEditor();

    PianoRollCanvas noteCanvas = new PianoRollCanvas();

    PianoRollCanvasHeader noteHeader = new PianoRollCanvasHeader();

    TimeBar timeBar = new TimeBar();

    TimelinePropertiesPanel timeProperties = new TimelinePropertiesPanel();

    NotePropertiesEditor noteTemplateEditor = new NotePropertiesEditor();

    JScrollPane noteScrollPane;

    JToggleButton snapButton = new JToggleButton();

    private PianoRoll p;

    public PianoRollEditor() {
        snapButton.setIcon(IconFactory.getLeftArrowIcon());
        snapButton.setSelectedIcon(IconFactory.getRightArrowIcon());
        snapButton.setFocusable(false);

        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        this.setLayout(new BorderLayout(5, 5));

        noteScrollPane = new JScrollPane();
        noteScrollPane.setViewportView(noteCanvas);
        noteScrollPane.setRowHeaderView(noteHeader);
        noteScrollPane.setColumnHeaderView(timeBar);
        noteScrollPane.setCorner(JScrollPane.UPPER_RIGHT_CORNER, snapButton);

        noteScrollPane.setAutoscrolls(true);

        setupNoteScrollBars(noteScrollPane);

        timeProperties.setVisible(false);
        timeProperties.setPreferredSize(new Dimension(150, 40));

        noteCanvas.addSelectionListener(noteTemplateEditor);
        noteCanvas.addSelectionListener(noteHeader);

        JTabbedPane tabs = new JTabbedPane();

        JPanel notesPanel = new JPanel(new BorderLayout());

        notesPanel.add(noteTemplateEditor, BorderLayout.NORTH);
        notesPanel.add(noteScrollPane, BorderLayout.CENTER);
        notesPanel.add(timeProperties, BorderLayout.EAST);

        tabs.add(BlueSystem.getString("pianoRoll.notes"), notesPanel);
        tabs.add(BlueSystem.getString("common.properties"), props);

        props.setNoteBuffer(noteCanvas.noteBuffer);

        this.add(tabs, BorderLayout.CENTER);

        centerNoteScrollPane();

        snapButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                timeProperties.setVisible(!timeProperties.isVisible());
            }
        });

        noteCanvas.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                Dimension d = new Dimension(e.getComponent().getWidth(), 20);
                timeBar.setSize(d);
                timeBar.setPreferredSize(d);

                timeBar.repaint();
            }

        });

        noteScrollPane.getViewport().addComponentListener(
        new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                noteCanvas.recalculateSize();
            }
        });
        
    }

    /**
     * @param noteScrollPane2
     */
    private void setupNoteScrollBars(JScrollPane noteSP) {

        JPanel horizontalViewChanger = new JPanel(new GridLayout(1, 2));

        ScrollerButton plusHorz = new ScrollerButton("+");
        ScrollerButton minusHorz = new ScrollerButton("-");
        plusHorz.setActionCommand("plusHorizontal");
        minusHorz.setActionCommand("minusHorizontal");

        horizontalViewChanger.add(plusHorz);
        horizontalViewChanger.add(minusHorz);

        JPanel verticalViewChanger = new JPanel(new GridLayout(2, 1));

        ScrollerButton plusVert = new ScrollerButton("+");
        ScrollerButton minusVert = new ScrollerButton("-");
        plusVert.setActionCommand("plusVertical");
        minusVert.setActionCommand("minusVertical");

        verticalViewChanger.add(plusVert);
        verticalViewChanger.add(minusVert);

        plusHorz.addActionListener(this);
        minusHorz.addActionListener(this);
        plusVert.addActionListener(this);
        minusVert.addActionListener(this);

        noteSP
                .setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
        noteSP
                .setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);

        noteSP.setLayout(new MyScrollPaneLayout());

        noteSP.add(horizontalViewChanger, MyScrollPaneLayout.HORIZONTAL_RIGHT);
        noteSP.add(verticalViewChanger, MyScrollPaneLayout.VERTICAL_BOTTOM);

    }

    private void centerNoteScrollPane() {
        JScrollBar scrollbar = noteScrollPane.getVerticalScrollBar();
        int max = scrollbar.getMaximum();
        scrollbar.setValue((max / 32) * 13);
    }

    public void editSoundObject(SoundObject sObj) {

        if (sObj == null) {
            return;
        }

        if (!(sObj instanceof PianoRoll)) {
            return;
        }

        PianoRoll p = (PianoRoll) sObj;

        if (this.p != null) {
            this.p.removePropertyChangeListener(this);
        }

        this.p = p;

        this.p.addPropertyChangeListener(this);

        noteCanvas.editPianoRoll(p);
        noteHeader.editPianoRoll(p);
        timeBar.editPianoRoll(p);
        props.editPianoRoll(p);
        timeProperties.setPianoRoll(p);

        centerNoteScrollPane();
    }

    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.p) {
            if (evt.getPropertyName().equals("scale")) {
                centerNoteScrollPane();
            }
        }
    }

    public static void main(String args[]) {

        GUI.setBlueLookAndFeel();

        PianoRollEditor pEditor = new PianoRollEditor();
        pEditor.editSoundObject(new PianoRoll());

        GUI.showComponentAsStandalone(pEditor, "Piano Roll Editor", true);
    }

    private void lowerHeight() {
        if (p == null) {
            return;
        }

        int noteHeight = p.getNoteHeight();

        if (noteHeight > 5) {
            noteHeight--;
            p.setNoteHeight(noteHeight);
        }
    }

    private void raiseHeight() {
        if (p == null) {
            return;
        }

        int noteHeight = p.getNoteHeight();

        if (noteHeight < 25) {
            noteHeight++;
            p.setNoteHeight(noteHeight);
        }
    }

    private void lowerPixelSecond() {
        if (p == null) {
            return;
        }

        int pixelSecond = p.getPixelSecond();

        if (pixelSecond <= 2) {
            return;
        }

        pixelSecond -= 2;

        p.setPixelSecond(pixelSecond);
    }

    private void raisePixelSecond() {
        if (p == null) {
            return;
        }

        int pixelSecond = p.getPixelSecond() + 2;
        p.setPixelSecond(pixelSecond);
    }

    public void actionPerformed(ActionEvent ae) {
        String command = ae.getActionCommand();
        if (command.equals("plusVertical")) {
            raiseHeight();
        } else if (command.equals("minusVertical")) {
            lowerHeight();
        } else if (command.equals("plusHorizontal")) {
            raisePixelSecond();
        } else if (command.equals("minusHorizontal")) {
            lowerPixelSecond();
        }
    }
}