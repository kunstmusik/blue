/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2012 Steven Yi (stevenyi@gmail.com)
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

import blue.BlueSystem;
import blue.gui.InfoDialog;
import blue.udo.UDOStyle;
import blue.udo.UserDefinedOpcode;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import blue.undo.TabWatchingUndoableEditGenerator;
import blue.utility.UDOUtilities;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.text.Document;
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

/**
 *
 * @author stevenyi
 */
public class UDOEditor extends javax.swing.JPanel {

    private boolean isUpdating = false;

    UserDefinedOpcode udo = null;

    UndoManager undo = new UndoRedo.Manager();

    MimeTypeEditorComponent codeBody = new MimeTypeEditorComponent(
            "text/x-csound-orc");

    MimeTypeEditorComponent comments = new MimeTypeEditorComponent("text/plain");

    private final JTextField inTypes = new JTextField();
    private final JLabel inTypesLabel = new JLabel();
    private final JTextField outTypes = new JTextField();
    private final JLabel outTypesLabel = new JLabel();

    /**
     * Creates new form UDOEditor
     */
    public UDOEditor() {
        initComponents();
        configureSignaturePanel();

        DocumentListener documentListener = new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                updateValue(e.getDocument());
            }

        };

        jTabbedPane1.insertTab("Code", null, codeBody, null, 0);
        jTabbedPane1.insertTab("Comments", null, comments, null, 1);
        jTabbedPane1.setSelectedIndex(0);
        jTabbedPane1.setBorder(BorderFactory.createEmptyBorder(0, 10, 10, 10));

        UDOStyleComboBoxSupport.configure(styleComboBox);

        outTypes.getDocument().addDocumentListener(documentListener);
        inTypes.getDocument().addDocumentListener(documentListener);
        codeBody.getDocument().addDocumentListener(documentListener);
        comments.getDocument().addDocumentListener(documentListener);

        styleComboBox.addActionListener((ActionEvent e) -> {
            updateStyle();
        });

        testOpcodeButton.addActionListener((ActionEvent e) -> {
            testOpcode();
        });

        editUserDefinedOpcode(null);

        new TabWatchingUndoableEditGenerator(jTabbedPane1, undo);

        outTypes.getDocument().addUndoableEditListener(undo);
        inTypes.getDocument().addUndoableEditListener(undo);
        codeBody.getDocument().addUndoableEditListener(undo);
        comments.getDocument().addUndoableEditListener(undo);

        AbstractAction undoAction = new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                if (undo.canUndo()) {
                    undo.undo();
                }
            }

        };

        AbstractAction redoAction = new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                if (undo.canRedo()) {
                    undo.redo();
                }
            }

        };

        setUndoActions(outTypes, undoAction, redoAction);
        setUndoActions(inTypes, undoAction, redoAction);

        codeBody.setUndoManager(undo);
        undo.setLimit(1000);
    }

    private void configureSignaturePanel() {
        inTypesLabel.setText(org.openide.util.NbBundle.getMessage(
                UDOEditor.class, "UDOEditor.inTypesLabel.text"));
        inTypesLabel.setLabelFor(inTypes);
        inTypes.setColumns(16);

        outTypesLabel.setText(org.openide.util.NbBundle.getMessage(
                UDOEditor.class, "UDOEditor.outTypesLabel.text"));
        outTypesLabel.setLabelFor(outTypes);
        outTypes.setColumns(16);

        signaturePanel.setOpaque(false);
        leftSignaturePanel.setOpaque(false);
        rightSignaturePanel.setOpaque(false);
    }

    private void refreshSignatureFields(UDOStyle style) {
        UDOStyle activeStyle = style == null ? UDOStyle.CLASSIC : style;
        boolean isModern = activeStyle == UDOStyle.MODERN;

        inTypesLabel.setText(isModern ? "Input Arguments:" : "In Types:");
        outTypesLabel.setText(isModern ? "Out Types (comma-sep):"
                : "Out Types:");

        leftSignaturePanel.removeAll();
        rightSignaturePanel.removeAll();

        if (isModern) {
            setSignaturePanel(leftSignaturePanel, inTypesLabel, inTypes);
            setSignaturePanel(rightSignaturePanel, outTypesLabel, outTypes);
        } else {
            setSignaturePanel(leftSignaturePanel, outTypesLabel, outTypes);
            setSignaturePanel(rightSignaturePanel, inTypesLabel, inTypes);
        }

        signaturePanel.revalidate();
        signaturePanel.repaint();
    }

    private void setSignaturePanel(JPanel panel, JLabel label,
            JTextField textField) {
        panel.add(label, BorderLayout.WEST);
        panel.add(textField, BorderLayout.CENTER);
    }

    private void setUndoActions(JComponent field, Action undoAction,
            Action redoAction) {
        KeyStroke undoKeyStroke = KeyStroke.getKeyStroke(KeyEvent.VK_Z,
                BlueSystem.getMenuShortcutKeyEx());

        KeyStroke redoKeyStroke = KeyStroke.getKeyStroke(KeyEvent.VK_Z,
                BlueSystem.getMenuShortcutKeyEx()
                | KeyEvent.SHIFT_DOWN_MASK);

        field.getInputMap().put(undoKeyStroke, "undo");
        field.getInputMap().put(redoKeyStroke, "redo");
        field.getActionMap().put("undo", undoAction);
        field.getActionMap().put("redo", redoAction);
    }

    protected void testOpcode() {
        if (udo != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this), udo
                    .generateCode(), "User-Defined Opcode");
        }
    }

    protected void updateValue(Document document) {
        if (udo == null || isUpdating) {
            return;
        }

        if (document == outTypes.getDocument()) {
            if (udo.style == UDOStyle.MODERN) {
                udo.outTypes = UDOUtilities.normalizeModernOutTypes(
                        outTypes.getText());
            } else {
                udo.outTypes = outTypes.getText();
            }
        } else if (document == inTypes.getDocument()) {
            if (udo.style == UDOStyle.MODERN) {
                udo.inputArguments = inTypes.getText();
            } else {
                udo.inTypes = inTypes.getText();
            }
        } else if (document == codeBody.getDocument()) {
            udo.codeBody = codeBody.getText();
        } else if (document == comments.getDocument()) {
            udo.comments = comments.getText();
        }
    }

    private void updateStyle() {
        if (udo == null || isUpdating) {
            return;
        }

        UDOStyle selectedStyle = (UDOStyle) styleComboBox.getSelectedItem();
        if (selectedStyle == null || selectedStyle == udo.style) {
            return;
        }

        isUpdating = true;
        if (selectedStyle == UDOStyle.MODERN) {
            UDOUtilities.convertToModern(udo);
        } else {
            UDOUtilities.convertToClassic(udo);
        }

        refreshSignatureFields(selectedStyle);
        setFields(udo);
        isUpdating = false;
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
            styleComboBox.setSelectedItem(UDOStyle.CLASSIC);
            outTypes.setText("");
            inTypes.setText("");
            codeBody.setText("");
            comments.setText("");

            styleComboBox.setEnabled(false);
            outTypes.setEnabled(false);
            inTypes.setEnabled(false);
            codeBody.getJEditorPane().setEnabled(false);
            comments.getJEditorPane().setEnabled(false);
            testOpcodeButton.setEnabled(false);
            outTypes.setEditable(false);
            inTypes.setEditable(false);
            refreshSignatureFields(UDOStyle.CLASSIC);
        } else {
            styleComboBox.setSelectedItem(udo.style);
            codeBody.setText(udo.codeBody);
            comments.setText(udo.comments);

            styleComboBox.setEnabled(true);
            outTypes.setEnabled(true);
            inTypes.setEnabled(true);
            codeBody.getJEditorPane().setEnabled(true);
            comments.getJEditorPane().setEnabled(true);
            testOpcodeButton.setEnabled(true);

            outTypes.setEditable(true);
            inTypes.setEditable(true);

            if (udo.style == UDOStyle.MODERN) {
                inTypes.setText(udo.inputArguments);
                outTypes.setText(UDOUtilities.getModernOutTypesDisplay(
                        udo.outTypes));
            } else {
                outTypes.setText(udo.outTypes);
                inTypes.setText(udo.inTypes);
            }
            refreshSignatureFields(udo.style);
        }

        codeBody.getJEditorPane().setCaretPosition(0);
        comments.getJEditorPane().setCaretPosition(0);
        codeBody.resetUndoManager();
        comments.resetUndoManager();
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jTabbedPane1 = new javax.swing.JTabbedPane();
        styleLabel = new javax.swing.JLabel();
        styleComboBox = new javax.swing.JComboBox<>();
        signaturePanel = new javax.swing.JPanel();
        leftSignaturePanel = new javax.swing.JPanel();
        rightSignaturePanel = new javax.swing.JPanel();
        testOpcodeButton = new javax.swing.JButton();

        styleLabel.setText(org.openide.util.NbBundle.getMessage(UDOEditor.class, "UDOEditor.styleLabel.text")); // NOI18N

        signaturePanel.setLayout(new java.awt.GridLayout(1, 2, 10, 0));

        leftSignaturePanel.setLayout(new java.awt.BorderLayout(6, 0));
        signaturePanel.add(leftSignaturePanel);

        rightSignaturePanel.setLayout(new java.awt.BorderLayout(6, 0));
        signaturePanel.add(rightSignaturePanel);

        testOpcodeButton.setText(org.openide.util.NbBundle.getMessage(UDOEditor.class, "UDOEditor.testOpcodeButton.text")); // NOI18N

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jTabbedPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 610, Short.MAX_VALUE)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(styleLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(styleComboBox, 0, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(testOpcodeButton)
                .addContainerGap())
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(signaturePanel, javax.swing.GroupLayout.DEFAULT_SIZE, 598, Short.MAX_VALUE)
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(styleLabel)
                    .addComponent(styleComboBox, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(testOpcodeButton))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(signaturePanel, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jTabbedPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 263, Short.MAX_VALUE))
        );
    }// </editor-fold>//GEN-END:initComponents

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JTabbedPane jTabbedPane1;
    private javax.swing.JPanel leftSignaturePanel;
    private javax.swing.JPanel rightSignaturePanel;
    private javax.swing.JPanel signaturePanel;
    private javax.swing.JComboBox<UDOStyle> styleComboBox;
    private javax.swing.JLabel styleLabel;
    private javax.swing.JButton testOpcodeButton;
    // End of variables declaration//GEN-END:variables
}
