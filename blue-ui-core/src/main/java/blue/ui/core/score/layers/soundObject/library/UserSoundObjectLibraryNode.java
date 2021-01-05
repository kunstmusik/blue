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
package blue.ui.core.score.layers.soundObject.library;

import blue.library.LibraryItem;
import blue.library.TransferableLibraryItem;
import blue.soundObject.SoundObject;
import blue.ui.core.clipboard.BlueClipboardUtils;
import blue.ui.core.score.ScoreObjectCopy;
import blue.ui.core.score.layers.soundObject.library.actions.AddFolderAction;
import java.awt.Image;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.dnd.DnDConstants;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import javafx.beans.InvalidationListener;
import javafx.beans.Observable;
import javax.swing.Action;
import org.openide.actions.CopyAction;
import org.openide.actions.CutAction;
import org.openide.actions.DeleteAction;
import org.openide.actions.MoveDownAction;
import org.openide.actions.MoveUpAction;
import org.openide.actions.PasteAction;
import org.openide.actions.RenameAction;
import org.openide.actions.ReorderAction;
import org.openide.nodes.AbstractNode;
import org.openide.nodes.ChildFactory;
import org.openide.nodes.Children;
import org.openide.nodes.Index;
import org.openide.nodes.Node;
import org.openide.nodes.NodeTransfer;
import org.openide.util.Exceptions;
import org.openide.util.actions.SystemAction;
import org.openide.util.datatransfer.ExTransferable;
import org.openide.util.datatransfer.PasteType;
import org.openide.util.lookup.AbstractLookup;
import org.openide.util.lookup.InstanceContent;

/**
 *
 * @author stevenyi
 */
public class UserSoundObjectLibraryNode extends AbstractNode {

    private UserSoundObjectLibraryChildFactory childFactory = null;
    private final LibraryItem<SoundObject> item;

    public UserSoundObjectLibraryNode(LibraryItem<SoundObject> item) {
        this(item, new InstanceContent());
    }

    private UserSoundObjectLibraryNode(LibraryItem<SoundObject> item, InstanceContent ic) {

        super(Children.LEAF, new AbstractLookup(ic));

        ic.add(item);

        this.item = item;

        if (!item.isLeaf()) {
            childFactory = new UserSoundObjectLibraryChildFactory(item);
            setChildren(Children.create(childFactory, true));
        }
        setName(item.toString());

        ic.add(new Index.Support() {
            @Override
            public Node[] getNodes() {
                return getChildren().getNodes(true);
            }

            @Override
            public int getNodesCount() {
                return getNodes().length;
            }

            @Override
            public void reorder(int[] perm) {
                var children = item.getChildren();
                LibraryItem<SoundObject>[] reordered = new LibraryItem[children.size()];

                for (int i = 0; i < perm.length; i++) {
                    int j = perm[i];
                    var c = children.get(i);
                    reordered[j] = c;
                }
                children.clear();
                children.addAll(Arrays.asList(reordered));
            }
        });
    }

    @Override
    public Action[] getActions(boolean context) {

        Action[] actions;

        if (!item.isLeaf()) {
            if (item.getParent() == null) {
                actions = new Action[]{
                    new AddFolderAction(item),
                    null,
                    SystemAction.get(PasteAction.class),
                    null,
                    SystemAction.get(ReorderAction.class),};
            } else {

                actions = new Action[]{
                    new AddFolderAction(item),
                    null,
                    SystemAction.get(CutAction.class),
                    SystemAction.get(CopyAction.class),
                    SystemAction.get(PasteAction.class),
                    null,
                    SystemAction.get(ReorderAction.class),
                    SystemAction.get(MoveUpAction.class),
                    SystemAction.get(MoveDownAction.class),
                    null,
                    SystemAction.get(RenameAction.class),
                    null,
                    SystemAction.get(DeleteAction.class),};
            }
        } else {
            actions = new Action[]{
                SystemAction.get(CutAction.class),
                SystemAction.get(CopyAction.class),
                null,
                SystemAction.get(MoveUpAction.class),
                SystemAction.get(MoveDownAction.class),
                null,
                SystemAction.get(RenameAction.class),
                null,
                SystemAction.get(DeleteAction.class),};
        }

        return actions;
    }

    @Override
    public boolean canRename() {
        return item.getParent() != null;
    }

    @Override
    public void setName(String s) {
        if (s != null && !s.isBlank()) {
            item.setText(s);
            super.setName(s);
        }
    }

    @Override
    public boolean canDestroy() {
        return item.getParent() != null;
    }

    @Override
    public void destroy() throws IOException {
        item.getParent().getChildren().remove(item);
        fireNodeDestroyed();
    }

    @Override
    public boolean canCut() {
        return item.getParent() != null;
    }

