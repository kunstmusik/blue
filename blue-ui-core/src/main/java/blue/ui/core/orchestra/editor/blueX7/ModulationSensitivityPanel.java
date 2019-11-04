package blue.ui.core.orchestra.editor.blueX7;

import blue.gui.LabelledRangeBar;
import blue.orchestra.blueX7.Operator;
import java.awt.GridLayout;
import javax.swing.JComponent;
import javax.swing.JLabel;
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

public class ModulationSensitivityPanel extends JComponent {
    LabelledRangeBar amplitude = new LabelledRangeBar("Amplitude ", 0, 3);

    public LabelledRangeBar pitch = new LabelledRangeBar("Pitch (*) ", 0, 7);

    Operator op;

    boolean isUpdatingData = false;

    public ModulationSensitivityPanel() {
        this.setLayout(new GridLayout(3, 1));
        this.add(new JLabel("[ Modulation Sensitivity ]"));
        this.add(amplitude);
        this.add(pitch);

        ChangeListener cl = (ChangeEvent e) -> {
            checkData();
        };

        amplitude.addChangeListener(cl);
        pitch.addChangeListener(cl);
    }

    public void checkData() {
        if (isUpdatingData) {
            return;
        }

        if (this.op == null) {
            // System.err.println("[ERROR]
            // KeyboardLevelScalingPanel::checkData() - Tried to set data on
            // null Operator");
            return;
        }

        op.modulationAmplitude = amplitude.getValue();
        op.modulationPitch = pitch.getValue();

    }

    public void editOperator(Operator op) {
        isUpdatingData = true;

        this.op = op;

        if (op == null) {
            return;
        }

        amplitude.setValue(op.modulationAmplitude);
        pitch.setValue(op.modulationPitch);

        isUpdatingData = false;
    }

    public static void main(String[] args) {
        ModulationSensitivityPanel modulationSensitivityPanel1 = new ModulationSensitivityPanel();
        blue.utility.GUI.showComponentAsStandalone(modulationSensitivityPanel1,
                "ModulationSensitivityPanel Test", true);
    }
}