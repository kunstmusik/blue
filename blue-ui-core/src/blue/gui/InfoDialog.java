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

import blue.components.CaretPositionDisplayLabel;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
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
import javax.swing.SwingUtilities;
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
    
    private static MimeTypeEditorComponent infoText
            = new MimeTypeEditorComponent("text/plain");
    
    public static final void showInformationDialog(Component parent,
            String information, String title) {
        
        infoText.setText(information);
        infoText.getJEditorPane().getCaret().setDot(0);
        
        final JDialog dlg = new JDialog(SwingUtilities.getWindowAncestor(parent));
        dlg.getContentPane().add(infoText);
        dlg.setModal(true);
        dlg.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
        dlg.setTitle(title);
        dlg.setSize(new Dimension(760, 400));
        
        GUI.centerOnScreen(dlg);
        dlg.show();
        infoText.setText("");
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
