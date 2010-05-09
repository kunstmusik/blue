/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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

import java.awt.Component;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.Iterator;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.MenuElement;

public class DialogUtil {

    private static int counter = 0;

    private static ArrayList<JDialog> dialogs = new ArrayList<JDialog>();

    private static JMenuBar menuBar = null;

    public static synchronized void registerJDialog(JDialog dialog) {
        if (menuBar != null) {
            setupActions(dialog, menuBar);
        } else {
            dialogs.add(dialog);
        }
    }

    public static synchronized void setupDialogActions(JMenuBar _menuBar) {
        menuBar = _menuBar;
        if (dialogs == null) {
            return;
        }
        for (Iterator<JDialog> iter = dialogs.iterator(); iter.hasNext();) {
            JDialog dialog = iter.next();

            setupActions(dialog, menuBar);
        }
        dialogs.clear();
        dialogs = null;
    }

    private static void setupActions(JDialog dialog, JMenuBar menuBar) {
        counter = 0;

        for (int i = 0; i < menuBar.getComponentCount(); i++) {
            Component c = menuBar.getComponent(i);

            if (c instanceof MenuElement) {
                setActionsMenu(dialog, (MenuElement) c);
            }
        }
    }

    private static void setActionsMenu(JDialog dialog, MenuElement menu) {

        MenuElement[] subItems = menu.getSubElements();

        for (int i = 0; i < subItems.length; i++) {
            MenuElement c = subItems[i];

            if (c instanceof JMenuItem) {
                final JMenuItem menuItem = (JMenuItem) c;

                if (menuItem.getAccelerator() != null) {

                    String key = "hackAction" + counter++;

                    dialog.getRootPane().getInputMap(
                            JComponent.WHEN_IN_FOCUSED_WINDOW).put(
                            menuItem.getAccelerator(), key);

                    if (menuItem.getAction() == null) {

                        dialog.getRootPane().getActionMap().put(key,
                                new AbstractAction() {

                                    public void actionPerformed(ActionEvent e) {
                                        menuItem.doClick();

                                    }

                                });

                    } else {

                        dialog.getRootPane().getActionMap().put(key,
                                menuItem.getAction());
                    }

                    // System.out.println(key + " : "
                    // + menuItem.getActionCommand() + " : "
                    // + menuItem.getAccelerator() + " : "
                    // + menuItem.getAction());

                }

            } else if (c.getSubElements().length > 0) {
                setActionsMenu(dialog, c);
            }
        }
    }

}
