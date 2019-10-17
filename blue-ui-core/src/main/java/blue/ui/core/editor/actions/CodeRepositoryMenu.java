/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.editor.actions;

import blue.tools.codeRepository.CodeRepositoryManager;
import blue.tools.codeRepository.ElementHolder;
import blue.ui.editor.actions.NameValueTextAction;
import electric.xml.ParseException;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.text.JTextComponent;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.TreeNode;
import org.netbeans.editor.BaseAction;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.Exceptions;
import org.openide.util.NbBundle;
import org.openide.util.actions.Presenter;

/**
 *
 * @author stevenyi
 */
@ActionID(
        id = "blue.ui.core.editor.actions.CodeRepositoryMenu",
category = "Edit")
@ActionRegistration(
        displayName = "#codeRepositoryMenu")
@ActionReferences({
    @ActionReference(
        path = "Editors/Popup", position = 1000)
})
@NbBundle.Messages("codeRepositoryMenu=Custom")
public class CodeRepositoryMenu extends BaseAction implements Presenter.Popup {

    private static JMenu menu;
    
    static {
        reinitialize();
    }

    
    public static void reinitialize() {
        menu = new JMenu("Custom");

        try {
            TreeNode root = CodeRepositoryManager.getCodeRepositoryTreeNode(true);
            handleOpcodeDocCategory(menu, root);
        } catch (ParseException ex) {
            Exceptions.printStackTrace(ex);
        }
    }
    
    public CodeRepositoryMenu() {
    }

    protected static void handleOpcodeDocCategory(JMenu menu, TreeNode category) {

        ArrayList<ElementHolder> snippets = new ArrayList<>();
        
        for(int i = 0; i < category.getChildCount(); i++) {
            DefaultMutableTreeNode node = (DefaultMutableTreeNode) category.getChildAt(i);
            ElementHolder info = (ElementHolder) node.getUserObject();
            
            if(info.isGroup) {
                JMenu subMenu = new JMenu(info.title);
                menu.add(subMenu);
                handleOpcodeDocCategory(subMenu, node);
            } else {
                snippets.add(info);
            }
        }
             
        JMenu currentMenu = menu;
        int counter = 0;
        for (ElementHolder info : snippets) {
            currentMenu.add(new NameValueTextAction(info.title, info.text));

            if (counter == 15) {
                JMenu more = new JMenu("More");
                currentMenu.add(more);
                currentMenu = more;
                counter = 0;
            }
        }

    }

    @Override
    public JMenuItem getPopupPresenter() {
        return menu;
    }

    @Override
    public void actionPerformed(ActionEvent evt, JTextComponent target) {
    }
}
