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
package blue.ui.core.udo;

import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;
import java.awt.BorderLayout;
import javax.swing.JComponent;
import javax.swing.JSplitPane;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;

public class EmbeddedOpcodeListPanel extends JComponent {

    OpcodeListEditPanel opcodeListEditPanel = new OpcodeListEditPanel();

    UDOEditor opcodeEditor = new UDOEditor();

    public EmbeddedOpcodeListPanel() {
        this.setLayout(new BorderLayout());
        JSplitPane split = new JSplitPane(JSplitPane.VERTICAL_SPLIT);

        split.add(opcodeListEditPanel, JSplitPane.TOP);
        split.add(opcodeEditor, JSplitPane.BOTTOM);

        split.setDividerLocation(200);

        this.add(split);

        opcodeListEditPanel
                .addListSelectionListener(new ListSelectionListener() {

                    @Override
                    public void valueChanged(ListSelectionEvent e) {

                        if (e.getValueIsAdjusting()) {
                            return;
                        }

                        UserDefinedOpcode[] udos = opcodeListEditPanel
                                .getSelectedUDOs();

                        
                        if(udos != null && udos.length == 1) {
                            opcodeEditor.editUserDefinedOpcode(udos[0]);
                            opcodeEditor.setBorder(null);
                        } else {
                            opcodeEditor.editUserDefinedOpcode(null);
                            opcodeEditor.setBorder(null);
                        }
                        

                    }
                });
    }

    public void editOpcodeList(OpcodeList opcodeList) {
        opcodeListEditPanel.setOpcodeList(opcodeList);
        opcodeEditor.setVisible(opcodeList != null);
    }

}
