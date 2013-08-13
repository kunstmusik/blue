package blue.ui.core.orchestra.editor.blueX7;

import blue.gui.LabelledRangeBar;
import blue.orchestra.blueX7.Operator;
import java.awt.FlowLayout;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Vector;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class OscilatorPanel extends JComponent {
    JLabel oscilatorLabel = new JLabel();

    JComboBox modeCombo;

    public JComboBox syncCombo;

    LabelledRangeBar freqCoarse = new LabelledRangeBar("Frequency Coarse ", 0,
            31);

    LabelledRangeBar freqFine = new LabelledRangeBar("Frequency Fine ", 0, 99);

    LabelledRangeBar detune = new LabelledRangeBar("Detune ", -7, 7);

    Operator op;

    boolean isUpdatingData = false;

    public OscilatorPanel() {
        setOscilatorLabel();

        Vector<String> items = new Vector<String>(2);
        items.add("Ratio");
        items.add("Fixed (Hz)");
        modeCombo = new JComboBox(items);

        items = new Vector<String>(2);
        items.add("Off");
        items.add("On");
        syncCombo = new JComboBox(items);

        JPanel modePanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        modePanel.add(new JLabel("Mode "));
        modePanel.add(modeCombo);
        modePanel.add(new JLabel(" Sync (*)"));
        modePanel.add(syncCombo);

        this.setLayout(new GridLayout(5, 1));

        this.add(oscilatorLabel);
        this.add(modePanel);
        this.add(freqCoarse);
        this.add(freqFine);
        this.add(detune);

        ChangeListener cl = new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                checkData();
            }
        };

        freqCoarse.addChangeListener(cl);
        freqFine.addChangeListener(cl);
        detune.addChangeListener(cl);

        ActionListener al = new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent ae) {
                checkData();
            }
        };

        modeCombo.addActionListener(al);
        syncCombo.addActionListener(al);
    }

    public void checkData() {
        if (isUpdatingData) {
            return;
        }

        if (this.op == null) {
            // System.err.println("[ERROR] OscilatorPanel::checkData() - Tried
            // to set data on null Operator");
            return;
        }

        op.freqCoarse = freqCoarse.getValue();
        op.freqFine = freqFine.getValue();
        op.detune = detune.getValue();
        op.mode = modeCombo.getSelectedIndex();
        op.sync = syncCombo.getSelectedIndex();

    }

    public void editOperator(Operator op) {
        isUpdatingData = true;

        if (op == null) {
            return;
        }

        this.op = null;

        modeCombo.setSelectedIndex(op.mode);
        syncCombo.setSelectedIndex(op.sync);

        freqCoarse.setValue(op.freqCoarse);
        freqFine.setValue(op.freqFine);
        detune.setValue(op.detune);

        this.op = op;

        isUpdatingData = false;
    }

    private void setOscilatorLabel() {
        oscilatorLabel.setText("[ Oscilator ]");
    }

    public static void main(String[] args) {
        OscilatorPanel oscilatorPanel1 = new OscilatorPanel();
        blue.utility.GUI.showComponentAsStandalone(oscilatorPanel1,
                "OscilatorPanel test", true);
    }
}