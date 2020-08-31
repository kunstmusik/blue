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
import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.PianoNote;
import blue.soundObject.pianoRoll.Scale;
import blue.ui.utilities.UiUtilities;
import blue.utility.ListUtil;
import blue.utility.ScoreUtilities;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.KeyboardFocusManager;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javafx.beans.property.ObjectProperty;
import javafx.collections.ObservableList;
import javax.swing.AbstractAction;
import javax.swing.JPopupMenu;
import javax.swing.JViewport;
import javax.swing.SwingUtilities;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;

/**
 * @author steven
 */
public class NoteCanvasMouseListener extends MouseAdapter {

    private static final int EDGE = 5;

    private static final int OS_CTRL_KEY = BlueSystem.getMenuShortcutKey();

    private final PianoRollCanvas canvas;
    private final ObservableList<PianoNote> selectedNotes;
    private final ObjectProperty<FieldDef> selectedFieldDef;

    private final Rectangle scrollRect = new Rectangle(0, 0, 1, 1);
    private Point start = null;

    private final JPopupMenu pasteMenu = new JPopupMenu();
    Point pastePoint = new Point(0, 0);

    private final NoteSourceData noteSourceData = new NoteSourceData();
    private PianoNote mouseNote = null;
    private DragMode dragMode = DragMode.NONE;

    // data for field editing
    private double[] originalValues = null;
    private Field[] affectedFields = null;

    Cursor canvasCursor = Cursor.getDefaultCursor();
    PianoNoteView mouseMoveNoteView = null;
    boolean noteJustAdded = false;

