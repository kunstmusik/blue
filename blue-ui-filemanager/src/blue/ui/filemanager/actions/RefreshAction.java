/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.ui.filemanager.actions;

import blue.ui.filemanager.FileNode;
import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

@ActionID(
        category = "Blue",
        id = "blue.ui.filemanager.actions.RefreshAction"
)
@ActionRegistration(
        displayName = "#CTL_RefreshAction"
)
@ActionReferences({
    @ActionReference(path = "blue/fileManager/roots/actions", position = 0)
    , 
    @ActionReference(path = "blue/fileManager/folder/actions", position = 0)
})
@Messages("CTL_RefreshAction=Refresh Folder")
public final class RefreshAction extends AbstractAction
        implements ContextAwareAction {

    private final FileNode folder;

    public RefreshAction() {
        this(Utilities.actionsGlobalContext());
    }

    public RefreshAction(Lookup lookup) {
        super(NbBundle.getMessage(RefreshAction.class, "CTL_RefreshAction"));
        this.folder = lookup.lookup(FileNode.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        folder.refresh();
    }

    @Override
    public boolean isEnabled() {
        return folder.getFile().isDirectory();
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new RefreshAction(actionContext);
    }
}
