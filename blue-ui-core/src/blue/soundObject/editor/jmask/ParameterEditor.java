/*
 * ParmeterEditor.java
 *
 * Created on April 20, 2007, 11:37 AM
 */
package blue.soundObject.editor.jmask;

import blue.gui.ListLayoutManager;
import blue.soundObject.jmask.Accumulatable;
import blue.soundObject.jmask.Accumulator;
import blue.soundObject.jmask.Mask;
import java.awt.Color;
import java.beans.PropertyChangeEvent;

import javax.swing.JComponent;
import javax.swing.JOptionPane;
import javax.swing.border.LineBorder;

import blue.soundObject.jmask.Generator;
import blue.soundObject.jmask.GeneratorRegistry;
import blue.soundObject.jmask.Maskable;
import blue.soundObject.jmask.Parameter;
import blue.soundObject.jmask.Quantizable;
import blue.soundObject.jmask.Quantizer;
import blue.ui.utilities.UiUtilities;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.List;
import javax.swing.BorderFactory;
import javax.swing.SwingUtilities;
import javax.swing.border.BevelBorder;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;

/**
 * 
 * @author steven
 */
public class ParameterEditor extends javax.swing.JPanel implements PropertyChangeListener {

    Parameter parameter = null;

    private transient List<ParameterEditListener> listeners = null;

    int parameterNum = -1;

    double duration = 1.0;

    JComponent generatorEditor = null;

    JComponent maskEditor = null;

    JComponent quantizerEditor = null;

    JComponent accumulatorEditor = null;

    /** Creates new form ParmeterEditor */
    public ParameterEditor() {
        initComponents();

        this.setBorder(new LineBorder(Color.BLACK));

        emptyPanel.setLayout(new ListLayoutManager());
        paramLabelPanel.setBackground(paramLabelPanel.getBackground().darker());
    }

    public void setDuration(double duration) {
        this.duration = duration;

        ((DurationSettable) generatorEditor).setDuration(duration);

        if (maskEditor != null) {
            ((DurationSettable) maskEditor).setDuration(duration);
        }

        if (quantizerEditor != null) {
            ((DurationSettable) quantizerEditor).setDuration(duration);
        }

        if (accumulatorEditor != null) {
            ((DurationSettable) accumulatorEditor).setDuration(duration);
        }
    }

    public void setParameter(Parameter parameter, int num) {
        this.parameter = parameter;

        setParameterNumber(num);
        final Generator generator = parameter.getGenerator();
        generatorEditor = GeneratorEditorFactory.getView(generator);

        generatorEditor.setBorder(BorderFactory.createBevelBorder(BevelBorder.RAISED));
        emptyPanel.add(generatorEditor);


        if (generator instanceof Maskable) {
            Mask mask = parameter.getMask();

            if (mask.isEnabled()) {
                maskEditor = new MaskEditor(mask);
                maskEditor.setBorder(BorderFactory.createBevelBorder(BevelBorder.RAISED));
                emptyPanel.add(maskEditor);
            }

            maskCheckBoxMenuItem.setVisible(true);
            maskCheckBoxMenuItem.setSelected(mask.isEnabled());
        } else {
            maskCheckBoxMenuItem.setVisible(false);
        }

        if (generator instanceof Quantizable) {
            Quantizer quantizer = parameter.getQuantizer();

            if (quantizer.isEnabled()) {
                quantizerEditor = new QuantizerEditor(quantizer);
                quantizerEditor.setBorder(BorderFactory.createBevelBorder(BevelBorder.RAISED));
                emptyPanel.add(quantizerEditor);
            }

            quantizeCheckBoxMenuItem.setVisible(true);
            quantizeCheckBoxMenuItem.setSelected(quantizer.isEnabled());
        } else {
            quantizeCheckBoxMenuItem.setVisible(false);
        }

        if (generator instanceof Accumulatable) {
            Accumulator accumulator = parameter.getAccumulator();

            if (accumulator.isEnabled()) {
                accumulatorEditor = new AccumulatorEditor(accumulator);
                accumulatorEditor.setBorder(BorderFactory.createBevelBorder(BevelBorder.RAISED));
                emptyPanel.add(accumulatorEditor);
            }

            accumulatorCheckBoxMenuItem.setVisible(true);
            accumulatorCheckBoxMenuItem.setSelected(accumulator.isEnabled());
        } else {
            accumulatorCheckBoxMenuItem.setVisible(false);
        }

        this.parameter.addPropertyChangeListener(this);
        this.setVisible(this.parameter.isVisible());
    }

