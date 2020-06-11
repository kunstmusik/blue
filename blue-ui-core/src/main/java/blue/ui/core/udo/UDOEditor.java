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
import blue.udo.UserDefinedOpcode;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import blue.undo.TabWatchingUndoableEditGenerator;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import javax.swing.*;
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
    
    MimeTypeEditorComponent codeBody = new MimeTypeEditorComponent("text/x-csound-orc");
    
    MimeTypeEditorComponent comments = new MimeTypeEditorComponent("text/plain");
    
    /**
     * Creates new form UDOEditor
     */
    public UDOEditor() {
        initComponents();
        
         DocumentListener dl = new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                updateValue(e.getDocument());
            }

        };
         
        jTabbedPane1.insertTab("Code", null, codeBody, null, 0);
        jTabbedPane1.insertTab("Comments", null, comments, null, 1);
        jTabbedPane1.setSelectedIndex(0);
        outTypes.getDocument().addDocumentListener(dl);
        inTypes.getDocument().addDocumentListener(dl);

        codeBody.getDocument().addDocumentListener(dl);
        comments.getDocument().addDocumentListener(dl);

        testOpcodeButton.addActionListener((ActionEvent e) -> {
            testOpcode();
        });


//        comments.setWrapStyleWord(true);
//        comments.setLineWrap(true);

        jTabbedPane1.setBorder(BorderFactory.createEmptyBorder(0, 10, 10, 10));

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

        outTypes.getDocument().addDocumentListener(dl);
        inTypes.getDocument().addDocumentListener(dl);
        codeBody.getDocument().addDocumentListener(dl);
        comments.getDocument().addDocumentListener(dl);

        setUndoActions(outTypes, undoAction, redoAction);
        setUndoActions(inTypes, undoAction, redoAction);

        codeBody.setUndoManager(undo);
        
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
            codeBody.getJEditorPane().setEnabled(false);
            comments.getJEditorPane().setEnabled(false);
        } else {
            outTypes.setText(udo.outTypes);
            inTypes.setText(udo.inTypes);
            codeBody.setText(udo.codeBody);
            comments.setText(udo.comments);

            outTypes.setEnabled(true);
            inTypes.setEnabled(true);
            codeBody.getJEditorPane().setEnabled(true);
            comments.getJEditorPane().setEnabled(true);
            
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
        outTypesLabel = new javax.swing.JLabel();
        outTypes = new javax.swing.JTextField();
        inTypesLabel = new javax.swing.JLabel();
        inTypes = new javax.swing.JTextField();
        testOpcodeButton = new javax.swing.JButton();

        outTypesLabel.setText(org.openide.util.NbBundle.getMessage(UDOEditor.class, "UDOEditor.outTypesLabel.text")); // NOI18N

        outTypes.setText(org.openide.util.NbBundle.getMessage(UDOEditor.class, "UDOEditor.outTypes.text")); // NOI18N

        inTypesLabel.setText(org.openide.util.NbBundle.getMessage(UDOEditor.class, "UDOEditor.inTypesLabel.text")); // NOI18N

        inTypes.setText(org.openide.util.NbBundle.getMessage(UDOEditor.class, "UDOEditor.inTypes.text")); // NOI18N

        testOpcodeButton.setText(org.openide.util.NbBundle.getMessage(UDOEditor.class, "UDOEditor.testOpcodeButton.text")); // NOI18N

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jTabbedPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 610, Short.MAX_VALUE)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(outTypesLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(outTypes)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(inTypesLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(inTypes)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(testOpcodeButton)
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(testOpcodeButton)
                    .addComponent(outTypes, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(inTypesLabel)
                    .addComponent(outTypesLabel)
                    .addComponent(inTypes, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jTabbedPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 263, Short.MAX_VALUE))
        );
    }// </editor-fold>//GEN-END:initComponents
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JTextField inTypes;
    private javax.swing.JLabel inTypesLabel;
    private javax.swing.JTabbedPane jTabbedPane1;
    private javax.swing.JTextField outTypes;
    private javax.swing.JLabel outTypesLabel;
    private javax.swing.JButton testOpcodeButton;
    // End of variables declaration//GEN-END:variables
}
