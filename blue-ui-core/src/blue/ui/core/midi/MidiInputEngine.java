/*
 * blue - object composition environment for csound Copyright (c) 2000-2010
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.midi;

import blue.BlueData;
import blue.InstrumentAssignment;
import blue.midi.MidiInputProcessor;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.ui.core.blueLive.BlueLiveToolBar;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import javax.sound.midi.MidiMessage;
import javax.sound.midi.Receiver;
import javax.sound.midi.ShortMessage;

/**
 *
 * @author syi
 */
public final class MidiInputEngine implements Receiver {

    private static MidiInputEngine instance = new MidiInputEngine();

    private static BlueLiveToolBar toolbar;

    private ArrayList<InstrumentAssignment> arrangement;

    private MidiInputProcessor processor = null;

    public static MidiInputEngine getInstance() {
        return instance;
    }


    private MidiInputEngine() {
        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.
                        getPropertyName())) {
                    reinitialize();
                }
            }
        });
    }

    protected void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData data = null;
        if (project != null) {
            data = project.getData();
            arrangement = data.getArrangement().getArrangement();
            processor = data.getMidiInputProcessor();
        }
    }

    public void send(MidiMessage message, long timeStamp) {

        if (message instanceof ShortMessage) {

            ShortMessage shortMsg = (ShortMessage) message;
            int channel = shortMsg.getChannel();
            int noteNum = shortMsg.getData1();
            int velocity = shortMsg.getData2();

            if(processor == null || arrangement == null || channel >= arrangement.size()) {
                return;
            }

            String id = arrangement.get(channel).arrangementId;

            String score = "i";

            switch (shortMsg.getCommand()) {
                case ShortMessage.NOTE_ON:
                    if (velocity > 0) {
                        score = processor.getNoteOn(id, noteNum, noteNum,
                                velocity);
                    } else {
                        score = processor.getNoteOff(id, noteNum);
                    }

                    break;
                case ShortMessage.NOTE_OFF:
//                    noteNum = shortMsg.getData1();
//                    velocity = shortMsg.getData2();

                    score = processor.getNoteOff(id, noteNum);

                    break;
            }

            System.err.println(score);
            if (toolbar == null) {
                toolbar = BlueLiveToolBar.getInstance();
            }
            toolbar.sendEvents(score);
        }

    }

    public void close() {
        throw new UnsupportedOperationException("Not supported yet.");
    }
}
