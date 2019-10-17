/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.ceciliaModule;

import blue.BlueSystem;
import blue.soundObject.CeciliaModule;
import blue.soundObject.ceciliaModule.CFileIn;
import blue.soundObject.ceciliaModule.CeciliaObject;
import blue.ui.utilities.FileChooserManager;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.StringTokenizer;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JSlider;
import javax.swing.JTextField;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public class FileInputPanel extends JComponent {

    private HashMap interfaceObjectMap = new HashMap();

    // private HashMap dataValues = new HashMap();

    int myNextItemRow = 0;

    // private static final String FILE_MANAGER_ID = "cecilia_file_input";

    public FileInputPanel() {
        setLayout(new GridBagLayout());

        // Create a blank label to use as a vertical fill so that the
        // label/item pairs are aligned to the top of the panel and are not
        // grouped in the centre if the parent component is taller than
        // the preferred size of the panel.

        addSpacer();
    }

    /**
     * 
     */
    private void addSpacer() {
        GridBagConstraints constraints = new GridBagConstraints();
        constraints.gridx = 0;
        constraints.gridy = 99;
        constraints.insets = new Insets(10, 0, 0, 0);
        constraints.weighty = 1.0;
        constraints.fill = GridBagConstraints.VERTICAL;

        JLabel verticalFillLabel = new JLabel();

        add(verticalFillLabel, constraints);
    }

    public void clearFileInputs() {
        this.removeAll();
        addSpacer();
        interfaceObjectMap.clear();

        myNextItemRow = 0;
    }

    public void addFileInput(final String objectName, boolean isAudio) {
        // FileSelectionPanel fsp = new FileSelectionPanel(FILE_MANAGER_ID);
        // fsp.setTitle(objectName);
        // this.add(fsp);
        // interfaceObjectMap.put(objectName, fsp);

        CFilePanel cfPanel = new CFilePanel(objectName, isAudio);

        GridBagConstraints labelConstraints = new GridBagConstraints();

        labelConstraints.gridx = 0;
        labelConstraints.gridy = myNextItemRow;
        labelConstraints.weightx = 1.0f;
        labelConstraints.insets = new Insets(10, 10, 0, 10);
        labelConstraints.anchor = GridBagConstraints.WEST;
        labelConstraints.fill = GridBagConstraints.HORIZONTAL;

        add(cfPanel, labelConstraints);

        myNextItemRow++;

        interfaceObjectMap.put(objectName, cfPanel);

    }

    public void editCeciliaModule(CeciliaModule cm) {
        clearFileInputs();

        String tk_interface = cm.getModuleDefinition().tk_interface;

        StringTokenizer st = new StringTokenizer(tk_interface, "\n");
        String line;
        while (st.hasMoreTokens()) {
            line = st.nextToken().trim();

            if (line.length() == 0) {
                continue;
            }

            StringTokenizer objectTokenizer = new StringTokenizer(line);
            if (objectTokenizer.countTokens() < 2) {
                continue;
            }

            String objectType = objectTokenizer.nextToken();
            String objectName = objectTokenizer.nextToken();

            if (objectType.equals("cfilein")) {
                boolean isAudio = true;
                while (objectTokenizer.hasMoreTokens()) {
                    String token = objectTokenizer.nextToken().trim();
                    if (token.equals("-type")
                            && objectTokenizer.hasMoreTokens()
                            && !objectTokenizer.nextToken().trim().equals(
                                    "audio")) {

                        isAudio = false;

                    }
                }
                this.addFileInput(objectName, isAudio);
            }
        }

        for (Iterator iter = cm.getStateData().values().iterator(); iter
                .hasNext();) {
            CeciliaObject element = (CeciliaObject) iter.next();

            if (element instanceof CFileIn) {
                CFileIn cfileIn = (CFileIn) element;

                CFilePanel cfPanel = (CFilePanel) interfaceObjectMap
                        .get(cfileIn.getObjectName());

                cfPanel.setCFileIn(cfileIn);

            }
        }
    }
}

class CFilePanel extends JComponent {
    private static String FILE_MANAGER_GROUP = "CFilePanel";

    CFileIn cfilein;

    JTextField fileNameText;

    JSlider slider;

    JLabel offsetLabel;

    boolean isAudio;

