/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject;

import blue.soundObject.tracker.Column;
import blue.soundObject.tracker.Track;
import blue.soundObject.tracker.TrackList;
import blue.soundObject.tracker.TrackerNote;
import junit.framework.TestCase;

public class TrackerObjectTest extends TestCase {

    public final void testGenerateNotes() {
        TrackerObject tracker = new TrackerObject();

        tracker.setTimeBehavior(SoundObject.TIME_BEHAVIOR_NONE);

        TrackList tracks = tracker.getTracks();

        Track track1 = new Track();
        Track track2 = new Track();
        Track track3 = new Track();

        tracks.addTrack(track1);
        tracks.addTrack(track2);
        tracks.addTrack(track3);

        NoteList nl;

        try {
            nl = tracker.generateNotes(0.0f, -1.0f);
            assertEquals(0, nl.size());
        } catch (SoundObjectException e) {
            fail("Tracker threw exception\n" + e.getMessage());
        }

        TrackerNote tn = track1.getTrackerNote(0);

        tn.setTied(true);
        tn.setValue(1, "8.00");
        tn.setValue(2, "80");

        boolean exceptionThrown = false;

        try {
            tn.setValue(3, "8.00");
        } catch (IndexOutOfBoundsException iobe) {
            exceptionThrown = true;
        }

        assertTrue("Index Out of Bounds not thrown", exceptionThrown);

        track1.addColumn(new Column());

        try {
            tn.setValue(3, "1");
            exceptionThrown = false;
        } catch (IndexOutOfBoundsException iobe) {
            exceptionThrown = true;
        }

        track1.setNoteTemplate(track1.getNoteTemplate() + " <col>");

        assertFalse("Index Out of Bounds should not be thrown", exceptionThrown);

        String expectedScore = "i1\t0.0\t-64\t8.00\t80\t1";

        try {
            nl = tracker.generateNotes(0.0f, -1.0f);
            assertEquals(1, nl.size());
            assertEquals(expectedScore, nl.toString().trim());
        } catch (SoundObjectException e) {
            fail("Tracker threw exception\n" + e.getMessage());
        }

        expectedScore = "i1\t0.0\t-1\t8.00\t80\t1";

        track1.getTrackerNote(1).setOff(true);

        try {
            nl = tracker.generateNotes(0.0f, -1.0f);
            assertEquals(1, nl.size());
            assertEquals(expectedScore, nl.toString().trim());
        } catch (SoundObjectException e) {
            fail("Tracker threw exception\n" + e.getMessage());
        }

        track1.getTrackerNote(1).setOff(true);

        track1.setInstrumentId("test");

        expectedScore = "i\"test\"\t0.0\t-1\t8.00\t80\t1";

        try {
            nl = tracker.generateNotes(0.0f, -1.0f);
            assertEquals(1, nl.size());
            assertEquals(expectedScore, nl.toString().trim());
        } catch (SoundObjectException e) {
            fail("Tracker threw exception\n" + e.getMessage());
        }

        // TODO - Continue testing, break this test into smaller tests and
        // use setUp and tearDown methods
    }

    /**
     * Test setting tracker steps sets steps on the individual tracks
     *
     */
    public final void testSetSteps() {
        TrackerObject tracker = new TrackerObject();
        TrackList tracks = tracker.getTracks();

        Track track = new Track();
        tracks.addTrack(track);

        assertEquals(64, track.getNumSteps());

        tracker.setSteps(32);

        assertEquals(32, track.getNumSteps());

        tracker.setSteps(128);

        assertEquals(128, track.getNumSteps());

    }

}
