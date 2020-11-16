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
import javax.swing.AbstractAction;
import javax.swing.Action;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

/* NOTE: Tried to use Netbeans action registration but could not find a way to 
  correctly use createContextAwareAction. Ended up instantiating directly from 
  PianoRollEditor.
*/

//@ActionID(
//        category = "PianoRoll",
//        id = "blue.soundObject.editor.pianoRoll.actions.ToggleSnapAction"
//)
//@ActionRegistration(
//        displayName = "#CTL_ToggleSnapAction"
//)
@Messages("CTL_ToggleSnapAction=Toggle Snap")

//@ActionReferences({
//    @ActionReference(path = "blue/score/pianoRoll/actions", position = 0),
//    @ActionReference(path = "blue/score/pianoRoll/shortcuts", name = "A-S")
//})
public final class ToggleSnapAction extends AbstractAction implements ContextAwareAction {

    private final Lookup context;

//    public ToggleSnapAction() {
//        this(Utilities.actionsGlobalContext());
//    }

    public ToggleSnapAction(Lookup context) {
        putValue(NAME, Bundle.CTL_ToggleSnapAction());
        putValue(ACCELERATOR_KEY, Utilities.stringToKey("A-S"));
        this.context = context;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        var p = context.lookup(PianoRoll.class);
        if (p != null) {
            p.setSnapEnabled(!p.isSnapEnabled());
        }
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ToggleSnapAction(actionContext);
    }

}
