/*
 * ExponentialEditor.java
 *
 * Created on April 20, 2008, 10:25 PM
 */
package blue.soundObject.editor.jmask.probability;

import blue.soundObject.editor.jmask.DurationSettable;
import blue.soundObject.jmask.probability.Exponential;
import javax.swing.SpinnerNumberModel;

/**
 *
 * @author  syi
 */
public class ExponentialEditor extends javax.swing.JPanel implements DurationSettable {

    Exponential exponential = null;

    /** Creates new form ExponentialEditor */
    public ExponentialEditor(Exponential exponential) {
        initComponents();

        lambdaTableEditor.setPositiveValues();
        lambdaTableEditor.setTable(exponential.getLambdaTable());
        
        lambdaSpinner.setModel(
                new SpinnerNumberModel(
                exponential.getLambda(),
                Double.MIN_VALUE, Double.MAX_VALUE, 0.1));

        directionComboBox.setSelectedIndex(exponential.getDirection());

        lambdaTypeComboBox.setSelectedIndex(exponential.isLambdaTableEnabled() ? 1 : 0);
        
        this.exponential = exponential;
        
        updateDisplay();
    }

    private void updateDisplay() {
        lambdaSpinner.setVisible(!this.exponential.isLambdaTableEnabled());
        lambdaTableEditor.setVisible(this.exponential.isLambdaTableEnabled());
    }
    
    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        lambdaButtonGroup = new javax.swing.ButtonGroup();
        jLabel1 = new javax.swing.JLabel();
        directionComboBox = new javax.swing.JComboBox();
        lambdaSpinner = new javax.swing.JSpinner();
        lambdaTableEditor = new blue.soundObject.editor.jmask.TableEditor();
        lambdaTypeComboBox = new javax.swing.JComboBox();

        jLabel1.setText("Direction");

        directionComboBox.setModel(new javax.swing.DefaultComboBoxModel(new String[] { "Decreasing", "Increasing", "Bilateral" }));
        directionComboBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                directionComboBoxActionPerformed(evt);
            }
        });

        lambdaSpinner.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                lambdaSpinnerStateChanged(evt);
            }
        });

        lambdaTypeComboBox.setModel(new javax.swing.DefaultComboBoxModel(new String[] { "Lambda (Constant)", "Lambda (Table)" }));
        lambdaTypeComboBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                lambdaTypeComboBoxActionPerformed(evt);
            }
        });

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING, false)
                        .addGroup(javax.swing.GroupLayout.Alignment.LEADING, layout.createSequentialGroup()
                            .addComponent(jLabel1)
                            .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.UNRELATED)
                            .addComponent(directionComboBox, 0, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
                        .addGroup(javax.swing.GroupLayout.Alignment.LEADING, layout.createSequentialGroup()
                            .addComponent(lambdaTypeComboBox, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                            .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                            .addComponent(lambdaSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 84, javax.swing.GroupLayout.PREFERRED_SIZE)))
                    .addComponent(lambdaTableEditor, javax.swing.GroupLayout.PREFERRED_SIZE, 445, Short.MAX_VALUE))
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel1)
                    .addComponent(directionComboBox, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(lambdaSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(lambdaTypeComboBox, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(lambdaTableEditor, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addContainerGap(javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
    }// </editor-fold>//GEN-END:initComponents

    private void lambdaSpinnerStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_lambdaSpinnerStateChanged
        if (this.exponential != null) {
            this.exponential.setLambda(
                    ((Double)lambdaSpinner.getValue()).doubleValue());
        }
}//GEN-LAST:event_lambdaSpinnerStateChanged

    private void directionComboBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_directionComboBoxActionPerformed
        if (this.exponential != null) {
            this.exponential.setDirection(directionComboBox.getSelectedIndex());
        }
}//GEN-LAST:event_directionComboBoxActionPerformed

private void lambdaTypeComboBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_lambdaTypeComboBoxActionPerformed
    if(this.exponential != null) {
        this.exponential.setLambdaTableEnabled(lambdaTypeComboBox.getSelectedIndex() == 1);
        updateDisplay();
    }
}//GEN-LAST:event_lambdaTypeComboBoxActionPerformed

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JComboBox directionComboBox;
    private javax.swing.JLabel jLabel1;
    private javax.swing.ButtonGroup lambdaButtonGroup;
    private javax.swing.JSpinner lambdaSpinner;
    private blue.soundObject.editor.jmask.TableEditor lambdaTableEditor;
    private javax.swing.JComboBox lambdaTypeComboBox;
    // End of variables declaration//GEN-END:variables

    @Override
    public void setDuration(double duration) {
        lambdaTableEditor.setDuration(duration);
    }
}