    public CFilePanel(String objectName, boolean isAudio) {
        this.isAudio = isAudio;
        this.setBorder(BorderFactory.createTitledBorder(objectName));

        this.setLayout(new GridBagLayout());
        fileNameText = new JTextField();
        fileNameText.setEnabled(false);

        JLabel label = new JLabel(BlueSystem.getString("ceciliaModule.file"));

        GridBagConstraints labelConstraints = new GridBagConstraints();

        labelConstraints.gridx = 0;
        labelConstraints.gridy = 0;
        labelConstraints.insets = new Insets(10, 10, 0, 0);
        labelConstraints.anchor = GridBagConstraints.NORTHEAST;
        labelConstraints.fill = GridBagConstraints.NONE;

        add(label, labelConstraints);

        // Add the component with its constraints

        GridBagConstraints itemConstraints = new GridBagConstraints();

        itemConstraints.gridx = 1;
        itemConstraints.gridy = 0;
        itemConstraints.insets = new Insets(10, 10, 0, 10);
        itemConstraints.weightx = 1.0;
        itemConstraints.anchor = GridBagConstraints.WEST;
        itemConstraints.fill = GridBagConstraints.HORIZONTAL;

        add(fileNameText, itemConstraints);

        JButton fileButton = new JButton("...");

        fileButton.addActionListener((ActionEvent e) -> {
            selectFile();
        });

        itemConstraints = new GridBagConstraints();

        itemConstraints.gridx = 2;
        itemConstraints.gridy = 0;
        itemConstraints.insets = new Insets(10, 0, 0, 10);
        itemConstraints.anchor = GridBagConstraints.EAST;
        itemConstraints.fill = GridBagConstraints.NONE;

        add(fileButton, itemConstraints);

        if (!isAudio) {
            return;
        }

        offsetLabel = new JLabel(BlueSystem.getString("ceciliaModule.offset"));

        labelConstraints = new GridBagConstraints();

        labelConstraints.gridx = 0;
        labelConstraints.gridy = 1;
        labelConstraints.insets = new Insets(10, 10, 0, 0);
        labelConstraints.anchor = GridBagConstraints.NORTHEAST;
        labelConstraints.fill = GridBagConstraints.NONE;

        add(offsetLabel, labelConstraints);

        slider = new JSlider();

        GridBagConstraints sliderConstraints = new GridBagConstraints();

        sliderConstraints.gridx = 1;
        sliderConstraints.gridy = 1;
        sliderConstraints.insets = new Insets(10, 10, 0, 10);
        sliderConstraints.weighty = 1.0;
        sliderConstraints.anchor = GridBagConstraints.WEST;
        sliderConstraints.fill = GridBagConstraints.HORIZONTAL;

        add(slider, sliderConstraints);

        slider.setEnabled(false);
        slider.setMinimum(0);
        slider.setValue(0);

        slider.addChangeListener((ChangeEvent e) -> {
            // slider = (JSlider) e.getSource();
            
            float val = slider.getValue() / 10.0f;
            
            offsetLabel.setText(Float.toString(val) + "s");
            
            if (cfilein != null) {
                cfilein.setOffset(slider.getValue());
            }
        });

    }

    /**
     * @param cfilein
     */
    public void setCFileIn(CFileIn cfilein) {
        this.cfilein = cfilein;
        this.fileNameText.setText(cfilein.getFileName());

        if (isAudio) {
            setSliderData(cfilein);
        }
    }

    protected void selectFile() {
        FileChooserManager.getDefault().setDialogTitle(FILE_MANAGER_GROUP, BlueSystem
                .getString("ceciliaModule.chooseFile"));

        List<File> retVal = FileChooserManager.getDefault()
                .showOpenDialog(FILE_MANAGER_GROUP, null);

        if (retVal.isEmpty()) {
            return;
        }

        File temp = retVal.get(0);

        if (cfilein != null) {
            String path;
            // try {
            path = temp.getAbsolutePath();
            cfilein.setFileName(path);
            fileNameText.setText(path);
            // } catch (IOException e) {
            // TODO Auto-generated catch block
            // e.printStackTrace();
            // }

        }

        if (isAudio) {
            setSliderData(cfilein);
        }
    }

    /**
     * @param cfilein
     */

    private void setSliderData(CFileIn cfilein) {

        if (cfilein.isAudioFile()) {
            slider.setValue(cfilein.getOffset());
            slider.setMinimum(0);
            slider.setMaximum(cfilein.getMaxTicks());
            slider.setEnabled(true);
        }
        // slider.setMaximum();
    }

}