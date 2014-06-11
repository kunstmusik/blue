/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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
package blue.ui.filemanager.actions;

import blue.ui.filemanager.FileNode;
import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

@ActionID(
        category = "Blue",
        id = "blue.ui.filemanager.actions.AddToFavoritesAction"
)
@ActionRegistration(
        displayName = "#CTL_AddToFavoritesAction"
)
@ActionReference(path = "blue/fileManager/folder/actions", position = 10)
@Messages("CTL_AddToFavoritesAction=&Add to Favorites")
public final class AddToFavoritesAction extends AbstractAction
        implements ContextAwareAction {
    private final FileNode folder;

    public AddToFavoritesAction() {
        this(Utilities.actionsGlobalContext());
    }

    public AddToFavoritesAction(Lookup lookup) {
        super(NbBundle.getMessage(AddToFavoritesAction.class, 
                "CTL_AddToFavoritesAction"));
        this.folder = lookup.lookup(FileNode.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        if(isEnabled()) {
            folder.getRoots().addRoot(folder.getFile());
        }
    }

    @Override
    public boolean isEnabled() {
        return !folder.getRoots().contains(folder.getFile());
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new AddToFavoritesAction(actionContext);
    }

}
