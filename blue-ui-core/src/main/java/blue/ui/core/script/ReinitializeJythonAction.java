/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.script;

import blue.scripting.PythonProxy;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;

@ActionID(
    category = "Script",
    id = "blue.ui.core.script.ReinitializeJythonAction")
@ActionRegistration(
    displayName = "#CTL_ReinitializeJythonAction")
@ActionReference(path = "Menu/Script", position = 110)
@Messages("CTL_ReinitializeJythonAction=Reinitialize &Jython Interpreter")
public final class ReinitializeJythonAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        PythonProxy.reinitialize();
    }
}
