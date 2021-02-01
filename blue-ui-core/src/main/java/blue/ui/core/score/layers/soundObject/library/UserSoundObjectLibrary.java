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
package blue.ui.core.score.layers.soundObject.library;

import blue.BlueSystem;
import blue.library.Library;
import blue.soundObject.SoundObject;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.io.IOException;
import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.border.BevelBorder;
import javax.swing.border.EmptyBorder;
import javax.swing.text.DefaultEditorKit;
import org.openide.explorer.ExplorerManager;
import org.openide.explorer.ExplorerUtils;
import org.openide.explorer.view.BeanTreeView;
import org.openide.nodes.Node;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.util.lookup.InstanceContent;

/**
 *
 * @author stevenyi
 */
public class UserSoundObjectLibrary extends JComponent implements ExplorerManager.Provider, Lookup.Provider {

    private transient ExplorerManager explorerManager = new ExplorerManager();

    Library<SoundObject> soundObjectLibrary;
    InstanceContent instanceContent;
    Lookup lookup;

    public UserSoundObjectLibrary(InstanceContent instanceContent) {
        setLayout(new BorderLayout());
        soundObjectLibrary = BlueSystem.getSoundObjectLibrary();
        this.instanceContent = instanceContent;

        JLabel label = new JLabel("User SoundObject Library");
        this.add(label, BorderLayout.NORTH);

        label.setMinimumSize(new Dimension(0, 0));
        label.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createBevelBorder(BevelBorder.RAISED),
                new EmptyBorder(3, 3,
                        3, 3)));
        lookup = ExplorerUtils.createLookup(explorerManager,
                getActionMap());
        explorerManager.setRootContext(new UserSoundObjectLibraryNode(soundObjectLibrary.getRoot()));
        BeanTreeView btv = new BeanTreeView();
        btv.setRootVisible(true);
        add(btv, BorderLayout.CENTER);

        initActions();
    }

    private void initActions() {
        var actions = getActionMap();

        actions.put(DefaultEditorKit.copyAction, ExplorerUtils.actionCopy(explorerManager));

        // Note: default action does not actually remove items, hence the workaround below
        // actions.put(DefaultEditorKit.cutAction, ExplorerUtils.actionCut(explorerManager));
        actions.put(DefaultEditorKit.cutAction, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent ev) {

                if (explorerManager == null) {
                    return;
                }
                var explorerCut = ExplorerUtils.actionCut(explorerManager);

                Node[] sel = explorerManager.getSelectedNodes();
                explorerCut.actionPerformed(ev);
                for (var n : sel) {
                    try {
                        n.destroy();
                    } catch (IOException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                }
            }
        }
        );

        actions.put(DefaultEditorKit.pasteAction, ExplorerUtils.actionPaste(explorerManager));
        actions.put("delete", ExplorerUtils.actionDelete(explorerManager, true));
    }

    @Override

    public ExplorerManager getExplorerManager() {
        return explorerManager;
    }

    @Override
    public Lookup getLookup() {
        return lookup;
    }
}
