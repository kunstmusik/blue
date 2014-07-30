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

import blue.components.PropertyEditor;
import blue.noteProcessor.NoteProcessorChainMap;
import blue.score.ScoreObject;
import blue.score.undo.ResizeScoreObjectEdit;
import blue.score.undo.StartTimeEdit;
import blue.soundObject.SoundObject;
import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.ui.core.score.layers.SoundObjectProvider;
import blue.ui.utilities.SimpleDocumentListener;
import blue.undo.BlueUndoManager;
import java.io.Serializable;
import java.util.Collection;
import javax.swing.event.DocumentEvent;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.util.Lookup;
import org.openide.util.LookupEvent;
import org.openide.util.LookupListener;
import org.openide.util.NbBundle;
import org.openide.util.Utilities;
import org.openide.windows.TopComponent;

@ConvertAsProperties(
        dtd = "-//blue.ui.core.score.layers.soundObject//SoundObjectProperties//EN",
        autostore = false
)
@TopComponent.Description(
        preferredID = "SoundObjectPropertiesTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "properties", openAtStartup = false)
@ActionID(category = "Window", id = "blue.ui.core.score.layers.soundObject.SoundObjectPropertiesTopComponent")
@ActionReferences({
    @ActionReference(path = "Menu/Window", position = 200),
    @ActionReference(path = "Shortcuts", name = "F3")
})
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_SoundObjectPropertiesAction",
        preferredID = "SoundObjectPropertiesTopComponent"
)
@NbBundle.Messages({
    "CTL_SoundObjectPropertiesAction=SoundObject Properties",
    "CTL_SoundObjectPropertiesTopComponent=SoundObject Properties",
    "HINT_SoundObjectPropertiesTopComponent=This is a SoundObject Properties window"
})
public final class SoundObjectPropertiesTopComponent extends TopComponent implements ScoreObjectListener, LookupListener {

    private ScoreObject sObj = null;

    private static SoundObjectPropertiesTopComponent instance;

    PropertyEditor propEdittor = new PropertyEditor();

    private boolean isUpdating = false;

    Lookup.Result<ScoreObject> result = null;

