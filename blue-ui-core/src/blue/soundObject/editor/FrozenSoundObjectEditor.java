/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

import blue.BlueSystem;
import blue.gui.LabelledItemPanel;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.FrozenSoundObject;
import blue.ui.utilities.FileChooserManager;
import blue.utility.FileUtilities;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.IOException;
import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.util.Exceptions;
import org.openide.windows.WindowManager;

/**
 * @author steven
 * 
 */
@ScoreObjectEditorPlugin
public class FrozenSoundObjectEditor extends ScoreObjectEditor {

    private FrozenSoundObject fso;

    private JLabel frozenObjectName = new JLabel();

    private JLabel frozenObjectType = new JLabel();

    private JLabel frozenWaveFileName = new JLabel();

    private JLabel frozenSoundObjectDuration = new JLabel();

    public FrozenSoundObjectEditor() {
        JButton button = new JButton("Save Copy");
        JPanel panel = new JPanel();
        panel.setLayout(new FlowLayout(FlowLayout.LEFT));
        panel.add(frozenWaveFileName);
        panel.add(button);
        button.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                saveCopy();
            }
        });

        LabelledItemPanel itemPanel = new LabelledItemPanel();
        this.setLayout(new BorderLayout());

        itemPanel.addItem(BlueSystem.getString("frozenSoundObject.name") + " ",
                frozenObjectName);
        itemPanel.addItem(BlueSystem.getString("frozenSoundObject.type") + " ",
                frozenObjectType);
        itemPanel.addItem(BlueSystem.getString("frozenSoundObject.waveName")
                + " ", panel);
        itemPanel.addItem(BlueSystem.getString("frozenSoundObject.duration")
                + " ", frozenSoundObjectDuration);

        JScrollPane jsp = new JScrollPane(itemPanel);
        jsp.setBorder(null);

        this.add(jsp, BorderLayout.CENTER);

        final FileChooserManager fcm = FileChooserManager.getDefault();
        fcm.setMultiSelectionEnabled(this, false);
        fcm.setDialogTitle(this, "Save Copy of Frozen Soundfile");
    }


    @Override
    public boolean accepts(ScoreObject sObj) {
        return (sObj != null && sObj instanceof FrozenSoundObject);
    }
    
    @Override
    public void editScoreObject(ScoreObject sObj) {
        if (sObj == null
                || !sObj.getClass().getName().equals(
                "blue.soundObject.FrozenSoundObject")) {
            fso = null;
            return;
        }
        this.fso = (FrozenSoundObject) sObj;

        frozenObjectName.setText(fso.getFrozenSoundObject().getName());

        frozenObjectType.setText(fso.getFrozenSoundObject().getClass().getName());

        frozenWaveFileName.setText(fso.getFrozenWaveFileName());

        frozenSoundObjectDuration.setText(Float.toString(fso.
                getFrozenSoundObject().getSubjectiveDuration()));

    }

    protected void saveCopy() {
        File f = BlueSystem.findFile(fso.getFrozenWaveFileName());

        if (f == null) {
            NotifyDescriptor descriptor = new NotifyDescriptor.Message(
                    "Could not locate frozen file:\n\n" + fso.
                    getFrozenWaveFileName(),
                    NotifyDescriptor.ERROR_MESSAGE);

            DialogDisplayer.getDefault().notify(descriptor);
            return;
        }

        final FileChooserManager fcm = FileChooserManager.getDefault();

        fcm.setCurrentDirectory(this, BlueSystem.getCurrentProjectDirectory());
        int retVal = fcm.showSaveDialog(this, WindowManager.getDefault().
                getMainWindow());

        if (retVal == JFileChooser.APPROVE_OPTION) {
            File dest = fcm.getSelectedFile(this);

            if (dest.exists()) {

                if (dest.isDirectory()) {
                    NotifyDescriptor descriptor = new NotifyDescriptor.Message(
                            "Destination is a directory.",
                            NotifyDescriptor.ERROR_MESSAGE);

                    DialogDisplayer.getDefault().notify(descriptor);
                    return;
                }

                if (dest.getName().startsWith("freeze")) {
                    NotifyDescriptor descriptor = new NotifyDescriptor.Message(
                            "Can not overwrite freeze files.",
                            NotifyDescriptor.ERROR_MESSAGE);

                    DialogDisplayer.getDefault().notify(descriptor);
                    return;
                }


                NotifyDescriptor descriptor = new NotifyDescriptor.Confirmation("Overwrite file " + dest.
                        getName() + "?",
                        NotifyDescriptor.OK_CANCEL_OPTION);
                Object conf = DialogDisplayer.getDefault().notify(descriptor);

                if (!NotifyDescriptor.OK_OPTION.equals(conf)) {
                    return;
                }
            }

            try {
                FileUtilities.copyFile(f, dest);
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
        }


    }
}