    @Override
    public void addNotify() {
        super.addNotify();
        this.parameter.addPropertyChangeListener(this);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        this.parameter.removePropertyChangeListener(this);
    }

    public void setParameterNumber(int num) {
        this.parameterNum = num;
        String label = "p" + num;

        final String fieldName = parameter.getName();

        if(fieldName != null && 
                !fieldName.equals("")) {
            label += " - " + fieldName;
        }

        final String newLabel = label;
        SwingUtilities.invokeLater(() -> {
            paramLabelPanel.setText(newLabel);
            repaint();
        });
    }

    public void addParameterEditListener(ParameterEditListener listener) {
        if (listeners == null) {
            listeners = new ArrayList<>(1);
        }
        listeners.add(listener);
    }

    public void removeParameterEditListener(ParameterEditListener listener) {
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    private void fireParameterEdit(int editType, int parameterNum,
            Generator generator) {
        if (listeners == null) {
            return;
        }

        for (ParameterEditListener listener : listeners) {
            listener.parameterEdit(editType, parameterNum, generator);
        }
    }

    private void updateInterface() {
        emptyPanel.removeAll();
        emptyPanel.add(this.generatorEditor);

        if (this.maskEditor != null) {
            emptyPanel.add(maskEditor);
        }

        if (this.quantizerEditor != null) {
            emptyPanel.add(quantizerEditor);
        }

        if (this.accumulatorEditor != null) {
            emptyPanel.add(accumulatorEditor);
        }

        revalidate();
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc=" Generated Code
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPopupMenu1 = new javax.swing.JPopupMenu();
        addParameterBefore = new javax.swing.JMenuItem();
        addParameterAfter = new javax.swing.JMenuItem();
        removeParameter = new javax.swing.JMenuItem();
        changeParameter = new javax.swing.JMenuItem();
        jSeparator1 = new javax.swing.JSeparator();
        pushUp = new javax.swing.JMenuItem();
        pushDown = new javax.swing.JMenuItem();
        jSeparator2 = new javax.swing.JSeparator();
        maskCheckBoxMenuItem = new javax.swing.JCheckBoxMenuItem();
        quantizeCheckBoxMenuItem = new javax.swing.JCheckBoxMenuItem();
        accumulatorCheckBoxMenuItem = new javax.swing.JCheckBoxMenuItem();
        emptyPanel = new javax.swing.JPanel();
        paramLabelPanel = new javax.swing.JLabel();

        addParameterBefore.setText("Add Parameter Before");
        addParameterBefore.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                addParameterBeforeActionPerformed(evt);
            }
        });
        jPopupMenu1.add(addParameterBefore);

        addParameterAfter.setText("Add Parameter After");
        addParameterAfter.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                addParameterAfterActionPerformed(evt);
            }
        });
        jPopupMenu1.add(addParameterAfter);

        removeParameter.setText("Remove Parameter");
        removeParameter.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                removeParameterActionPerformed(evt);
            }
        });
        jPopupMenu1.add(removeParameter);

        changeParameter.setText("Change Parameter Type");
        changeParameter.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                changeParameterActionPerformed(evt);
            }
        });
        jPopupMenu1.add(changeParameter);
        jPopupMenu1.add(jSeparator1);

        pushUp.setText("Push Up");
        pushUp.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                pushUpActionPerformed(evt);
            }
        });
        jPopupMenu1.add(pushUp);

        pushDown.setText("Push Down");
        pushDown.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                pushDownActionPerformed(evt);
            }
        });
        jPopupMenu1.add(pushDown);
        jPopupMenu1.add(jSeparator2);

        maskCheckBoxMenuItem.setSelected(true);
        maskCheckBoxMenuItem.setText("Mask");
        maskCheckBoxMenuItem.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                maskCheckBoxMenuItemActionPerformed(evt);
            }
        });
        jPopupMenu1.add(maskCheckBoxMenuItem);

        quantizeCheckBoxMenuItem.setSelected(true);
        quantizeCheckBoxMenuItem.setText("Quantize");
        quantizeCheckBoxMenuItem.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                quantizeCheckBoxMenuItemActionPerformed(evt);
            }
        });
        jPopupMenu1.add(quantizeCheckBoxMenuItem);

        accumulatorCheckBoxMenuItem.setSelected(true);
        accumulatorCheckBoxMenuItem.setText("Accumulator");
        accumulatorCheckBoxMenuItem.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                accumulatorCheckBoxMenuItemActionPerformed(evt);
            }
        });
        jPopupMenu1.add(accumulatorCheckBoxMenuItem);

        setBorder(javax.swing.BorderFactory.createEmptyBorder(1, 1, 1, 1));
        setLayout(new java.awt.BorderLayout());

        javax.swing.GroupLayout emptyPanelLayout = new javax.swing.GroupLayout(emptyPanel);
        emptyPanel.setLayout(emptyPanelLayout);
        emptyPanelLayout.setHorizontalGroup(
            emptyPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 521, Short.MAX_VALUE)
        );
        emptyPanelLayout.setVerticalGroup(
            emptyPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 133, Short.MAX_VALUE)
        );

        add(emptyPanel, java.awt.BorderLayout.CENTER);

        paramLabelPanel.setText("jLabel1");
        paramLabelPanel.setVerticalAlignment(javax.swing.SwingConstants.TOP);
        paramLabelPanel.setBorder(javax.swing.BorderFactory.createBevelBorder(javax.swing.border.BevelBorder.RAISED));
        paramLabelPanel.setMinimumSize(new java.awt.Dimension(20, 19));
        paramLabelPanel.setOpaque(true);
        paramLabelPanel.setPreferredSize(new java.awt.Dimension(20, 19));
        paramLabelPanel.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseReleased(java.awt.event.MouseEvent evt) {
                paramLabelPanelMouseReleased(evt);
            }
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                labelMouseClicked(evt);
            }
        });
        add(paramLabelPanel, java.awt.BorderLayout.NORTH);
    }// </editor-fold>//GEN-END:initComponents

