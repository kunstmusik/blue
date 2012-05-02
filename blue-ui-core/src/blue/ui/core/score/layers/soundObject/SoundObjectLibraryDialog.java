/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score.layers.soundObject;

import java.awt.BorderLayout;
import java.awt.Frame;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.ArrayList;
import java.util.Iterator;

import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.border.EmptyBorder;

import blue.BlueSystem;
import blue.SoundObjectLibrary;
import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.gui.DialogUtil;
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import electric.xml.Element;

/**
 * Title: blue (Object Composition Environment) Description: Copyright:
 * Copyright (c) steven yi Company: steven yi music
 * 
 * @author steven yi
 */

// TODO - Clean up UI Code for this class
public final class SoundObjectLibraryDialog extends JDialog implements
        WindowSettingsSavable {

    SoundObjectLibrary sObjLib = new SoundObjectLibrary();

    SoundObjectBuffer sObjBuffer;

    JTable sObjLibTable = new JTable();

    JButton removeButton = new JButton();

    JScrollPane sObjLibScrollPane = new JScrollPane();

    JButton copyInstanceButton = new JButton();

    JButton copyButton = new JButton();

    private ArrayList listenerList = new ArrayList();

    public SoundObjectLibraryDialog(Frame owner) {
        super(owner);

        this.sObjBuffer = SoundObjectBuffer.getInstance();

        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        JPanel rootPanel = ((JPanel) this.getContentPane());
        rootPanel.setBorder(new EmptyBorder(5, 5, 5, 5));
        this.setTitle(BlueSystem.getString("soundObjectLibrary.title"));

        this.getContentPane().setLayout(new BorderLayout());

        JPanel jPanel1 = new JPanel();
        JPanel buttonPanel = new JPanel();

        jPanel1.setLayout(new BorderLayout());

        removeButton.setText(BlueSystem.getString("soundObjectLibrary.remove"));

        copyInstanceButton.setText(BlueSystem
                .getString("soundObjectLibrary.copyInstance"));

        copyButton.setText(BlueSystem.getString("soundObjectPopup.copy.text"));

        this.getContentPane().add(jPanel1, BorderLayout.CENTER);

        jPanel1.add(buttonPanel, BorderLayout.NORTH);

        buttonPanel.add(copyButton);
        buttonPanel.add(copyInstanceButton);
        buttonPanel.add(removeButton);

        jPanel1.add(sObjLibScrollPane, BorderLayout.CENTER);

        sObjLibScrollPane.getViewport().add(sObjLibTable, null);
        this.setSize(300, 600);

        copyButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                copySoundObject();
            }

        });

        copyInstanceButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                copyInstanceOfSoundObject();
            }
        });

        removeButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                removeSoundObject();
            }
        });

        sObjLibTable.addMouseListener(new MouseAdapter() {

            public void mouseClicked(MouseEvent e) {

                int index = sObjLibTable.getSelectedRow();

                if (index != -1) {
                    SoundObject sObj = sObjLib.getSoundObject(index);

                    if (e.getClickCount() >= 2) {
                        fireSoundObjectSelected(sObj);
                    }
                    // } else {
                    // sObjEditPanel.editSoundObject(sObj);
                    // }
                }

            }
        });

        WindowSettingManager.getInstance().registerWindow("SoundObjectLibrary",
                this);

        DialogUtil.registerJDialog(this);
    }

    /**
     * @param sObj
     */
    protected void fireSoundObjectSelected(SoundObject sObj) {

        SelectionEvent selectionEvent = new SelectionEvent(sObj,
                SelectionEvent.SELECTION_SINGLE);

        for (Iterator iter = listenerList.iterator(); iter.hasNext();) {
            SelectionListener listener = (SelectionListener) iter.next();
            listener.selectionPerformed(selectionEvent);
        }
    }

    protected void fireSoundObjectRemoved(SoundObject sObj) {

        SelectionEvent selectionEvent = new SelectionEvent(sObj,
                SelectionEvent.SELECTION_REMOVE);

        for (Iterator iter = listenerList.iterator(); iter.hasNext();) {
            SelectionListener listener = (SelectionListener) iter.next();
            listener.selectionPerformed(selectionEvent);
        }
    }

    public void setSoundObjectLibrary(SoundObjectLibrary sObjLib) {
        this.sObjLib = sObjLib;
        sObjLibTable.setModel(new SoundObjectLibraryTableModel(sObjLib));
        sObjLibTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        sObjLibTable.setColumnSelectionAllowed(true);

        this.setColumnWidth(0, 20);
        this.setColumnWidth(1, 80);
        // this.setColumnWidth(2, 80);

        sObjLibTable.getTableHeader().setReorderingAllowed(false);

    }

    public void addSoundObject(SoundObject sObj) {
        sObjLib.addSoundObject(sObj);
        this.sObjLibTable.revalidate();
    }

    public void copySoundObject() {
        int index = sObjLibTable.getSelectedRow();
        if (index != -1) {
            SoundObject sObj = sObjLib.getSoundObject(index);
            sObjBuffer.setBufferedObject((SoundObject) sObj.clone(), 0, 0);
        }
    }

    public void copyInstanceOfSoundObject() {
        int index = sObjLibTable.getSelectedRow();
        if (index != -1) {
            SoundObject originalSObj = sObjLib.getSoundObject(index);
            Instance tempSObj = new Instance(originalSObj);
            tempSObj.setStartTime(0.0f);
            tempSObj.setSubjectiveDuration(tempSObj.getObjectiveDuration());
            sObjBuffer.setBufferedObject(tempSObj, 0, 0);
        }
    }

    public void removeSoundObject() {
        if (sObjLibTable.getSelectedRow() != -1) {
            Object sObj = sObjLib.remove(sObjLibTable.getSelectedRow());

            // sObjEditPanel.editSoundObject(null);

            fireSoundObjectRemoved((SoundObject) sObj);

            sObjLibTable.revalidate();
        }
    }

    private void setColumnWidth(int columnNum, int width) {
        sObjLibTable.getTableHeader().getColumnModel().getColumn(columnNum)
                .setPreferredWidth(width);
        // sObjLibTable.getTableHeader().getColumnModel().getColumn(columnNum).setMaxWidth(width);
        // sObjLibTable.getTableHeader().getColumnModel().getColumn(columnNum).setMinWidth(width);
    }

    public void addSelectionListener(SelectionListener sl) {
        listenerList.add(sl);
    }

    public void removeSelectionListener(SelectionListener sl) {
        listenerList.remove(sl);
    }

    /* UNIT TEST */
    public static void main(String args[]) {
        JFrame mFrame = new JFrame();
        mFrame.setSize(800, 600);

        SoundObjectLibraryDialog a = new SoundObjectLibraryDialog(mFrame);
        SoundObjectLibrary temp = new SoundObjectLibrary();

        for (int i = 0; i < 10; i++) {
            temp.addSoundObject(new blue.soundObject.GenericScore());
        }
        a.setSoundObjectLibrary(temp);

        mFrame.show();
        mFrame.addWindowListener(new WindowAdapter() {

            public void windowClosing(WindowEvent e) {
                System.exit(0);
            }
        });
        a.show();
    }

    /**
     * @param soundObject
     * @return
     */
    public boolean containsSoundObject(SoundObject soundObject) {
        if (sObjLib == null) {
            return false;
        }

        return sObjLib.contains(soundObject);
    }

    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);
    }

    public Element saveWindowSettings() {
        return WindowSettingManager.getBasicSettings(this);
    }
}