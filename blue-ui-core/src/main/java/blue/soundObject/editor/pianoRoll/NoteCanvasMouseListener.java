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
import blue.soundObject.pianoRoll.PianoNote;
import blue.soundObject.pianoRoll.Scale;
import blue.ui.utilities.UiUtilities;
import blue.utility.ListUtil;
import blue.utility.ScoreUtilities;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.List;
import javafx.collections.ObservableList;
import javax.swing.AbstractAction;
import javax.swing.JPopupMenu;
import javax.swing.JViewport;
import javax.swing.SwingUtilities;

/**
 * @author steven
 */
public class NoteCanvasMouseListener extends MouseAdapter {

    private static final int EDGE = 5;

    private static final int OS_CTRL_KEY = BlueSystem.getMenuShortcutKey();

    private final PianoRollCanvas canvas;
    private final ObservableList<PianoNote> selectedNotes;

    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);
    private Point start = null;

    private JPopupMenu pasteMenu = new JPopupMenu();
    Point pastePoint = new Point(0, 0);

    private NoteSourceData noteSourceData = new NoteSourceData();
    private PianoNote mouseNote = null;
    private ResizeMode resizeMode = ResizeMode.NONE;

    public NoteCanvasMouseListener(PianoRollCanvas canvas, ObservableList<PianoNote> selectedNotes) {
        this.canvas = canvas;
        this.selectedNotes = selectedNotes;

        canvas.addMouseListener(this);
        canvas.addMouseMotionListener(this);

        pasteMenu.add(new AbstractAction("Paste") {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (PianoRollCanvas.NOTE_COPY_BUFFER.size() > 0) {
                    pasteNotes(pastePoint);
                }
            }
        });
    }
    
    
    @Override
    public void mousePressed(MouseEvent e) {
        canvas.requestFocus();
        Component comp = canvas.getComponentAt(e.getPoint());
        
        resizeMode = ResizeMode.NONE;

        if (UiUtilities.isRightMouseButton(e)) {
            if (comp instanceof PianoNoteView) {
                var pnv = (PianoNoteView) comp;

                if (ListUtil.containsByRef(selectedNotes, pnv.getPianoNote())) {
                    canvas.showPopup(e.getX(), e.getY());
                }

            } else if (!PianoRollCanvas.NOTE_COPY_BUFFER.isEmpty()) {
                pastePoint = e.getPoint();
                pasteMenu.show(canvas, pastePoint.x, pastePoint.y);
            }
        } else if (SwingUtilities.isLeftMouseButton(e)) {
            if (comp instanceof PianoNoteView) {
                var noteView = (PianoNoteView) comp;
                var note = noteView.getPianoNote();

                if (e.getX() > noteView.getX() + noteView.getWidth() - EDGE) {

                    resizeMode = ResizeMode.RESIZE_RIGHT;
                    if(!selectedNotes.contains(note)) {
                        selectedNotes.add(note);
                    }

                    noteSourceData.setupData(selectedNotes, canvas.p.getScale());
                    mouseNote = note;

                    start = new Point(
                            noteView.getX() + noteView.getWidth(), e.getY());
                } else if (ListUtil.containsByRef(selectedNotes, note)) {
                    if (e.isShiftDown() && selectedNotes.size() > 0) {
                        ListUtil.removeByRef(selectedNotes, note);
                    } else {
                        start = e.getPoint();

                        noteSourceData.setupData(selectedNotes, canvas.p.getScale());

                    }
                } else {
                    start = null;

                    if (e.isShiftDown()) {

                        selectedNotes.add(note);

                    } else {
                        selectedNotes.clear();
                        selectedNotes.add(note);
                    }
                }

            } else if (((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY) && !e.isShiftDown()) {
                if (PianoRollCanvas.NOTE_COPY_BUFFER.isEmpty()) {
                    return;
                }

                pasteNotes(e.getPoint());

            } else if (e.isShiftDown() && ((e.getModifiers() & OS_CTRL_KEY) != OS_CTRL_KEY)) {
                selectedNotes.clear();
                // start = null;

                int x = e.getX();
                int y = e.getY();

                var pixelSecond = canvas.p.getPixelSecond();

                double startTime = (double) x / pixelSecond;
                double duration = 5.0f / canvas.p.getPixelSecond();

                if (canvas.p.isSnapEnabled()) {
                    double snapValue = canvas.p.getSnapValue();
                    startTime = ScoreUtilities.getSnapValueStart(startTime, snapValue);

                    duration = canvas.p.getSnapValue();
                }

                var note = canvas.addNote(startTime, y);

                note.setDuration(duration);

                start = new Point(e.getX() + (int) Math.round(duration * pixelSecond), y);

                selectedNotes.add(note);
                noteSourceData.setupData(selectedNotes, canvas.p.getScale());
                mouseNote = note;

                resizeMode = ResizeMode.RESIZE_RIGHT;

            } else {
                selectedNotes.clear();
                start = null;

                canvas.marquee.setStart(e.getPoint());
                canvas.marquee.setVisible(true);
            }
        }
    }

    private void pasteNotes(Point p) {
        int x = p.x;
        int y = p.y;

        double startTime = (double) x / canvas.p.getPixelSecond();
        int[] pchBase = canvas.getOctaveScaleDegreeForY(y);
        double timeAdjust = Double.MAX_VALUE;
        int topPitchNum = Integer.MIN_VALUE;
        int bottomPitchNum = Integer.MAX_VALUE;
        int scaleDegrees = canvas.p.getScale().getNumScaleDegrees();

        if (canvas.p.isSnapEnabled()) {
            double snapValue = canvas.p.getSnapValue();
            startTime = ScoreUtilities.getSnapValueStart(startTime, snapValue);
        }

        for (PianoNote note : PianoRollCanvas.NOTE_COPY_BUFFER) {
            timeAdjust = Math.min(timeAdjust, note.getStart());
            int pitchNum = note.getOctave() * scaleDegrees + note.getScaleDegree();
            topPitchNum = Math.max(topPitchNum, pitchNum);
            bottomPitchNum = Math.min(bottomPitchNum, pitchNum);
        }

        selectedNotes.clear();
        start = null;

        int basePitchNum = pchBase[0] * scaleDegrees + pchBase[1];
        int pitchNumAdjust = basePitchNum - topPitchNum;
        var pianoRollNotes = canvas.p.getNotes();

        for (PianoNote note : PianoRollCanvas.NOTE_COPY_BUFFER) {
            PianoNote copy = new PianoNote(note);
            copy.setStart(startTime + (copy.getStart() - timeAdjust));

            int pitchNum = copy.getOctave() * scaleDegrees + copy.getScaleDegree();
            pitchNum += pitchNumAdjust;

            copy.setOctave(pitchNum / scaleDegrees);
            copy.setScaleDegree(pitchNum % scaleDegrees);

            selectedNotes.add(copy);
            pianoRollNotes.add(copy);
        }
    }


    /*
     * (non-Javadoc)
     * 
     * @see java.awt.event.MouseMotionListener#mouseDragged(java.awt.event.MouseEvent)
     */
    @Override
    public void mouseDragged(MouseEvent e) {

        if (canvas.marquee.isVisible()) {
            canvas.marquee.setDragPoint(e.getPoint());
            checkScroll(e);
            return;
        }

        if (start == null) {
            return;
        }

        switch(resizeMode) {
            case RESIZE_LEFT:
                break;
            case RESIZE_RIGHT:
                resizeNote(e);
                break;
            case NONE:
                moveNotes(e);
                break;
        }
        
        checkScroll(e);
    }

    
    @Override
    public void mouseReleased(MouseEvent e) {
        if (canvas.marquee.isVisible()) {
            endMarquee();
        }

        start = null;
        noteSourceData.clear();
    }

    
    
    private void checkScroll(MouseEvent e) {
        Point temp = SwingUtilities.convertPoint(canvas, e.getPoint(), canvas
                .getParent());
        scrollRect.setLocation(temp);
        ((JViewport) (canvas.getParent())).scrollRectToVisible(scrollRect);
    }

    private void moveNotes(MouseEvent e) {
        final int noteHeight = canvas.getNoteHeight();

        final int diffX = e.getPoint().x - start.x;
        final int baseNoteNumDiff = (start.y / noteHeight) - (e.getPoint().y / noteHeight);

        final var pianoRoll = canvas.p;
        final var scale = pianoRoll.getScale();

        final int maxNoteNum = 16 * scale.getNumScaleDegrees() - 1;
        final int noteNumAdjust = Math.max(-noteSourceData.bottomScaleNoteNum,
                Math.min(maxNoteNum - noteSourceData.topScaleNoteNum, baseNoteNumDiff));

        final double baseAdjust = (double) diffX / canvas.p.getPixelSecond();
        final double timeAdjust;

        if (baseAdjust + noteSourceData.noteSourceStart < 0.0) {
            timeAdjust = -noteSourceData.noteSourceStart;
        } else if (pianoRoll.isSnapEnabled()) {
            double snappedStart = ScoreUtilities.getSnapValueMove(
                    noteSourceData.noteSourceStart + baseAdjust,
                    canvas.p.getSnapValue());

            timeAdjust = snappedStart - noteSourceData.noteSourceStart;
        } else {
            timeAdjust = baseAdjust;
        }

        for (final var nd : noteSourceData.noteSourceData) {
            final var note = nd.pianoNote;
            note.setStart(nd.originStart + timeAdjust);

            final var noteNum = nd.octave * scale.getNumScaleDegrees() + nd.scaleDegree;
            var newNoteNum = noteNum + noteNumAdjust;
            var newOct = newNoteNum / scale.getNumScaleDegrees();
            var newScaleDegree = newNoteNum % scale.getNumScaleDegrees();

            note.setOctave(newOct);
            note.setScaleDegree(newScaleDegree);
        }

    }

    // TODO - make resize work with multiple notes
    private void resizeNote(MouseEvent e) {
        final int mouseX = e.getX();
        final var pixelSecond = canvas.p.getPixelSecond();
        final var snapEnabled = canvas.p.isSnapEnabled();

        final var minDur = (EDGE) / (double) pixelSecond;

        var timeAdjust = (mouseX - start.x) / (double) pixelSecond;
        timeAdjust = Math.max(timeAdjust, noteSourceData.minTimeAdjust + minDur);

        if (snapEnabled) {
            double snapValue = canvas.p.getSnapValue();
            var mouseNsd = noteSourceData.noteSourceData.stream()
                    .filter(nsd -> nsd.pianoNote == mouseNote).findFirst();
            var nsd = mouseNsd.get();
            var originEnd = nsd.originStart + nsd.originDuration;
            var snapEndTime = ScoreUtilities.getSnapValueMove(
                    originEnd + timeAdjust,
                    snapValue
            );

            var newTimeAdjust = snapEndTime - originEnd;
            
            timeAdjust = (newTimeAdjust < timeAdjust) ? newTimeAdjust + snapValue : newTimeAdjust;
        }

        for (var nsd : noteSourceData.noteSourceData) {
            var note = nsd.pianoNote;
            double newDuration = nsd.originDuration + timeAdjust;
            note.setDuration(newDuration);
        }

    }

    /*
     * (non-Javadoc)
     * 
     * @see java.awt.event.MouseMotionListener#mouseMoved(java.awt.event.MouseEvent)
     */
    @Override
    public void mouseMoved(MouseEvent e) {
        Component comp = canvas.getComponentAt(e.getPoint());
        if (comp instanceof PianoNoteView) {

            if (e.getX() > (comp.getX() + comp.getWidth() - EDGE)) {
                comp.setCursor(Cursor.getPredefinedCursor(Cursor.E_RESIZE_CURSOR));
            } else {
                comp.setCursor(Cursor.getDefaultCursor());
            }
        } 
    }

    public void endMarquee() {
        canvas.marquee.setVisible(false);

        Component[] comps = canvas.getComponents();

        selectedNotes.clear();

        for (int i = 0; i < comps.length; i++) {
            if (!(comps[i] instanceof PianoNoteView)) {
                continue;
            }

            var pnv = (PianoNoteView) comps[i];

            if (canvas.marquee.intersects(pnv)) {
                selectedNotes.add(pnv.getPianoNote());
            }

        }

        canvas.marquee.setSize(1, 1);
        canvas.marquee.setLocation(-1, -1);

    }

    static class NoteSourceData {

        public final List<NoteData> noteSourceData = new ArrayList<>();
        public double noteSourceStart = 0.0;
        public double minTimeAdjust = 0.0;
        public int topScaleNoteNum = 0;
        public int bottomScaleNoteNum = 0;

        /**
         * Sets up data cache for notes at their original times/pitches
         */
        public void setupData(List<PianoNote> selectedNotes, Scale scale) {

            var numScaleDegrees = scale.getNumScaleDegrees();

            noteSourceData.clear();
            noteSourceStart = Double.POSITIVE_INFINITY;
            minTimeAdjust = Double.NEGATIVE_INFINITY;

            topScaleNoteNum = Integer.MIN_VALUE;
            bottomScaleNoteNum = Integer.MAX_VALUE;

            for (var note : selectedNotes) {
                var noteNum = note.getOctave() * numScaleDegrees + note.getScaleDegree();
                noteSourceData.add(new NoteData(note));
                noteSourceStart = Math.min(noteSourceStart, note.getStart());
                minTimeAdjust = Math.max(minTimeAdjust, -note.getDuration());

                topScaleNoteNum = Math.max(topScaleNoteNum, noteNum);
                bottomScaleNoteNum = Math.min(bottomScaleNoteNum, noteNum);
            }
        }

        public void clear() {
            noteSourceData.clear();
            noteSourceStart = 0.0;
            minTimeAdjust = 0.0;
            topScaleNoteNum = 0;
            bottomScaleNoteNum = 0;
        }

    }

    static class NoteData {

        public final PianoNote pianoNote;
        public final double originStart;
        public final double originDuration;
        public final int octave;
        public final int scaleDegree;

        public NoteData(PianoNote pianoNote) {
            this.pianoNote = pianoNote;
            this.originStart = pianoNote.getStart();
            this.originDuration = pianoNote.getDuration();
            this.octave = pianoNote.getOctave();
            this.scaleDegree = pianoNote.getScaleDegree();
        }

    }
    
    static enum ResizeMode {
        NONE, RESIZE_LEFT, RESIZE_RIGHT,
    }
}