private void maskCheckBoxMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_maskCheckBoxMenuItemActionPerformed
    boolean enabled = maskCheckBoxMenuItem.isSelected();

    this.parameter.getMask().setEnabled(enabled);

    if (enabled) {
        maskEditor = new MaskEditor(parameter.getMask());
        maskEditor.setBorder(BorderFactory.createBevelBorder(BevelBorder.RAISED));
        ((DurationSettable) maskEditor).setDuration(this.duration);
    } else {
        maskEditor = null;
    }

    updateInterface();
}//GEN-LAST:event_maskCheckBoxMenuItemActionPerformed

private void quantizeCheckBoxMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_quantizeCheckBoxMenuItemActionPerformed
    boolean enabled = quantizeCheckBoxMenuItem.isSelected();

    this.parameter.getQuantizer().setEnabled(enabled);

    if (enabled) {
        quantizerEditor = new QuantizerEditor(parameter.getQuantizer());
        quantizerEditor.setBorder(BorderFactory.createBevelBorder(BevelBorder.RAISED));
        ((DurationSettable) quantizerEditor).setDuration(this.duration);
    } else {
        quantizerEditor = null;
    }

    updateInterface();
}//GEN-LAST:event_quantizeCheckBoxMenuItemActionPerformed

private void accumulatorCheckBoxMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_accumulatorCheckBoxMenuItemActionPerformed
    boolean enabled = accumulatorCheckBoxMenuItem.isSelected();

    this.parameter.getAccumulator().setEnabled(enabled);

    if (enabled) {
        accumulatorEditor = new AccumulatorEditor(parameter.getAccumulator());
        accumulatorEditor.setBorder(BorderFactory.createBevelBorder(BevelBorder.RAISED));
        ((DurationSettable) accumulatorEditor).setDuration(this.duration);
    } else {
        accumulatorEditor = null;
    }

    updateInterface();
}//GEN-LAST:event_accumulatorCheckBoxMenuItemActionPerformed

private void pushUpActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_pushUpActionPerformed
    fireParameterEdit(ParameterEditListener.PARAMETER_PUSH_UP,
            parameterNum, null);
}//GEN-LAST:event_pushUpActionPerformed

