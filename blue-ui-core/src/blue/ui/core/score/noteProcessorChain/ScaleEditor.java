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
package blue.ui.core.score.noteProcessorChain;

import java.awt.BorderLayout;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFileChooser;
import javax.swing.JLabel;

import blue.BlueSystem;
import blue.soundObject.editor.pianoRoll.ScalaFileFilter;
import blue.soundObject.editor.pianoRoll.ScaleSelectionPanel;
import blue.soundObject.pianoRoll.Scale;
import blue.ui.utilities.FileChooserManager;

/**
 * @author steven
 */
public class ScaleEditor extends JComponent {
    Vector listeners = new Vector();

    ScaleSelector scaleSelector;

    JButton button;

    JLabel label;

    Scale scale;

    public ScaleEditor() {
        initScaleFileSelector();
        
        this.setLayout(new BorderLayout(0, 0));
        button = new JButton("...");
        this.add(button, BorderLayout.EAST);
        button.setMargin(new Insets(0, 0, 0, 0));

        button.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) {
                selectScale();
            }
        });

        label = new JLabel();
        this.add(label, BorderLayout.CENTER);
    }

    public void addActionListener(ActionListener al) {
        listeners.add(al);
    }

    public void removeActionListener(ActionListener al) {
        listeners.remove(al);
    }

    public void fireActionPerformed() {
        ActionEvent ae = new ActionEvent(this, ActionEvent.ACTION_PERFORMED,
                "scale");
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            ActionListener al = (ActionListener) iter.next();
            al.actionPerformed(ae);
        }
    }

    protected void selectScale() {
        
        int rValue = FileChooserManager.getDefault().showOpenDialog(ScaleSelectionPanel.FILE_CHOOSER_ID,
                null);

        if (rValue == JFileChooser.APPROVE_OPTION) {
            File f = FileChooserManager.getDefault()
                    .getSelectedFile(ScaleSelectionPanel.FILE_CHOOSER_ID);

            if (!f.exists()) {
                return;
            }

            Scale scale = Scale.loadScale(f);

            if(scale != null) {
                scale.setBaseFrequency(this.scale.getBaseFrequency());
                this.scale.copyValues(scale);
            }
        }
        
        fireActionPerformed();
    }

    /**
     * @return Returns the scale.
     */
    public Scale getScale() {
        return scale;
    }

    /**
     * @param scale
     *            The scale to set.
     */
    public void setScale(Scale scale) {
        this.scale = scale;
        label.setText(scale.getScaleName());
    }
    
    private void initScaleFileSelector() {
        if (FileChooserManager.getDefault().isDialogDefined(ScaleSelectionPanel.FILE_CHOOSER_ID)) {
            return;
        }

        FileChooserManager.getDefault().setDialogTitle(ScaleSelectionPanel.FILE_CHOOSER_ID, BlueSystem
                .getString("pianoRoll.selectScalaFile"));
        FileChooserManager.getDefault().addFilter(ScaleSelectionPanel.FILE_CHOOSER_ID, new ScalaFileFilter());

        // SET DEFAULT DIR
        String fileName = BlueSystem.getUserConfigurationDirectory();
        fileName += File.separator + "scl";

        File defaultDir = new File(fileName);

        if (defaultDir.exists() && defaultDir.isDirectory()) {
            FileChooserManager.getDefault().setSelectedFile(ScaleSelectionPanel.FILE_CHOOSER_ID, defaultDir);
        }
    }
}