/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

/*
 * DiskRenderSettingsPanel.java
 *
 * Created on Feb 8, 2009, 8:37:04 PM
 */
package blue.ui.core.project;

import blue.ProjectProperties;
import blue.ui.utilities.SimpleDocumentListener;
import javax.swing.event.DocumentEvent;

/**
 *
 * @author steven
 */
public class DiskRenderSettingsPanel extends javax.swing.JPanel {

    private ProjectProperties projectProperties = null;

    /** Creates new form DiskRenderSettingsPanel */
    public DiskRenderSettingsPanel() {
        initComponents();

        diskSrText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (projectProperties != null) {
                            projectProperties.diskSampleRate = diskSrText.getText();
                        }
                    }
                });

        diskKsmpsText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (projectProperties != null) {
                            projectProperties.diskKsmps = diskKsmpsText.getText();
                        }
                    }
                });

        diskNchnlsText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (projectProperties != null) {
                            projectProperties.diskChannels = diskNchnlsText.getText();
                        }
                    }
                });

        fileNameText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (projectProperties != null) {
                            projectProperties.fileName = fileNameText.getText();
                        }
                    }
                });

        diskAdvancedSettingsText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (projectProperties != null) {
                            projectProperties.diskAdvancedSettings = diskAdvancedSettingsText.getText();
                        }
                    }
                });
    }

    public void setProjectProperties(ProjectProperties projectProperties) {
        this.projectProperties = null;

        if (projectProperties != null) {
            diskSrText.setText(projectProperties.diskSampleRate);
            diskKsmpsText.setText(projectProperties.diskKsmps);
            diskNchnlsText.setText(projectProperties.diskChannels);
            fileNameText.setText(projectProperties.fileName);
            askOnRenderCBox.setSelected(projectProperties.askOnRender);

            diskNoteAmpCBox.setSelected(projectProperties.diskNoteAmpsEnabled);
            diskOutOfRangeCBox.setSelected(projectProperties.diskOutOfRangeEnabled);
            diskWarningsCBox.setSelected(projectProperties.diskWarningsEnabled);
            diskBenchmarkCBox.setSelected(projectProperties.diskBenchmarkEnabled);

            diskAdvancedSettingsText.setText(projectProperties.diskAdvancedSettings);
            diskOverrideCBox.setSelected(projectProperties.diskCompleteOverride);

            alwayRenderFromStartCBox.setSelected(projectProperties.diskAlwaysRenderEntireProject);

            this.projectProperties = projectProperties;
        }
    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jLabel5 = new javax.swing.JLabel();
        jLabel6 = new javax.swing.JLabel();
        jLabel7 = new javax.swing.JLabel();
        jLabel8 = new javax.swing.JLabel();
        jLabel11 = new javax.swing.JLabel();
        jLabel15 = new javax.swing.JLabel();
        askOnRenderCBox = new javax.swing.JCheckBox();
        diskOverrideCBox = new javax.swing.JCheckBox();
        diskBenchmarkCBox = new javax.swing.JCheckBox();
        diskWarningsCBox = new javax.swing.JCheckBox();
        diskOutOfRangeCBox = new javax.swing.JCheckBox();
        diskNoteAmpCBox = new javax.swing.JCheckBox();
        fileNameText = new javax.swing.JTextField();
        diskSrText = new javax.swing.JTextField();
        diskKsmpsText = new javax.swing.JTextField();
        diskNchnlsText = new javax.swing.JTextField();
        diskAdvancedSettingsText = new javax.swing.JTextField();
        jButton2 = new javax.swing.JButton();
        alwayRenderFromStartCBox = new javax.swing.JCheckBox();

        jLabel5.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.jLabel5.text")); // NOI18N

        jLabel6.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.jLabel6.text")); // NOI18N

        jLabel7.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.jLabel7.text")); // NOI18N

        jLabel8.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.jLabel8.text")); // NOI18N

        jLabel11.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.jLabel11.text")); // NOI18N

        jLabel15.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.jLabel15.text")); // NOI18N

        askOnRenderCBox.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.askOnRenderCBox.text")); // NOI18N
        askOnRenderCBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        askOnRenderCBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        askOnRenderCBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                askOnRenderCBoxActionPerformed(evt);
            }
        });

        diskOverrideCBox.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.diskOverrideCBox.text")); // NOI18N
        diskOverrideCBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        diskOverrideCBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        diskOverrideCBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                diskOverrideCBoxActionPerformed(evt);
            }
        });

        diskBenchmarkCBox.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.diskBenchmarkCBox.text")); // NOI18N
        diskBenchmarkCBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        diskBenchmarkCBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        diskBenchmarkCBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                diskBenchmarkCBoxActionPerformed(evt);
            }
        });

        diskWarningsCBox.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.diskWarningsCBox.text")); // NOI18N
        diskWarningsCBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        diskWarningsCBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        diskWarningsCBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                diskWarningsCBoxActionPerformed(evt);
            }
        });

        diskOutOfRangeCBox.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.diskOutOfRangeCBox.text")); // NOI18N
        diskOutOfRangeCBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        diskOutOfRangeCBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        diskOutOfRangeCBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                diskOutOfRangeCBoxActionPerformed(evt);
            }
        });

        diskNoteAmpCBox.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.diskNoteAmpCBox.text")); // NOI18N
        diskNoteAmpCBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        diskNoteAmpCBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        diskNoteAmpCBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                diskNoteAmpCBoxActionPerformed(evt);
            }
        });

        jButton2.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.jButton2.text")); // NOI18N
        jButton2.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                jButton2openAdvancedFlags(evt);
            }
        });

        alwayRenderFromStartCBox.setText(org.openide.util.NbBundle.getMessage(DiskRenderSettingsPanel.class, "DiskRenderSettingsPanel.alwayRenderFromStartCBox.text")); // NOI18N
        alwayRenderFromStartCBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        alwayRenderFromStartCBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                alwayRenderFromStartCBoxActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .addContainerGap()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jLabel5)
                    .add(jLabel15)
                    .add(jLabel11)
                    .add(jLabel6)
                    .add(jLabel7)
                    .add(jLabel8))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(layout.createSequentialGroup()
                        .add(diskAdvancedSettingsText, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 217, Short.MAX_VALUE)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(jButton2))
                    .add(layout.createSequentialGroup()
                        .add(diskOverrideCBox)
                        .add(169, 169, 169))
                    .add(layout.createSequentialGroup()
                        .add(alwayRenderFromStartCBox)
                        .add(119, 119, 119))
                    .add(layout.createSequentialGroup()
                        .add(diskBenchmarkCBox)
                        .add(145, 145, 145))
                    .add(layout.createSequentialGroup()
                        .add(diskWarningsCBox)
                        .add(211, 211, 211))
                    .add(layout.createSequentialGroup()
                        .add(diskOutOfRangeCBox)
                        .add(139, 139, 139))
                    .add(layout.createSequentialGroup()
                        .add(diskNoteAmpCBox)
                        .add(179, 179, 179))
                    .add(layout.createSequentialGroup()
                        .add(askOnRenderCBox)
                        .add(187, 187, 187))
                    .add(fileNameText, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 276, Short.MAX_VALUE)
                    .add(diskNchnlsText, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 276, Short.MAX_VALUE)
                    .add(diskKsmpsText, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 276, Short.MAX_VALUE)
                    .add(diskSrText, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 276, Short.MAX_VALUE))
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .addContainerGap()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel8)
                    .add(diskSrText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel7)
                    .add(diskKsmpsText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel6)
                    .add(diskNchnlsText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel11)
                    .add(fileNameText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(askOnRenderCBox)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel15)
                    .add(diskNoteAmpCBox))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(diskOutOfRangeCBox)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(diskWarningsCBox)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(diskBenchmarkCBox)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.UNRELATED)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(diskAdvancedSettingsText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel5)
                    .add(jButton2))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(diskOverrideCBox)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(alwayRenderFromStartCBox)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
    }// </editor-fold>//GEN-END:initComponents

    private void askOnRenderCBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_askOnRenderCBoxActionPerformed
        if (projectProperties != null) {
            projectProperties.askOnRender = askOnRenderCBox.isSelected();
        }
    }//GEN-LAST:event_askOnRenderCBoxActionPerformed

    private void diskOverrideCBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_diskOverrideCBoxActionPerformed
        if (projectProperties != null) {
            projectProperties.diskCompleteOverride = diskOverrideCBox.isSelected();
        }
    }//GEN-LAST:event_diskOverrideCBoxActionPerformed

    private void diskBenchmarkCBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_diskBenchmarkCBoxActionPerformed
        if (projectProperties != null) {
            projectProperties.diskBenchmarkEnabled = diskBenchmarkCBox.isSelected();
        }
    }//GEN-LAST:event_diskBenchmarkCBoxActionPerformed

    private void diskWarningsCBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_diskWarningsCBoxActionPerformed
        if (projectProperties != null) {
            projectProperties.diskWarningsEnabled = diskWarningsCBox.isSelected();
        }
    }//GEN-LAST:event_diskWarningsCBoxActionPerformed

    private void diskOutOfRangeCBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_diskOutOfRangeCBoxActionPerformed
        if (projectProperties != null) {
            projectProperties.diskOutOfRangeEnabled = diskOutOfRangeCBox.isSelected();
        }
    }//GEN-LAST:event_diskOutOfRangeCBoxActionPerformed

    private void diskNoteAmpCBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_diskNoteAmpCBoxActionPerformed
        if (projectProperties != null) {
            projectProperties.diskNoteAmpsEnabled = diskNoteAmpCBox.isSelected();
        }
    }//GEN-LAST:event_diskNoteAmpCBoxActionPerformed

    private void jButton2openAdvancedFlags(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_jButton2openAdvancedFlags
// TODO - implement method to get Program Options
        //         String url = ProgramOptions.getGeneralSettings().getCsoundDocRoot()
//            + "CommandFlags.html";
//         URLOpener.openURL(url);
    }//GEN-LAST:event_jButton2openAdvancedFlags

    private void alwayRenderFromStartCBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_alwayRenderFromStartCBoxActionPerformed
        if (projectProperties != null) {
            projectProperties.diskAlwaysRenderEntireProject =
                    alwayRenderFromStartCBox.isSelected();
        }
}//GEN-LAST:event_alwayRenderFromStartCBoxActionPerformed
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JCheckBox alwayRenderFromStartCBox;
    private javax.swing.JCheckBox askOnRenderCBox;
    private javax.swing.JTextField diskAdvancedSettingsText;
    private javax.swing.JCheckBox diskBenchmarkCBox;
    private javax.swing.JTextField diskKsmpsText;
    private javax.swing.JTextField diskNchnlsText;
    private javax.swing.JCheckBox diskNoteAmpCBox;
    private javax.swing.JCheckBox diskOutOfRangeCBox;
    private javax.swing.JCheckBox diskOverrideCBox;
    private javax.swing.JTextField diskSrText;
    private javax.swing.JCheckBox diskWarningsCBox;
    private javax.swing.JTextField fileNameText;
    private javax.swing.JButton jButton2;
    private javax.swing.JLabel jLabel11;
    private javax.swing.JLabel jLabel15;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JLabel jLabel8;
    // End of variables declaration//GEN-END:variables

}