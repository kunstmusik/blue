/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import java.util.Arrays;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTabbedPane;
import javax.swing.KeyStroke;
import javax.swing.event.DocumentEvent;
import javax.swing.event.UndoableEditEvent;
import javax.swing.event.UndoableEditListener;
import javax.swing.text.BadLocationException;
import javax.swing.undo.UndoManager;
import javax.swing.undo.UndoableEdit;

import skt.swing.SwingUtil;
import blue.BlueSystem;
import blue.actions.RedoAction;
import blue.actions.UndoAction;
import blue.components.EditEnabledCheckBox;
import blue.event.EditModeListener;
import blue.gui.BlueEditorPane;
import blue.orchestra.BlueSynthBuilder;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import blue.undo.NoStyleChangeUndoManager;
import blue.undo.TabSelectionWrapper;

/**
 * @author steven
 */
public class BSBCodeEditor extends JComponent {
    
    BSBCompletionProvider completionProvider = new BSBCompletionProvider();

    MimeTypeEditorComponent codePane = 
            new MimeTypeEditorComponent("text/x-blue-synth-builder");

    MimeTypeEditorComponent alwaysOnCodePane = 
            new MimeTypeEditorComponent("text/x-blue-synth-builder");

    MimeTypeEditorComponent globalOrcEditPane = 
            new MimeTypeEditorComponent("text/x-blue-synth-builder");

    BlueEditorPane globalScoEditPane = new BlueEditorPane();

    BlueSynthBuilder bsb = new BlueSynthBuilder();

    EditEnabledCheckBox editBox = new EditEnabledCheckBox();

    UndoManager undo = new NoStyleChangeUndoManager();

    public BSBCodeEditor() {

        editBox.addEditModeListener(new EditModeListener() {

            public void setEditing(boolean isEditing) {
                codePane.getJEditorPane().setEnabled(isEditing);
                // FIXME - does enable propagate?
                alwaysOnCodePane.getJEditorPane().setEnabled(isEditing);
                globalOrcEditPane.getJEditorPane().setEnabled(isEditing);
                globalScoEditPane.setEnabled(isEditing);

                if (bsb != null) {
                    bsb.setEditEnabled(isEditing);
                }
            }
        });

        codePane.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (bsb != null) {
                            bsb.setInstrumentText(codePane.getText());
                        }
                    }
                });

        alwaysOnCodePane.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (bsb != null) {
                            bsb.setAlwaysOnInstrumentText(alwaysOnCodePane.
                                    getText());
                        }
                    }
                });

        globalOrcEditPane.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (bsb != null) {
                            bsb.setGlobalOrc(globalOrcEditPane.getText());
                        }
                    }
                });

        globalScoEditPane.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (bsb != null) {
                            bsb.setGlobalSco(globalScoEditPane.getText());
                        }
                    }
                });

        JPanel topBar = new JPanel(new BorderLayout());
        topBar.add(editBox, BorderLayout.EAST);

        final JTabbedPane tabs = new JTabbedPane(JTabbedPane.BOTTOM);
        tabs.add(BlueSystem.getString("instrument.instrumentText"), codePane);
        tabs.add("Always-On Instrument Text", alwaysOnCodePane);
        tabs.add(BlueSystem.getString("global.orchestra"), globalOrcEditPane);
        tabs.add(BlueSystem.getString("global.score"), globalScoEditPane);

        this.setLayout(new BorderLayout());
        this.add(topBar, BorderLayout.NORTH);
        this.add(tabs, BorderLayout.CENTER);

        UndoableEditListener ul = new UndoableEditListener() {

            public void undoableEditHappened(UndoableEditEvent e) {
                UndoableEdit event = e.getEdit();

                if (event.getPresentationName().equals("style change")) {
                    undo.addEdit(event);
                } else {
                    TabSelectionWrapper wrapper = new TabSelectionWrapper(
                            event, tabs);
                    undo.addEdit(wrapper);
                }
            }
        };

        codePane.getDocument().addUndoableEditListener(ul);
        alwaysOnCodePane.getDocument().addUndoableEditListener(ul);
        globalOrcEditPane.getDocument().addUndoableEditListener(ul);
        globalScoEditPane.getDocument().addUndoableEditListener(ul);

        Action[] undoActions = new Action[]{new UndoAction(undo),
            new RedoAction(undo)};

//        SwingUtil.installActions(codePane, undoActions);
//        SwingUtil.installActions(alwaysOnCodePane, undoActions);
//        SwingUtil.installActions(globalOrcEditPane, undoActions);
        SwingUtil.installActions(globalScoEditPane, undoActions);

        codePane.setUndoManager(undo);
        alwaysOnCodePane.setUndoManager(undo);
        globalOrcEditPane.setUndoManager(undo);
        
        undo.setLimit(1000);
        
        codePane.getJEditorPane().putClientProperty("bsb-completion-provider", 
                completionProvider);
        alwaysOnCodePane.getJEditorPane().putClientProperty("bsb-completion-provider", 
                completionProvider);
        globalOrcEditPane.getJEditorPane().putClientProperty("bsb-completion-provider", 
                completionProvider);

        initActions();

        codePane.getJEditorPane().setEnabled(false);
        alwaysOnCodePane.getJEditorPane().setEnabled(false);
        globalOrcEditPane.getJEditorPane().setEnabled(false);
        globalScoEditPane.setEnabled(false);

    }

    /**
     * 
     */
    private void initActions() {

        this.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(
                KeyStroke.getKeyStroke(KeyEvent.VK_E, BlueSystem.
                getMenuShortcutKey()), "switchEditMode");
        this.getActionMap().put("switchEditMode", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                editBox.doClick();
            }
        });
    }

    private void setupCodeCompleteAction(JComponent component,
            KeyStroke codeCompleteKeyStroke, Action codeCompleteAction) {

        InputMap inputMap = component.getInputMap(WHEN_FOCUSED);
        ActionMap actionMap = component.getActionMap();

        inputMap.put(codeCompleteKeyStroke, "bsbCodeComplete");
        actionMap.put("bsbCodeComplete", codeCompleteAction);
    }

    /**
     * @param bsb
     */
    public void editBlueSynthBuilder(BlueSynthBuilder bsb) {
        this.bsb = null;

        codePane.setText(bsb.getInstrumentText());
        codePane.getJEditorPane().setCaretPosition(0);

        alwaysOnCodePane.setText(bsb.getAlwaysOnInstrumentText());
        alwaysOnCodePane.getJEditorPane().setCaretPosition(0);

        globalOrcEditPane.setText(bsb.getGlobalOrc());
        globalOrcEditPane.getJEditorPane().setCaretPosition(0);

        globalScoEditPane.setText(bsb.getGlobalSco());
        globalScoEditPane.setCaretPosition(0);

        if (bsb != null) {
            if (editBox.isSelected() != bsb.isEditEnabled()) {
                editBox.doClick();
            }
            completionProvider.setBSBGraphicInterface(bsb.getGraphicInterface());
        } else {
            editBox.setSelected(false);
            completionProvider.setBSBGraphicInterface(null);
        }

        this.bsb = bsb;

        undo.discardAllEdits();
    }
}
