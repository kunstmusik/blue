package blue.ui.core.orchestra.editor.blueX7;

import blue.orchestra.blueX7.Operator;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JPanel;

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

public class OperatorPanel extends JComponent {
    public OscilatorPanel oscilator = new OscilatorPanel();

    KeyboardLevelScalingPanel keyboardLevel = new KeyboardLevelScalingPanel();

    OperatorEditPanel opEdit = new OperatorEditPanel();

    public ModulationSensitivityPanel modulation = new ModulationSensitivityPanel();

    EnvelopeGeneratorPanel eg = new EnvelopeGeneratorPanel(
            "Envelope Generator", "R", "L");

    public OperatorPanel() {
        JPanel top = new JPanel(new GridLayout(1, 2));
        top.add(oscilator);
        JPanel right = new JPanel(new GridLayout(2, 1));
        right.setBorder(BorderFactory.createEmptyBorder(0, 5, 0, 0));
        right.add(opEdit);
        right.add(modulation);
        top.add(right);

        JPanel bottom = new JPanel(new GridLayout(1, 2));
        bottom.add(keyboardLevel);
        bottom.add(eg);

        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        this.setLayout(new BorderLayout());
        this.add(top, BorderLayout.NORTH);
        this.add(bottom, BorderLayout.CENTER);
    }

    public void editOperator(Operator op) {

        oscilator.editOperator(op);
        keyboardLevel.editOperator(op);
        opEdit.editOperator(op);
        modulation.editOperator(op);
        eg.setPoints(op.envelopePoints);

    }

    public static void main(String[] args) {
        OperatorPanel operatorPanel1 = new OperatorPanel();
        blue.utility.GUI.showComponentAsStandalone(operatorPanel1,
                "OperatorPanel Test", true);
    }
}