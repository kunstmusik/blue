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
package blue.ui.editor.csound.orc.actions;

import blue.ui.editor.actions.NameValueTextAction;
import csound.manual.CsoundManualUtilities;
import csound.manual.OpcodeDoc;
import csound.manual.OpcodeDocCategory;
import java.awt.event.ActionEvent;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.text.JTextComponent;
import org.netbeans.editor.BaseAction;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle;
import org.openide.util.actions.Presenter;

/**
 *
 * @author stevenyi
 */
@ActionID(
        id = "blue.ui.editor.actions.OpcodesMenu",
category = "Edit")
@ActionRegistration(
        displayName = "#opcodesMenu")
@ActionReferences({
    @ActionReference(
        path = "Editors/text/x-csound-orc/Popup", position = 800, separatorAfter = 900),
    @ActionReference(
        path = "Editors/text/x-blue-synth-builder/Popup", position = 800, separatorAfter = 900)
})
@NbBundle.Messages("opcodesMenu=Opcodes")
public class OpcodesMenu extends BaseAction implements Presenter.Popup {

    JMenu menu;

    public OpcodesMenu() {
        menu = new JMenu("Opcodes");

        OpcodeDocCategory root = CsoundManualUtilities.getOpcodeDocCategory();
        
        handleOpcodeDocCategory(menu, root);
        
    }
    
    protected void handleOpcodeDocCategory(JMenu menu, OpcodeDocCategory category) {
        
        for(OpcodeDocCategory cat : category.subGroups) {
            JMenu subMenu = new JMenu(cat.categoryName);
            menu.add(subMenu);
            handleOpcodeDocCategory(subMenu, cat);
        }
        
        JMenu currentMenu = menu;
        for(int i = 0, counter = 0; i <  category.opcodes.size(); i++, counter++) {
            OpcodeDoc op = category.opcodes.get(i);
            currentMenu.add(new NameValueTextAction(op.opcodeName, op.signature));
            
            if(counter == 15 && i < category.opcodes.size() - 2) {
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
