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
import blue.event.SimpleDocumentListener;
import blue.orchestra.editor.blueSynthBuilder.BSBInterfaceEditor;
import blue.ui.core.udo.EmbeddedOpcodeListPanel;
import blue.utility.GUI;

/**
 * 
 * @author steven
 */
public class EffectEditor extends javax.swing.JPanel implements
        PropertyChangeListener {

    BSBInterfaceEditor interfaceEditor = new BSBInterfaceEditor(
            EffectsObjectRegistry.getBSBObjects(), true);

    EffectCodeEditor code = new EffectCodeEditor();

    JLabel xInLabel = new JLabel();

    JLabel xOutLabel = new JLabel();

    EmbeddedOpcodeListPanel udoPanel = new EmbeddedOpcodeListPanel();

    JTextArea commentsText = new JTextArea();

    private Effect effect = null;

    /** Creates new form EffectEditor */
    public EffectEditor() {
        initComponents();

        tabs.add("Interface", interfaceEditor);

        JPanel codePanel = new JPanel(new BorderLayout());
        codePanel.add(xInLabel, BorderLayout.NORTH);
        codePanel.add(code, BorderLayout.CENTER);
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

        commentsText.setWrapStyleWord(true);
        commentsText.setLineWrap(true);
        commentsText.setTabSize(4);

        commentsText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (effect != null) {
                            effect.setComments(commentsText.getText());
                        }
                    }

                });

        tabs.add(BlueSystem.getString("instrument.udo"), udoPanel);

        tabs.add("Comments", new JScrollPane(commentsText));

        setEffect(null);
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
            code.editEffect(effect);
            commentsText.setText("");
            inSpinner.setValue(new Integer(1));
            outSpinner.setValue(new Integer(1));

            // code.setEnabled(false);
            commentsText.setEnabled(false);
            inSpinner.setEnabled(false);
            outSpinner.setEnabled(false);

            udoPanel.editOpcodeList(null);
        } else {
            interfaceEditor.editInterface(effect.getGraphicInterface(), null);
            code.editEffect(effect);
            commentsText.setText(effect.getComments());

            inSpinner.setValue(new Integer(effect.getNumIns()));
            outSpinner.setValue(new Integer(effect.getNumOuts()));

            // code.setEnabled(true);
            commentsText.setEnabled(true);
            inSpinner.setEnabled(true);
            outSpinner.setEnabled(true);

            udoPanel.editOpcodeList(effect.getOpcodeList());

            effect.addPropertyChangeListener(this);
        }

        this.effect = effect;

        updateXLabels();
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
    // ">//GEN-BEGIN:initComponents
    private void initComponents() {
        inputLabel = new javax.swing.JLabel();
        outputLabel = new javax.swing.JLabel();
        inSpinner = new javax.swing.JSpinner();
        outSpinner = new javax.swing.JSpinner();
        tabs = new javax.swing.JTabbedPane();

        inputLabel.setText("Inputs:");

        outputLabel.setText("Outputs:");

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(
                this);
        this.setLayout(layout);
        layout
                .setHorizontalGroup(layout
                        .createParallelGroup(
                                org.jdesktop.layout.GroupLayout.LEADING)
                        .add(
                                layout
                                        .createSequentialGroup()
                                        .addContainerGap()
                                        .add(
                                                layout
                                                        .createParallelGroup(
                                                                org.jdesktop.layout.GroupLayout.LEADING)
                                                        .add(
                                                                tabs,
                                                                org.jdesktop.layout.GroupLayout.DEFAULT_SIZE,
                                                                479,
                                                                Short.MAX_VALUE)
                                                        .add(
                                                                layout
                                                                        .createSequentialGroup()
                                                                        .add(
                                                                                inputLabel)
                                                                        .addPreferredGap(
                                                                                org.jdesktop.layout.LayoutStyle.RELATED)
                                                                        .add(
                                                                                inSpinner,
                                                                                org.jdesktop.layout.GroupLayout.PREFERRED_SIZE,
                                                                                42,
                                                                                org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                                                        .addPreferredGap(
                                                                                org.jdesktop.layout.LayoutStyle.RELATED)
                                                                        .add(
                                                                                outputLabel)
                                                                        .addPreferredGap(
                                                                                org.jdesktop.layout.LayoutStyle.RELATED)
                                                                        .add(
                                                                                outSpinner,
                                                                                org.jdesktop.layout.GroupLayout.PREFERRED_SIZE,
                                                                                42,
                                                                                org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)))
                                        .addContainerGap()));
        layout
                .setVerticalGroup(layout
                        .createParallelGroup(
                                org.jdesktop.layout.GroupLayout.LEADING)
                        .add(
                                layout
                                        .createSequentialGroup()
                                        .addContainerGap()
                                        .add(
                                                layout
                                                        .createParallelGroup(
                                                                org.jdesktop.layout.GroupLayout.BASELINE)
                                                        .add(inputLabel)
                                                        .add(
                                                                inSpinner,
                                                                org.jdesktop.layout.GroupLayout.PREFERRED_SIZE,
                                                                org.jdesktop.layout.GroupLayout.DEFAULT_SIZE,
                                                                org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                                        .add(outputLabel)
                                                        .add(
                                                                outSpinner,
                                                                org.jdesktop.layout.GroupLayout.PREFERRED_SIZE,
                                                                org.jdesktop.layout.GroupLayout.DEFAULT_SIZE,
                                                                org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                                        .addPreferredGap(
                                                org.jdesktop.layout.LayoutStyle.RELATED)
                                        .add(
                                                tabs,
                                                org.jdesktop.layout.GroupLayout.DEFAULT_SIZE,
                                                390, Short.MAX_VALUE)
                                        .addContainerGap()));
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
