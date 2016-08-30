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

import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.soundObject.PianoRoll;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.HashMap;
import javax.swing.JComponent;

/**
 * @author steven
 */

public class PianoRollCanvasHeader extends JComponent implements
        PropertyChangeListener, SelectionListener<PianoNoteView> {

    private static final Font labelFont = new Font("Dialog", Font.PLAIN, 10);

    private static final String[] NOTE_NAMES = { "C", "C#/Db", "D", "D#/Eb",
            "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B" };

    int octaves = 16;

    int centerOctave = 8;

    private static Color OCTAVE_COLOR = new Color(198, 226, 255);

    private PianoRoll p;

    private HashMap<PianoNoteView, SelectedNoteHighlighter> noteHilightMap =
            new HashMap<>();

    public PianoRollCanvasHeader() {
        // this.setBackground(Color.darkGray);
        setSizeForScale();
        this.setLayout(null);
    }

    private void setSizeForScale() {
        if (p == null) {
            return;
        }

        int notesPerOctave = p.getScale().getNumScaleDegrees();
        int noteHeight = p.getNoteHeight();

        this.setSize(32, octaves * notesPerOctave * noteHeight);
        this.setPreferredSize(new Dimension(32, octaves * notesPerOctave
                * noteHeight));
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);

        g.setFont(labelFont);

        g.setColor(this.getBackground());
        g.fillRect(0, 0, this.getWidth(), this.getHeight());

        if (this.p == null) {
            return;
        }

        if (p.getPchGenerationMethod() == PianoRoll.GENERATE_MIDI) {
            drawMIDI(g);
        } else {
            drawScale(g);
        }

    }

    private void drawMIDI(Graphics g) {
        int notesPerOctave = 12;

        int noteHeight = p.getNoteHeight();
        int h = 128 * noteHeight;
        int w = this.getWidth();

        g.setColor(OCTAVE_COLOR);
        g.drawLine(w - 1, 0, w - 1, h);

        for (int i = 0; i < octaves; i++) {
            int lineY = h - (i * notesPerOctave * noteHeight);

            g.drawLine(0, lineY, w, lineY);

            String label = "C" + i;

            int labelW = g.getFontMetrics().stringWidth(label);
            int labelX = w - labelW - 2;

            g.setColor(OCTAVE_COLOR);
            g.drawString(label, labelX, lineY - 2);

            g.setColor(OCTAVE_COLOR.darker());

            for (int j = 1; j < notesPerOctave; j++) {
                int noteY = lineY - (j * noteHeight);
                g.drawLine(w - 4, noteY, w, noteY);

                String noteLabel = NOTE_NAMES[j];

                labelW = g.getFontMetrics().stringWidth(noteLabel);
                labelX = w - labelW - 2;
                g.drawString(noteLabel, labelX, noteY - 2);
            }

        }
    }

    /**
     * @param g
     */
    private void drawScale(Graphics g) {
        int notesPerOctave = p.getScale().getNumScaleDegrees();

        int noteHeight = p.getNoteHeight();
        int h = octaves * notesPerOctave * noteHeight;
        int w = this.getWidth();

        g.setColor(OCTAVE_COLOR);
        g.drawLine(w - 1, 0, w - 1, h);

        for (int i = 0; i < octaves; i++) {
            int lineY = h - (i * notesPerOctave * noteHeight);

            g.drawLine(0, lineY, w, lineY);

            String label = i + ".00";

            int labelW = g.getFontMetrics().stringWidth(label);
            int labelX = w - labelW - 2;

            g.drawString(i + ".00", labelX, lineY - 2);

            for (int j = 1; j < notesPerOctave; j++) {
                int noteY = lineY - (j * noteHeight);
                g.drawLine(w - 4, noteY, w, noteY);

                String noteLabel = Integer.toString(j);
                if (noteLabel.length() == 1) {
                    noteLabel = "0" + noteLabel;
                }

                labelW = g.getFontMetrics().stringWidth(noteLabel);
                labelX = w - labelW - 2;
                g.drawString(noteLabel, labelX, noteY - 2);
            }

        }
    }

    /**
     * @param p
     */
    public void editPianoRoll(PianoRoll p) {
        if (this.p != null) {
            this.p.removePropertyChangeListener(this);
        }

        this.p = p;

        this.p.addPropertyChangeListener(this);

        this.p = p;
        setSizeForScale();
        repaint();
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.p) {
            String propertyName = evt.getPropertyName();

            if (propertyName.equals("scale")
                    || propertyName.equals("noteHeight")) {
                setSizeForScale();
                revalidate();
                repaint();
            }
        }
    }

    @Override
    public void selectionPerformed(SelectionEvent<PianoNoteView> e) {
        PianoNoteView pnv = e.getSelectedItem();
        SelectedNoteHighlighter snh;

        switch (e.getSelectionType()) {
            case SelectionEvent.SELECTION_CLEAR:
                for(SelectedNoteHighlighter tempSnh : noteHilightMap.values()) {
                    tempSnh.cleanup();
                }
                noteHilightMap.clear();
                this.removeAll();
                repaint();

                break;

            case SelectionEvent.SELECTION_SINGLE:
                for(SelectedNoteHighlighter tempSnh : noteHilightMap.values()) {
                    tempSnh.cleanup();
                }
                noteHilightMap.clear();
                this.removeAll();

                snh = new SelectedNoteHighlighter(pnv);
                snh.setLocation(0, pnv.getY());

                this.add(snh);
                noteHilightMap.put(pnv, snh);

                repaint();

                break;

            case SelectionEvent.SELECTION_ADD:
                snh = new SelectedNoteHighlighter(pnv);
                snh.setLocation(0, pnv.getY());

                this.add(snh);
                noteHilightMap.put(pnv, snh);

                repaint();

                break;
                
            case SelectionEvent.SELECTION_REMOVE:
                snh = noteHilightMap.get(pnv);

                this.remove(snh);

                if (snh != null) {
                    noteHilightMap.remove(pnv);
                    snh.cleanup();
                }

                break;
        }
    }

}