    public NoteCanvasMouseListener(PianoRollCanvas canvas,
            ObservableList<PianoNote> selectedNotes,
            ObjectProperty<FieldDef> selectedFieldDef) {
        this.canvas = canvas;
        this.selectedNotes = selectedNotes;
        this.selectedFieldDef = selectedFieldDef;

        canvas.addMouseListener(this);
        canvas.addMouseMotionListener(this);

        pasteMenu.add(new AbstractAction("Paste") {
            @Override
            public void actionPerformed(ActionEvent e) {
                var buffer = NoteCopyBuffer.getInstance();
                if (!buffer.getCopiedNotes().isEmpty()) {
                    pasteNotes(pastePoint);
                }
            }
        });

        // TODO: enable/disable only when visible?
        KeyboardFocusManager.getCurrentKeyboardFocusManager().addKeyEventDispatcher(key -> {
            if (dragMode == DragMode.NONE && mouseMoveNoteView != null) {

                Cursor c = mouseMoveNoteView.getCursor();

                if (c != Cursor.getPredefinedCursor(Cursor.E_RESIZE_CURSOR)
                        && c != Cursor.getPredefinedCursor(Cursor.W_RESIZE_CURSOR)) {
                    if ((key.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY && selectedFieldDef.getValue() != null) {
                        mouseMoveNoteView.setCursor(Cursor.getPredefinedCursor(Cursor.S_RESIZE_CURSOR));
                        canvas.setCursor(Cursor.getPredefinedCursor(Cursor.S_RESIZE_CURSOR));
                    } else {
                        mouseMoveNoteView.setCursor(Cursor.getDefaultCursor());
                        canvas.setCursor(canvasCursor);
                    }
                }

            } else {
                canvasCursor = key.isShiftDown() ? Cursor.getPredefinedCursor(Cursor.CROSSHAIR_CURSOR) : Cursor.getDefaultCursor();

                if (dragMode == DragMode.NONE) {
                    canvas.setCursor(canvasCursor);
                }
            }

            return false;
        });
    }

    @Override
    public void mousePressed(MouseEvent e) {
        canvas.requestFocus();
        Component comp = canvas.getComponentAt(e.getPoint());

        dragMode = DragMode.NONE;
        noteJustAdded = false;

        final var buffer = NoteCopyBuffer.getInstance();

        if (UiUtilities.isRightMouseButton(e)) {
            if (comp instanceof PianoNoteView) {
                var pnv = (PianoNoteView) comp;

                if (ListUtil.containsByRef(selectedNotes, pnv.getPianoNote())) {
                    canvas.showPopup(e.getX(), e.getY());
                }

            } else if (!buffer.getCopiedNotes().isEmpty()) {
                pastePoint = e.getPoint();
                pasteMenu.show(canvas, pastePoint.x, pastePoint.y);
            }
        } else if (SwingUtilities.isLeftMouseButton(e)) {
            if (comp instanceof PianoNoteView) {
                var noteView = (PianoNoteView) comp;
                var note = noteView.getPianoNote();

                if ((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY && selectedFieldDef.getValue() != null) {
                    // MODIFY NOTE FIELD DATA
                    var fieldDef = selectedFieldDef.getValue();

                    if (!selectedNotes.contains(note)) {
                        selectedNotes.add(note);
                    }

                    start = e.getPoint();
                    dragMode = DragMode.FIELD_EDIT;

                    originalValues = new double[selectedNotes.size()];
                    affectedFields = new Field[selectedNotes.size()];

                    for (int i = 0; i < selectedNotes.size(); i++) {
                        var n = selectedNotes.get(i);
                        // If this throws an exception, let it get reported higher up
                        var field = n.getField(fieldDef).get();
                        affectedFields[i] = field;
                        originalValues[i] = field.getValue();
                    }

                } else if (e.getX() > noteView.getX() + noteView.getWidth() - EDGE) {
                    // RESIZE NOTES RIGHT
                    dragMode = DragMode.RESIZE_RIGHT;
                    if (!selectedNotes.contains(note)) {
                        selectedNotes.add(note);
                    }

                    noteSourceData.setupData(selectedNotes, canvas.p.getScale());
                    mouseNote = note;

                    start = new Point(
                            noteView.getX() + noteView.getWidth(), e.getY());
                } else if (e.getX() >= comp.getX() && e.getX() <= comp.getX() + EDGE) {
                    // RESIZE NOTES RIGHT
                    dragMode = DragMode.RESIZE_LEFT;
                    if (!selectedNotes.contains(note)) {
                        selectedNotes.add(note);
                    }

                    noteSourceData.setupData(selectedNotes, canvas.p.getScale());
                    mouseNote = note;

                    start = e.getPoint();
                } else if (selectedNotes.contains(note)) {
                    if (e.isShiftDown() && selectedNotes.size() > 0) {
                        // DESELECT NOTE
                        selectedNotes.remove(note);
                    } else {
                        // START MOVE
                        start = e.getPoint();
                        dragMode = DragMode.MOVE;

                        noteSourceData.setupData(selectedNotes, canvas.p.getScale());

                    }
                } else {
                    // SELECT NOTE
                    start = null;

                    if (e.isShiftDown()) {

                        selectedNotes.add(note);

                    } else {
                        selectedNotes.clear();
                        selectedNotes.add(note);
                    }
                }

            } else if (((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY) && !e.isShiftDown()) {
                // PASTE NOTES

                if (buffer.getCopiedNotes().isEmpty()) {
                    return;
                }

                pasteNotes(e.getPoint());

            } else if (e.isShiftDown() && ((e.getModifiers() & OS_CTRL_KEY) != OS_CTRL_KEY)) {
                // DRAW NOTES

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

                dragMode = DragMode.RESIZE_RIGHT;
                noteJustAdded = true;

            } else {
                // MARQUEE SELECT NOTES
                dragMode = DragMode.SELECTING;
                selectedNotes.clear();
                start = null;

                canvas.marquee.setStart(e.getPoint());
                canvas.marquee.setVisible(true);
            }
        }
    }

    private void pasteNotes(Point p) {
        final var buffer = NoteCopyBuffer.getInstance();
        final var sourcePianoRoll = buffer.getSourcePianoRoll();
        final var currentPianoRoll = canvas.p;
        final Map<FieldDef, FieldDef> srcToTargetMap = new HashMap<>();

        if (!currentPianoRoll.isCompatible(sourcePianoRoll)) {
            var nd = new NotifyDescriptor("Unable to paste notes as source and target PianoRolls are not compatible.",
                    "Paste Error", NotifyDescriptor.DEFAULT_OPTION,
                    NotifyDescriptor.ERROR_MESSAGE,
                    null, null);
            DialogDisplayer.getDefault().notify(nd);
            return;
        }

        if (sourcePianoRoll != currentPianoRoll) {
            var aDefs = sourcePianoRoll.getFieldDefinitions();
            var bDefs = currentPianoRoll.getFieldDefinitions();
            
            for (int i = 0; i < aDefs.size(); i++) {
                srcToTargetMap.put(aDefs.get(i), bDefs.get(i));
            }
        }

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

        for (PianoNote note : buffer.getCopiedNotes()) {
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

        for (PianoNote note : buffer.getCopiedNotes()) {
            PianoNote copy = new PianoNote(note);
            
            // ensure field defs relinked if pasting to a different PianoRoll
            if(!srcToTargetMap.isEmpty()) {
                for(var f : copy.getFields()) {
                    var fd = srcToTargetMap.get(f.getFieldDef());
                    f.setFieldDef(fd);
                }
            }
            
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
        if (dragMode == DragMode.NONE) {
            return;
        }

        switch (dragMode) {
            case SELECTING:
                canvas.marquee.setDragPoint(e.getPoint());
                break;
            case FIELD_EDIT:
                modifyFields(e);
                break;
            case RESIZE_LEFT:
                resizeNotesLeft(e);
                break;
            case RESIZE_RIGHT:
                resizeNotesRight(e);
                break;
            case MOVE:
                moveNotes(e);
                break;
        }

        if (dragMode != DragMode.FIELD_EDIT) {
            checkScroll(e);
        }
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        if (canvas.marquee.isVisible()) {
            endMarquee();
        }

        Component comp = canvas.getComponentAt(e.getPoint());

        if (!(comp instanceof PianoNoteView)) {
            canvas.setCursor(canvasCursor);
        }

        start = null;
        noteSourceData.clear();
        dragMode = DragMode.NONE;
        noteJustAdded = false;
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

        var snapEnabled = pianoRoll.isSnapEnabled();

        if (baseAdjust + noteSourceData.noteSourceStart < 0.0) {
            timeAdjust = -noteSourceData.noteSourceStart;
        } else if (snapEnabled && !e.isShiftDown()
                || e.isShiftDown() && !snapEnabled) {
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

    private void resizeNotesLeft(MouseEvent e) {
        final int mouseX = e.getX();
        final var pixelSecond = canvas.p.getPixelSecond();
        final var snapEnabled = canvas.p.isSnapEnabled();

        final var minDur = (EDGE) / (double) pixelSecond;

        // timeAdjust add to start time of original note, duration 
        // adjusted to match original end
        var timeAdjust = (mouseX - start.x) / (double) pixelSecond;

        // don't adjust so that it goes below 0
        timeAdjust = Math.max(-noteSourceData.noteSourceStart, timeAdjust);

        // don't adjust so that it makes any note smaller that EDGE size
        final var minTimeAdjust = -noteSourceData.minTimeAdjust - minDur;
        timeAdjust = Math.min(timeAdjust, minTimeAdjust);

        if (snapEnabled && !e.isShiftDown()
                || e.isShiftDown() && !snapEnabled) {
            double snapValue = canvas.p.getSnapValue();
            var mouseNsd = noteSourceData.noteSourceData.stream()
                    .filter(nsd -> nsd.pianoNote == mouseNote).findFirst();
            var nsd = mouseNsd.get();

            var snapStartTime = ScoreUtilities.getSnapValueMove(
                    nsd.originStart + timeAdjust,
                    snapValue
            );

            var newTimeAdjust = snapStartTime - nsd.originStart;

            timeAdjust = newTimeAdjust;
            timeAdjust = (newTimeAdjust > minTimeAdjust) ? newTimeAdjust - snapValue : newTimeAdjust;
        }

        for (var nsd : noteSourceData.noteSourceData) {
            var note = nsd.pianoNote;
            var originEnd = nsd.originStart + nsd.originDuration;

            double newStart = nsd.originStart + timeAdjust;
            double newDuration = originEnd - newStart;
            note.setStart(newStart);
            note.setDuration(newDuration);
        }

    }

    private void resizeNotesRight(MouseEvent e) {
        final int mouseX = e.getX();
        final var pixelSecond = canvas.p.getPixelSecond();
        final var snapEnabled = canvas.p.isSnapEnabled();

        final var minDur = (EDGE) / (double) pixelSecond;

        var timeAdjust = (mouseX - start.x) / (double) pixelSecond;
        timeAdjust = Math.max(timeAdjust, noteSourceData.minTimeAdjust + minDur);

        var processSnap = noteJustAdded ? snapEnabled
                : (snapEnabled && !e.isShiftDown() || e.isShiftDown() && !snapEnabled);

        if (processSnap) {
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
            mouseMoveNoteView = (PianoNoteView) comp;
            var x = e.getX();

            if ((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY
                    && selectedFieldDef.getValue() != null) {
                comp.setCursor(Cursor.getPredefinedCursor(Cursor.S_RESIZE_CURSOR));
                canvas.setCursor(Cursor.getPredefinedCursor(Cursor.S_RESIZE_CURSOR));
            } else if (x > (comp.getX() + comp.getWidth() - EDGE)) {
                comp.setCursor(Cursor.getPredefinedCursor(Cursor.E_RESIZE_CURSOR));
                canvas.setCursor(Cursor.getPredefinedCursor(Cursor.E_RESIZE_CURSOR));
            } else if (x >= comp.getX() && x <= comp.getX() + EDGE) {
                comp.setCursor(Cursor.getPredefinedCursor(Cursor.W_RESIZE_CURSOR));
                canvas.setCursor(Cursor.getPredefinedCursor(Cursor.W_RESIZE_CURSOR));
            } else {
                comp.setCursor(Cursor.getDefaultCursor());
                canvas.setCursor(Cursor.getDefaultCursor());
            }
        } else {
            mouseMoveNoteView = null;
            canvas.setCursor(canvasCursor);
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

    private void modifyFields(MouseEvent e) {
        if (originalValues == null) {
            return;
        }

        var pt = e.getPoint();
        var yDiff = pt.y - start.y;
        var yScale = canvas.getFieldEditorYScale();

        if (yDiff == 0) {
            for (int i = 0; i < selectedNotes.size(); i++) {
                affectedFields[i].setValue(originalValues[i]);
            }
        } else {
            double valDiff;
            if (yDiff < 0) {
                valDiff = yScale.calcReverse(yScale.getRangeStart() + yDiff);
            } else {
                valDiff = yScale.calcReverse(yScale.getRangeEnd() + yDiff) - yScale.getDomainEnd();
            }

            for (int i = 0; i < selectedNotes.size(); i++) {
                affectedFields[i].setValue(originalValues[i] + valDiff);
            }
        }

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

    enum DragMode {
        NONE, SELECTING, MOVE, RESIZE_LEFT, RESIZE_RIGHT, FIELD_EDIT
    }
}
