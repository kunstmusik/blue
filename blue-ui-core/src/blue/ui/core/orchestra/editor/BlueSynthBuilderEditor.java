/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

package blue.ui.core.orchestra.editor;

import java.awt.BorderLayout;

import javax.swing.JLabel;
import javax.swing.JTabbedPane;

import blue.BlueSystem;
import blue.orchestra.BlueSynthBuilder;
import blue.orchestra.Instrument;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObjectRegistry;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import blue.orchestra.editor.InstrumentEditor;
import blue.orchestra.editor.blueSynthBuilder.BSBCodeEditor;
import blue.orchestra.editor.blueSynthBuilder.BSBInterfaceEditor;
import blue.ui.core.udo.EmbeddedOpcodeListPanel;

/**
 * @author Steven Yi
 */
public class BlueSynthBuilderEditor extends InstrumentEditor {

    private BlueSynthBuilder bsb;

    private BSBInterfaceEditor interfaceEditor = new BSBInterfaceEditor(
            BSBObjectRegistry.getBSBObjects(), true);

    private BSBCodeEditor codeEditor = new BSBCodeEditor();

    private EmbeddedOpcodeListPanel udoPanel = new EmbeddedOpcodeListPanel();

    public BlueSynthBuilderEditor() {
        JTabbedPane tabs = new JTabbedPane();
        tabs.add(BlueSystem.getString("instrument.interface"), interfaceEditor);
        tabs.add(BlueSystem.getString("instrument.code"), codeEditor);
        tabs.add(BlueSystem.getString("instrument.udo"), udoPanel);

        JLabel label = new JLabel("[ Blue Synth Builder ]");

        this.setLayout(new BorderLayout());
        this.add(label, BorderLayout.NORTH);
        this.add(tabs, BorderLayout.CENTER);

    }

    public void editInstrument(Instrument instr) {
        if (instr == null) {
            this.bsb = null;
            return;
        }

        if (!(instr instanceof BlueSynthBuilder)) {
            this.bsb = null;
            return;
        }

        this.bsb = (BlueSynthBuilder) instr;

        PresetGroup presetGroup = bsb.getPresetGroup();
        BSBGraphicInterface graphicInterface = bsb.getGraphicInterface();

        this.interfaceEditor.editInterface(graphicInterface, presetGroup);
        this.codeEditor.editBlueSynthBuilder(bsb);

        this.udoPanel.editOpcodeList(bsb.getOpcodeList());
    }

//    public static void main(String[] args) {
//        try {
//            UIManager.setLookAndFeel(new BlueLookAndFeel());
//
//        } catch (UnsupportedLookAndFeelException e) {
//            e.printStackTrace();
//        }
//
//        BlueSynthBuilderEditor bsbEditor = new BlueSynthBuilderEditor();
//        bsbEditor.editInstrument(new BlueSynthBuilder());
//
//        GUI.showComponentAsStandalone(bsbEditor, "BlueSynthEditor Test", true);
//    }

    @Override
    public Class getInstrumentClass() {
        return BlueSynthBuilder.class;
    }
}