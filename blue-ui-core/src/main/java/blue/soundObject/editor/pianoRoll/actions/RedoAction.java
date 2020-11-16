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

import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import static javax.swing.Action.ACCELERATOR_KEY;
import javax.swing.undo.UndoManager;
import org.openide.util.Lookup;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

@Messages("CTL_RedoAction=Redo")

/**
 *
 * @author Steven Yi
 */
public class RedoAction extends AbstractAction {

    private final Lookup lookup;
    
    public RedoAction(Lookup lookup) {
        putValue(NAME, Bundle.CTL_RedoAction());
        putValue(ACCELERATOR_KEY, Utilities.stringToKey("DS-Z"));
        this.lookup = lookup;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        var undoManager = lookup.lookup(UndoManager.class);
        if(undoManager != null && undoManager.canRedo()) {
            undoManager.redo();
        }
    }
}
