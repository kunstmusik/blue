/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.editor;

import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.HashMap;
import java.util.StringTokenizer;

import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTabbedPane;

import blue.BlueSystem;
import blue.soundObject.CeciliaModule;
import blue.soundObject.SoundObject;
import blue.soundObject.ceciliaModule.CFileIn;
import blue.soundObject.ceciliaModule.CGraph;
import blue.soundObject.ceciliaModule.CPopup;
import blue.soundObject.ceciliaModule.CSlider;
import blue.soundObject.ceciliaModule.CToggle;
import blue.soundObject.ceciliaModule.CeciliaObject;
import blue.soundObject.ceciliaModule.ModuleDefinition;
import blue.soundObject.editor.ceciliaModule.CeciliaModuleImportDialog;
import blue.soundObject.editor.ceciliaModule.EditorPanel;
import blue.soundObject.editor.ceciliaModule.FileInputPanel;
import blue.soundObject.editor.ceciliaModule.GrapherEditPanel;
import blue.soundObject.editor.ceciliaModule.PropertiesPanel;
import blue.utility.GUI;
import blue.utility.TextUtilities;

/**
 * @author steven
 * 
 */
public class CeciliaModuleEditor extends SoundObjectEditor {

    private CeciliaModule ceciliaModule;

    private PropertiesPanel properties = new PropertiesPanel();

    private FileInputPanel fip = new FileInputPanel();

    private GrapherEditPanel grapher = new GrapherEditPanel();

    private EditorPanel editor = new EditorPanel();

    public CeciliaModuleEditor() {
        FlowLayout fLayout = new FlowLayout(FlowLayout.LEFT);

        JLabel label = new JLabel("[ Cecilia Module ]");

        JButton loadModule = new JButton(BlueSystem
                .getString("ceciliaModule.loadModule"));
        loadModule.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                loadModule();

            }
        });

        JPanel topPanel = new JPanel();
        topPanel.setLayout(fLayout);
        topPanel.add(label);
        topPanel.add(loadModule);

        this.setLayout(new BorderLayout());
        JTabbedPane tabs = new JTabbedPane();

        tabs.addTab(BlueSystem.getString("common.properties"), properties);
        tabs.add(BlueSystem.getString("ceciliaModule.fileInput"), fip);
        tabs.addTab(BlueSystem.getString("ceciliaModule.grapher"), grapher);
        tabs.addTab(BlueSystem.getString("common.editor"), editor);

        this.add(topPanel, BorderLayout.NORTH);
        this.add(tabs, BorderLayout.CENTER);

    }

    /**
     * 
     */
    protected void loadModule() {
        ModuleDefinition moduleDefinition = CeciliaModuleImportDialog
                .importCeciliaModule();

        if (moduleDefinition == null) {
            return;
        }

        HashMap stateData = createDefaultStateData(moduleDefinition);

        ceciliaModule.setModuleDefinition(moduleDefinition);
        ceciliaModule.setStateData(stateData);

        editSoundObject(ceciliaModule);
    }

    /**
     * @param moduleDefinition
     * @return
     */
    private HashMap createDefaultStateData(ModuleDefinition moduleDefinition) {
        String tk_interface = moduleDefinition.tk_interface;

        StringTokenizer st = new StringTokenizer(tk_interface, "\n");
        String line;

        HashMap stateData = new HashMap();

        while (st.hasMoreTokens()) {
            line = st.nextToken().trim();
            if (line.length() == 0) {
                continue;
            }

            String[] tokens = TextUtilities.splitStringWithQuotes(line);

            String objectType = tokens[0];

            if (!objectType.equals("csepar") && tokens.length == 1) {
                // show some error
                continue;
            }

            if (objectType.equals("csepar")) {
                continue;
            }

            String objectName = tokens[1];

            CeciliaObject cObj = null;

            if (objectType.equals("cfilein")) {
                CeciliaObject fileIn = new CFileIn();
                cObj = fileIn;
            } else if (objectType.equals("cpopup")) {
                CPopup popup = new CPopup();
                cObj = popup;
            } else if (objectType.equals("ctoggle")) {
                CToggle toggle = new CToggle();
                cObj = toggle;
            } else if (objectType.equals("cslider")) {
                CSlider slider = new CSlider();
                cObj = slider;
            } else if (objectType.equals("cgraph")) {
                CGraph graph = new CGraph();
                cObj = graph;
            }

            cObj.initialize(tokens);
            stateData.put(objectName, cObj);

            // ObjectUtilities.printMembers(cObj);
        }

        return stateData;
    }

    public void editSoundObject(SoundObject sObj) {
        if (sObj == null) {
            System.err.println("[CeciliaModuleEditor::editSoundObject()] "
                    + "ERROR: null object passed in");
            ceciliaModule = null;
            return;
        }

        if (!sObj.getClass().getName().equals("blue.soundObject.CeciliaModule")) {
            System.err.println("[CeciliaModuleEditor::editSoundObject()] "
                    + "ERROR: not an instance of AudioFile");
            ceciliaModule = null;
            return;
        }

        ceciliaModule = (CeciliaModule) sObj;

        editor.editCeciliaModule(ceciliaModule);
        properties.editCeciliaModule(ceciliaModule);
        fip.editCeciliaModule(ceciliaModule);
        grapher.editCeciliaModule(ceciliaModule);
    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();

        CeciliaModuleEditor ceciliaModuleEditor = new CeciliaModuleEditor();
        ceciliaModuleEditor.editSoundObject(new CeciliaModule());

        GUI.showComponentAsStandalone(ceciliaModuleEditor,
                "CeciliaModule Editor", true);
    }
}