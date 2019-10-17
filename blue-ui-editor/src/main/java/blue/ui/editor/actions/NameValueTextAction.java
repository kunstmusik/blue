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
package blue.ui.editor.actions;

import java.awt.event.ActionEvent;
import javax.swing.Action;
import javax.swing.text.BadLocationException;
import javax.swing.text.JTextComponent;
import org.netbeans.editor.BaseAction;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class NameValueTextAction extends BaseAction {
    private final String var;

    public NameValueTextAction(String name) {
        this(name, name);
    }
    
    public NameValueTextAction(String name, String value) {
        this.var = value;
        putValue(Action.NAME, name);
    }

    @Override
    public void actionPerformed(ActionEvent evt, JTextComponent target) {
        int loc = target.getCaretPosition();
        int start = target.getSelectionStart();
        int end = target.getSelectionEnd();
        try {
            if (end != start) {
                target.getDocument().remove(loc, end - loc);
                target.getDocument().insertString(loc, var, null);
            } else {
                target.getDocument().insertString(loc, this.var, null);
            }
        } catch (BadLocationException ex) {
            Exceptions.printStackTrace(ex);
        }
    }
    
}