    private SoundObjectPropertiesTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(SoundObjectPropertiesTopComponent.class,
                "CTL_SoundObjectPropertiesTopComponent"));
        setToolTipText(NbBundle.getMessage(
                SoundObjectPropertiesTopComponent.class,
                "HINT_SoundObjectPropertiesTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));

        nameText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    @Override
                    public void documentChanged(DocumentEvent e) {
                        if (nameText.getText() != null && sObj != null) {
                            isUpdating = true;
                            updateName();
                            isUpdating = false;
                        }
                    }
                });

    }

    private void setScoreObject(ScoreObject scoreObj) {
        SoundObject soundObj = null;
        if (scoreObj instanceof SoundObject) {
            soundObj = (SoundObject) scoreObj;
        }

        isUpdating = true;

        if (this.sObj != null) {
            this.sObj.removeScoreObjectListener(this);
        }

        if (scoreObj == null) {
            sObj = null;
            disableFields();
            propEdittor.editObject(null);
            noteProcessorChainEditor2.setNoteProcessorChain(null);
        } else {
            enableFields();
            setFieldsVisible(scoreObj != null);
            sObj = scoreObj;
            updateProperties();
            colorPanel.setColor(sObj.getBackgroundColor());


            if (soundObj != null) {
                noteProcessorChainEditor2.setNoteProcessorChain(
                    soundObj.getNoteProcessorChain());
                final int timeBehavior = soundObj.getTimeBehavior();
                if (timeBehavior == SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED) {
                    timeBehaviorBox.setEnabled(false);
                    useRepeatPoint.setEnabled(false);
                    repeatePointText.setEnabled(false);
                } else {
                    timeBehaviorBox.setEnabled(true);
                    timeBehaviorBox.setSelectedIndex(timeBehavior);

                    if (timeBehavior == SoundObject.TIME_BEHAVIOR_REPEAT) {

                        useRepeatPoint.setEnabled(true);

                        float repeatPoint = soundObj.getRepeatPoint();

                        if (repeatPoint <= 0.0f) {
                            useRepeatPoint.setSelected(false);
                            repeatePointText.setEnabled(false);
                        } else {
                            useRepeatPoint.setSelected(true);
                            repeatePointText.setEnabled(true);
                            repeatePointText.setText(Float.toString(repeatPoint));
                        }

                    } else {
                        useRepeatPoint.setEnabled(false);
                        repeatePointText.setEnabled(false);
                    }
                }
            }
            propEdittor.editObject(null);

            sObj.addScoreObjectListener(this);
        }

        isUpdating = false;
    }

    private void updateProperties() {
        if (sObj != null) {
            startTimeText.setText(Float.toString(sObj.getStartTime()));
            nameText.setText(sObj.getName());
            subjectiveDurationText.setText(Float.toString(sObj
                    .getSubjectiveDuration()));

            if (sObj instanceof SoundObject) {
                float repeatPoint = ((SoundObject) sObj).getRepeatPoint();
                repeatePointText.setText(Float.toString(repeatPoint));
            }

            updateEndTime();
        }
    }

    private void updateEndTime() {
        endTimeText.setText(Float.toString(this.sObj.getStartTime()
                + this.sObj.getSubjectiveDuration()));
    }

    protected void updateName() {
        sObj.setName(nameText.getText());
    }

    protected void updateColor() {
        sObj.setBackgroundColor(colorPanel.getColor());
    }

    protected void updateStartTime() {
        float initialStart = sObj.getStartTime();
        float newValue;

        try {
            newValue = Float.parseFloat(startTimeText.getText());
        } catch (NumberFormatException nfe) {
            startTimeText.setText(Float.toString(initialStart));
            return;
        }

        if (newValue < 0.0f) {
            newValue = 0.0f;
            startTimeText.setText("0.0");
        }

        sObj.setStartTime(newValue);

        BlueUndoManager.setUndoManager("score");

        BlueUndoManager
                .addEdit(new StartTimeEdit(initialStart, newValue, sObj));
    }

    protected void updateSubjectiveDuration() {
        float initialDuration = sObj.getSubjectiveDuration();
        float newValue;

        try {
            newValue = Float.parseFloat(subjectiveDurationText.getText());
        } catch (NumberFormatException nfe) {
            subjectiveDurationText.setText(Float.toString(initialDuration));
            return;
        }

        sObj.setSubjectiveDuration(newValue);

        BlueUndoManager.setUndoManager("score");

        BlueUndoManager.addEdit(new ResizeScoreObjectEdit(this.sObj,
                initialDuration, this.sObj.getSubjectiveDuration()));

    }

    private void updateTimeBehavior() {

        if (!(sObj instanceof ScoreObject)) {
            return;
        }

        SoundObject soundObj = (SoundObject) sObj;

        soundObj.setTimeBehavior(timeBehaviorBox.getSelectedIndex());

        if (timeBehaviorBox.getSelectedIndex() == SoundObject.TIME_BEHAVIOR_REPEAT) {

            boolean repeatPointUsed = soundObj.getRepeatPoint() > 0.0f;

            useRepeatPoint.setSelected(repeatPointUsed);
            useRepeatPoint.setEnabled(true);

            repeatePointText.setEnabled(repeatPointUsed);

        } else {
            useRepeatPoint.setSelected(false);
            useRepeatPoint.setEnabled(false);

            repeatePointText.setEnabled(false);

            if (!isUpdating) {
                soundObj.setRepeatPoint(-1.0f);
            }

        }
    }

    private void updateUseRepeatPoint() {
        if (!(sObj instanceof ScoreObject)) {
            return;
        }

        SoundObject soundObj = (SoundObject) sObj;
        repeatePointText.setEnabled(useRepeatPoint.isSelected());

        if (!isUpdating) {
            float dur = -1.0f;

            if (useRepeatPoint.isSelected()) {
                dur = sObj.getSubjectiveDuration();
            }

            soundObj.setRepeatPoint(dur);
            repeatePointText.setText(Float.toString(dur));
        }

    }

    protected void updateRepeatPoint() {
        if (!(sObj instanceof ScoreObject)) {
            return;
        }

        SoundObject soundObj = (SoundObject) sObj;
        float initialRepeatPoint = soundObj.getRepeatPoint();
        float newValue;

        try {
            newValue = Float.parseFloat(repeatePointText.getText());
        } catch (NumberFormatException nfe) {
            repeatePointText.setText(Float.toString(initialRepeatPoint));
            return;
        }

        if (newValue <= 0.0f) {
            repeatePointText.setText(Float.toString(initialRepeatPoint));
            return;
        } else {
            soundObj.setRepeatPoint(newValue);
            repeatePointText.setText(Float.toString(newValue));
        }

    }

    // utility methods
    private void setFieldsVisible(boolean isSoundObject) {
        timeBehaviorBox.setVisible(isSoundObject);
        repeatePointText.setVisible(isSoundObject);
        noteProcessorChainEditor2.setVisible(isSoundObject);
    }

    private void enableFields() {
        nameText.setEnabled(true);
        startTimeText.setEnabled(true);
        subjectiveDurationText.setEnabled(true);
        timeBehaviorBox.setEnabled(true);
        repeatePointText.setEnabled(true);
        colorPanel.setVisible(true);
    }

    private void disableFields() {
        nameText.setText("");
        nameText.setEnabled(false);
        startTimeText.setText("");
        startTimeText.setEnabled(false);
        subjectiveDurationText.setText("");
        subjectiveDurationText.setEnabled(false);
        endTimeText.setText("");
        timeBehaviorBox.setEnabled(false);
        useRepeatPoint.setEnabled(false);
        repeatePointText.setText("");
        repeatePointText.setEnabled(false);
        colorPanel.setVisible(false);
    }

    /**
     * @param npcMap
     */
    public void setNoteProcessorChainMap(NoteProcessorChainMap npcMap) {
        noteProcessorChainEditor2.setNoteProcessorChainMap(npcMap);
    }

