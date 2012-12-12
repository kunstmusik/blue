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

import blue.tools.codeRepository.AddToCodeRepositoryDialog;
import blue.tools.codeRepository.CodeRepositoryManager;
import electric.xml.ParseException;
import java.awt.event.ActionEvent;
import java.lang.ref.WeakReference;
import javax.swing.Action;
import javax.swing.JOptionPane;
import javax.swing.text.JTextComponent;
import javax.swing.tree.DefaultMutableTreeNode;
import org.netbeans.editor.BaseAction;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle;

/**
 *
 * @author stevenyi
 */
@ActionID(
        id = "blue.ui.core.editor.actions.AddToCodeRepositoryAction",
        category = "Edit")
@ActionRegistration(
        displayName = "#CTL_AddToCodeRepositoryAction")
@ActionReferences({
@ActionReference(
        path = "Editors/Popup", position = 1100, separatorAfter = 1200)
})
@NbBundle.Messages("CTL_AddToCodeRepositoryAction=Add to Code Repository")
public class AddToCodeRepositoryAction extends BaseAction {

    //private static WeakReference<AddToCodeRepositoryDialog> addDialogRef = null;
    
    static AddToCodeRepositoryDialog addDialog = new AddToCodeRepositoryDialog();
    
//    protected static AddToCodeRepositoryDialog getAddDialog() {
//        if(addDialogRef == null || addDialogRef.get() == null) {
//            AddToCodeRepositoryDialog addDialog = new AddToCodeRepositoryDialog();
//            addDialogRef = new WeakReference<AddToCodeRepositoryDialog>(
//                    addDialog);
//        } 
//        return addDialogRef.get();
//    }
            
    public AddToCodeRepositoryAction() {
        super("Add to Code Repository");
        
        putValue(Action.SHORT_DESCRIPTION,
                "Add Selected Text to Code Repository");
    }
    
    @Override
    public void actionPerformed(ActionEvent evt, JTextComponent target) {
        
        String selectedText = target.getSelectedText();
        
        if (selectedText == null || selectedText.length() == 0) {
            return;
        }

        
        //AddToCodeRepositoryDialog addDialog = getAddDialog();
        

        while (addDialog.ask()) {
            DefaultMutableTreeNode rootNode;

            try {
                rootNode = addDialog.getUpdatedCodeRepository(selectedText);
            } catch (ParseException e) {
                e.printStackTrace();
                JOptionPane
                        .showMessageDialog(null,
                        "There was an error trying to open or parse opcodes.xml or codeRepository.xml");
                return;
            }

            if (rootNode == null) {
                JOptionPane.showMessageDialog(null,
                        "Error: Code Snippet Name not filled in or "
                        + "Category not selected.");
            } else {
                CodeRepositoryManager.saveCodeRepository(rootNode);
                return;
            }

        }
    }
}
