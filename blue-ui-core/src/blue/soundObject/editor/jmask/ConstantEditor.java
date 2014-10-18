/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.jmask;

import java.awt.Color;

import javax.swing.BorderFactory;
import javax.swing.border.Border;
import javax.swing.event.DocumentEvent;

import blue.soundObject.jmask.Constant;
import blue.ui.utilities.SimpleDocumentListener;

/**
 * 
 * @author steven
 */
public class ConstantEditor extends javax.swing.JPanel implements DurationSettable {

    private Constant constant;

    Border normalBorder;

    Border errorBorder;

    /** Creates new form ConstantEditor */
    public ConstantEditor(final Constant constant) {
        this.constant = constant;

        initComponents();

        normalBorder = valueText.getBorder();
        errorBorder = BorderFactory.createLineBorder(Color.RED);

        valueText.setText(Double.toString(constant.getValue()));

        valueText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        try {
                            double val = Double
                                    .parseDouble(valueText.getText());

                            constant.setValue(val);

                            if (valueText.getBorder() != normalBorder) {
                                valueText.setBorder(normalBorder);
                            }
                        } catch (NumberFormatException nfe) {
                            valueText.setBorder(errorBorder);
                        }
                    }
                });

    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc=" Generated Code
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        constantLabel = new javax.swing.JLabel();
        valueText = new javax.swing.JTextField();

        constantLabel.setText("Constant");

        valueText.setText("jTextField1");
        valueText.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                valueTextFocusLost(evt);
            }
        });

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(constantLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(valueText, javax.swing.GroupLayout.DEFAULT_SIZE, 232, Short.MAX_VALUE)
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(constantLabel)
                    .addComponent(valueText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addContainerGap(javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
    }// </editor-fold>//GEN-END:initComponents

    private void valueTextFocusLost(java.awt.event.FocusEvent evt) {// GEN-FIRST:event_valueTextFocusLost
        if (valueText.getBorder() == errorBorder) {
            valueText.setText(Double.toString(constant.getValue()));
        }
    }// GEN-LAST:event_valueTextFocusLost

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JLabel constantLabel;
    private javax.swing.JTextField valueText;
    // End of variables declaration//GEN-END:variables

    public void setDuration(double duration) {
        //ignore
    }

}
