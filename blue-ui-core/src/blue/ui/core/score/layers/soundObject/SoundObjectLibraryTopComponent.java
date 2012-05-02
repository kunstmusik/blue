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
import blue.event.SelectionEvent;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.logging.Logger;
import javax.swing.ListSelectionModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;
//import org.openide.util.Utilities;

/**
 * Top component which displays something.
 */
final class SoundObjectLibraryTopComponent extends TopComponent implements ChangeListener {

    private static SoundObjectLibraryTopComponent instance;

    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "SoundObjectLibraryTopComponent";

    private SoundObjectBuffer sObjBuffer;

    private SoundObjectLibrary sObjLib = new SoundObjectLibrary();

    private SoundObjectLibraryTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(SoundObjectLibraryTopComponent.class,
                "CTL_SoundObjectLibraryTopComponent"));
        setToolTipText(NbBundle.getMessage(SoundObjectLibraryTopComponent.class,
                "HINT_SoundObjectLibraryTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));

        this.sObjBuffer = SoundObjectBuffer.getInstance();

        sObjLibTable.addMouseListener(new MouseAdapter() {

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

        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    reinitialize();
                }
            }
        });

        reinitialize();
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

        SelectionEvent selectionEvent = new SelectionEvent(sObj,
                SelectionEvent.SELECTION_SINGLE, SelectionEvent.SELECTION_LIBRARY);

        SoundObjectSelectionBus.getInstance().selectionPerformed(selectionEvent);
    }

    protected void fireSoundObjectRemoved(SoundObject sObj) {

        SelectionEvent selectionEvent = new SelectionEvent(sObj,
                SelectionEvent.SELECTION_REMOVE, SelectionEvent.SELECTION_LIBRARY);

        SoundObjectSelectionBus.getInstance().selectionPerformed(selectionEvent);
    }

    public void setSoundObjectLibrary(SoundObjectLibrary sObjLib) {
        
        if(this.sObjLib != null) {
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

        if(this.sObjLib != null) {
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

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPanel1 = new javax.swing.JPanel();
        copyButton = new javax.swing.JButton();
        copyInstanceButton = new javax.swing.JButton();
        removeButton = new javax.swing.JButton();
        jScrollPane1 = new javax.swing.JScrollPane();
        sObjLibTable = new javax.swing.JTable();

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

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jPanel1, javax.swing.GroupLayout.PREFERRED_SIZE, 318, Short.MAX_VALUE)
            .addComponent(jScrollPane1, javax.swing.GroupLayout.Alignment.TRAILING, javax.swing.GroupLayout.DEFAULT_SIZE, 318, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addComponent(jPanel1, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 288, Short.MAX_VALUE))
        );
    }// </editor-fold>//GEN-END:initComponents

    private void copyButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_copyButtonActionPerformed
        int index = sObjLibTable.getSelectedRow();
        if (index != -1) {
            SoundObject sObj = sObjLib.getSoundObject(index);
            sObjBuffer.setBufferedObject((SoundObject) sObj.clone(), 0, 0);
        }
}//GEN-LAST:event_copyButtonActionPerformed

    private void copyInstanceButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_copyInstanceButtonActionPerformed
        int index = sObjLibTable.getSelectedRow();
        if (index != -1) {
            SoundObject originalSObj = sObjLib.getSoundObject(index);
            Instance tempSObj = new Instance(originalSObj);
            tempSObj.setStartTime(0.0f);
            tempSObj.setSubjectiveDuration(tempSObj.getObjectiveDuration());
            sObjBuffer.setBufferedObject(tempSObj, 0, 0);
        }
    }//GEN-LAST:event_copyInstanceButtonActionPerformed

    private void removeButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_removeButtonActionPerformed
        if (sObjLibTable.getSelectedRow() != -1) {
            Object sObj = sObjLib.remove(sObjLibTable.getSelectedRow());

            // sObjEditPanel.editSoundObject(null);

            fireSoundObjectRemoved((SoundObject) sObj);

            sObjLibTable.revalidate();
        }
    }//GEN-LAST:event_removeButtonActionPerformed
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton copyButton;
    private javax.swing.JButton copyInstanceButton;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JButton removeButton;
    private javax.swing.JTable sObjLibTable;
    // End of variables declaration//GEN-END:variables

    /**
     * Gets default instance. Do not use directly: reserved for *.settings files only,
     * i.e. deserialization routines; otherwise you could get a non-deserialized instance.
     * To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized SoundObjectLibraryTopComponent getDefault() {
        if (instance == null) {
            instance = new SoundObjectLibraryTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the SoundObjectLibraryTopComponent instance. Never call {@link #getDefault} directly!
     */
    public static synchronized SoundObjectLibraryTopComponent findInstance() {
        TopComponent win = WindowManager.getDefault().findTopComponent(
                PREFERRED_ID);
        if (win == null) {
            Logger.getLogger(SoundObjectLibraryTopComponent.class.getName()).
                    warning(
                    "Cannot find " + PREFERRED_ID + " component. It will not be located properly in the window system.");
            return getDefault();
        }
        if (win instanceof SoundObjectLibraryTopComponent) {
            return (SoundObjectLibraryTopComponent) win;
        }
        Logger.getLogger(SoundObjectLibraryTopComponent.class.getName()).warning(
                "There seem to be multiple components with the '" + PREFERRED_ID +
                "' ID. That is a potential source of errors and unexpected behavior.");
        return getDefault();
    }

    @Override
    public int getPersistenceType() {
        return TopComponent.PERSISTENCE_ALWAYS;
    }

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    /** replaces this in object stream */
    @Override
    public Object writeReplace() {
        return new ResolvableHelper();
    }

    @Override
    protected String preferredID() {
        return PREFERRED_ID;
    }

    @Override
    public void stateChanged(ChangeEvent ce) {
        this.sObjLibTable.revalidate();
    }

    final static class ResolvableHelper implements Serializable {

        private static final long serialVersionUID = 1L;

        public Object readResolve() {
            return SoundObjectLibraryTopComponent.getDefault();
        }
    }
}