    @Override
    public boolean canCopy() {
        return item.getParent() != null;
    }

    @Override
    public Transferable clipboardCut() throws IOException {
        Transferable deflt = super.clipboardCut();
        ExTransferable added = ExTransferable.create(deflt);

        if (isLeaf()) {
            added.put(new ExTransferable.Single(ScoreObjectCopy.DATA_FLAVOR) {
                @Override
                protected ScoreObjectCopy getData() {
                    return new ScoreObjectCopy(List.of(item.getValue()), List.of(0));
                }
            });
        } else {
            added.put(new ExTransferable.Single(TransferableLibraryItem.LIBRARY_ITEM_FLAVOR) {
                @Override
                protected LibraryItem getData() {
                    return getLookup().lookup(LibraryItem.class);
                }
            });
        }
        return added;
    }

    @Override
    public Transferable clipboardCopy() throws IOException {
        Transferable deflt = super.clipboardCopy();
        ExTransferable added = ExTransferable.create(deflt);

        if (isLeaf()) {
            added.put(new ExTransferable.Single(ScoreObjectCopy.DATA_FLAVOR) {
                @Override
                protected ScoreObjectCopy getData() {
                    return new ScoreObjectCopy(List.of(item.getValue()), List.of(0));
                }
            });
        } else {
            added.put(new ExTransferable.Single(TransferableLibraryItem.LIBRARY_ITEM_FLAVOR) {
                @Override
                protected LibraryItem getData() {
                    return getLookup().lookup(LibraryItem.class);
                }
            });
        }
        return added;
    }

    @Override
    public PasteType getDropType(Transferable t, int action, int index) {

        if (item.isLeaf()) {
            return null;
        }

        try {
            if (t.isDataFlavorSupported(ScoreObjectCopy.DATA_FLAVOR)) {
                final var buffer = BlueClipboardUtils.getScoreObjectCopy();
                if (buffer == null || !buffer.isOnlySoundObjects() || buffer.scoreObjects.size() != 1) {
                    return null;
                }

                final var sObj = (SoundObject) buffer.scoreObjects.get(0);
                final var copy = sObj.deepCopy();

                return new PasteType() {
                    @Override
                    public Transferable paste() throws IOException {

                        item.getChildren().add(new LibraryItem<>(item, copy));
                        final Node dropNode = NodeTransfer.node(t,
                                DnDConstants.ACTION_MOVE + NodeTransfer.CLIPBOARD_CUT);
                        if (dropNode != null) {
                            dropNode.destroy();
                        }
                        return null;
                    }
                };

            } else if (t.isDataFlavorSupported(TransferableLibraryItem.LIBRARY_ITEM_FLAVOR)) {
                final var libItem = (LibraryItem<SoundObject>) t.getTransferData(TransferableLibraryItem.LIBRARY_ITEM_FLAVOR);
                final var copy = libItem.deepCopy(item);

                return new PasteType() {
                    @Override
                    public Transferable paste() throws IOException {
                        item.getChildren().add(copy);
                        final Node dropNode = NodeTransfer.node(t,
                                DnDConstants.ACTION_MOVE + NodeTransfer.CLIPBOARD_CUT);
                        if (dropNode != null) {
                            dropNode.destroy();
                        }
                        return null;
                    }
                };
            }

        } catch (UnsupportedFlavorException ex) {
            Exceptions.printStackTrace(ex);
        } catch (IOException ex) {
            Exceptions.printStackTrace(ex);

        }

        return null;
    }

    @Override
    protected void createPasteTypes(Transferable t, List<PasteType> s) {
        super.createPasteTypes(t, s); //To change body of generated methods, choose Tools | Templates.

        PasteType paste = getDropType(t, DnDConstants.ACTION_COPY, -1);
        if (paste != null) {
            s.add(paste);
        }
    }

    @Override
    public Image getIcon(int type) {
        return super.getIcon(type); //To change body of generated methods, choose Tools | Templates.

    }

    static class UserSoundObjectLibraryChildFactory extends ChildFactory<LibraryItem<SoundObject>> {

        private final LibraryItem<SoundObject> item;

        private UserSoundObjectLibraryChildFactory(LibraryItem<SoundObject> item) {

            this.item = item;
            item.getChildren().addListener(new InvalidationListener() {
                @Override
                public void invalidated(Observable o) {
                    refresh(true);
                }
            });
        }

        @Override
        protected boolean createKeys(List<LibraryItem<SoundObject>> toPopulate) {
            toPopulate.addAll(this.item.getChildren());
            return true;
        }

        @Override
        protected Node createNodeForKey(LibraryItem<SoundObject> newItem) {
            return new UserSoundObjectLibraryNode(newItem);
        }

    }
}
