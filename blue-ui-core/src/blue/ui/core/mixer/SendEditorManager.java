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
package blue.ui.core.mixer;

import blue.mixer.*;
import java.util.HashMap;
import java.util.Iterator;

import javax.swing.ComboBoxModel;
import javax.swing.JDialog;

import blue.gui.DialogUtil;
import java.awt.Frame;

public class SendEditorManager {

    private static SendEditorManager manager = null;

    private HashMap map = new HashMap();

    private SendEditorManager() {

    }

    public void clear() {

        for (Iterator iter = map.values().iterator(); iter.hasNext();) {
            JDialog dialog = (JDialog) iter.next();
            dialog.setVisible(false);
            dialog.dispose();
        }
        map.clear();
    }

    public void removeSend(Send send) {
        if (map.containsKey(send)) {
            Object val = map.get(send);

            if (val != null) {
                ((JDialog) val).setVisible(false);
                ((JDialog) val).dispose();
            }

            map.remove(send);
        }
    }

    public void openSendEditor(Frame root, Send send,
            ComboBoxModel comboBoxModel) {
        Object val = map.get(send);

        if (val == null) {
            JDialog dialog = new JDialog(root);
            // dialog.getContentPane().add(.getEditor());

            SendEditPanel panel = new SendEditPanel();
            panel.setComboBoxModel(comboBoxModel);
            panel.setSend(send);

            dialog.getContentPane().add(panel);

            dialog.setTitle("Send");
            dialog.pack();

            DialogUtil.registerJDialog(dialog);

            dialog.setSize(dialog.getWidth() + 5, dialog.getHeight() + 5);
            // dialog.setModal(true);

            dialog.setVisible(true);

            map.put(send, dialog);
        } else {
            ((JDialog) val).setVisible(true);
        }

    }

    public static SendEditorManager getInstance() {
        if (manager == null) {
            manager = new SendEditorManager();
        }

        return manager;
    }

}
