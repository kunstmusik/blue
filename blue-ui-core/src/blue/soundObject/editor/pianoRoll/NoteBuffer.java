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

import java.util.ArrayList;

import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.soundObject.PianoRoll;
import java.util.Collections;

/**
 * @author steven
 */
public class NoteBuffer extends ArrayList<PianoNoteView> implements SelectionListener {
    private static final int EDGE = 5;

    private PianoRoll pianoRoll = null;

    int[] startX;

    int[] startLayer;

    public int leftBoundary;

    int startWidth;
    
    float[] initialStartTimes = null;

    public void startMove() {
        startX = new int[this.size()];
        startLayer = new int[this.size()];

        initialStartTimes = new float[this.size()];

        Collections.sort(this);
        
        leftBoundary = Integer.MAX_VALUE;

        int noteHeight = pianoRoll.getNoteHeight();

        for (int i = 0; i < this.size(); i++) {
            PianoNoteView noteView = this.get(i);
            startX[i] = noteView.getX();

            startLayer[i] = noteView.getY() / noteHeight;
            
            initialStartTimes[i] = noteView.getPianoNote().getStart();

            if (startX[i] < leftBoundary) {
                leftBoundary = startX[i];
            }
        }
        leftBoundary = -leftBoundary;
    }

    public void moveByTime(float diffTime, int layerDiff) {

        int noteHeight = pianoRoll.getNoteHeight();

        for (int i = 0; i < this.size(); i++) {
            PianoNoteView noteView = this.get(i);

            int newY = (startLayer[i] + layerDiff) * noteHeight;
            noteView.setLocation(noteView.getX(), newY);
            
            noteView.updateNotePitchFromY();
            noteView.getPianoNote().setStart(initialStartTimes[i] + diffTime);
        }
    }
    
    public void move(int diffX, int layerDiff) {

        if (diffX < leftBoundary) {
            diffX = leftBoundary;
        }

        int noteHeight = pianoRoll.getNoteHeight();

        for (int i = 0; i < this.size(); i++) {
            PianoNoteView noteView = this.get(i);

            int newY = (startLayer[i] + layerDiff) * noteHeight;
            noteView.setLocation(startX[i] + diffX, newY);
        }
    }

    public void endMove() {
        startX = null;
        startLayer = null;

        for (int i = 0; i < this.size(); i++) {
            PianoNoteView noteView = (PianoNoteView) this.get(i);
            noteView.updateNoteStartFromLocation();
        }

    }

    public void selectionPerformed(SelectionEvent e) {
        Object selectedItem = e.getSelectedItem();

        switch (e.getSelectionType()) {
            case SelectionEvent.SELECTION_CLEAR:
                this.clearBuffer();
                break;
            case SelectionEvent.SELECTION_SINGLE:
                if (this.contains(selectedItem) && this.size() == 1) {
                    return;
                }
                this.clearBuffer();
                this.addBufferedObject((PianoNoteView) selectedItem);

                break;
            case SelectionEvent.SELECTION_ADD:
                this.addBufferedObject((PianoNoteView) selectedItem);
                break;
            case SelectionEvent.SELECTION_REMOVE:
                ((PianoNoteView) selectedItem).setSelected(false);
                this.remove(selectedItem);
                break;
        }

    }

    private void addBufferedObject(PianoNoteView sObj) {
        if (!this.contains(sObj)) {
            this.add(sObj);
            sObj.setSelected(true);
        }
    }

    private void clearBuffer() {
        PianoNoteView temp;
        for (int i = 0; i < this.size(); i++) {
            temp = (PianoNoteView) this.get(i);
            temp.setSelected(false);
        }
        this.clear();
        // motionBuffer = null;
        // point = null;
    }

    public void startResize() {
        if (this.size() != 1) {
            System.out.println("Error: Size of NoteBuffer != 1");
            return;
        }

        PianoNoteView temp = this.get(0);
        initialStartTimes = new float[1];
        initialStartTimes[0] = temp.getPianoNote().getStart();

        startWidth = temp.getWidth();
    }

    public void setDuration(float duration) {
         if (this.size() != 1) {
            System.out.println("Error: Size of NoteBuffer != 1");
            return;
        }

        PianoNoteView temp = this.get(0);

        temp.getPianoNote().setDuration(duration);
    }
    
    /**
     * @param diffX
     */
    public void resize(int diffX) {
        if (this.size() != 1) {
            System.out.println("Error: Size of NoteBuffer != 1");
            return;
        }

        int newWidth = startWidth + diffX;

        if (newWidth < EDGE) {
            newWidth = EDGE;
        }

        PianoNoteView temp = this.get(0);

        temp.setSize(newWidth, temp.getHeight());

    }

    public void endResize() {
        PianoNoteView temp = (PianoNoteView) this.get(0);
        temp.updateNoteDurFromWidth();
    }

    /**
     * @return Returns the pianoRoll.
     */
    public PianoRoll getPianoRoll() {
        return pianoRoll;
    }

    /**
     * @param pianoRoll
     *            The pianoRoll to set.
     */
    public void setPianoRoll(PianoRoll pianoRoll) {
        this.pianoRoll = pianoRoll;
    }
}