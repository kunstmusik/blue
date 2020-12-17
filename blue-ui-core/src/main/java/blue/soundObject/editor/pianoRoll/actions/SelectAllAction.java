/*
 * blue - object composition environment for csound
 * Copyright (C) 2020
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

package blue.soundObject.editor.pianoRoll.actions;

import blue.soundObject.PianoRoll;
import java.awt.event.ActionEvent;
import javafx.collections.ObservableList;
import javax.swing.AbstractAction;
import static javax.swing.Action.ACCELERATOR_KEY;
import org.openide.util.Lookup;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

@Messages("CTL_SelectAllAction=Select All Notes")

/**
 *
 * @author Steven Yi
 */
public class SelectAllAction extends AbstractAction {

    private final Lookup lookup;
    
    public SelectAllAction(Lookup lookup) {
        putValue(NAME, Bundle.CTL_UndoAction());
        putValue(ACCELERATOR_KEY, Utilities.stringToKey("D-A"));
        this.lookup = lookup;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        var pianoRoll = lookup.lookup(PianoRoll.class);
        var selectedNotes = lookup.lookup(ObservableList.class);
        
        selectedNotes.setAll(pianoRoll.getNotes());
    }
}
