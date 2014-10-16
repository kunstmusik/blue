/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.

 * blue - object composition environment for csound Copyright (c) 2000-2014
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

import blue.BlueSystem;
import blue.actions.BlueAction;
import blue.score.TimeState;
import blue.score.undo.AddSoundObjectEdit;
import blue.settings.GeneralSettings;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.BluePluginManager;
import blue.ui.utilities.FileChooserManager;
import blue.undo.BlueUndoManager;
import blue.utility.GenericFileFilter;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Document;
import electric.xml.Element;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JFileChooser;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.filechooser.FileFilter;
import org.openide.util.Exceptions;

/**
 *
 * Popup used when rt-mouse click on a ScoreTimeCanvas
 *
 */
public class SoundLayerPopup extends JPopupMenu implements ActionListener {

    private static final String IMPORT_DIALOG = "sObj.import";

    HashMap<String, Class> sObjNameClassMap = new HashMap<String, Class>();

    JMenuItem addNewPolyObject = new JMenuItem();

    JMenuItem pasteSoundObjects = new JMenuItem();

    JMenuItem pasteAsPolyObject = new JMenuItem();

    private int xValue;

    private int sLayerIndex;

    private ScoreTimeCanvas sCanvas;
    
    TimeState timeState = null;

    public SoundLayerPopup() {

        File defaultFile = new File(
                GeneralSettings.getInstance().getDefaultDirectory() +
                File.separator + "default.sobj");

        FileFilter presetFilter = new GenericFileFilter("sobj",
                "blue Sound Object File");

        final FileChooserManager fcm = FileChooserManager.getDefault();
        fcm.addFilter(IMPORT_DIALOG, presetFilter);
        fcm.setDialogTitle(IMPORT_DIALOG, "Import Sound Object");
        fcm.setSelectedFile(IMPORT_DIALOG, defaultFile);

        BlueSystem.setMenuText(addNewPolyObject,
                "soundLayerPopup.addNewPolyObject");
        pasteSoundObjects.setText(BlueSystem.getString("soundLayerPopup.paste"));
        pasteAsPolyObject.setText(BlueSystem.getString("soundLayerPopup.pasteAsPolyObject"));

        this.add(addNewPolyObject);
        this.addSeparator();

        ArrayList<Class> plugins =
                    BluePluginManager.getInstance().getSoundObjectClasses();
        
        for (Class sObjClass : plugins) {
            String className = sObjClass.getName();

            if (className.equals("blue.soundObject.PolyObject")) {
                continue;
            }

            sObjNameClassMap.put(className, sObjClass);

            JMenuItem temp = new JMenuItem();
            temp.setText(BlueSystem.getString("soundLayerPopup.addNew") + " " + 
                    BlueSystem.getShortClassName(className));
            temp.setActionCommand(className);
            temp.addActionListener(this);
            this.add(temp);
        }

        this.addSeparator();
        this.add(pasteSoundObjects);
        this.add(pasteAsPolyObject);
        this.addSeparator();

        this.add(new BlueAction("soundLayerPopup.selectLayer") {

            public void actionPerformed(ActionEvent e) {
                sCanvas.sMouse.selectLayer(sLayerIndex);
            }
        });

        this.add(new BlueAction("soundLayerPopup.selectAllBefore") {

            public void actionPerformed(ActionEvent e) {
                sCanvas.sMouse.selectAllBefore(xValue);
            }
        });

        this.add(new BlueAction("soundLayerPopup.selectAllAfter") {

            public void actionPerformed(ActionEvent e) {
                sCanvas.sMouse.selectAllAfter(xValue);
            }
        });

        this.addSeparator();

        Action importItem = new AbstractAction(BlueSystem.getString("common.import")) {

            public void actionPerformed(ActionEvent e) {

                int retVal = FileChooserManager.getDefault().showOpenDialog(
                        IMPORT_DIALOG, SwingUtilities.getRoot(sCanvas));

                if (retVal == JFileChooser.APPROVE_OPTION) {

                    File f = FileChooserManager.getDefault().getSelectedFile(IMPORT_DIALOG);
                    Document doc;

                    try {
                        doc = new Document(f);
                        Element root = doc.getRoot();
                        if (root.getName().equals("soundObject")) {
                            SoundObject tempInstr = (SoundObject) ObjectUtilities.loadFromXML(root, null);

                            int start = xValue;

                            if (timeState.isSnapEnabled()) {
                                int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());

                                start = start - (start % snapPixels);
                            }

                            float startTime = (float) start / timeState.getPixelSecond();
                            tempInstr.setStartTime(startTime);

                            sCanvas.getPolyObject().addSoundObject(sLayerIndex, tempInstr);

                        } else {
                            JOptionPane.showMessageDialog(
                                    SwingUtilities.getRoot(sCanvas),
                                    "Error: File did not contain Sound Object",
                                    "Error",
                                    JOptionPane.ERROR_MESSAGE);
                        }

                    } catch (Exception ex) {
                        ex.printStackTrace();
                        JOptionPane.showMessageDialog(
                                SwingUtilities.getRoot(sCanvas),
                                "Error: Could not read Sound Object from file",
                                "Error", JOptionPane.ERROR_MESSAGE);
                    }

                }

            }
        };

        this.add(importItem);

        addNewPolyObject.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {

                int start = xValue;

                if (timeState.isSnapEnabled()) {
                    int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());

                    start = start - (start % snapPixels);
                }

                float startTime = (float) start / timeState.getPixelSecond();
                PolyObject temp = new PolyObject();
                temp.setStartTime(startTime);
                temp.newLayerAt(0);

                sCanvas.getPolyObject().addSoundObject(sLayerIndex, temp);
            }
        });

        pasteSoundObjects.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                float start = (float) xValue / timeState.getPixelSecond();

                if (timeState.isSnapEnabled()) {
                    start = ScoreUtilities.getSnapValueStart(start, timeState.getSnapValue());
                }
                
                sCanvas.sMouse.pasteSoundObjects(sLayerIndex, start);
            }
        });

        pasteAsPolyObject.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                float start = (float) xValue / timeState.getPixelSecond();

                if (timeState.isSnapEnabled()) {
                    start = ScoreUtilities.getSnapValueStart(start, timeState.getSnapValue());
                }
                
                sCanvas.sMouse.pasteSoundObject(sLayerIndex, start);
            }
        });
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
    }
    
    public void actionPerformed(ActionEvent ae) {

        // TODO - refactor out to addSoundObject

        try {

            String sObjName = ae.getActionCommand();
            Class c = sObjNameClassMap.get(sObjName);

            SoundObject sObj = (SoundObject) c.newInstance();
            
            int start = xValue;

            if (timeState.isSnapEnabled()) {
                int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());

                start = start - (start % snapPixels);
            }

            float startTime = (float) start / timeState.getPixelSecond();
            sObj.setStartTime(startTime);

            sCanvas.getPolyObject().addSoundObject(sLayerIndex, sObj);

            BlueUndoManager.setUndoManager("score");
            BlueUndoManager.addEdit(new AddSoundObjectEdit(sCanvas.getPolyObject(), sObj, sLayerIndex));

        } catch (Exception ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    public void show(int index, ScoreTimeCanvas sCanvas, int x, int y) {
        this.sCanvas = sCanvas;
        this.sLayerIndex = index;
        this.xValue = x;

        boolean hasBufferedSoundObject = sCanvas.buffer.hasBufferedSoundObject();
        this.pasteSoundObjects.setEnabled(hasBufferedSoundObject);
        this.pasteAsPolyObject.setEnabled(hasBufferedSoundObject);

        super.show(sCanvas, x, y);
    }
}
