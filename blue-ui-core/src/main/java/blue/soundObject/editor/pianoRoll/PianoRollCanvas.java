/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.pianoRoll;

import blue.BlueSystem;
import blue.components.AlphaMarquee;
import blue.soundObject.PianoRoll;
import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.FieldType;
import blue.soundObject.pianoRoll.PianoNote;
import blue.utilities.scales.ScaleLinear;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.GradientPaint;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import java.awt.event.ContainerEvent;
import java.awt.event.ContainerListener;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ObjectProperty;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JLayeredPane;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import javax.swing.KeyStroke;
import javax.swing.Scrollable;
import javax.swing.SwingConstants;
import javax.swing.ToolTipManager;

/**
 * @author steven
 */
public class PianoRollCanvas extends JLayeredPane implements Scrollable,
        PropertyChangeListener, ListChangeListener<PianoNote> {

    JPopupMenu popup = new JPopupMenu();

    private static final int RIGHT_EXTRA_SPACE = 100;

    int octaves = 16;

    int centerOctave = 8;

    AlphaMarquee marquee = new AlphaMarquee();

    private static final Color OCTAVE_COLOR = new Color(198, 226, 255);

    private static final Color LINE_COLOR = Color.DARK_GRAY.darker();

    protected PianoRoll p;

    //public NoteBuffer noteBuffer = new NoteBuffer();
    ComponentListener cl;

    private final NoteCanvasMouseListener nMouse;

    private final ObservableList<PianoNote> selectedNotes;
    private final ScaleLinear fieldEditorYScale;
    private final ObjectProperty<FieldDef> selectedFieldDef;

    public ScaleLinear getFieldEditorYScale() {
        return fieldEditorYScale;
    }

    public PianoRollCanvas(ObservableList<PianoNote> selectedNotes,
            ObjectProperty<FieldDef> selectedFieldDef,
            ScaleLinear fieldEditorYScale) {

        this.selectedNotes = selectedNotes;
        this.selectedFieldDef = selectedFieldDef;
        this.fieldEditorYScale = fieldEditorYScale;

        this.setLayout(null);
        recalculateSize();
        this.setBackground(Color.black);

        nMouse = new NoteCanvasMouseListener(this, selectedNotes, selectedFieldDef);

        cl = new ComponentAdapter() {

            @Override
            public void componentMoved(ComponentEvent e) {
                recalculateSize();
                repaint();
            }

            @Override
            public void componentResized(ComponentEvent e) {
                recalculateSize();
                repaint();
            }
        };

        this.addContainerListener(new ContainerListener() {

            @Override
            public void componentAdded(ContainerEvent e) {
                if (e.getChild() instanceof PianoNoteView) {
                    e.getChild().addComponentListener(cl);
                }

            }

            @Override
            public void componentRemoved(ContainerEvent e) {
                if (e.getChild() instanceof PianoNoteView) {
                    e.getChild().removeComponentListener(cl);
                }
            }
        });

        InputMap inputMap = this.getInputMap();
        ActionMap actionMap = this.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_BACK_SPACE, 0),
                "deleteNotes");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DELETE, 0),
                "deleteNotes");
        final int osCtrlKey = BlueSystem.getMenuShortcutKey();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_X, osCtrlKey), "cut");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_C, osCtrlKey), "copy");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_RIGHT, osCtrlKey), "raisePixelSecond");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_LEFT, osCtrlKey), "lowerPixelSecond");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN, osCtrlKey), "raiseHeight");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_UP, osCtrlKey), "lowerHeight");

        // Extra set of shortcuts in case the others interfere with window
        // manager
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_EQUALS, osCtrlKey), "raisePixelSecond");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_MINUS, osCtrlKey), "lowerPixelSecond");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_EQUALS, osCtrlKey
                | InputEvent.SHIFT_DOWN_MASK), "raiseHeight");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_MINUS, osCtrlKey
                | InputEvent.SHIFT_DOWN_MASK), "lowerHeight");

        Action deleteNotes = new AbstractAction(BlueSystem
                .getString("common.remove")) {

            @Override
            public void actionPerformed(ActionEvent e) {
                if (selectedNotes.size() > 0) {
                    removeNotes();
                }
            }
        };

        Action copyAction = new AbstractAction("Copy") {
            @Override
            public void actionPerformed(ActionEvent e) {
                copy();
            }
        };

        Action cutAction = new AbstractAction("Cut") {
            @Override
            public void actionPerformed(ActionEvent e) {
                cut();
            }
        };

        actionMap.put("deleteNotes", deleteNotes);
        actionMap.put("cut", cutAction);
        actionMap.put("copy", copyAction);

        JMenuItem remove = new JMenuItem("Remove");
        remove.setAction(deleteNotes);

        JMenuItem cut = new JMenuItem("Cut");
        cut.setAction(cutAction);

        JMenuItem copy = new JMenuItem("Copy");
        copy.setAction(copyAction);

        popup.add(cut);
        popup.add(copy);
        popup.addSeparator();
        popup.add(remove);

        // ZOOM ACTIONS
        actionMap.put("raisePixelSecond", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                raisePixelSecond();
            }

        });

        actionMap.put("lowerPixelSecond", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                lowerPixelSecond();
            }

        });

        actionMap.put("raiseHeight", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                raiseHeight();
            }

        });

        actionMap.put("lowerHeight", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                lowerHeight();
            }

        });

        ToolTipManager.sharedInstance().registerComponent(this);
    }

    @Override
    public String getToolTipText(MouseEvent e) {

        String tip = null;

        Object obj = this.getComponentAt(e.getPoint());
        if (obj instanceof PianoNoteView) {
            var pnv = (PianoNoteView) obj;
            var note = pnv.getPianoNote();

            StringBuilder builder = new StringBuilder("<b>Note: </b>");

            switch (p.getPchGenerationMethod()) {
                case PianoRoll.GENERATE_FREQUENCY:
                    builder.append(String.format("%d.%02d", note.getOctave(), note.getScaleDegree()));
                    break;
                case PianoRoll.GENERATE_PCH:
                    builder.append(String.format("%d.%d", note.getOctave(), note.getScaleDegree()));
                    break;
                case PianoRoll.GENERATE_MIDI:
                    builder.append(String.format("%d", note.getOctave() * 12 + note.getScaleDegree()));
                    break;
            }

            for (var fd : note.getFields()) {
                var fDef = fd.getFieldDef();
                builder.append("<br/>");
                if (fDef == selectedFieldDef.getValue()) {
                    builder.append("<b>").append(fDef.getFieldName()).append(":</b> ");
                } else {
                    builder.append(fDef.getFieldName()).append(": ");
                }
                if (fd.getFieldDef().getFieldType() == FieldType.DISCRETE) {
                    builder.append(Integer.toString((int) fd.getValue()));
                } else {
                    builder.append(String.format("%.3g", fd.getValue()));
                }
            }

            tip = String.format("<html>%s</html>",
                    builder.toString());
        }

        return tip;
    }

    public void cut() {
        copy();
        removeNotes();
    }

    public void copy() {
        var buffer = NoteCopyBuffer.getInstance();
        buffer.clear();
        
        buffer.setSourcePianoRoll(p);
        var copiedNotes = buffer.getCopiedNotes();
        
        for (var note : selectedNotes) {
            copiedNotes.add(new PianoNote(note));
        }
    }

    /**
     *
     */
    protected void removeNotes() {
        for (var note : selectedNotes) {
            this.p.getNotes().remove(note);
        }

        selectedNotes.clear();

        repaint();
    }

    public void recalculateSize() {
        if (p == null) {
            return;
        }

        int noteHeight = p.getNoteHeight();

        int h;

        if (p.getPchGenerationMethod() == PianoRoll.GENERATE_MIDI) {
            h = 128 * noteHeight;
        } else {
            int notesPerOctave = p.getScale().getNumScaleDegrees();
            h = notesPerOctave * octaves * noteHeight;
        }

        int maxW = this.getParent().getWidth();

        for (int i = 0; i < getComponentCount(); i++) {
            Component comp = getComponent(i);
            int right = comp.getX() + comp.getWidth() + RIGHT_EXTRA_SPACE;
            if (right > maxW) {
                maxW = right;
            }
        }

        this.setSize(maxW, h);
        this.setPreferredSize(new Dimension(maxW, h));
    }

    @Override
    public void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g;

        g.setColor(this.getBackground());
        g.fillRect(0, 0, this.getWidth(), this.getHeight());

        if (p == null) {
            return;
        }

        int w = this.getWidth();

        int h;
        int octaveHeight;
        int notesPerOctave;

        int noteHeight = p.getNoteHeight();

        if (p.getPchGenerationMethod() == PianoRoll.GENERATE_MIDI) {
            h = 128 * noteHeight;
            octaveHeight = noteHeight * 12;
            notesPerOctave = 12;
        } else {
            notesPerOctave = p.getScale().getNumScaleDegrees();

            octaveHeight = notesPerOctave * noteHeight;

            h = octaves * octaveHeight;
        }

        for (int i = 0; i < octaves; i++) {
            int lineY = h - (i * octaveHeight);

            Color lightColor = new Color(38, 51, 76).darker().darker();
            Color darkColor = lightColor.darker();

            GradientPaint backgroundPaint = new GradientPaint(0, lineY,
                    darkColor, 1, lineY - octaveHeight, lightColor);
            g2d.setPaint(backgroundPaint);
            g2d.fillRect(0, lineY - octaveHeight, w, octaveHeight);

            g.setColor(OCTAVE_COLOR);

            g.drawLine(0, lineY, w, lineY);

            g.setColor(LINE_COLOR);

            for (int j = 1; j < notesPerOctave; j++) {
                lineY = h - (((i * notesPerOctave) + j) * noteHeight);
                g.drawLine(0, lineY, w, lineY);
            }
        }

        if (p.isSnapEnabled()) {
            int snapPixels = (int) (p.getSnapValue() * p.getPixelSecond());

            int x = 0;
            if (snapPixels <= 0) {
                return;
            }

            double snapValue = p.getSnapValue();
            int pixelSecond = p.getPixelSecond();
            double time;

            for (int i = 0; x < w; i++) {
                x = (int) ((i * snapValue) * pixelSecond);
                g.drawLine(x, 0, x, h);
            }

        }

    }

    public void editPianoRoll(PianoRoll p) {

        if (this.p == p) {
            return;
        }

        if (this.p != null) {
            this.p.removePropertyChangeListener(this);
            this.p.getNotes().removeListener(this);
        }

        p.addPropertyChangeListener(this);
        p.getNotes().addListener(this);

        this.p = p;

        this.removeAll();

        this.add(marquee, JLayeredPane.DRAG_LAYER);
        marquee.setVisible(false);

        for (PianoNote note : p.getNotes()) {
            addNoteView(note);
        }

        selectedNotes.clear();

        recalculateSize();
        revalidate();
        repaint();
    }

    /**
     * @param x
     * @param y
     */
    public PianoNote addNote(double startTime, int y) {
        PianoNote note = new PianoNote();
        note.setNoteTemplate(p.getNoteTemplate());
        note.setStart(startTime);

        for (var fd : p.getFieldDefinitions()) {
            var f = new Field(fd);
            note.getFields().add(f);
        }

        int[] pch = getOctaveScaleDegreeForY(y);
        note.setOctave(pch[0]);
        note.setScaleDegree(pch[1]);

        p.getNotes().add(note);

        return note;
    }

    public int[] getOctaveScaleDegreeForY(int y) {
        int[] retVal = new int[2];

        int h = getHeight() - y;
        int noteHeight = p.getNoteHeight();

        h = h / noteHeight;
        int numScaleDegrees = p.getScale().getNumScaleDegrees();
        retVal[0] = h / numScaleDegrees;
        retVal[1] = h % numScaleDegrees;

        return retVal;
    }

    /**
     * @param note
     */
    private PianoNoteView addNoteView(PianoNote note) {
        PianoNoteView noteView = new PianoNoteView(note, p, selectedNotes);
        this.add(noteView);
        return noteView;
    }

    /* EVENT LISTENER CODE */
    @Override
    public void propertyChange(PropertyChangeEvent evt) {

        if (evt.getSource() == this.p) {

            String propertyName = evt.getPropertyName();
            switch (propertyName) {
                case "scale":
                case "pchGenerationMethod":
                    recalculateSize();
                    revalidate();
                    repaint();
                    break;
                case "snapEnabled":
                case "snapValue":
                    repaint();
                    break;
                case "timeValue":
                    break;
                case "pixelSecond":
                case "noteHeight":
                    repaint();
                    break;
            }

        }

    }

    // IMPLEMENTATION FOR SCROLLABLE
    int maxUnitIncrement = 50;

    @Override
    public Dimension getPreferredScrollableViewportSize() {
        return getPreferredSize();
    }

    @Override
    public int getScrollableUnitIncrement(Rectangle visibleRect,
            int orientation, int direction) {
        // Get the current position.
        int currentPosition = 0;
        if (orientation == SwingConstants.HORIZONTAL) {
            currentPosition = visibleRect.x;
        } else {
            return p.getNoteHeight();
            // currentPosition = visibleRect.y;
        }

        // Return the number of pixels between currentPosition
        // and the nearest tick mark in the indicated direction.
        if (direction < 0) {
            int newPosition = currentPosition
                    - (currentPosition / maxUnitIncrement) * maxUnitIncrement;
            return (newPosition == 0) ? maxUnitIncrement : newPosition;
        }

        return ((currentPosition / maxUnitIncrement) + 1) * maxUnitIncrement
                - currentPosition;

    }

    @Override
    public int getScrollableBlockIncrement(Rectangle visibleRect,
            int orientation, int direction) {

        if (orientation == SwingConstants.HORIZONTAL) {
            return visibleRect.width - maxUnitIncrement;
        }

        // return visibleRect.height - maxUnitIncrement;
        return p.getNoteHeight() * 5;
    }

    @Override
    public boolean getScrollableTracksViewportWidth() {
        return false;
    }

    @Override
    public boolean getScrollableTracksViewportHeight() {
        return false;
    }

    /**
     * @return
     */
    public int getNoteHeight() {
        if (p == null) {
            return 0;
        }

        return p.getNoteHeight();
    }

    /**
     * @param x
     * @param y
     */
    public void showPopup(int x, int y) {
        popup.show(this, x, y);
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
    public void onChanged(Change<? extends PianoNote> change) {
        while (change.next()) {
            if (change.wasAdded()) {
                for (var note : change.getAddedSubList()) {
                    addNoteView(note);
                }
            } else if (change.wasRemoved()) {
                // TODO - Improve algorithm as this performance is not good
                for (var note : change.getRemoved()) {
                    for (var c : getComponents()) {
                        if (c instanceof PianoNoteView) {
                            var pnv = (PianoNoteView) c;

                            if (pnv.getPianoNote() == note) {
                                remove(pnv);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}
