/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2020 Steven Yi (stevenyi@gmail.com)
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
import blue.gui.ScrollerButton;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.NoteList;
import blue.soundObject.PianoRoll;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.pianoRoll.FieldEditor;
import blue.soundObject.editor.pianoRoll.NotePropertiesEditor;
import blue.soundObject.editor.pianoRoll.PianoRollCanvas;
import blue.soundObject.editor.pianoRoll.PianoRollCanvasHeader;
import blue.soundObject.editor.pianoRoll.PianoRollPropertiesEditor;
import blue.soundObject.editor.pianoRoll.PianoRollScrollPaneLayout;
import blue.soundObject.editor.pianoRoll.TimeBar;
import blue.soundObject.editor.pianoRoll.TimelinePropertiesPanel;
import blue.ui.components.IconFactory;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JPanel;
import javax.swing.JScrollBar;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JToggleButton;
import javax.swing.JViewport;
import javax.swing.SwingUtilities;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
@ScoreObjectEditorPlugin(scoreObjectType = PianoRoll.class)
public class PianoRollEditor extends ScoreObjectEditor implements
        PropertyChangeListener, ActionListener {

    PianoRollPropertiesEditor props = new PianoRollPropertiesEditor();

    PianoRollCanvas noteCanvas = new PianoRollCanvas();

    PianoRollCanvasHeader noteHeader = new PianoRollCanvasHeader();

    TimeBar timeBar = new TimeBar();

    TimelinePropertiesPanel timeProperties = new TimelinePropertiesPanel();

    NotePropertiesEditor noteTemplateEditor = new NotePropertiesEditor();

    JScrollPane noteScrollPane;

    JToggleButton snapButton = new JToggleButton();
    
    FieldEditor fieldEditor = new FieldEditor();

    private PianoRoll p;

    public PianoRollEditor() {
        snapButton.setIcon(IconFactory.getLeftArrowIcon());
        snapButton.setSelectedIcon(IconFactory.getRightArrowIcon());
        snapButton.setFocusable(false);

        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        this.setLayout(new BorderLayout());

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

        JButton testButton = new JButton("Test");
        testButton.addActionListener(evt -> generateTest());

        JTabbedPane tabs = new JTabbedPane();

        JPanel notesPanel = new JPanel(new BorderLayout());

        JPanel topPanel = new JPanel(new BorderLayout());
        topPanel.add(noteTemplateEditor, BorderLayout.CENTER);
        topPanel.add(testButton, BorderLayout.EAST);

        notesPanel.add(topPanel, BorderLayout.NORTH);
        notesPanel.add(noteScrollPane, BorderLayout.CENTER);
        notesPanel.add(timeProperties, BorderLayout.EAST);

        tabs.add(BlueSystem.getString("pianoRoll.notes"), notesPanel);
        tabs.add(BlueSystem.getString("common.properties"), props);

        props.setNoteBuffer(noteCanvas.noteBuffer);

        this.add(tabs, BorderLayout.CENTER);

        centerNoteScrollPane();

        snapButton.addActionListener((ActionEvent e) -> {
            timeProperties.setVisible(!timeProperties.isVisible());
        });

        noteCanvas.addComponentListener(new ComponentAdapter() {

            @Override
            public void componentResized(ComponentEvent e) {
                Dimension d = new Dimension(e.getComponent().getWidth(), 20);
                timeBar.setSize(d);
                timeBar.setPreferredSize(d);

                timeBar.repaint();
            }

        });

        noteScrollPane.getViewport().addComponentListener(
                new ComponentAdapter() {

                    @Override
                    public void componentResized(ComponentEvent e) {
                        noteCanvas.recalculateSize();
                    }
                });

    }

    protected void generateTest() {

        if (this.p == null) {
            return;
        }

        NoteList notes = null;

        try {
            notes = ((SoundObject) this.p).generateForCSD(null, 0.0f, -1.0f);
        } catch (Exception e) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this), e);
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                    .getString("soundObject.generatedScore"));
        }
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
                .setHorizontalScrollBarPolicy(
                        JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
        noteSP
                .setVerticalScrollBarPolicy(
                        JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);

        noteSP.setLayout(new PianoRollScrollPaneLayout());

        noteSP.add(horizontalViewChanger, PianoRollScrollPaneLayout.HORIZONTAL_RIGHT);
        noteSP.add(verticalViewChanger, PianoRollScrollPaneLayout.VERTICAL_BOTTOM);

        JViewport fieldViewPort = new JViewport();
        fieldViewPort.setView(fieldEditor);
        
        noteSP.add(fieldViewPort, PianoRollScrollPaneLayout.COLUMN_FOOTER_VIEW);
        
        JPanel splitter = new JPanel() {
            @Override
            protected void paintComponent(Graphics g) {
                g.setColor(Color.DARK_GRAY);
                g.fillRect(0, 0, getWidth(), getHeight());
            }
        };
        splitter.setCursor(Cursor.getPredefinedCursor(Cursor.S_RESIZE_CURSOR));
        
        var splitterListener = new MouseAdapter() {
            @Override
            public void mouseDragged(MouseEvent e) {
                var pt = SwingUtilities.convertPoint(splitter, e.getPoint(), noteSP.getViewport());
                
                var max = noteSP.getHeight() - 
                        noteSP.getHorizontalScrollBar().getHeight() 
                        - noteSP.getColumnHeader().getView().getHeight();
                
                var loc = Math.max(5, Math.min(max - 5, max - pt.y));
                
                noteSP.putClientProperty("SplitterLocation", loc);
                noteSP.revalidate();
            }  
        };
        splitter.addMouseMotionListener(splitterListener);
        
        noteSP.add(splitter, PianoRollScrollPaneLayout.SPLITTER);
        
        
        noteSP.putClientProperty("SplitterLocation", 100);
    }

    private void centerNoteScrollPane() {
        JScrollBar scrollbar = noteScrollPane.getVerticalScrollBar();
        int max = scrollbar.getMaximum();
        scrollbar.setValue((max / 32) * 13);
    }

    @Override
    public void editScoreObject(ScoreObject sObj) {

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
        fieldEditor.editPianoRoll(p);
        
        centerNoteScrollPane();
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.p) {
            if (evt.getPropertyName().equals("scale")) {
                centerNoteScrollPane();
            }
        }
    }

    public static void main(String[] args) {

        GUI.setBlueLookAndFeel();

        PianoRollEditor pEditor = new PianoRollEditor();
        pEditor.editScoreObject(new PianoRoll());

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

    @Override
    public void actionPerformed(ActionEvent ae) {
        String command = ae.getActionCommand();
        switch (command) {
            case "plusVertical":
                raiseHeight();
                break;
            case "minusVertical":
                lowerHeight();
                break;
            case "plusHorizontal":
                raisePixelSecond();
                break;
            case "minusHorizontal":
                lowerPixelSecond();
                break;
        }
    }
}
