/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.

 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.score.layers.soundObject;

import blue.BlueData;
import blue.BlueSystem;
import blue.SoundLayer;
import blue.actions.BlueAction;
import blue.event.SelectionEvent;
import blue.gui.ExceptionDialog;
import blue.mixer.Mixer;
import blue.projects.BlueProjectManager;
import blue.score.TimeState;
import blue.services.render.CsdRenderResult;
import blue.score.undo.AlignEdit;
import blue.services.render.CSDRenderService;
import blue.settings.UtilitySettings;
import blue.ui.core.score.undo.MoveSoundObjectsEdit;
import blue.ui.core.score.undo.ReplaceSoundObjectEdit;
import blue.soundObject.External;
import blue.soundObject.FrozenSoundObject;
import blue.soundObject.GenericScore;
import blue.soundObject.Instance;
import blue.soundObject.ObjectBuilder;
import blue.soundObject.PolyObject;
import blue.soundObject.PythonObject;
import blue.soundObject.SoundObject;
import blue.ui.core.render.DiskRenderManager;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.utilities.FileChooserManager;
import blue.undo.BlueUndoManager;
import blue.utility.FileUtilities;
import blue.utility.ObjectUtilities;
import blue.utility.SoundFileUtilities;
import electric.xml.Element;
import java.awt.Color;
import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Iterator;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JColorChooser;
import javax.swing.JComponent;
import javax.swing.JFileChooser;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;

/*
 *
 * Popup used when rt-mouse click on a soundObject
 *
 */

