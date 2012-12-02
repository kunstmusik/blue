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
import java.awt.event.ActionEvent;
import javax.swing.Action;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.text.BadLocationException;
import javax.swing.text.JTextComponent;
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
        id = "blue.ui.editor.actions.BlueVariablesMenu",
category = "Edit")
@ActionRegistration(
        displayName = "#blueVariablesMenu")
@ActionReferences({
    @ActionReference(
        path = "Editors/text/x-csound-orc/Popup", position = 600)
})
@NbBundle.Messages("blueVariablesMenu=Blue Variables")
public class BlueVariablesMenu extends BaseAction implements Presenter.Popup {

    JMenu menu;

    public BlueVariablesMenu() {
        menu = new JMenu("Blue Variables");

        String[] values = {"<TOTAL_DUR>", "<RENDER_START>",
            "<PROCESSING_START>", "<INSTR_ID>", "<INSTR_NAME>"};

        for (String s : values) {
            menu.add(new NameValueTextAction(s));
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
