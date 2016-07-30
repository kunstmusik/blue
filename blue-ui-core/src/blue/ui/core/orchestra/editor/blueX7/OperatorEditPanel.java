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

public class OperatorEditPanel extends JComponent {
    LabelledRangeBar outputLevel = new LabelledRangeBar("Output Level ", 0, 99);

    LabelledRangeBar velocitySensitivity = new LabelledRangeBar(
            "Velocity Sensitivity ", 0, 7);

    Operator op;

    boolean isUpdatingData = false;

    public OperatorEditPanel() {
        this.setLayout(new GridLayout(3, 1));
        this.add(new JLabel("[ Operator ]"));
        this.add(outputLevel);
        this.add(velocitySensitivity);

        ChangeListener cl = new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                checkData();
            }
        };

        outputLevel.addChangeListener(cl);
        velocitySensitivity.addChangeListener(cl);

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

        op.outputLevel = outputLevel.getValue();
        op.velocitySensitivity = velocitySensitivity.getValue();

    }

    public void editOperator(Operator op) {
        isUpdatingData = true;

        this.op = op;

        if (op == null) {
            return;
        }

        outputLevel.setValue(op.outputLevel);
        velocitySensitivity.setValue(op.velocitySensitivity);

        isUpdatingData = false;
    }

    public static void main(String[] args) {
        OperatorEditPanel operatorEditPanel1 = new OperatorEditPanel();
        blue.utility.GUI.showComponentAsStandalone(operatorEditPanel1,
                "Operator Edit Panel Test", true);
    }
}