// TODO - Redo using Actions
public class SoundObjectPopup extends JPopupMenu {

//    private static final String EXPORT_DIALOG = "sObj.export";
//
//    private static final String SHOW_SOBJ_PROPS = "Show Sound Object Properties";
//
//    private static final String HIDE_SOBJ_PROPS = "Hide Sound Object Properties";
//
//    Action auditionSoundObjects;
//
//    JMenuItem editMenuOpt = new JMenuItem();
//
//    JMenuItem sObjLibMenuOpt = new JMenuItem();
//
//    JMenuItem convertPolyMenuOpt = new JMenuItem();
//
////    JMenuItem convertGenericMenuOpt = new JMenuItem();
//
//    JMenuItem convertObjectBuilderMenuOpt = new JMenuItem();
//
//    JMenuItem replaceOpt = new JMenuItem();
//
//    JMenuItem followTheLeaderMenuOpt = new JMenuItem();
//
//    JMenuItem setTimeMenuOpt = new JMenuItem();
//
//    JMenuItem cutMenuOpt = new JMenuItem();
//
//    JMenuItem copyMenuOpt = new JMenuItem();
//
//    JMenuItem removeMenuOpt = new JMenuItem();
//
//    JMenuItem freezeMenuOpt = new JMenuItem();
//
//    JMenuItem alignLeftMenuOpt = new JMenuItem();
//
//    JMenuItem alignRightMenuOpt = new JMenuItem();
//
//    JMenuItem alignCenterMenuOpt = new JMenuItem();
//
////    JMenuItem showSObjProperties = new JMenuItem();
//
//    SoundObjectView sObjView;
//
//    ScoreTimeCanvas sCanvas;
//    
//    TimeState timeState = null;
//
//    public SoundObjectPopup(final ScoreTimeCanvas sCanvas) {
//        this.sCanvas = sCanvas;
//
//        BlueSystem.setMenuText(editMenuOpt, "soundObjectPopup.edit");
//        BlueSystem.setMenuText(sObjLibMenuOpt, "soundObjectPopup.sObjLib");
//        BlueSystem.setMenuText(convertPolyMenuOpt,
//                "soundObjectPopup.convertPoly");
////        BlueSystem.setMenuText(convertGenericMenuOpt,
////                "soundObjectPopup.convertGeneric");
//        BlueSystem.setMenuText(convertObjectBuilderMenuOpt,
//                "soundObjectPopup.convertObjectBuilder");
//        BlueSystem.setMenuText(replaceOpt, "soundObjectPopup.replace");
//        BlueSystem.setMenuText(followTheLeaderMenuOpt,
//                "soundObjectPopup.followTheLeader");
//        BlueSystem.setMenuText(setTimeMenuOpt, "soundObjectPopup.setTime");
//        BlueSystem.setMenuText(cutMenuOpt, "soundObjectPopup.cut");
//        BlueSystem.setMenuText(copyMenuOpt, "soundObjectPopup.copy");
//        BlueSystem.setMenuText(removeMenuOpt, "soundObjectPopup.remove");
//
//        freezeMenuOpt.setText("Freeze/Unfreeze SoundObjects");
//
//        BlueSystem.setMenuText(alignLeftMenuOpt,
//                "soundObjectPopup.align.left");
//        BlueSystem.setMenuText(alignCenterMenuOpt,
//                "soundObjectPopup.align.center");
//        BlueSystem.setMenuText(alignRightMenuOpt,
//                "soundObjectPopup.align.right");
//
//        auditionSoundObjects = new AbstractAction(
//                "Audition Selected SoundObjects") {
//
//            public void actionPerformed(ActionEvent e) {
//                auditionSoundObjects();
//            }
//        };
//
//        editMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                editSObj();
//            }
//        });
//        sObjLibMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                addToSObjLib();
//            }
//        });
//        convertPolyMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                convertToPolyObject();
//            }
//        });
////        convertGenericMenuOpt.addActionListener(new ActionListener() {
////
////            public void actionPerformed(ActionEvent e) {
////                convertToGenericScore();
////            }
////        });
//        convertObjectBuilderMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                convertToObjectBuilder();
//            }
//        });
//        replaceOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                replaceSoundObject();
//            }
//        });
//        followTheLeaderMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                followTheLeader();
//            }
//        });
//
//        Action reverseAction = new BlueAction("soundObjectPopup.reverse") {
//
//            public void actionPerformed(ActionEvent e) {
//                reverseSoundObjects();
//
//            }
//        };
//
//        setTimeMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                setSubjectiveTimeToObjectiveTime();
//            }
//        });
//        removeMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                removeSObj();
//            }
//        });
//        freezeMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                freezeUnfreezeSoundObject();
//            }
//        });
//        copyMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                copySObj();
//            }
//        });
//        cutMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                copySObj();
//                removeSObj();
//            }
//        });
//        alignLeftMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                alignLeft();
//            }
//        });
//        alignCenterMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                alignCenter();
//            }
//        });
//        alignRightMenuOpt.addActionListener(new ActionListener() {
//
//            public void actionPerformed(ActionEvent e) {
//                alignRight();
//            }
//        });
////        showSObjProperties.addActionListener(new ActionListener() {
////
////            public void actionPerformed(ActionEvent e) {
////                flipSoundObjectProperties();
////            }
////        });
//
//        Action setColorAction = new SetColorAction();
//
//        Action exportItem = new AbstractAction(BlueSystem.getString("common.export")) {
//
//            public void actionPerformed(ActionEvent e) {
//                if (sObjView == null) {
//                    return;
//                }
//
//                int retVal = FileChooserManager.getDefault().showSaveDialog(
//                        EXPORT_DIALOG, SwingUtilities.getRoot(sCanvas));
//
//                if (retVal == JFileChooser.APPROVE_OPTION) {
//
//                    File f = FileChooserManager.getDefault().getSelectedFile(EXPORT_DIALOG);
//
//                    if (f.exists()) {
//                        int overWrite = JOptionPane.showConfirmDialog(SwingUtilities.getRoot(sCanvas),
//                                "Please confirm you would like to overwrite this file.");
//
//                        if (overWrite != JOptionPane.OK_OPTION) {
//                            return;
//                        }
//                    }
//
//                    SoundObject sObj = sObjView.getSoundObject();
//
//                    if ((sObj instanceof Instance) || ((sObj instanceof PolyObject) && containsInstance((PolyObject) sObj))) {
//                        JOptionPane.showMessageDialog(
//                                SwingUtilities.getRoot(sCanvas),
//                                "Error: Export of Instance or " + "PolyObjects containing Instance " + "is not allowed.",
//                                "Error", JOptionPane.ERROR_MESSAGE);
//                        return;
//                    }
//
//                    Element node = sObj.saveAsXML(null);
//
//                    PrintWriter out;
//
//                    try {
//                        out = new PrintWriter(new FileWriter(f));
//                        out.print(node.toString());
//
//                        out.flush();
//                        out.close();
//                    } catch (IOException ex) {
//                        ex.printStackTrace();
//                    }
//
//                }
//            }
//        };
//
//        Action shiftAction = new AbstractAction(BlueSystem.getString("scoreGUI.action.shift")) {
//
//            @Override
//            public void actionPerformed(ActionEvent e) {
////                if (sCanvas.mBuffer.size() <= 0) {
////                    return;
////                }
////
////                String value = JOptionPane.showInputDialog(null, BlueSystem
////                        .getString("scoreGUI.action.shift.message"));
////
////                sCanvas.mBuffer.motionBufferObjects();
////                SoundObjectView[] views = sCanvas.mBuffer.motionBuffer;
////
////                try {
////                    float val = Float.parseFloat(value);
////
////                    for (int i = 0; i < views.length; i++) {
////                        if ((views[i].getStartTime() + val) < 0) {
////                            JOptionPane.showMessageDialog(null, BlueSystem
////                                    .getString("scoreGUI.action.shift.error"));
////                            return;
////                        }
////                    }
////
////                    for (int i = 0; i < views.length; i++) {
////                        SoundObject sObj = views[i].getSoundObject();
////
////                        views[i].setStartTime(sObj.getStartTime() + val);
////                    }
////
////                } catch (NumberFormatException nfe) {
////                    System.err.println(nfe.getMessage());
////                }
//            }
//            
//        };
//     
//        JMenu align = new JMenu();
//        BlueSystem.setMenuText(align, "soundObjectPopup.align");
//
//        this.add(auditionSoundObjects);
//        this.addSeparator();
//
//        this.add(editMenuOpt);
//        this.addSeparator();
//
//        this.add(sObjLibMenuOpt);
//        this.addSeparator();
//
//        this.add(freezeMenuOpt);
//        this.addSeparator();
//
//        this.add(convertPolyMenuOpt);
////        this.add(convertGenericMenuOpt);
//        this.add(convertObjectBuilderMenuOpt);
//        this.add(replaceOpt);
//        this.add(followTheLeaderMenuOpt);
//
//        this.add(align);
//        align.add(alignLeftMenuOpt);
//        align.add(alignCenterMenuOpt);
//        align.add(alignRightMenuOpt);
//
//        this.add(reverseAction);
//        this.add(shiftAction);
//
//        this.add(setTimeMenuOpt);
//
//        this.addSeparator();
//        this.add(cutMenuOpt);
//        this.add(copyMenuOpt);
//        this.addSeparator();
//        this.add(removeMenuOpt);
//
//        this.addSeparator();
//        this.add(setColorAction);
////        this.add(showSObjProperties);
//
//        this.addSeparator();
//        this.add(exportItem);
//
//    }
//
//    public void setTimeState(TimeState timeState) {
//        this.timeState = timeState;
//    }
//    
//    protected boolean containsInstance(PolyObject pObj) {
////        ArrayList soundObjects = pObj.getSoundObjects(true);
////
////        for (Iterator iter = soundObjects.iterator(); iter.hasNext();) {
////            SoundObject sObj = (SoundObject) iter.next();
////
////            if (sObj instanceof PolyObject) {
////                if (containsInstance((PolyObject) sObj)) {
////                    return true;
////                }
////            } else if (sObj instanceof Instance) {
////                return true;
////            }
////        }
//        return false;
//    }
//
//    /**
//     * Aligns selected soundObjects to the left
//     */
//    protected void alignLeft() {
//        SoundObject[] soundObjects = sCanvas.mBuffer.getSoundObjectsAsArray();
//
//        if (soundObjects.length < 2) {
//            return;
//        }
//
//        float initialStartTimes[] = new float[sCanvas.mBuffer.size()];
//        float endingStartTimes[] = new float[sCanvas.mBuffer.size()];
//
//        float farLeft = soundObjects[0].getStartTime();
//        initialStartTimes[0] = farLeft;
//
//        float tempStart;
//        for (int i = 1; i < soundObjects.length; i++) {
//            SoundObject sObj = soundObjects[i];
//            tempStart = sObj.getStartTime();
//
//            initialStartTimes[i] = tempStart;
//
//            if (tempStart < farLeft) {
//                farLeft = tempStart;
//            }
//        }
//        for (int i = 0; i < soundObjects.length; i++) {
//            SoundObject sObj = soundObjects[i];
//            sObj.setStartTime(farLeft);
//            endingStartTimes[i] = farLeft;
//        }
//
//        BlueUndoManager.setUndoManager("score");
//        AlignEdit edit = new AlignEdit(soundObjects, initialStartTimes,
//                endingStartTimes);
//
//        edit.setPresentationName("Align Left");
//
//        BlueUndoManager.addEdit(edit);
//
//    }
//
//    /**
//     * Aligns selected soundObjects to the center
//     */
//    protected void alignCenter() {
//        SoundObject soundObjects[] = sCanvas.mBuffer.getSoundObjectsAsArray();
//        if (soundObjects.length < 2) {
//            return;
//        }
//
//        float initialStartTimes[] = new float[soundObjects.length];
//        float endingStartTimes[] = new float[soundObjects.length];
//
//        float farLeft = soundObjects[0].getStartTime();
//        initialStartTimes[0] = farLeft;
//
//        float tempStart;
//        for (int i = 1; i < soundObjects.length; i++) {
//            tempStart = soundObjects[i].getStartTime();
//
//            initialStartTimes[i] = tempStart;
//
//            if (tempStart < farLeft) {
//                farLeft = tempStart;
//            }
//        }
//
//        float farRight = soundObjects[0].getStartTime() + soundObjects[0].getSubjectiveDuration();
//        float endTime;
//
//        for (int i = 1; i < soundObjects.length; i++) {
//            endTime = soundObjects[i].getStartTime() + soundObjects[i].getSubjectiveDuration();
//
//            if (endTime > farRight) {
//                farRight = endTime;
//            }
//        }
//
//        float centerTime = ((farRight - farLeft) / 2) + farLeft;
//
//        float newEndTime;
//        for (int i = 0; i < soundObjects.length; i++) {
//            newEndTime = centerTime - (soundObjects[i].getSubjectiveDuration() / 2);
//            soundObjects[i].setStartTime(newEndTime);
//            endingStartTimes[i] = newEndTime;
//        }
//
//        BlueUndoManager.setUndoManager("score");
//        AlignEdit edit = new AlignEdit(soundObjects, initialStartTimes,
//                endingStartTimes);
//
//        edit.setPresentationName("Align Center");
//
//        BlueUndoManager.addEdit(edit);
//
//    }
//
//    /**
//     * Aligns selected soundObjects to the right
//     */
//    protected void alignRight() {
//        SoundObject soundObjects[] = sCanvas.mBuffer.getSoundObjectsAsArray();
//        if (soundObjects.length < 2) {
//            return;
//        }
//
//        float initialStartTimes[] = new float[soundObjects.length];
//        float endingStartTimes[] = new float[soundObjects.length];
//
//        float farRight = soundObjects[0].getStartTime() + soundObjects[0].getSubjectiveDuration();
//        initialStartTimes[0] = farRight;
//
//        float startTime;
//        float endTime;
//
//        for (int i = 1; i < soundObjects.length; i++) {
//
//            startTime = soundObjects[i].getStartTime();
//            endTime = startTime + soundObjects[i].getSubjectiveDuration();
//
//            initialStartTimes[i] = startTime;
//
//            if (endTime > farRight) {
//                farRight = endTime;
//            }
//        }
//
//        float newStart;
//        for (int i = 0; i < soundObjects.length; i++) {
//            newStart = farRight - soundObjects[i].getSubjectiveDuration();
//            soundObjects[i].setStartTime(newStart);
//            endingStartTimes[i] = newStart;
//        }
//
//        BlueUndoManager.setUndoManager("score");
//        AlignEdit edit = new AlignEdit(soundObjects, initialStartTimes,
//                endingStartTimes);
//
//        edit.setPresentationName("Align Right");
//
//        BlueUndoManager.addEdit(edit);
//
//    }
//
//    public void copySObj() {
//        sCanvas.buffer.copySoundObjects(sCanvas.mBuffer);
//    }
//
//    private void editSObj() {
//        if (sObjView.getSoundObject() instanceof PolyObject) {
////                sCanvas.sGUI.polyObjectBar.addPolyObject((PolyObject) sObjView
////                        .getSoundObject());
//            }
//    }
//
//    private void addToSObjLib() {
//        SoundObject sObj = (SoundObject) sObjView.getSoundObject().clone();
//
//        if(sObj instanceof Instance) {
//            return;
//        }
//        
//        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
//        data.getSoundObjectLibrary().addSoundObject(sObj);
//       
//        Instance i = new Instance(sObj);
//
//        replaceSoundObject(sObjView.getSoundObject(), i, true, false);
//    }
//
//    public void removeSObj() {
//        sCanvas.removeSoundObjects();
//    }
//
//    // FIXME
////    private void convertToGenericScore() {
////        int index = sCanvas.getPolyObject().getLayerNumForY(sObjView.getY());
////
////        SoundObject temp = sCanvas.mBuffer.getBufferedSoundObject();
////
////        if (temp == null) {
////            return;
////        }
////
////        int retVal = JOptionPane.showConfirmDialog(null,
////                "This operation can not be undone.\nAre you sure?");
////
////        if (retVal != JOptionPane.OK_OPTION) {
////            return;
////        }
////
////        GenericScore tempGen = null;
////
////            try {
////                BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
////                Arrangement arr = project.getData().getArrangement();
////
////                temp.generateInstruments(arr);
////
////                // TODO - NEED TO GRAB FTABLES FROM TEMP INSTRUMENT!
////                tempGen = GenericScore.transformSoundObject(temp);
////            } catch (SoundObjectException e) {
////                String message = "Could not convert to GenericScore due to errors in the "
////                        + "Source SoundObject. Please correct the errors before proceeding.";
////
////                SoundObjectException soe = new SoundObjectException(temp,
////                        message, e);
////
////                ExceptionDialog.showExceptionDialog(SwingUtilities
////                        .getRoot(this), soe);
////                return;
////
////            }
////
////        removeSObj();
////
////        float startTime = (float) sObjView.getX() / sCanvas.getPolyObject().getPixelSecond();
////        tempGen.setStartTime(startTime);
////
////        sCanvas.getPolyObject().addSoundObject(index, tempGen);
////
////        sCanvas.sMouse.fireSelectionEvent(new SelectionEvent(null,
////                SelectionEvent.SELECTION_CLEAR));
////
////    }
//
//    private void convertToPolyObject() {
//        int retVal = JOptionPane.showConfirmDialog(null,
//                "This operation can not be undone.\nAre you sure?");
//
//        if (retVal != JOptionPane.OK_OPTION) {
//            return;
//        }
//
//        int index = sCanvas.getPolyObject().getLayerNumForY(sObjView.getY());
//
//        PolyObject temp = sCanvas.mBuffer.getBufferedPolyObject();
//
//        removeSObj();
//
//        float startTime = (float) sObjView.getX() / timeState.getPixelSecond();
//        temp.setStartTime(startTime);
//
//        sCanvas.getPolyObject().addSoundObject(index, temp);
//        sCanvas.sMouse.fireSelectionEvent(new SelectionEvent(null,
//                SelectionEvent.SELECTION_CLEAR));
//    }
//
//    private void convertToObjectBuilder() {
//        SoundObject temp = sCanvas.mBuffer.getBufferedSoundObject();
//
//        if (temp == null || !(temp instanceof PythonObject || temp instanceof External)) {
//            return;
//        }
//
//        int retVal = JOptionPane.showConfirmDialog(null,
//                "This operation can not be undone.\nAre you sure?");
//
//        if (retVal != JOptionPane.OK_OPTION) {
//            return;
//        }
//
//        int index = sCanvas.getPolyObject().getLayerNumForY(sObjView.getY());
//
//        ObjectBuilder objBuilder = new ObjectBuilder();
//
//        if (temp instanceof PythonObject) {
//            PythonObject tempPython = (PythonObject) temp;
//            objBuilder.setName(tempPython.getName());
//            objBuilder.setNoteProcessorChain(tempPython.getNoteProcessorChain());
//            objBuilder.setTimeBehavior(tempPython.getTimeBehavior());
//            objBuilder.setStartTime(tempPython.getStartTime());
//            objBuilder.setSubjectiveDuration(tempPython.getSubjectiveDuration());
//            objBuilder.setCode(tempPython.getText());
//            objBuilder.setBackgroundColor(tempPython.getBackgroundColor());
//
//        } else if (temp instanceof External) {
//            External tempExt = (External) temp;
//            objBuilder.setName(tempExt.getName());
//            objBuilder.setNoteProcessorChain(tempExt.getNoteProcessorChain());
//            objBuilder.setTimeBehavior(tempExt.getTimeBehavior());
//            objBuilder.setStartTime(tempExt.getStartTime());
//            objBuilder.setSubjectiveDuration(tempExt.getSubjectiveDuration());
//            objBuilder.setCode(tempExt.getText());
//            objBuilder.setCommandLine(tempExt.getCommandLine());
//            objBuilder.setExternal(true);
//            objBuilder.setBackgroundColor(tempExt.getBackgroundColor());
//        } else {
//            return;
//        }
//
//        removeSObj();
//        sCanvas.getPolyObject().addSoundObject(index, objBuilder);
//        sCanvas.sMouse.fireSelectionEvent(new SelectionEvent(null,
//                SelectionEvent.SELECTION_CLEAR));
//    }
//
//    private void replaceSoundObject() {
//
//        SoundObject[] sObjects = sCanvas.mBuffer.getSoundObjectsAsArray();
//
//        for (int i = 0; i < sObjects.length; i++) {
//
//            SoundObject temp = sCanvas.buffer.getBufferedSoundObject();
//
//            replaceSoundObject(sObjects[i], temp, true, true);
//        }
//    }
//
//    private void replaceSoundObject(SoundObject oldSoundObject,
//            SoundObject newSoundObject, boolean scaleDuration,
//            boolean recordEdit) {
//
//        SoundObjectView sObjView = sCanvas.getViewForSoundObject(oldSoundObject);
//
//        int index = sCanvas.getPolyObject().getLayerNumForY(sObjView.getY());
//
//        newSoundObject.setStartTime(oldSoundObject.getStartTime());
//
//        if (scaleDuration) {
//            newSoundObject.setSubjectiveDuration(oldSoundObject.getSubjectiveDuration());
//        }
//
//        sCanvas.getPolyObject().removeSoundObject(oldSoundObject);
//
//        float startTime = (float) sObjView.getX() / timeState.getPixelSecond();
//        newSoundObject.setStartTime(startTime);
//
//        sCanvas.getPolyObject().addSoundObject(index, newSoundObject);
//
//        sCanvas.sMouse.fireSelectionEvent(new SelectionEvent(null,
//                SelectionEvent.SELECTION_CLEAR));
//
//        if (recordEdit) {
//
//            BlueUndoManager.setUndoManager("score");
//            BlueUndoManager.addEdit(new ReplaceSoundObjectEdit(sCanvas.getPolyObject(), oldSoundObject,
//                    newSoundObject, index));
//        }
//    }
//
//    private void setSubjectiveTimeToObjectiveTime() {
//        SoundObject sObj = this.sObjView.getSoundObject();
//        if (sObj.getObjectiveDuration() <= 0) {
//            JOptionPane.showMessageDialog(
//                    null,
//                    BlueSystem.getString("soundObjectPopup.setTime.error.text"),
//                    BlueSystem.getString("soundObjectPopup.setTime.error.title"),
//                    JOptionPane.ERROR_MESSAGE);
//            return;
//        }
//        this.sObjView.setSubjectiveTime(sObj.getObjectiveDuration());
//    }
//
//    /**
//     * sets selected soundObjects to follow on after the other
//     */
//    private void followTheLeader() {
//        SoundObjectView[] sObjViews = sCanvas.mBuffer.motionBuffer;
//
//        float initialStartTimes[] = new float[sObjViews.length - 1];
//        float endingStartTimes[] = new float[sObjViews.length - 1];
//        SoundObject soundObjects[] = new SoundObject[sObjViews.length - 1];
//
//        float runningTotal;
//        runningTotal = sObjViews[0].getStartTime() + sObjViews[0].getSubjectiveDuration();
//        for (int i = 1; i < sObjViews.length; i++) {
//            initialStartTimes[i - 1] = sObjViews[i].getStartTime();
//            soundObjects[i - 1] = sObjViews[i].getSoundObject();
//            endingStartTimes[i - 1] = runningTotal;
//
//            sObjViews[i].setStartTime(runningTotal);
//            runningTotal += sObjViews[i].getSoundObject().getSubjectiveDuration();
//        }
//
//        BlueUndoManager.setUndoManager("score");
//        AlignEdit edit = new AlignEdit(soundObjects, initialStartTimes,
//                endingStartTimes);
//
//        edit.setPresentationName("Follow the Leader");
//
//        BlueUndoManager.addEdit(edit);
//
//    }
//
//    private void reverseSoundObjects() {
//
//        if (sCanvas.mBuffer.size() < 2) {
//            return;
//        }
//
//        sCanvas.mBuffer.motionBufferObjects();
//
//        SoundObjectView[] sObjViews = sCanvas.mBuffer.motionBuffer;
//
//        float start = Float.MAX_VALUE;
//        float end = Float.MIN_VALUE;
//
//        for (int i = 0; i < sObjViews.length; i++) {
//            SoundObject sObj = sObjViews[i].getSoundObject();
//
//            float tempStart = sObj.getStartTime();
//            float tempEnd = tempStart + sObj.getSubjectiveDuration();
//
//            if (tempStart < start) {
//                start = tempStart;
//            }
//
//            if (tempEnd > end) {
//                end = tempEnd;
//            }
//        }
//
//        for (int i = 0; i < sObjViews.length; i++) {
//            SoundObject sObj = sObjViews[i].getSoundObject();
//
//            float tempStart = sObj.getStartTime();
//            float tempEnd = tempStart + sObj.getSubjectiveDuration();
//
//            float newStart = start + (end - tempEnd);
//
//            sObj.setStartTime(newStart);
//
//        }
//
//        BlueUndoManager.setUndoManager("score");
//
//        MoveSoundObjectsEdit edit = sCanvas.mBuffer.getMoveEdit(sCanvas.getPolyObject());
//
//        edit.setPresentationName(BlueSystem.getString("soundObjectPopup.reverse.text"));
//
//        BlueUndoManager.addEdit(edit);
//
//    }
//
//    protected void auditionSoundObjects() {
//        BlueData data = BlueProjectManager.getInstance().getCurrentProject().getData();
//        SoundObject[] soundObjects = sCanvas.mBuffer.getSoundObjectsAsArray();
//
//        RealtimeRenderManager.getInstance().auditionSoundObjects(data, soundObjects);
//    }
//
//    /**
//     * Freezes or Unfreezes the soundObject
//     */
//    protected void freezeUnfreezeSoundObject() {
//
//        SoundObject[] soundObjects = new SoundObject[sCanvas.mBuffer.size()];
//
//        for (int i = 0; i < sCanvas.mBuffer.size(); i++) {
//            SoundObjectView sObjView = sCanvas.mBuffer.get(i);
//            soundObjects[i] = sObjView.getSoundObject();
//        }
//
//        FreezeDialog.freezeSoundObjects(soundObjects, this);
//
//    }
//
//    /**
//     * @param sObj
//     */
//    protected void freezeSoundObject(SoundObject sObj) {
//        File projectDir = BlueSystem.getCurrentProjectDirectory();
//
//        if (projectDir == null) {
//            JOptionPane.showMessageDialog(null,
//                    "Project must be saved before soundObjects can be frozen.");
//            return;
//        }
//
//        BlueData data = BlueProjectManager.getInstance().getCurrentProject().getData();
//        BlueData tempData = (BlueData) ObjectUtilities.clone(data);
//
//        PolyObject tempPObj = new PolyObject(true);
//        SoundLayer sLayer = (SoundLayer)tempPObj.newLayerAt(-1);
//
//        SoundObject tempSObj = (SoundObject) sObj.clone();
//        tempData.setRenderStartTime(tempSObj.getStartTime());
//
//        float renderEndTime = tempSObj.getStartTime() + tempSObj.getSubjectiveDuration();
//        Mixer m = data.getMixer();
//
//        if (m.isEnabled()) {
//            renderEndTime += m.getExtraRenderTime();
//        }
//
//        tempData.setRenderEndTime(renderEndTime);
//
//        sLayer.addSoundObject(tempSObj);
//
//        tempData.getScore().clearLayerGroups();
//        tempData.getScore().addLayerGroup(tempPObj);
//
//        String tempCSD;
//        CsdRenderResult result;
//
//        try {
//            result = CSDRenderService.getDefault().generateCSD(tempData, tempSObj.getStartTime(), renderEndTime, false);
//            tempCSD = result.getCsdText();
//        } catch (Exception e) {
//            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this), e);
//            throw new RuntimeException("CSDRender Failed", e);
//        }
//
//        String tempFileName = getAvailableFreezeFileName(projectDir);
//        String fullTempFileName = projectDir.getAbsolutePath() + File.separatorChar + tempFileName;
//
//        System.out.println("TEMP FILE NAME: " + tempFileName);
//
//        String csoundExec;
//        final UtilitySettings utilitySettings = UtilitySettings.getInstance();
//
//        csoundExec = utilitySettings.csoundExecutable;
//
//        String flags = utilitySettings.freezeFlags;
//
//        String command = csoundExec + " " + flags + " ";
//
//
//
//        try {
//            // float tempStart;
//
//            File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
//                    projectDir, tempCSD);
//
//            String[] args = command.split("\\s+");
//            String[] args2 = new String[args.length + 2];
//            System.arraycopy(args, 0, args2, 0, args.length);
//            args2[args.length] = fullTempFileName;
//            args2[args.length + 1] = temp.getAbsolutePath();
//
//            String csoundOutput = DiskRenderManager.getInstance()
//                .execWaitAndCollect(args2, projectDir);
//
//           // FIXME - remove commented out code 
////            if (APIUtilities.isCsoundAPIAvailable() &&
////                    GeneralSettings.getInstance().isUsingCsoundAPI()) {
////
////                String[] args = command.split("\\s+");
////
////                String[] args2 = new String[args.length + 2];
////                System.arraycopy(args, 0, args2, 0, args.length);
////                args2[args.length] = fullTempFileName;
////                args2[args.length + 1] = temp.getAbsolutePath();
////
////                APIDiskRenderer renderer = new APIDiskRenderer();
////                renderer.execWaitAndCollect(args2, projectDir);
////            } else {
////                command += "\"" + fullTempFileName + "\"";
////                command += " \"" + temp.getAbsolutePath() + "\"";
////
////                ProcessConsole pConsole = new ProcessConsole();
////
////                pConsole.execWait(command, projectDir);
////            }
//
//
//
//            FrozenSoundObject fso = new FrozenSoundObject();
//
//            fso.setFrozenSoundObject(sObj);
//            fso.setFrozenWaveFileName(tempFileName);
//            fso.setName("F: " + sObj.getName());
//
//            float soundFileDuration = SoundFileUtilities.getDurationInSeconds(fullTempFileName);
//
//            fso.setSubjectiveDuration(soundFileDuration);
//
//            int numChannels = SoundFileUtilities.getNumberOfChannels(fullTempFileName);
//
//            fso.setNumChannels(numChannels);
//
//            replaceSoundObject(sObj, fso, false, false);
//
//        } catch (Exception ex) {
//            System.err.println("[" + BlueSystem.getString("message.error") + "] " + ex.getLocalizedMessage());
//            ex.printStackTrace();
//        }
//
//    }
//
//    private String getAvailableFreezeFileName(File projectDir) {
//        String[] files = projectDir.list();
//
//        int counter = -1;
//
//        for (int i = 0; i < files.length; i++) {
//            if (files[i].startsWith("freeze")) {
//                try {
//                    int num = Integer.parseInt(files[i].substring(6,
//                            files[i].indexOf(".")));
//                    if (counter < num) {
//                        counter = num;
//                    }
//                } catch (NumberFormatException nfe) {
//                    // just continue on
//                    }
//            }
//        }
//
//        counter++;
//
//        String extension = ".wav";
//
//        if (System.getProperty("os.name").indexOf("Mac") >= 0) {
//            extension = ".aif";
//        }
//
//        String tempFileName = "freeze" + counter + extension;
//
//        while (new File(tempFileName).exists()) {
//            counter++;
//            tempFileName = "freeze" + counter + extension;
//        }
//
//        return tempFileName;
//    }
//
//    protected void unfreezeSoundObject(FrozenSoundObject fso) {
//
//        replaceSoundObject(fso, fso.getFrozenSoundObject(), false, false);
//
//        String waveFileName = fso.getFrozenWaveFileName();
//
//        int refCount = freezeReferenceCount(sCanvas.getPolyObject(), waveFileName);
//
//        System.out.println("Reference Count: " + refCount);
//
//        if (refCount <= 0) {
//            File projectDir = BlueSystem.getCurrentProjectDirectory();
//            File f = new File(projectDir, waveFileName);
//            f.delete();
//
//            System.out.println("Deleting File: " + f.getAbsolutePath());
//        }
//    }
//
//    private int freezeReferenceCount(PolyObject pObj, String waveFileName) {
//        int retVal = 0;
//
//        ArrayList sObjects = pObj.getSoundObjects(true);
//
//        for (Iterator iter = sObjects.iterator(); iter.hasNext();) {
//            SoundObject sObj = (SoundObject) iter.next();
//
//            if (sObj instanceof PolyObject) {
//                retVal += freezeReferenceCount((PolyObject) sObj,
//                        waveFileName);
//            } else if (sObj instanceof FrozenSoundObject) {
//                FrozenSoundObject fso = (FrozenSoundObject) sObj;
//                if (fso.getFrozenWaveFileName().equals(waveFileName)) {
//                    retVal += 1;
//                }
//            }
//
//        }
//
//        return retVal;
//    }
//
//    public void show(SoundObjectView sObjView, Component invoker, int x,
//            int y) {
//        this.sObjView = sObjView;
//
//        SoundObject viewSObj = sObjView.getSoundObject();
//
//        if (viewSObj instanceof GenericScore || viewSObj instanceof PolyObject) {
//            setTimeMenuOpt.setEnabled(true);
//        } else {
//            setTimeMenuOpt.setEnabled(false);
//        }
//
//        if (viewSObj instanceof PythonObject || viewSObj instanceof External) {
//            convertObjectBuilderMenuOpt.setEnabled(true);
//        } else {
//            convertObjectBuilderMenuOpt.setEnabled(false);
//        }
//
//        editMenuOpt.setVisible(viewSObj instanceof PolyObject);
//        int index = this.getComponentIndex(editMenuOpt) + 1;
//        this.getComponent(index).setVisible(editMenuOpt.isVisible());
//
//        int size = sCanvas.mBuffer.size();
//
//        freezeMenuOpt.setEnabled(size > 0);
//        followTheLeaderMenuOpt.setEnabled(size > 1);
//
////            boolean showing = sCanvas.sGUI.isSObjPropsShowing();
////
////            if (showing) {
////                showSObjProperties.setText(HIDE_SOBJ_PROPS);
////            } else {
////                showSObjProperties.setText(SHOW_SOBJ_PROPS);
////            }
//
//        // checks if there's a soundObject in the buffer
//        replaceOpt.setEnabled((size > 0) && (sCanvas.buffer.size() > 0));
//
//        super.show(invoker, x, y);
//    }
//
//    private final class SetColorAction extends BlueAction {
//
//        private SetColorAction() {
//            super("soundObjectPopup.setColor");
//        }
//
//        public void actionPerformed(ActionEvent e) {
//
//            MotionBuffer buffer = MotionBuffer.getInstance();
//
//            if (buffer.size() == 0) {
//                return;
//            }
//
//            SoundObject[] sObjects = buffer.getSoundObjectsAsArray();
//
//            Color retVal = JColorChooser.showDialog(SwingUtilities.getRoot((JComponent) e.getSource()), "Choose Color",
//                    sObjects[0].getBackgroundColor());
//
//            if (retVal != null) {
//                for (int i = 0; i < sObjects.length; i++) {
//                    SoundObject sObj = sObjects[i];
//                    sObj.setBackgroundColor(retVal);
//                }
//            }
//
//        }
//    }
}

