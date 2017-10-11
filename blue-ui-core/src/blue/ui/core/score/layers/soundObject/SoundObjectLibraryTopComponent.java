/*
 * blue - object composition environment for csound
 *  Copyright (c) 2000-2009 Steven Yi (stevenyi@gmail.com)
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published
 *  by  the Free Software Foundation; either version 2 of the License or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; see the file COPYING.LIB.  If not, write to
 *  the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 *  Boston, MA  02111-1307 USA
 */
package blue.ui.core.score.layers.soundObject;

import blue.BlueData;
import blue.SoundObjectLibrary;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.layers.SoundObjectProvider;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Collections;
import javax.swing.ListSelectionModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.util.NbBundle;
import org.openide.util.lookup.AbstractLookup;
import org.openide.util.lookup.InstanceContent;
import org.openide.windows.TopComponent;

@ConvertAsProperties(
        dtd = "-//blue.ui.core.score.layers.soundObject//SoundObjectLibrary//EN",
        autostore = false
)
@TopComponent.Description(
        preferredID = "SoundObjectLibraryTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "properties", openAtStartup = false)
@ActionID(category = "Window", id = "blue.ui.core.score.layers.soundObject.SoundObjectLibraryTopComponent")
@ActionReferences({
    @ActionReference(path = "Menu/Window", position = 300)
    ,
    @ActionReference(path = "Shortcuts", name = "F4")
})
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_SoundObjectLibraryAction",
        preferredID = "SoundObjectLibraryTopComponent"
)
@NbBundle.Messages({
    "CTL_SoundObjectLibraryAction=SoundObject Library",
    "CTL_SoundObjectLibraryTopComponent=SoundObject Library",
    "HINT_SoundObjectLibraryTopComponent=This is a SoundObject Library window"
})
public final class SoundObjectLibraryTopComponent extends TopComponent
        implements ChangeListener, SoundObjectProvider {

    private static SoundObjectLibraryTopComponent instance;

    private final InstanceContent content = new InstanceContent();

    private SoundObjectLibrary sObjLib = new SoundObjectLibrary();

    final ScoreController.ScoreObjectBuffer scoreObjectBuffer
            = ScoreController.getInstance().getScoreObjectBuffer();

    private SoundObjectLibraryTopComponent() {
        initComponents();

        associateLookup(new AbstractLookup(content));

        setName(NbBundle.getMessage(SoundObjectLibraryTopComponent.class,
                "CTL_SoundObjectLibraryTopComponent"));
        setToolTipText(NbBundle.getMessage(SoundObjectLibraryTopComponent.class,
                "HINT_SoundObjectLibraryTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));

        sObjLibTable.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {

                int index = sObjLibTable.getSelectedRow();

                if (index != -1) {
                    SoundObject sObj = sObjLib.getSoundObject(index);

                    if (e.getClickCount() >= 2) {
                        fireSoundObjectSelected(sObj);
                    }
                }
            }
        });

        BlueProjectManager.getInstance().addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if (BlueProjectManager.CURRENT_PROJECT.equals(
                    evt.getPropertyName())) {
                reinitialize();
            }
        });

        reinitialize();
        splitPane.setRightComponent(new UserSoundObjectLibrary(content));
        splitPane.setDividerLocation(200);
    }

    public void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().
                getCurrentProject();
        if (project != null) {
            BlueData currentData = project.getData();
            setSoundObjectLibrary(currentData.getSoundObjectLibrary());
        }
    }

    /**
     * @param sObj
     */
    protected void fireSoundObjectSelected(SoundObject sObj) {
        content.set(Collections.singleton(sObj), null);
    }

    protected void fireSoundObjectRemoved(SoundObject sObj) {
        content.set(Collections.emptyList(), null);
    }

    public void setSoundObjectLibrary(SoundObjectLibrary sObjLib) {

        if (this.sObjLib != null) {
            this.sObjLib.removeChangeListener(this);
        }

        this.sObjLib = sObjLib;
        sObjLibTable.setModel(new SoundObjectLibraryTableModel(sObjLib));
        sObjLibTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        sObjLibTable.setColumnSelectionAllowed(true);

        this.setColumnWidth(0, 20);
        this.setColumnWidth(1, 80);
        // this.setColumnWidth(2, 80);

        sObjLibTable.getTableHeader().setReorderingAllowed(false);

        if (this.sObjLib != null) {
            this.sObjLib.addChangeListener(this);
        }
    }

    public boolean containsSoundObject(SoundObject soundObject) {
        if (sObjLib == null) {
            return false;
        }

        return sObjLib.contains(soundObject);
    }

    private void setColumnWidth(int columnNum, int width) {
        sObjLibTable.getTableHeader().getColumnModel().getColumn(columnNum).
                setPreferredWidth(width);
        // sObjLibTable.getTableHeader().getColumnModel().getColumn(columnNum).setMaxWidth(width);
        // sObjLibTable.getTableHeader().getColumnModel().getColumn(columnNum).setMinWidth(width);
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        splitPane = new javax.swing.JSplitPane();
        jPanel2 = new javax.swing.JPanel();
        jPanel1 = new javax.swing.JPanel();
        copyButton = new javax.swing.JButton();
        copyInstanceButton = new javax.swing.JButton();
        removeButton = new javax.swing.JButton();
        jScrollPane1 = new javax.swing.JScrollPane();
        sObjLibTable = new javax.swing.JTable();

        splitPane.setOrientation(javax.swing.JSplitPane.VERTICAL_SPLIT);

        org.openide.awt.Mnemonics.setLocalizedText(copyButton, org.openide.util.NbBundle.getMessage(SoundObjectLibraryTopComponent.class, "SoundObjectLibraryTopComponent.copyButton.text")); // NOI18N
        copyButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                copyButtonActionPerformed(evt);
            }
        });
        jPanel1.add(copyButton);

        org.openide.awt.Mnemonics.setLocalizedText(copyInstanceButton, org.openide.util.NbBundle.getMessage(SoundObjectLibraryTopComponent.class, "SoundObjectLibraryTopComponent.copyInstanceButton.text")); // NOI18N
        copyInstanceButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                copyInstanceButtonActionPerformed(evt);
            }
        });
        jPanel1.add(copyInstanceButton);

        org.openide.awt.Mnemonics.setLocalizedText(removeButton, org.openide.util.NbBundle.getMessage(SoundObjectLibraryTopComponent.class, "SoundObjectLibraryTopComponent.removeButton.text")); // NOI18N
        removeButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                removeButtonActionPerformed(evt);
            }
        });
        jPanel1.add(removeButton);

        sObjLibTable.setModel(new javax.swing.table.DefaultTableModel(
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
        jScrollPane1.setViewportView(sObjLibTable);

        javax.swing.GroupLayout jPanel2Layout = new javax.swing.GroupLayout(jPanel2);
        jPanel2.setLayout(jPanel2Layout);
        jPanel2Layout.setHorizontalGroup(
            jPanel2Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel2Layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(jPanel2Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(jPanel1, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                    .addComponent(jScrollPane1, javax.swing.GroupLayout.Alignment.TRAILING, javax.swing.GroupLayout.PREFERRED_SIZE, 0, Short.MAX_VALUE))
                .addContainerGap())
        );
        jPanel2Layout.setVerticalGroup(
            jPanel2Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel2Layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(jPanel1, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 27, Short.MAX_VALUE)
                .addContainerGap())
        );

        splitPane.setLeftComponent(jPanel2);

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(splitPane, javax.swing.GroupLayout.Alignment.TRAILING)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(splitPane, javax.swing.GroupLayout.Alignment.TRAILING)
        );
    }// </editor-fold>//GEN-END:initComponents

    private void copyButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_copyButtonActionPerformed
        int index = sObjLibTable.getSelectedRow();
        if (index != -1) {
            SoundObject sObj = sObjLib.getSoundObject(index);
            SoundObject tempSObj = sObj.deepCopy();
            ScoreController.getInstance().setSelectedScoreObjects(
                    Collections.singleton(tempSObj));

            scoreObjectBuffer.clear();
            scoreObjectBuffer.scoreObjects.add(tempSObj);
            scoreObjectBuffer.layerIndexes.add(0);
        }
}//GEN-LAST:event_copyButtonActionPerformed

    private void copyInstanceButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_copyInstanceButtonActionPerformed
        int index = sObjLibTable.getSelectedRow();
        if (index != -1) {
            SoundObject originalSObj = sObjLib.getSoundObject(index);
            Instance tempSObj = new Instance(originalSObj);
            tempSObj.setStartTime(0.0f);
            tempSObj.setSubjectiveDuration(tempSObj.getObjectiveDuration());
            ScoreController.getInstance().setSelectedScoreObjects(
                    Collections.singleton(tempSObj));

            scoreObjectBuffer.clear();
            scoreObjectBuffer.scoreObjects.add(tempSObj);
            scoreObjectBuffer.layerIndexes.add(0);
        }
    }//GEN-LAST:event_copyInstanceButtonActionPerformed

    private void removeButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_removeButtonActionPerformed
        if (sObjLibTable.getSelectedRow() != -1) {

            NotifyDescriptor descriptor = new NotifyDescriptor.Confirmation(
                    "Removing this SoundObject will remove all Instances of it "
                    + "within your project.  Please confirm this operation. (This "
                    + "can not be undone.)",
                    NotifyDescriptor.YES_NO_CANCEL_OPTION);

            Object retVal = DialogDisplayer.getDefault().notify(descriptor);

            if (retVal == NotifyDescriptor.YES_OPTION) {

                SoundObject sObj = sObjLib.getSoundObject(
                        sObjLibTable.getSelectedRow());

                SoundObjectLibraryUtils.removeLibrarySoundObject(
                        BlueProjectManager.getInstance().getCurrentBlueData(),
                        sObj);

                // sObjEditPanel.editSoundObject(null);
                fireSoundObjectRemoved((SoundObject) sObj);

                sObjLibTable.revalidate();
            }
        }
    }//GEN-LAST:event_removeButtonActionPerformed
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton copyButton;
    private javax.swing.JButton copyInstanceButton;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPanel jPanel2;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JButton removeButton;
    private javax.swing.JTable sObjLibTable;
    private javax.swing.JSplitPane splitPane;
    // End of variables declaration//GEN-END:variables

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    void writeProperties(java.util.Properties p) {
        p.setProperty("version", "1.0");
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
    }

    @Override
    public void stateChanged(ChangeEvent ce) {
        this.sObjLibTable.revalidate();
    }
}