private void pushDownActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_pushDownActionPerformed
    fireParameterEdit(ParameterEditListener.PARAMETER_PUSH_DOWN,
            parameterNum, null);
}//GEN-LAST:event_pushDownActionPerformed

    private void labelMouseClicked(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_labelMouseClicked
        if(evt.getClickCount() == 2) {
            String oldVal = parameter.getName();

            NotifyDescriptor.InputLine descriptor = new NotifyDescriptor.InputLine("Enter Field Name", "Field Name", NotifyDescriptor.OK_CANCEL_OPTION, NotifyDescriptor.PLAIN_MESSAGE);
            descriptor.setInputText(parameter.getName());
           
            Object status = DialogDisplayer.getDefault().notify(descriptor);
            if(status == NotifyDescriptor.OK_OPTION) {
                parameter.setName(descriptor.getInputText());
                setParameterNumber(this.parameterNum);           
            }
        }
    }//GEN-LAST:event_labelMouseClicked
    private void changeParameterActionPerformed(java.awt.event.ActionEvent evt) {// GEN-FIRST:event_changeParameterActionPerformed

        GeneratorRegistry.GeneratorEntry[] options = GeneratorRegistry.getGeneratorEntries();

        Object val = JOptionPane.showInputDialog(this.getParent(),
                "Select Generator Type", "Change Generator Type",
                JOptionPane.PLAIN_MESSAGE, null, options, options[0]);

        if (val != null) {
            Generator gen = ((GeneratorRegistry.GeneratorEntry) val).createGenerator();

            if (gen.getClass() != parameter.getGenerator().getClass()) {
                fireParameterEdit(ParameterEditListener.PARAMETER_CHANGE_TYPE,
                        parameterNum, gen);
            }
        }
    }// GEN-LAST:event_changeParameterActionPerformed

    private void paramLabelPanelMouseReleased(java.awt.event.MouseEvent evt) {// GEN-FIRST:event_paramLabelPanelMouseReleased

        if (UiUtilities.isRightMouseButton(evt)) {
            removeParameter.setEnabled(parameterNum > 3);
            jPopupMenu1.show(paramLabelPanel, evt.getX(), evt.getY());
        }
    }// GEN-LAST:event_paramLabelPanelMouseReleased

    private void removeParameterActionPerformed(java.awt.event.ActionEvent evt) {// GEN-FIRST:event_removeParameterActionPerformed

        fireParameterEdit(ParameterEditListener.PARAMETER_REMOVE, parameterNum,
                null);
    }// GEN-LAST:event_removeParameterActionPerformed

    private void addParameterAfterActionPerformed(java.awt.event.ActionEvent evt) {// GEN-FIRST:event_addParameterAfterActionPerformed

        GeneratorRegistry.GeneratorEntry[] options = GeneratorRegistry.getGeneratorEntries();

        Object val = JOptionPane.showInputDialog(this.getParent(),
                "Select Generator Type", "Add Generator After",
                JOptionPane.PLAIN_MESSAGE, null, options, options[0]);

        if (val != null) {
            Generator gen = ((GeneratorRegistry.GeneratorEntry) val).createGenerator();
            fireParameterEdit(ParameterEditListener.PARAMETER_ADD_AFTER,
                    parameterNum, gen);
        }

    }// GEN-LAST:event_addParameterAfterActionPerformed

    private void addParameterBeforeActionPerformed(
            java.awt.event.ActionEvent evt) {// GEN-FIRST:event_addParameterBeforeActionPerformed

        GeneratorRegistry.GeneratorEntry[] options = GeneratorRegistry.getGeneratorEntries();

        Object val = JOptionPane.showInputDialog(this.getParent(),
                "Select Generator Type", "Add Generator Before",
                JOptionPane.PLAIN_MESSAGE, null, options, options[0]);

        if (val != null) {
            Generator gen = ((GeneratorRegistry.GeneratorEntry) val).createGenerator();
            fireParameterEdit(ParameterEditListener.PARAMETER_ADD_BEFORE,
                    parameterNum, gen);
        }
    }// GEN-LAST:event_addParameterBeforeActionPerformed

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JCheckBoxMenuItem accumulatorCheckBoxMenuItem;
    private javax.swing.JMenuItem addParameterAfter;
    private javax.swing.JMenuItem addParameterBefore;
    private javax.swing.JMenuItem changeParameter;
    private javax.swing.JPanel emptyPanel;
    private javax.swing.JPopupMenu jPopupMenu1;
    private javax.swing.JSeparator jSeparator1;
    private javax.swing.JSeparator jSeparator2;
    private javax.swing.JCheckBoxMenuItem maskCheckBoxMenuItem;
    private javax.swing.JLabel paramLabelPanel;
    private javax.swing.JMenuItem pushDown;
    private javax.swing.JMenuItem pushUp;
    private javax.swing.JCheckBoxMenuItem quantizeCheckBoxMenuItem;
    private javax.swing.JMenuItem removeParameter;
    // End of variables declaration//GEN-END:variables

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getPropertyName().equals("visible")) {
            this.setVisible(this.parameter.isVisible());
        }
    }
}
