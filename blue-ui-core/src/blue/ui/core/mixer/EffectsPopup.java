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
package blue.ui.core.mixer;

import blue.BlueSystem;
import blue.mixer.*;
import blue.ui.core.mixer.EffectCategory;
import blue.ui.core.mixer.EffectsLibrary;
import blue.utility.ObjectUtilities;
import java.awt.Frame;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ComboBoxModel;
import javax.swing.JMenu;
import javax.swing.JPopupMenu;
import javax.swing.ListSelectionModel;
import javax.swing.SingleSelectionModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import org.openide.windows.WindowManager;

public class EffectsPopup extends JPopupMenu implements ChangeListener {

    private static EffectsPopup popup = null;

    private EffectEditorDialog effectDialog = null;

    private AddEffectEditorDialog addEffectDialog = null;

    Action addInsert;

    Action addNewEffect = new AddNewEffectAction();

    Action addSend = new AddNewSendAction();

    Action removeItem;

    Action openEditor = new OpenEditorAction();

    Action editEffect = new EditEffectAction();

    Action enableDisableEffect = new EnableDisableEffectAction();

    Action cutAction;

    Action copyAction;

    Action pasteAction;

    JMenu effectsMenu = new JMenu("Add Effect");

    private EffectsChain chain;

    private int selectedIndex;

    Action pushUp = new PushUpAction();

    Action pushDown = new PushDownAction();

    Action importToLibrary = new ImportToLibraryAction();

    Effect bufferedEffect = null;

    Action importAction;

    Action exportAction;

    private ComboBoxModel model;
    private ListSelectionModel listSelectionModel;

