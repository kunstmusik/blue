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

package blue.gui;

import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

import javax.swing.AbstractAction;
import javax.swing.JDialog;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;

import blue.components.CaretPositionDisplayLabel;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import org.openide.windows.WindowManager;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class InfoDialog {

    private static JPanel infoPanel = null;

    private static JTextArea infoText = null;

    private static JDialog dialog = null;

    private static JTabbedPane tabs = null;

    private static JPopupMenu popup = null;

    private InfoDialog() {
    }

    private static final void initialize() {
        infoPanel = new JPanel();

        JScrollPane infoScrollPane = new JScrollPane();
        infoText = new JTextArea();
        infoText.setFont(new Font("Monospaced", Font.PLAIN, 12));

        CaretPositionDisplayLabel caretPositionDisplayLabel = new CaretPositionDisplayLabel();
        infoText.addCaretListener(caretPositionDisplayLabel);
        
        infoScrollPane.getViewport().add(infoText);
        infoScrollPane.setPreferredSize(new Dimension(760, 400));

        infoPanel.setLayout(new BorderLayout());
        infoPanel.add(infoScrollPane, BorderLayout.CENTER);
        infoPanel.add(caretPositionDisplayLabel, BorderLayout.SOUTH);
    }

    public static final void showInformationDialog(Component parent,
            String information, String title) {
        if (infoPanel == null) {
            initialize();
        }
        infoText.setText(information);
        JOptionPane.showMessageDialog(parent, infoPanel, title,
                JOptionPane.PLAIN_MESSAGE);
        infoText.setText("");
    }

    public static final void showInformationDialogCode(Component parent,
            String information, String title) {
        BlueEditorPane bep = new BlueEditorPane();

        bep.setText(information);
        bep.setCaretPosition(0);
        JOptionPane.showMessageDialog(parent, bep, title,
                JOptionPane.PLAIN_MESSAGE);
    }

    public static final void showInformationDialogTabs(String information,
            String title) {
        if (dialog == null) {
            dialog = new JDialog(
                    WindowManager.getDefault().getMainWindow(), false);
            dialog.setTitle("Information");
            tabs = new JTabbedPane();
            dialog.getContentPane().add(tabs);

            dialog.setSize(640, 480);

            GUI.centerOnScreen(dialog);

            popup = new JPopupMenu();

            popup.add(new AbstractAction("Remove") {

                public void actionPerformed(ActionEvent e) {
                    int index = tabs.getSelectedIndex();
                    if (index >= 0) {
                        tabs.remove(index);

                        if (tabs.getTabCount() == 0) {
                            dialog.setVisible(false);
                        }
                    }
                }

            });

            tabs.addMouseListener(new MouseAdapter() {

                public void mousePressed(MouseEvent e) {
                    if (UiUtilities.isRightMouseButton(e)) {
                        popup.show(tabs, e.getX(), e.getY());
                    }
                }

            });

            DialogUtil.registerJDialog(dialog);
        }

        tabs.add(title, new JScrollPane(new JTextArea(information)));
        tabs.setSelectedIndex(tabs.getTabCount() - 1);
        dialog.setVisible(true);

    }

    public static boolean infoTabsHasTabs() {
        if (tabs == null) {
            return false;
        }
        return tabs.getTabCount() > 0;
    }

    public static void showInfoTabsDialog() {
        if (dialog != null) {
            dialog.setVisible(!dialog.isVisible());
        }
    }
}