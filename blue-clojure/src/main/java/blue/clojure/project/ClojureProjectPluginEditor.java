/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.clojure.project;

import blue.BlueData;
import blue.plugin.ProjectPluginEditorItem;
import blue.project.ProjectPluginEditor;
import blue.project.ProjectPluginUtils;
import blue.ui.utilities.UiUtilities;

/**
 *
 * @author stevenyi
 */
@ProjectPluginEditorItem(displayName = "Clojure", position = 10)
public class ClojureProjectPluginEditor extends ProjectPluginEditor {

    ClojureProjectDataTableModel tableModel = new ClojureProjectDataTableModel();
    private ClojureProjectData projData;

    /**
     * Creates new form ClojureProjectPluginEditor
     */
    public ClojureProjectPluginEditor() {
        initComponents();
        clojureProjectDataTable.setModel(tableModel);
        final var selModel = clojureProjectDataTable.getSelectionModel();
        selModel.addListSelectionListener(lse -> {
            if (!lse.getValueIsAdjusting()) {
                updateButtons();
            }
        });
    }

    private void updateButtons() {
        final var selModel = clojureProjectDataTable.getSelectionModel();

        var empty = projData == null || selModel.isSelectionEmpty();
        addButton.setEnabled(projData != null);
        removeButton.setEnabled(!empty);
        pushUpButton.setEnabled(!empty && selModel.getSelectedIndices()[0] > 0);
        pushDownButton.setEnabled(!empty && selModel.getSelectedIndices()[0] < projData.libraryList().size() - 1);
    }

    @Override
    public void edit(BlueData data) {
        UiUtilities.invokeOnSwingThread(() -> {
            ClojureProjectData projData = ProjectPluginUtils.findPluginData(
                    data.getPluginData(), ClojureProjectData.class);

            if (projData == null) {
                projData = new ClojureProjectData();
                data.getPluginData().add(projData);
            }
            this.projData = projData;
            tableModel.setClojureProjectData(projData);
            updateButtons();
        });
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jScrollPane1 = new javax.swing.JScrollPane();
        clojureProjectDataTable = new javax.swing.JTable();
        addButton = new javax.swing.JButton();
        removeButton = new javax.swing.JButton();
        pushUpButton = new javax.swing.JButton();
        pushDownButton = new javax.swing.JButton();

        clojureProjectDataTable.setModel(new javax.swing.table.DefaultTableModel(
            new Object [][] {
                {null, null, null, null},
                {null, null, null, null},
                {null, null, null, null},
                {null, null, null, null}
            },
            new String [] {
                "Title 1", "Title 2", "Title 3", "Title 4"
            }
        ));
        clojureProjectDataTable.setSelectionMode(javax.swing.ListSelectionModel.SINGLE_SELECTION);
        clojureProjectDataTable.setSelectionMode(javax.swing.ListSelectionModel.SINGLE_SELECTION);
        jScrollPane1.setViewportView(clojureProjectDataTable);

        org.openide.awt.Mnemonics.setLocalizedText(addButton, org.openide.util.NbBundle.getMessage(ClojureProjectPluginEditor.class, "ClojureProjectPluginEditor.addButton.text")); // NOI18N
        addButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                addButtonActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(removeButton, org.openide.util.NbBundle.getMessage(ClojureProjectPluginEditor.class, "ClojureProjectPluginEditor.removeButton.text")); // NOI18N
        removeButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                removeButtonActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(pushUpButton, org.openide.util.NbBundle.getMessage(ClojureProjectPluginEditor.class, "ClojureProjectPluginEditor.pushUpButton.text")); // NOI18N
        pushUpButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                pushUpButtonActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(pushDownButton, org.openide.util.NbBundle.getMessage(ClojureProjectPluginEditor.class, "ClojureProjectPluginEditor.pushDownButton.text")); // NOI18N
        pushDownButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                pushDownButtonActionPerformed(evt);
            }
        });

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 762, Short.MAX_VALUE)
            .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, layout.createSequentialGroup()
                .addContainerGap(javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                .addComponent(addButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(removeButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(pushUpButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(pushDownButton)
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 318, Short.MAX_VALUE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(addButton)
                    .addComponent(removeButton)
                    .addComponent(pushUpButton)
                    .addComponent(pushDownButton))
                .addContainerGap())
        );
    }// </editor-fold>//GEN-END:initComponents

    private void addButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_addButtonActionPerformed
        if (projData == null) {
            return;
        }
        int item = clojureProjectDataTable.getSelectedRow();
        if (item >= 0) {
            projData.libraryList().add(item, new ClojureLibraryEntry());
        } else {
            projData.libraryList().add(new ClojureLibraryEntry());
        }
    }//GEN-LAST:event_addButtonActionPerformed

    private void removeButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_removeButtonActionPerformed
        if (projData == null) {
            return;
        }
        int item = clojureProjectDataTable.getSelectedRow();
        if (item >= 0 && item < projData.libraryList().size()) {
            projData.libraryList().remove(item);
        }
    }//GEN-LAST:event_removeButtonActionPerformed

    private void pushUpButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_pushUpButtonActionPerformed
        if (projData == null) {
            return;
        }

        int index = clojureProjectDataTable.getSelectedRow();
        if (index > 0) {
            ClojureLibraryEntry item = projData.libraryList().remove(index);
            projData.libraryList().add(index - 1, item);
            clojureProjectDataTable.getSelectionModel().setSelectionInterval(index - 1, index - 1);
        }

    }//GEN-LAST:event_pushUpButtonActionPerformed

    private void pushDownButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_pushDownButtonActionPerformed
        int index = clojureProjectDataTable.getSelectedRow();
        if (index < projData.libraryList().size() - 1) {
            ClojureLibraryEntry item = projData.libraryList().remove(index);
            projData.libraryList().add(index + 1, item);
            clojureProjectDataTable.getSelectionModel().setSelectionInterval(index + 1, index + 1);
        }
    }//GEN-LAST:event_pushDownButtonActionPerformed


    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton addButton;
    private javax.swing.JTable clojureProjectDataTable;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JButton pushDownButton;
    private javax.swing.JButton pushUpButton;
    private javax.swing.JButton removeButton;
    // End of variables declaration//GEN-END:variables
}
