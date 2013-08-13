package blue.ui.core.orchestra.editor;

/**
 * <p>Title: blue</p>
 * <p>Description: an object composition environment for csound</p>
 * <p>Copyright: Copyright (c) 2001-2002</p>
 * <p>Company: steven yi music</p>
 * @author unascribed
 * @version 1.0
 */

import blue.BlueSystem;
import blue.orchestra.BlueX7;
import blue.orchestra.Instrument;
import blue.orchestra.editor.InstrumentEditor;
import blue.ui.core.orchestra.editor.blueX7.AlgorithmCommonPanel;
import blue.ui.core.orchestra.editor.blueX7.BlueX7ImportDialog;
import blue.ui.core.orchestra.editor.blueX7.CsoundCodePanel;
import blue.ui.core.orchestra.editor.blueX7.EnvelopeGeneratorPanel;
import blue.ui.core.orchestra.editor.blueX7.LFOPanel;
import blue.ui.core.orchestra.editor.blueX7.OperatorPanel;
import java.awt.BorderLayout;
import java.awt.Font;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSlider;
import javax.swing.JTabbedPane;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

public class BlueX7Editor extends InstrumentEditor {
    AlgorithmCommonPanel common = new AlgorithmCommonPanel();

    LFOPanel lfo = new LFOPanel();

    OperatorPanel[] operators = new OperatorPanel[6];

    EnvelopeGeneratorPanel PEG = new EnvelopeGeneratorPanel(
            "Envelope Generator", "Rate ", "Pitch ");

    CsoundCodePanel csoundCodePanel = new CsoundCodePanel();

    JButton importButton = new JButton(BlueSystem.getString("common.import"));

    // JButton aboutButton = new JButton("[ about ]");

    BlueX7 blueX7;

    ChangeListener modPitchListener;

    ActionListener syncListener;

    boolean isUpdatingData = false;

    public BlueX7Editor() {
        modPitchListener = new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                if (isUpdatingData) {
                    return;
                }
                int val = ((JSlider) e.getSource()).getValue();
                for (int i = 0; i < operators.length; i++) {
                    operators[i].modulation.pitch.setValue(val);
                }
            }
        };

        syncListener = new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isUpdatingData) {
                    return;
                }
                int val = ((JComboBox) e.getSource()).getSelectedIndex();
                for (int i = 0; i < operators.length; i++) {
                    operators[i].oscilator.syncCombo.setSelectedIndex(val);
                }
            }
        };

        importButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                importFromSysex();
            }
        });

        JTabbedPane operatorPanel = new JTabbedPane();

        for (int i = 0; i < 6; i++) {
            operators[i] = new OperatorPanel();
            operatorPanel.add("Op " + (i + 1), operators[i]);
            operators[i].modulation.pitch.addChangeListener(modPitchListener);
            operators[i].oscilator.syncCombo.addActionListener(syncListener);
        }

        PEG.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        operatorPanel.add("PEG", PEG);

        JPanel top = new JPanel(new GridLayout(1, 2));
        top.add(common);
        top.add(lfo);

        JPanel mainPanel = new JPanel(new BorderLayout());

        mainPanel.add(top, BorderLayout.NORTH);
        mainPanel.add(operatorPanel, BorderLayout.CENTER);

        JLabel title = new JLabel("blueX7");
        title.setFont(new Font("Monospaced", Font.BOLD, 30));

        Box box = Box.createHorizontalBox();
        box.add(title);
        box.add(Box.createHorizontalStrut(10));
        box.add(importButton);
        box.add(Box.createGlue());
        // box.add(aboutButton);

        this.setLayout(new BorderLayout());
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        this.add(box, BorderLayout.NORTH);

        JTabbedPane tabs = new JTabbedPane();

        JPanel csoundPanel = new JPanel();

        JScrollPane mainScroll = new JScrollPane();
        mainScroll.getViewport().add(mainPanel);

        csoundPanel.setLayout(new BorderLayout());
        csoundPanel.add(csoundCodePanel, BorderLayout.CENTER);

        tabs.add(BlueSystem.getString("instrument.instrument"), mainScroll);
        tabs.add("Csound", csoundPanel);
        this.add(tabs, BorderLayout.CENTER);

    }

    private void importFromSysex() {
        if (blueX7 == null) {
            System.err
                    .println("[ERROR] BlueX7Editor::importFromSysex() - null blueX7");
            return;
        }

        BlueX7ImportDialog.importFromDX7File(this.blueX7);

        editInstrument(this.blueX7);
    }

    @Override
    public void editInstrument(Instrument instr) {
        if (instr == null || !(instr instanceof BlueX7)) {
            this.blueX7 = null;
            System.err
                    .println("[ERROR] BlueX7Editor::editInstrument - not instance of blueX7");
            return;
        }

        isUpdatingData = true;

        BlueX7 blueX7 = (BlueX7) instr;

        common.editBlueX7(blueX7);
        lfo.editBlueX7(blueX7);
        csoundCodePanel.editBlueX7(blueX7);

        for (int i = 0; i < operators.length; i++) {
            operators[i].editOperator(blueX7.operators[i]);
        }

        PEG.setPoints(blueX7.peg);
        this.blueX7 = blueX7;

        isUpdatingData = false;
    }

//    public static void main(String[] args) {
//        try {
//            UIManager.setLookAndFeel(new blue.plaf.BlueLookAndFeel());
//        } catch (Exception e) {
//        }
//
//        BlueX7Editor blueX7Editor1 = new BlueX7Editor();
//        blue.utility.GUI.showComponentAsStandalone(blueX7Editor1,
//                "BlueX7 GUI Test", true);
//        blueX7Editor1.editInstrument(new BlueX7());
//    }

    @Override
    public Class getInstrumentClass() {
        return BlueX7.class;
    }
}