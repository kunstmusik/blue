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

import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.lang.reflect.InvocationTargetException;
import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import javax.swing.AbstractAction;
import javax.swing.JDialog;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;
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
    private static JDialog dialog = null;

    private static JTabbedPane tabs = null;

    private static JPopupMenu popup = null;
    
    public static synchronized final void showInformationDialog(Component parent,
            String information, String title) {
        
        showInformationDialog(parent, information, title, "text/plain");
    }

    public static synchronized final void showInformationDialog(Component parent,
            String information, String title, String mimeType) {

        MimeTypeEditorComponent infoText;

        try {
            if (SwingUtilities.isEventDispatchThread()) {
                infoText = new MimeTypeEditorComponent(mimeType);
                infoText.setText(information);
                infoText.getJEditorPane().getCaret().setDot(0);
                infoText.resetUndoManager();

                final JDialog dlg = new JDialog(SwingUtilities.getWindowAncestor(parent));
                dlg.getContentPane().add(infoText);
                dlg.setModal(true);
                dlg.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
                dlg.setTitle(title);

                final Preferences prefs = NbPreferences.forModule(
                        InfoDialog.class);

                int w = prefs.getInt("infoDialogWidth", 760);
                int h = prefs.getInt("infoDialogHeight", 400);

                dlg.setSize(new Dimension(w, h));
                dlg.addWindowListener(new WindowAdapter() {
                    @Override
                    public void windowClosing(WindowEvent e) {
                        final Preferences prefs = NbPreferences.forModule(
                                InfoDialog.class);

                        prefs.putInt("infoDialogWidth", dlg.getWidth());
                        prefs.putInt("infoDialogHeight", dlg.getHeight());
                        prefs.putInt("infoDialogX", dlg.getX());
                        prefs.putInt("infoDialogY", dlg.getY());
                        try {
                            prefs.sync();
                        } catch (BackingStoreException ex) {
                            Exceptions.printStackTrace(ex);
                        }
                    }
                });

                int x = prefs.getInt("infoDialogX", -1);
                int y = prefs.getInt("infoDialogY", -1);
                if (x > 0 && y > 0) {
                    dlg.setLocation(x, y);
                } else {
                    GUI.centerOnScreen(dlg);
                }
                dlg.setVisible(true);
                infoText.setText("");
            } else {
                SwingUtilities.invokeAndWait(()
                        -> showInformationDialog(parent, information, title));
            }
        } catch (InterruptedException ex) {
            Exceptions.printStackTrace(ex);
        } catch (InvocationTargetException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    public static final void showInformationDialogTabs(String information,
            String title) {
        if (dialog == null) {
            dialog = new JDialog(
                    WindowManager.getDefault().getMainWindow(), false);
            dialog.setTitle("Information");
            tabs = new JTabbedPane();
            dialog.getContentPane().add(tabs);

            final Preferences prefs = NbPreferences.forModule(
                    InfoDialog.class);

            int w = prefs.getInt("infoDialogTabsWidth", 640);
            int h = prefs.getInt("infoDialogTabsHeight", 480);

            dialog.setSize(new Dimension(w, h));
            dialog.addWindowListener(new WindowAdapter() {
                @Override
                public void windowClosing(WindowEvent e) {
                    final Preferences prefs = NbPreferences.forModule(
                            InfoDialog.class);

                    prefs.putInt("infoDialogTabsWidth", dialog.getWidth());
                    prefs.putInt("infoDialogTabsHeight", dialog.getHeight());
                    prefs.putInt("infoDialogTabsX", dialog.getX());
                    prefs.putInt("infoDialogTabsY", dialog.getY());
                    try {
                        prefs.sync();
                    } catch (BackingStoreException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                }
            });

            int x = prefs.getInt("infoDialogTabsX", -1);
            int y = prefs.getInt("infoDialogTabsY", -1);
            if (x > 0 && y > 0) {
                dialog.setLocation(x, y);
            } else {
                GUI.centerOnScreen(dialog);
            }

            popup = new JPopupMenu();

            popup.add(new AbstractAction("Remove") {

                @Override
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

                @Override
                public void mousePressed(MouseEvent e) {
                    if (UiUtilities.isRightMouseButton(e)) {
                        popup.show(tabs, e.getX(), e.getY());
                    }
                }

            });

            dialog.getRootPane().putClientProperty("SeparateWindow",
                    Boolean.TRUE);
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
