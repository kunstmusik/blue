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
package blue.soundObject.editor.pianoRoll;

import blue.BlueSystem;
import blue.soundObject.pianoRoll.Scale;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.UiUtilities;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.util.Vector;
import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFileChooser;
import javax.swing.JPopupMenu;
import javax.swing.JTextField;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

public class ScaleSelectionPanel extends JComponent {

    public static String FILE_CHOOSER_ID = "scaleSelectionPanel";

    JTextField fileNameField = new JTextField();

    Scale scale = null;

    Vector<ChangeListener> changeListeners = null;

    ChangeEvent c = null;

    JPopupMenu popup = new JPopupMenu();

    public ScaleSelectionPanel() {
        this.setLayout(new BorderLayout());

        initScaleFileSelector();

        JButton fileButton = new JButton("...");
        fileButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {

                int rValue = FileChooserManager.getDefault().showOpenDialog(
                        FILE_CHOOSER_ID,
                        null);

                if (rValue == JFileChooser.APPROVE_OPTION) {
                    File f = FileChooserManager.getDefault().getSelectedFile(
                            FILE_CHOOSER_ID);

                    if (!f.exists()) {
                        return;
                    }

                    scale = Scale.loadScale(f);

                    updateDisplay();
                    fireChangeEvent();
                }
            }
        });

        fileNameField.setEditable(false);

        this.add(fileNameField, BorderLayout.CENTER);
        this.add(fileButton, BorderLayout.EAST);

        popup.add(new AbstractAction("Reset (12TET)") {

            @Override
            public void actionPerformed(ActionEvent e) {
                setScale(Scale.get12TET());
                fireChangeEvent();
            }
        });

        fileNameField.addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent evt) {
                if (UiUtilities.isRightMouseButton(evt)) {

                    Component c = evt.getComponent();

                    popup.show(c, evt.getX(), evt.getY());
                }
            }
        });
    }

    private void initScaleFileSelector() {
        final FileChooserManager fcm = FileChooserManager.getDefault();
        if (fcm.isDialogDefined(FILE_CHOOSER_ID)) {
            return;
        }

        fcm.setDialogTitle(FILE_CHOOSER_ID, BlueSystem.getString(
                "pianoRoll.selectScalaFile"));
        fcm.addFilter(FILE_CHOOSER_ID, new ScalaFileFilter());

        // SET DEFAULT DIR
        String fileName = BlueSystem.getUserConfigurationDirectory();
        fileName += File.separator + "scl";

        File defaultDir = new File(fileName);

        if (defaultDir.exists() && defaultDir.isDirectory()) {
            fcm.setSelectedFile(FILE_CHOOSER_ID, defaultDir);
        }
    }

    public void setScale(Scale scale) {
        this.scale = scale;
        updateDisplay();
    }

    public Scale getScale() {
        return this.scale;
    }

    private void updateDisplay() {
        if (scale == null) {
            fileNameField.setText("");
        } else {
            fileNameField.setText(scale.getScaleName());
        }
    }

    // change listener methods
    public void addChangeListener(ChangeListener cl) {
        if (changeListeners == null) {
            changeListeners = new Vector<ChangeListener>();
        }
        changeListeners.add(cl);
    }

    public void removeChangeListener(ChangeListener cl) {
        if (changeListeners != null) {
            changeListeners.remove(cl);
        }
    }

    protected void fireChangeEvent() {

        if (changeListeners == null) {
            return;
        }

        if (c == null) {
            c = new ChangeEvent(this);
        }

        for (ChangeListener cl : changeListeners) {
            cl.stateChanged(c);
        }
    }
}
