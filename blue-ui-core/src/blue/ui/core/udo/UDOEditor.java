/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue.ui.core.udo;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.event.UndoableEditEvent;
import javax.swing.event.UndoableEditListener;
import javax.swing.text.Document;
import javax.swing.undo.UndoManager;
import javax.swing.undo.UndoableEdit;

import blue.BlueSystem;
import blue.event.SimpleDocumentListener;
import blue.gui.BlueEditorPane;
import blue.gui.InfoDialog;
import blue.gui.LabelledItemPanel;
import blue.udo.UserDefinedOpcode;
import blue.undo.NoStyleChangeUndoManager;
import blue.undo.TabSelectionWrapper;

/**
 * @author Steven Yi
 */
public class UDOEditor extends JComponent {

    JTextField outTypes = new JTextField();

    JTextField inTypes = new JTextField();

    BlueEditorPane codeBody = new BlueEditorPane();

    JTextArea comments = new JTextArea();

    private boolean isUpdating = false;

    UserDefinedOpcode udo = null;

    UndoManager undo = new NoStyleChangeUndoManager();

    public UDOEditor() {

        DocumentListener dl = new SimpleDocumentListener() {

            public void documentChanged(DocumentEvent e) {
                updateValue(e.getDocument());
            }

        };

        outTypes.getDocument().addDocumentListener(dl);
        inTypes.getDocument().addDocumentListener(dl);

        codeBody.getDocument().addDocumentListener(dl);
        comments.getDocument().addDocumentListener(dl);

        JButton testOpcodeButton = new JButton("Test Opcode");
        testOpcodeButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                testOpcode();
            }

        });

        LabelledItemPanel itemPanel = new LabelledItemPanel();

        itemPanel.addItem("Out Types:", outTypes);
        itemPanel.addItem("In Types:", inTypes);
        itemPanel.addItem("", testOpcodeButton);

        final JTabbedPane tabs = new JTabbedPane();
        tabs.add("Code", codeBody);
        tabs.add("Comments", new JScrollPane(comments));

        comments.setWrapStyleWord(true);
        comments.setLineWrap(true);

        tabs.setBorder(BorderFactory.createEmptyBorder(0, 10, 10, 10));

        this.setLayout(new BorderLayout());

        this.add(itemPanel, BorderLayout.NORTH);
        this.add(tabs, BorderLayout.CENTER);

        editUserDefinedOpcode(null);

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

        outTypes.getDocument().addUndoableEditListener(ul);
        inTypes.getDocument().addUndoableEditListener(ul);
        codeBody.getDocument().addUndoableEditListener(ul);
        comments.getDocument().addUndoableEditListener(ul);

        AbstractAction undoAction = new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (undo.canUndo()) {
                    undo.undo();
                }
            }

        };

        AbstractAction redoAction = new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (undo.canRedo()) {
                    undo.redo();
                }
            }

        };

        outTypes.getDocument().addDocumentListener(dl);
        inTypes.getDocument().addDocumentListener(dl);
        codeBody.getDocument().addDocumentListener(dl);
        comments.getDocument().addDocumentListener(dl);

        setUndoActions(outTypes, undoAction, redoAction);
        setUndoActions(inTypes, undoAction, redoAction);
        setUndoActions(codeBody, undoAction, redoAction);
        setUndoActions(comments, undoAction, redoAction);

        undo.setLimit(1000);

    }

    private void setUndoActions(JComponent field, Action undoAction,
            Action redoAction) {
        KeyStroke undoKeyStroke = KeyStroke.getKeyStroke(KeyEvent.VK_Z,
                BlueSystem.getMenuShortcutKey());

        KeyStroke redoKeyStroke = KeyStroke.getKeyStroke(KeyEvent.VK_Z,
                BlueSystem.getMenuShortcutKey() | KeyEvent.SHIFT_DOWN_MASK);

        field.getInputMap().put(undoKeyStroke, "undo");
        field.getInputMap().put(redoKeyStroke, "redo");
        field.getActionMap().put("undo", undoAction);
        field.getActionMap().put("redo", redoAction);
    }

    /**
     * 
     */
    protected void testOpcode() {
        if (udo != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this), udo
                    .generateCode(), "User-Defined Opcode");
        }
    }

    /**
     * @param document
     */
    protected void updateValue(Document document) {
        if (udo == null || isUpdating) {
            return;
        }

        if (document == outTypes.getDocument()) {
            udo.outTypes = outTypes.getText();
        } else if (document == inTypes.getDocument()) {
            udo.inTypes = inTypes.getText();
        } else if (document == codeBody.getDocument()) {
            udo.codeBody = codeBody.getText();
        } else if (document == comments.getDocument()) {
            udo.comments = comments.getText();
        }

    }

    public void editUserDefinedOpcode(UserDefinedOpcode udo) {
        isUpdating = true;

        this.udo = udo;
        setFields(udo);

        isUpdating = false;

        undo.discardAllEdits();
    }

    private void setFields(UserDefinedOpcode udo) {
        if (udo == null) {
            outTypes.setText("");
            inTypes.setText("");
            codeBody.setText("");
            comments.setText("");

            outTypes.setEnabled(false);
            inTypes.setEnabled(false);
            codeBody.setEnabled(false);
            comments.setEnabled(false);
        } else {
            outTypes.setText(udo.outTypes);
            inTypes.setText(udo.inTypes);
            codeBody.setText(udo.codeBody);
            comments.setText(udo.comments);

            outTypes.setEnabled(true);
            inTypes.setEnabled(true);
            codeBody.setEnabled(true);
            comments.setEnabled(true);
        }

    }

}
