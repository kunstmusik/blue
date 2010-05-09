/*
 * blue - object composition environment for csound Copyright (c) 2000-2008
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.soundObject.editor;

import blue.BlueSystem;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.soundObject.NoteList;
import blue.soundObject.PythonObject;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import blue.undo.NoStyleChangeUndoManager;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.event.UndoableEditEvent;
import javax.swing.event.UndoableEditListener;
import javax.swing.undo.UndoManager;
import javax.swing.undo.UndoableEdit;
import org.syntax.jedit.tokenmarker.PythonTokenMarker;

/**
 *
 * @author steven
 */
public class PythonEditor extends SoundObjectEditor {

    PythonObject pObj = null;
    UndoManager undo = new NoStyleChangeUndoManager();

    /** Creates new form PythonEditor */
    public PythonEditor() {
        initComponents();

        initActions();

        codeEditPane.getDocument().addDocumentListener(new DocumentListener() {

            public void insertUpdate(DocumentEvent e) {
                if (pObj != null) {
                    pObj.setText(codeEditPane.getText());
                }
            }

            public void removeUpdate(DocumentEvent e) {
                if (pObj != null) {
                    pObj.setText(codeEditPane.getText());
                }
            }

            public void changedUpdate(DocumentEvent e) {
                if (pObj != null) {
                    pObj.setText(codeEditPane.getText());
                }
            }
        });

        codeEditPane.getDocument().addUndoableEditListener(
                new UndoableEditListener() {

                    public void undoableEditHappened(UndoableEditEvent e) {
                        UndoableEdit edit = e.getEdit();
                        undo.addEdit(edit);

                    }
                });

        undo.setLimit(1000);
    }

    private void initActions() {
        InputMap inputMap = codeEditPane.getInputMap();
        ActionMap actions = codeEditPane.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_T, BlueSystem.
                getMenuShortcutKey()), "testSoundObject");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_Z, BlueSystem.
                getMenuShortcutKey()), "undo");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_Z, BlueSystem.
                getMenuShortcutKey() | KeyEvent.SHIFT_DOWN_MASK), "redo");

        actions.put("testSoundObject", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                testSoundObject();
            }
        });

        actions.put("undo", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (undo.canUndo()) {
                    undo.undo();
                }
            }
        });

        actions.put("redo", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (undo.canRedo()) {
                    undo.redo();
                }
            }
        });
    }

    public final void editSoundObject(SoundObject sObj) {
        this.pObj = null;
        
        if (sObj == null) {
            codeEditPane.setText("null soundObject");
            codeEditPane.setEnabled(false);
            processOnLoadCheckBox.setEnabled(false);
            return;
        }

        if (!(sObj instanceof PythonObject)) {            
            codeEditPane.setText(
                    "[ERROR] GenericEditor::editSoundObject - not instance " +
                    "of GenericEditable");
            codeEditPane.setEnabled(false);
            processOnLoadCheckBox.setEnabled(false);
            return;
        }

        PythonObject tempPObj = (PythonObject) sObj;

        codeEditPane.setTokenMarker(new PythonTokenMarker());

        codeEditPane.setText(tempPObj.getText());
        codeEditPane.setEnabled(true);
        codeEditPane.setCaretPosition(0);

        processOnLoadCheckBox.setSelected(tempPObj.isOnLoadProcessable());
        processOnLoadCheckBox.setEnabled(true);

        undo.discardAllEdits();

        this.pObj = tempPObj;
    }

    public final void testSoundObject() {
        if (this.pObj == null) {
            return;
        }

        NoteList notes = null;

        try {
            notes = ((SoundObject) this.pObj).generateNotes(0.0f, -1.0f);
        } catch (SoundObjectException e) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this), e);
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem.getString(
                    "soundObject.generatedScore"));
        }
    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        codeEditPane = new blue.gui.BlueEditorPane();
        testButton = new javax.swing.JButton();
        processOnLoadCheckBox = new javax.swing.JCheckBox();
        jLabel1 = new javax.swing.JLabel();

        setPreferredSize(new java.awt.Dimension(596, 222));

        testButton.setText(BlueSystem.getString("common.test"));
        testButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                testButtonActionPerformed(evt);
            }
        });

        processOnLoadCheckBox.setText("Process On Load");
        processOnLoadCheckBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                processOnLoadCheckBoxActionPerformed(evt);
            }
        });

        jLabel1.setText("PythonObject");

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, layout.createSequentialGroup()
                .addContainerGap()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.TRAILING)
                    .add(org.jdesktop.layout.GroupLayout.LEADING, codeEditPane, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                    .add(layout.createSequentialGroup()
                        .add(jLabel1)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED, 298, Short.MAX_VALUE)
                        .add(processOnLoadCheckBox)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                        .add(testButton)))
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, layout.createSequentialGroup()
                .addContainerGap()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(testButton)
                    .add(processOnLoadCheckBox)
                    .add(jLabel1))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(codeEditPane, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 171, Short.MAX_VALUE)
                .addContainerGap())
        );
    }// </editor-fold>//GEN-END:initComponents

    private void processOnLoadCheckBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_processOnLoadCheckBoxActionPerformed
        if (this.pObj != null) {
            this.pObj.setOnLoadProcessable(processOnLoadCheckBox.isSelected());
        }
    }//GEN-LAST:event_processOnLoadCheckBoxActionPerformed

    private void testButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_testButtonActionPerformed
        testSoundObject();
    }//GEN-LAST:event_testButtonActionPerformed
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private blue.gui.BlueEditorPane codeEditPane;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JCheckBox processOnLoadCheckBox;
    private javax.swing.JButton testButton;
    // End of variables declaration//GEN-END:variables
}
