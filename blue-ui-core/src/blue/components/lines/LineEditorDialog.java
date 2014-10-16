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
package blue.components.lines;

import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dialog;
import java.awt.Frame;
import java.util.WeakHashMap;

import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.SwingUtilities;

import com.l2fprod.common.swing.BaseDialog;

public class LineEditorDialog extends BaseDialog {

    private static LineEditorDialog lineEditorDialog = null;

    private static WeakHashMap map = new WeakHashMap();

    JTable lineTable = new JTable();

    private LineEditorDialog(Frame owner) {
        super(owner, "Line Point Editor", true);
        this.setDialogMode(BaseDialog.CLOSE_DIALOG);

        Container contentPane = this.getContentPane();
        contentPane.setLayout(new BorderLayout());
        contentPane.add(new JScrollPane(lineTable), BorderLayout.CENTER);

        this.getBanner().setVisible(false);

        this.setSize(400, 300);
        this.centerOnScreen();
    }

    private LineEditorDialog(Dialog owner) {
        super(owner, "Line Point Editor", true);
        this.setDialogMode(BaseDialog.CLOSE_DIALOG);

        Container contentPane = this.getContentPane();
        contentPane.setLayout(new BorderLayout());
        contentPane.add(new JScrollPane(lineTable), BorderLayout.CENTER);

        this.getBanner().setVisible(false);

        this.setSize(400, 300);
        this.centerOnScreen();
    }

    // ASSUMES BLUE MAIN FRAME WILL BE WHERE ALL USAGES OF THIS WILL BE
    // FROM; NOT THE BEST ASSUMPTION BUT WORKS FOR NOW
    public static LineEditorDialog getInstance(Component obj) {
        Component root = SwingUtilities.getRoot(obj);

        if (!map.containsKey(root)) {
            LineEditorDialog dialog;

            if (root instanceof Frame) {
                dialog = new LineEditorDialog((Frame) root);
            } else if (root instanceof Dialog) {
                dialog = new LineEditorDialog((Dialog) root);
            } else {
                return null;
            }
            map.put(root, dialog);
        }

        return (LineEditorDialog) map.get(root);
    }

    public void setLine(Line line) {
        lineTable.setModel(line);
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        // TODO Auto-generated method stub

    }

}