//    // SELECTION LISTENER
//    public void selectionPerformed(SelectionEvent e) {
//        Object item = e.getSelectedItem();
//
//        SoundObject sObj = null;
//
//        if (item instanceof SoundObjectView) {
//            SoundObjectView sObjView = (SoundObjectView) item;
//            sObj = sObjView.getSoundObject();
//
//            setLibraryItem(false);
//        } else {
//            sObj = (SoundObject) item;
//            setLibraryItem(true);
//        }
//
//        switch (e.getSelectionType()) {
//            case SelectionEvent.SELECTION_SINGLE:
//                sObjBuffer.clear();
//                sObjBuffer.add(sObj);
//                // System.out.println("Single");
//                break;
//            case SelectionEvent.SELECTION_ADD:
//                // System.out.println("Add");
//                sObjBuffer.add(sObj);
//                break;
//            case SelectionEvent.SELECTION_REMOVE:
//                sObjBuffer.remove(sObj);
//                // System.out.println("Remove");
//                break;
//            case SelectionEvent.SELECTION_CLEAR:
//                sObjBuffer.clear();
//                // System.out.println("Clear");
//                break;
//        }
//
//        setSoundObject(sObj);
//    }
    private void setLibraryItem(boolean isLibrary) {
        startTimeText.setEnabled(!isLibrary);
    }

    // SOUND OBJECT LISTENER
    @Override
    public void scoreObjectChanged(ScoreObjectEvent event) {
        if (event.getScoreObject() != this.sObj) {
            return;
        }

        switch (event.getPropertyChanged()) {
            case ScoreObjectEvent.NAME:
                if (!isUpdating) {
                    nameText.setText(sObj.getName());
                }
                break;
            case ScoreObjectEvent.START_TIME:
                startTimeText.setText(Float.toString(sObj.getStartTime()));
                updateEndTime();
                break;
            case ScoreObjectEvent.DURATION:
                subjectiveDurationText.setText(Float.toString(sObj
                        .getSubjectiveDuration()));
                updateEndTime();
                break;
            case ScoreObjectEvent.COLOR:
                colorPanel.setColor(sObj.getBackgroundColor());
                break;
        }
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        noteProcessorChainEditor1 = new blue.ui.core.score.NoteProcessorChainEditor();
        jScrollPane1 = new javax.swing.JScrollPane();
        jPanel1 = new javax.swing.JPanel();
        colorPanel = new blue.components.ColorSelectionPanel();
        jLabel4 = new javax.swing.JLabel();
        useRepeatPoint = new javax.swing.JCheckBox();
        jLabel1 = new javax.swing.JLabel();
        subjectiveDurationText = new javax.swing.JTextField();
        jLabel3 = new javax.swing.JLabel();
        nameText = new javax.swing.JTextField();
        repeatePointText = new javax.swing.JTextField();
        timeBehaviorBox = new javax.swing.JComboBox();
        jLabel7 = new javax.swing.JLabel();
        jLabel5 = new javax.swing.JLabel();
        startTimeText = new javax.swing.JTextField();
        endTimeText = new javax.swing.JTextField();
        jLabel6 = new javax.swing.JLabel();
        jLabel8 = new javax.swing.JLabel();
        noteProcessorChainEditor2 = new blue.ui.core.score.NoteProcessorChainEditor();
        jLabel2 = new javax.swing.JLabel();

        jScrollPane1.setBorder(null);

        colorPanel.addPropertyChangeListener(new java.beans.PropertyChangeListener() {
            public void propertyChange(java.beans.PropertyChangeEvent evt) {
                colorPanelPropertyChange(evt);
            }
        });

        javax.swing.GroupLayout colorPanelLayout = new javax.swing.GroupLayout(colorPanel);
        colorPanel.setLayout(colorPanelLayout);
        colorPanelLayout.setHorizontalGroup(
            colorPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 123, Short.MAX_VALUE)
        );
        colorPanelLayout.setVerticalGroup(
            colorPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 16, Short.MAX_VALUE)
        );

        org.openide.awt.Mnemonics.setLocalizedText(jLabel4, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.jLabel4.text")); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(useRepeatPoint, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.useRepeatPoint.text")); // NOI18N
        useRepeatPoint.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                useRepeatPointActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(jLabel1, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.jLabel1.text")); // NOI18N

        subjectiveDurationText.setText(org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.subjectiveDurationText.text")); // NOI18N
        subjectiveDurationText.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                subjectiveDurationTextActionPerformed(evt);
            }
        });
        subjectiveDurationText.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                subjectiveDurationTextFocusLost(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(jLabel3, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.jLabel3.text")); // NOI18N

        nameText.setText(org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.nameText.text")); // NOI18N
        nameText.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                nameTextActionPerformed(evt);
            }
        });
        nameText.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                nameTextFocusLost(evt);
            }
        });

        repeatePointText.setText(org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.repeatePointText.text")); // NOI18N
        repeatePointText.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                repeatePointTextActionPerformed(evt);
            }
        });
        repeatePointText.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                repeatePointTextFocusLost(evt);
            }
        });

        timeBehaviorBox.setModel(new javax.swing.DefaultComboBoxModel(new String[] { "Scale", "Repeat", "None" }));
        timeBehaviorBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                timeBehaviorBoxActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(jLabel7, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.jLabel7.text")); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(jLabel5, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.jLabel5.text")); // NOI18N

        startTimeText.setText(org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.startTimeText.text")); // NOI18N
        startTimeText.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                startTimeTextActionPerformed(evt);
            }
        });
        startTimeText.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                startTimeTextFocusLost(evt);
            }
        });

        endTimeText.setEditable(false);
        endTimeText.setText(org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.endTimeText.text")); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(jLabel6, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.jLabel6.text")); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(jLabel8, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.jLabel8.text")); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(jLabel2, org.openide.util.NbBundle.getMessage(SoundObjectPropertiesTopComponent.class, "SoundObjectPropertiesTopComponent.jLabel2.text")); // NOI18N

        javax.swing.GroupLayout jPanel1Layout = new javax.swing.GroupLayout(jPanel1);
        jPanel1.setLayout(jPanel1Layout);
        jPanel1Layout.setHorizontalGroup(
            jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING)
                    .addComponent(noteProcessorChainEditor2, javax.swing.GroupLayout.PREFERRED_SIZE, 260, Short.MAX_VALUE)
                    .addGroup(jPanel1Layout.createSequentialGroup()
                        .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addComponent(jLabel1, javax.swing.GroupLayout.Alignment.TRAILING)
                            .addComponent(jLabel2, javax.swing.GroupLayout.Alignment.TRAILING)
                            .addComponent(jLabel3, javax.swing.GroupLayout.Alignment.TRAILING)
                            .addComponent(jLabel4, javax.swing.GroupLayout.Alignment.TRAILING)
                            .addComponent(jLabel5, javax.swing.GroupLayout.Alignment.TRAILING)
                            .addComponent(jLabel7, javax.swing.GroupLayout.Alignment.TRAILING)
                            .addComponent(jLabel6, javax.swing.GroupLayout.Alignment.TRAILING)
                            .addComponent(jLabel8, javax.swing.GroupLayout.Alignment.TRAILING))
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addComponent(colorPanel, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                            .addComponent(nameText, javax.swing.GroupLayout.DEFAULT_SIZE, 123, Short.MAX_VALUE)
                            .addComponent(repeatePointText, javax.swing.GroupLayout.DEFAULT_SIZE, 123, Short.MAX_VALUE)
                            .addComponent(endTimeText, javax.swing.GroupLayout.DEFAULT_SIZE, 123, Short.MAX_VALUE)
                            .addComponent(subjectiveDurationText, javax.swing.GroupLayout.DEFAULT_SIZE, 123, Short.MAX_VALUE)
                            .addComponent(startTimeText, javax.swing.GroupLayout.DEFAULT_SIZE, 123, Short.MAX_VALUE)
                            .addComponent(timeBehaviorBox, 0, 123, Short.MAX_VALUE)
                            .addComponent(useRepeatPoint))))
                .addContainerGap())
        );
        jPanel1Layout.setVerticalGroup(
            jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel1)
                    .addComponent(nameText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel2)
                    .addComponent(startTimeText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel3)
                    .addComponent(subjectiveDurationText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel4)
                    .addComponent(endTimeText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel5)
                    .addComponent(timeBehaviorBox, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(jLabel7)
                    .addComponent(useRepeatPoint))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel6)
                    .addComponent(repeatePointText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING, false)
                    .addComponent(colorPanel, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                    .addComponent(jLabel8))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.UNRELATED)
                .addComponent(noteProcessorChainEditor2, javax.swing.GroupLayout.DEFAULT_SIZE, 113, Short.MAX_VALUE)
                .addContainerGap())
        );

        jScrollPane1.setViewportView(jPanel1);

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 245, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 341, Short.MAX_VALUE)
        );
    }// </editor-fold>//GEN-END:initComponents

    private void timeBehaviorBoxActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_timeBehaviorBoxActionPerformed
        updateTimeBehavior();
    }//GEN-LAST:event_timeBehaviorBoxActionPerformed

    private void colorPanelPropertyChange(java.beans.PropertyChangeEvent evt) {//GEN-FIRST:event_colorPanelPropertyChange
        if (evt.getPropertyName().equals("colorSelectionValue")) {
            updateColor();
        }
    }//GEN-LAST:event_colorPanelPropertyChange

    private void nameTextFocusLost(java.awt.event.FocusEvent evt) {//GEN-FIRST:event_nameTextFocusLost
        if (nameText.getText() != null && sObj != null) {
            updateName();
        }
    }//GEN-LAST:event_nameTextFocusLost

    private void nameTextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_nameTextActionPerformed
        if (nameText.getText() != null && sObj != null) {
            updateName();
        }
    }//GEN-LAST:event_nameTextActionPerformed

    private void subjectiveDurationTextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_subjectiveDurationTextActionPerformed
        if (sObj != null) {
            updateSubjectiveDuration();
        }
    }//GEN-LAST:event_subjectiveDurationTextActionPerformed

    private void subjectiveDurationTextFocusLost(java.awt.event.FocusEvent evt) {//GEN-FIRST:event_subjectiveDurationTextFocusLost
        if (sObj != null) {
            updateSubjectiveDuration();
        }
    }//GEN-LAST:event_subjectiveDurationTextFocusLost

    private void useRepeatPointActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_useRepeatPointActionPerformed
        updateUseRepeatPoint();
    }//GEN-LAST:event_useRepeatPointActionPerformed

    private void repeatePointTextFocusLost(java.awt.event.FocusEvent evt) {//GEN-FIRST:event_repeatePointTextFocusLost
        if (repeatePointText.getText() != null && sObj != null) {
            updateRepeatPoint();
        }
}//GEN-LAST:event_repeatePointTextFocusLost

    private void repeatePointTextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_repeatePointTextActionPerformed
        if (repeatePointText.getText() != null && sObj != null) {
            updateRepeatPoint();
        }
}//GEN-LAST:event_repeatePointTextActionPerformed

    private void startTimeTextFocusLost(java.awt.event.FocusEvent evt) {//GEN-FIRST:event_startTimeTextFocusLost
        if (startTimeText.getText() != null && sObj != null) {
            updateStartTime();
        }
}//GEN-LAST:event_startTimeTextFocusLost

    private void startTimeTextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_startTimeTextActionPerformed
        if (startTimeText.getText() != null && sObj != null) {
            updateStartTime();
        }
}//GEN-LAST:event_startTimeTextActionPerformed

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private blue.components.ColorSelectionPanel colorPanel;
    private javax.swing.JTextField endTimeText;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JLabel jLabel8;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JTextField nameText;
    private blue.ui.core.score.NoteProcessorChainEditor noteProcessorChainEditor1;
    private blue.ui.core.score.NoteProcessorChainEditor noteProcessorChainEditor2;
    private javax.swing.JTextField repeatePointText;
    private javax.swing.JTextField startTimeText;
    private javax.swing.JTextField subjectiveDurationText;
    private javax.swing.JComboBox timeBehaviorBox;
    private javax.swing.JCheckBox useRepeatPoint;
    // End of variables declaration//GEN-END:variables

    public static synchronized SoundObjectPropertiesTopComponent getDefault() {
        if (instance == null) {
            instance = new SoundObjectPropertiesTopComponent();
        }
        return instance;
    }

    @Override
    public void componentOpened() {
        result = Utilities.actionsGlobalContext().lookupResult(ScoreObject.class);
        result.addLookupListener(this);
        resultChanged(null);
    }

    @Override
    public void componentClosed() {
        result.removeLookupListener(this);
    }

    @Override
    protected void componentActivated() {
        super.componentActivated();

        if (nameText.isEnabled()) {
            nameText.requestFocus();
        }

    }

    void writeProperties(java.util.Properties p) {
        p.setProperty("version", "1.0");
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
    }

    /**
     * replaces this in object stream
     */
    @Override
    public Object writeReplace() {
        return new ResolvableHelper();
    }

    @Override
    public void resultChanged(LookupEvent ev) {

        if (!(TopComponent.getRegistry().getActivated() instanceof SoundObjectProvider)) {
            return;
        }

        Collection<? extends ScoreObject> scoreObjects = result.allInstances();
        if (scoreObjects.size() == 1) {
            setScoreObject(scoreObjects.iterator().next());
        } else {
            setScoreObject(null);
        }
    }

    final static class ResolvableHelper implements Serializable {

        private static final long serialVersionUID = 1L;

        public Object readResolve() {
            return SoundObjectPropertiesTopComponent.getDefault();
        }
    }
}