    private EffectsPopup() {

        addInsert = new AbstractAction("Add Insert") {
            @Override
            public void actionPerformed(ActionEvent ae) {

            }
        };

        removeItem = new AbstractAction("Remove") {
            @Override
            public void actionPerformed(ActionEvent ae) {
                if (selectedIndex >= 0 && chain != null) {
                    Object obj = chain.removeElementAt(selectedIndex);

                    if (obj instanceof Effect) {
                        Effect effect = (Effect) obj;

                        EffectEditorManager.getInstance().removeEffect(effect);
                    }
                }
            }
        };

        cutAction = new AbstractAction(BlueSystem.getString("common.cut")) {
            @Override
            public void actionPerformed(ActionEvent ae) {
                if (selectedIndex >= 0 && chain != null) {

                    Object obj = chain.removeElementAt(selectedIndex);

                    if (obj instanceof Effect) {
                        bufferedEffect = new Effect((Effect) obj);
                        EffectEditorManager.getInstance().removeEffect(
                                (Effect) obj);
                    }

                }
            }
        };

        copyAction = new AbstractAction(BlueSystem.getString("common.copy")) {
            @Override
            public void actionPerformed(ActionEvent ae) {
                if (selectedIndex >= 0 && chain != null) {

                    Object obj = chain.getElementAt(selectedIndex);

                    if (obj instanceof Effect) {
                        bufferedEffect = new Effect((Effect) obj);
                    }

                }
            }
        };

        pasteAction = new AbstractAction(BlueSystem.getString("common.paste")) {
            @Override
            public void actionPerformed(ActionEvent ae) {
                if (chain != null && bufferedEffect != null) {
                    Effect clone = new Effect(bufferedEffect);
                    clone.clearParameters();
                    chain.addEffect(clone);
                }
            }
        };

        importAction = new AbstractAction("Import from File") {

            @Override
            public void actionPerformed(ActionEvent e) {
                if (chain == null) {
                    return;
                }

                Effect effect = EffectsUtil.importEffect();

                if (effect != null) {
                    chain.addEffect(effect);
                }
            }

        };

        exportAction = new AbstractAction("Export to File") {

            @Override
            public void actionPerformed(ActionEvent e) {
                if (selectedIndex >= 0 && chain != null) {
                    Object obj = chain.getElementAt(selectedIndex);

                    if (obj instanceof Effect) {
                        EffectsUtil.exportEffect((Effect) obj);
                    }
                }
            }

        };

        this.addPopupMenuListener(new PopupMenuListener() {
            @Override
            public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                boolean itemSelected = selectedIndex >= 0;

                removeItem.setEnabled(itemSelected);
                openEditor.setEnabled(itemSelected);

                pushUp.setEnabled(selectedIndex > 0);
                pushDown.setEnabled(selectedIndex < chain.size() - 1);

                pasteAction.setEnabled(bufferedEffect != null);

                enableDisableEffect.setEnabled(itemSelected);

                boolean isEffect = false;

                if (itemSelected) {
                    Object obj = chain.getElementAt(selectedIndex);

                    if (obj instanceof Effect) {
                        Effect effect = (Effect) obj;

                        if (effect.isEnabled()) {
                            enableDisableEffect.putValue(Action.NAME,
                                    "Disable Effect");
                        } else {
                            enableDisableEffect.putValue(Action.NAME,
                                    "Enable Effect");
                        }
                        openEditor.putValue(Action.NAME,
                                "Open Editor for Effect");
                        isEffect = true;
                    } else {
                        Send send = (Send) obj;

                        if (send.isEnabled()) {
                            enableDisableEffect.putValue(Action.NAME,
                                    "Disable Send");
                        } else {
                            enableDisableEffect.putValue(Action.NAME,
                                    "Enable Send");
                        }

                        openEditor
                                .putValue(Action.NAME, "Open Editor for Send");
                    }

                }

                editEffect.setEnabled(isEffect && itemSelected);
                importToLibrary.setEnabled(isEffect && itemSelected);
                cutAction.setEnabled(isEffect && itemSelected);
                copyAction.setEnabled(isEffect && itemSelected);
                exportAction.setEnabled(isEffect && itemSelected);
            }

            @Override
            public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
            }

            @Override
            public void popupMenuCanceled(PopupMenuEvent e) {
            }

        });

        EffectsLibrary.getInstance().addChangeListener(this);
        reinitialize();
    }

    public void setEffectsChain(EffectsChain chain, int selectedIndex) {
        this.selectedIndex = selectedIndex;
        this.chain = chain;
    }

    public void setMaster(boolean isMaster) {
        addSend.setEnabled(!isMaster);
    }

    public void setComboBoxModel(ComboBoxModel model) {
        this.model = model;
    }

    public static EffectsPopup getInstance() {
        if (popup == null) {
            popup = new EffectsPopup();
        }

        return popup;
    }

    @Override
    public void stateChanged(ChangeEvent e) {
        reinitialize();
    }

    private void reinitialize() {
        this.removeAll();
        effectsMenu.removeAll();

        EffectsLibrary library = EffectsLibrary.getInstance();

        populateMenu(library.getRootEffectCategory(), effectsMenu);

        // this.add(addInsert);
        this.add(addNewEffect);
        this.add(effectsMenu);
        this.addSeparator();
        this.add(addSend);
        this.addSeparator();
        this.add(pushUp);
        this.add(pushDown);
        this.addSeparator();

        this.add(openEditor);
        this.add(editEffect);
        this.add(enableDisableEffect);

        this.addSeparator();

        this.add(cutAction);
        this.add(copyAction);
        this.add(pasteAction);

        this.addSeparator();
        this.add(importToLibrary);
        this.addSeparator();
        this.add(removeItem);
        this.addSeparator();
        this.add(importAction);
        this.add(exportAction);
    }

    private void populateMenu(EffectCategory category, JMenu menu) {

        JMenu currentMenu = menu;

        ArrayList categories = category.getSubCategories();
        ArrayList effects = category.getEffects();

        for (int i = 0; i < categories.size(); i++) {
            EffectCategory cat = (EffectCategory) categories.get(i);

            JMenu catMenu = new JMenu(cat.getCategoryName());

            menu.add(catMenu);
            populateMenu(cat, catMenu);
        }

        int counter = 0;

        for (int i = 0; i < effects.size(); i++) {
            Effect effect = (Effect) effects.get(i);

            AddEffectAction action = new AddEffectAction(effect);

            if (counter < 10) {
                currentMenu.add(action);
                counter++;
            } else {
                JMenu tempMenu = new JMenu(BlueSystem.getString("menu.more"));
                currentMenu.add(tempMenu);
                currentMenu = tempMenu;
                currentMenu.add(action);
                counter = 1;
            }

        }
    }

    void setListSelectionModel(ListSelectionModel selectionModel) {
        this.listSelectionModel = selectionModel;
    }

    class AddEffectAction extends AbstractAction {

        private Effect effect;

        public AddEffectAction(Effect effect) {
            this.effect = effect;
            putValue(NAME, effect.getName());
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (chain != null) {
                Effect copy = new Effect(effect);
                copy.clearParameters();
                copy.setEnabled(true);
                chain.addEffect(copy);
            }
        }

    }

    class PushUpAction extends AbstractAction {

        public PushUpAction() {
            putValue(NAME, "Push Up");
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (chain != null && selectedIndex > 0) {
                chain.pushUp(selectedIndex);
                if (listSelectionModel != null) {
                    listSelectionModel.setSelectionInterval(
                            listSelectionModel.getMinSelectionIndex() - 1,
                            listSelectionModel.getMaxSelectionIndex() - 1);
                }
            }
        }

    }

    class PushDownAction extends AbstractAction {

        public PushDownAction() {
            putValue(NAME, "Push Down");
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (chain != null && selectedIndex < chain.size() - 1) {
                chain.pushDown(selectedIndex);
                if (listSelectionModel != null) {
                    listSelectionModel.setSelectionInterval(
                            listSelectionModel.getMinSelectionIndex() + 1,
                            listSelectionModel.getMaxSelectionIndex() + 1);
                }
            }
        }

    }

    class ImportToLibraryAction extends AbstractAction {

        public ImportToLibraryAction() {
            putValue(NAME, "Import to Effects Library");
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (chain != null && selectedIndex >= 0) {
                Object obj = chain.getElementAt(selectedIndex);

                if (obj instanceof Effect) {
                    Effect effect = (Effect) obj;

                    Effect copy = new Effect(effect);

                    EffectsLibrary library = EffectsLibrary.getInstance();

                    library.importEffect(copy);
                }
            }
        }

    }

    class OpenEditorAction extends AbstractAction {

        public OpenEditorAction() {
            putValue(NAME, "Open Interface for Effect");
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (chain != null && selectedIndex >= 0) {
                Object obj = chain.getElementAt(selectedIndex);

                Frame root = WindowManager.getDefault().getMainWindow();

                if (obj instanceof Effect) {
                    Effect effect = (Effect) obj;

                    EffectEditorManager.getInstance().openEffectEditor(root,
                            effect);
                } else if (obj instanceof Send) {
                    // JOptionPane.showMessageDialog(null, "Show editor for
                    // Send!");

                    Send send = (Send) obj;

                    ComboBoxModel temp = null;

                    if (model instanceof ChannelOutComboBoxModel) {
                        temp = ((ChannelOutComboBoxModel) model).getCopy();
                    } else if (model instanceof SubChannelOutComboBoxModel) {
                        temp = ((SubChannelOutComboBoxModel) model).getCopy();
                    }

                    SendEditorManager.getInstance().openSendEditor(root, send,
                            temp);

                }
            }
        }
    }

    class EditEffectAction extends AbstractAction {

        public EditEffectAction() {
            putValue(NAME, "Edit Effect");
        }

        @Override
        public void actionPerformed(ActionEvent e) {

            if (chain != null && selectedIndex >= 0) {
                Object obj = chain.getElementAt(selectedIndex);

                if (obj instanceof Effect) {
                    Effect effect = (Effect) obj;

                    if (effectDialog == null) {
                        Frame root = WindowManager.getDefault().getMainWindow();

                        effectDialog = new EffectEditorDialog(root, true);
                    }

                    effectDialog.setEffect(effect);

                    effectDialog.show();

                    EffectEditorManager.getInstance().updateEffectInterface(
                            effect);
                }
            }
        }
    }

    class EnableDisableEffectAction extends AbstractAction {

        public EnableDisableEffectAction() {
            putValue(NAME, "Disable Effect");
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (chain != null && selectedIndex >= 0) {
                Object obj = chain.getElementAt(selectedIndex);

                if (obj instanceof Effect) {
                    Effect effect = (Effect) obj;
                    effect.setEnabled(!effect.isEnabled());
                } else if (obj instanceof Send) {
                    Send send = (Send) obj;
                    send.setEnabled(!send.isEnabled());
                }
            }
        }
    }

    class AddNewEffectAction extends AbstractAction {

        public AddNewEffectAction() {
            putValue(NAME, "Add New Effect");
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (chain != null) {
                if (addEffectDialog == null) {
                    Frame root = WindowManager.getDefault().getMainWindow();

                    addEffectDialog = new AddEffectEditorDialog(root);
                }

                addEffectDialog.setEffect(null);

                boolean val = addEffectDialog.ask();

                if (val) {
                    Effect effect = addEffectDialog.getEffect();
                    chain.addEffect(effect);
                }
            }
        }
    }

    class AddNewSendAction extends AbstractAction {

        public AddNewSendAction() {
            putValue(NAME, "Add New Send");
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (chain != null) {

                Send send = new Send();

                chain.addSend(send);

                ComboBoxModel temp = null;

                if (model instanceof ChannelOutComboBoxModel) {
                    temp = ((ChannelOutComboBoxModel) model).getCopy();
                } else if (model instanceof SubChannelOutComboBoxModel) {
                    temp = ((SubChannelOutComboBoxModel) model).getCopy();
                }

                Frame root = WindowManager.getDefault().getMainWindow();

                SendEditorManager.getInstance()
                        .openSendEditor(root, send, temp);
            }
        }
    }
}
