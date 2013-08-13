/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
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
import blue.soundObject.FrozenSoundObject;
import blue.soundObject.SoundObject;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JProgressBar;

public class FreezeDialog extends JDialog {

    JLabel itemNumber = new JLabel();

    JProgressBar progress = new JProgressBar();

    public int totalJobs = 0;

    private FreezeDialog() {
        this.setTitle(BlueSystem.getString("scoreGUI.freezeDialog.title"));
        this.getContentPane().setSize(400, 80);
        this.getContentPane().setLayout(new GridBagLayout());

        GridBagConstraints gbc = new GridBagConstraints();
        gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.gridx = 0;
        gbc.gridy = 0;

        this.getContentPane().add(itemNumber, gbc);

        gbc.gridy = 1;

        this.getContentPane().add(progress, gbc);

        itemNumber.setHorizontalAlignment(JLabel.CENTER);

        this.setDefaultCloseOperation(DISPOSE_ON_CLOSE);
    }

    public void setDone(int jobNum) {
        // TODO - Look into using java.text.MessageFormat

        itemNumber.setText((jobNum + 1) + " "
                + BlueSystem.getString("message.of") + " " + totalJobs + " "
                + BlueSystem.getString("message.complete") + ".");
        progress.getModel().setMinimum(0);
        progress.getModel().setMaximum(totalJobs);
        progress.setValue(jobNum + 1);
    }

    /**
     * @param object
     */
    public static void freezeSoundObjects(SoundObject[] soundObjects,
            SoundObjectPopup sObjPopup) {
        FreezeDialog dialog = new FreezeDialog();
        dialog.setSize(400, 80);
        blue.utility.GUI.centerOnScreen(dialog);
        dialog.show();

        dialog.totalJobs = soundObjects.length;
        dialog.setDone(-1);

        new FreezeRunner(soundObjects, dialog, sObjPopup).start();

        // dialog.setVisible(false);
        // dialog.dispose();

    }

}

class FreezeRunner extends Thread {

    private SoundObject[] soundObjects;

    private FreezeDialog dialog;

    private SoundObjectPopup sObjPopup;

    public FreezeRunner(SoundObject[] soundObjects, FreezeDialog dialog,
            SoundObjectPopup sObjPopup) {
        this.soundObjects = soundObjects;
        this.dialog = dialog;
        this.sObjPopup = sObjPopup;
    }

    @Override
    public void run() {
        for (int i = 0; i < soundObjects.length; i++) {
            if (soundObjects[i] instanceof FrozenSoundObject) {
                System.out.println(BlueSystem
                        .getString("scoreGUI.freezeDialog.unfreezing"));
                sObjPopup
                        .unfreezeSoundObject((FrozenSoundObject) soundObjects[i]);
                dialog.setDone(i);
            } else {
                System.out.println(BlueSystem
                        .getString("scoreGUI.freezeDialog.freezing"));
                sObjPopup.freezeSoundObject(soundObjects[i]);
                dialog.setDone(i);
            }
        }
        dialog.setVisible(false);
        dialog.dispose();
    }
}