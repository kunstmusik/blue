/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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

import blue.mixer.*;
import java.awt.BorderLayout;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.DocumentEvent;

import blue.BlueSystem;
import blue.orchestra.editor.blueSynthBuilder.BSBCompletionProvider;
import blue.orchestra.editor.blueSynthBuilder.BSBInterfaceEditor;
import blue.ui.core.udo.EmbeddedOpcodeListPanel;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import blue.undo.TabWatchingUndoableEditGenerator;
import blue.utility.GUI;
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

/**
 *
 * @author steven
 */
public class EffectEditor extends javax.swing.JPanel implements
        PropertyChangeListener {

    //FIXME - check if this class needs to add removeNotify to remove listeners
    BSBInterfaceEditor interfaceEditor = new BSBInterfaceEditor(
            EffectsObjectRegistry.getBSBObjects(), true);
    BSBCompletionProvider completionProvider = new BSBCompletionProvider();
    MimeTypeEditorComponent code1 = new MimeTypeEditorComponent(
            "text/x-blue-synth-builder");
    MimeTypeEditorComponent commentsText = new MimeTypeEditorComponent(
            "text/plain");
    JLabel xInLabel = new JLabel();
    JLabel xOutLabel = new JLabel();
    EmbeddedOpcodeListPanel udoPanel = new EmbeddedOpcodeListPanel();
        
    private Effect effect = null;
    UndoManager undo = new UndoRedo.Manager();

    /**
     * Creates new form EffectEditor
     */
    public EffectEditor() {
        initComponents();

        tabs.add("Interface", interfaceEditor);

        JPanel codePanel = new JPanel(new BorderLayout());
        codePanel.add(xInLabel, BorderLayout.NORTH);
        codePanel.add(code1, BorderLayout.CENTER);
        codePanel.add(xOutLabel, BorderLayout.SOUTH);

        inSpinner.setModel(new SpinnerNumberModel(1, 1, 100, 1));
        inSpinner.addChangeListener(new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                if (effect != null) {
                    Integer val = (Integer) inSpinner.getValue();

                    effect.setNumIns(val.intValue());
                }
            }
        });

        outSpinner.setModel(new SpinnerNumberModel(1, 1, 100, 1));
        outSpinner.addChangeListener(new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                if (effect != null) {
                    Integer val = (Integer) outSpinner.getValue();

                    effect.setNumOuts(val.intValue());
                }
            }
        });

        tabs.add("Code", codePanel);

        commentsText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        if (effect != null) {
                            effect.setComments(commentsText.getText());
                        }
                    }
                });

        tabs.add(BlueSystem.getString("instrument.udo"), udoPanel);

        tabs.add("Comments", commentsText);
        commentsText.getDocument().addUndoableEditListener(undo);
        commentsText.setUndoManager(undo);

        new TabWatchingUndoableEditGenerator(tabs, undo);
        
        setEffect(null);

        code1.getDocument().addUndoableEditListener(undo);
        code1.setUndoManager(undo);
        code1.getJEditorPane().putClientProperty("bsb-completion-provider",
                completionProvider);
        code1.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        if (effect != null) {
                            effect.setCode(code1.getText());
                        }
                    }
                });
    }

    public void setEffect(Effect effect) {
        if (this.effect != null) {
            this.effect.removePropertyChangeListener(this);
        }

        if (this.effect == effect && this.effect != null) {
            return;
        }

        this.effect = null;

        if (effect == null) {
            interfaceEditor.editInterface(null, null);
            completionProvider.setBSBGraphicInterface(null);
            code1.setText(null);
            commentsText.setText("");
            inSpinner.setValue(new Integer(1));
            outSpinner.setValue(new Integer(1));

            code1.getJEditorPane().setEnabled(false);
            commentsText.getJEditorPane().setEnabled(false);
            inSpinner.setEnabled(false);
            outSpinner.setEnabled(false);

            udoPanel.editOpcodeList(null);
        } else {
            interfaceEditor.editInterface(effect.getGraphicInterface(), null);
            completionProvider.setBSBGraphicInterface(
                    effect.getGraphicInterface());
            code1.getJEditorPane().setText(effect.getCode());
            commentsText.setText(effect.getComments());

            inSpinner.setValue(new Integer(effect.getNumIns()));
            outSpinner.setValue(new Integer(effect.getNumOuts()));

            code1.getJEditorPane().setEnabled(true);
            commentsText.getJEditorPane().setEnabled(true);
            inSpinner.setEnabled(true);
            outSpinner.setEnabled(true);

            udoPanel.editOpcodeList(effect.getOpcodeList());

            effect.addPropertyChangeListener(this);
        }

        code1.getJEditorPane().setCaretPosition(0);
        commentsText.getJEditorPane().setCaretPosition(0);

        
        this.effect = effect;

        updateXLabels();
        undo.discardAllEdits();
    }

    private void updateXLabels() {
        if (this.effect == null) {
            xInLabel.setText(" ");
            xOutLabel.setText(" ");
            return;
        }

        int numIns = effect.getNumIns();
        int numOuts = effect.getNumOuts();

        StringBuffer inText = new StringBuffer();
        StringBuffer outText = new StringBuffer();

        inText.append("<html>");

        for (int i = 0; i < numIns; i++) {
            if (i > 0) {
                inText.append(",");
            }
            inText.append("ain").append(i + 1);
        }

        inText.append(" <b>xin</b></html>");

        outText.append("<html><b>xout</b> ");
        for (int i = 0; i < numOuts; i++) {
            if (i > 0) {
                outText.append(",");
            }
            outText.append("aout").append(i + 1);
        }
        outText.append("</html>");

        xInLabel.setText(inText.toString());
        xOutLabel.setText(outText.toString());
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc=" Generated Code
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        inputLabel = new javax.swing.JLabel();
        outputLabel = new javax.swing.JLabel();
        inSpinner = new javax.swing.JSpinner();
        outSpinner = new javax.swing.JSpinner();
        tabs = new javax.swing.JTabbedPane();

        inputLabel.setText("Inputs:");

        outputLabel.setText("Outputs:");

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(tabs, javax.swing.GroupLayout.DEFAULT_SIZE, 479, Short.MAX_VALUE)
                    .addGroup(layout.createSequentialGroup()
                        .addComponent(inputLabel)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(inSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 42, javax.swing.GroupLayout.PREFERRED_SIZE)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(outputLabel)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(outSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 42, javax.swing.GroupLayout.PREFERRED_SIZE)))
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(inputLabel)
                    .addComponent(inSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(outputLabel)
                    .addComponent(outSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(tabs, javax.swing.GroupLayout.DEFAULT_SIZE, 390, Short.MAX_VALUE)
                .addContainerGap())
        );
    }// </editor-fold>//GEN-END:initComponents

    public static void main(String args[]) {
        GUI.setBlueLookAndFeel();

        EffectEditor editor = new EffectEditor();
        editor.setEffect(new Effect());

        GUI.showComponentAsStandalone(editor, "Effect Editor", true);
    }

    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.effect) {
            String prop = evt.getPropertyName();

            if (prop.equals("numIns") || prop.equals("numOuts")) {
                updateXLabels();
            }
        }
    }
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JSpinner inSpinner;
    private javax.swing.JLabel inputLabel;
    private javax.swing.JSpinner outSpinner;
    private javax.swing.JLabel outputLabel;
    private javax.swing.JTabbedPane tabs;
    // End of variables declaration//GEN-END:variables
}
