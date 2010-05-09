package blue.ui.core.orchestra.editor.blueX7;

import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.BorderFactory;
import javax.swing.ImageIcon;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

import blue.gui.LabelledRangeBar;
import blue.gui.LabelledRangeLabelFilter;
import blue.orchestra.BlueX7;
import blue.orchestra.blueX7.AlgorithmCommonData;
import org.openide.util.ImageUtilities;

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

public class AlgorithmCommonPanel extends JComponent {
    ImageIcon algoIcon[] = new ImageIcon[32];

    JLabel algorithmPicture;

    LabelledRangeBar keyTranspose = new LabelledRangeBar("Key Transpose ", 0,
            48);

    LabelledRangeBar algorithm = new LabelledRangeBar("Algorithm ", 1, 32);

    LabelledRangeBar feedback = new LabelledRangeBar("Feedback ", 0, 7);

    JCheckBox[] operatorEnabled = new JCheckBox[6];

    BlueX7 blueX7;

    boolean isUpdatingData = false;

    public AlgorithmCommonPanel() {

        // algoIcon[1] = new
        // ImageIcon(ClassLoader.getSystemResource("blue/resources/blueX7/algo02.gif"));


        for(int i = 0; i < 32; i++) {
            String num = Integer.toString(i + 1);
            if(i < 9) {
                num = "0" + num;
            }

            algoIcon[i] = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/blueX7/algo" + num + ".gif"));
        }

//        algoIcon[0] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo01.gif"));
//        algoIcon[1] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo02.gif"));
//        algoIcon[2] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo03.gif"));
//        algoIcon[3] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo04.gif"));
//        algoIcon[4] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo05.gif"));
//        algoIcon[5] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo06.gif"));
//        algoIcon[6] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo07.gif"));
//        algoIcon[7] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo08.gif"));
//        algoIcon[8] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo09.gif"));
//        algoIcon[9] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo10.gif"));
//        algoIcon[10] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo11.gif"));
//        algoIcon[11] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo12.gif"));
//        algoIcon[12] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo13.gif"));
//        algoIcon[13] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo14.gif"));
//        algoIcon[14] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo15.gif"));
//        algoIcon[15] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo16.gif"));
//        algoIcon[16] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo17.gif"));
//        algoIcon[17] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo18.gif"));
//        algoIcon[18] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo19.gif"));
//        algoIcon[19] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo20.gif"));
//        algoIcon[20] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo21.gif"));
//        algoIcon[21] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo22.gif"));
//        algoIcon[22] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo23.gif"));
//        algoIcon[23] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo24.gif"));
//        algoIcon[24] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo25.gif"));
//        algoIcon[25] = new ImageIcon(ImageUtilities.loadImage("blue/resources/blueX7/algo26.gif"));
//        algoIcon[26] = new ImageIcon(ClassLoader
//                .getSystemResource("blue/resources/blueX7/algo27.gif"));
//        algoIcon[27] = new ImageIcon(ClassLoader
//                .getSystemResource("blue/resources/blueX7/algo28.gif"));
//        algoIcon[28] = new ImageIcon(ClassLoader
//                .getSystemResource("blue/resources/blueX7/algo29.gif"));
//        algoIcon[29] = new ImageIcon(ClassLoader
//                .getSystemResource("blue/resources/blueX7/algo30.gif"));
//        algoIcon[30] = new ImageIcon(ClassLoader
//                .getSystemResource("blue/resources/blueX7/algo31.gif"));
//        algoIcon[31] = new ImageIcon(ClassLoader
//                .getSystemResource("blue/resources/blueX7/algo32.gif"));

        algorithmPicture = new JLabel(algoIcon[0]);

        algorithm.addChangeListener(new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                algorithmPicture.setIcon(algoIcon[algorithm.getValue() - 1]);
            }
        });

        algorithmPicture.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        LabelledRangeLabelFilter transposeFilter = new LabelledRangeLabelFilter() {
            String[] KeyTransposeName = new String[] { "C1", "C#1", "D1",
                    "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1",
                    "C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2",
                    "A2", "A#2", "B2", "C3", "C#3", "D3", "D#3", "E3", "F3",
                    "F#3", "G3", "G#3", "A3", "A#3", "B3", "C4", "C#4", "D4",
                    "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
                    "C5" };

            public String filter(int val) {
                if (val < KeyTransposeName.length) {
                    return KeyTransposeName[val];
                } else {
                    return "xxx";
                }
            }
        };

        keyTranspose.setFilter(transposeFilter);
        keyTranspose.setValue(12);

        // JPanel operatorPanel = new JPanel();
        // operatorPanel.setLayout(new GridLayout(2,1));
        // operatorPanel.add(new JLabel("Operator on/off"));
        JPanel operatorBank = new JPanel(new FlowLayout(FlowLayout.LEFT));
        operatorBank.setAlignmentY(0.0f);
        // operatorPanel.add(operatorBank);

        for (int i = 0; i < 6; i++) {
            operatorEnabled[i] = new JCheckBox(Integer.toString(i + 1));
            operatorBank.add(operatorEnabled[i]);
        }

        JPanel algorithmEditPanelTop = new JPanel(new GridLayout(5, 1));
        algorithmEditPanelTop.add(keyTranspose);
        algorithmEditPanelTop.add(algorithm);
        algorithmEditPanelTop.add(feedback);
        algorithmEditPanelTop.add(new JLabel("Operator on/off"));
        algorithmEditPanelTop.add(operatorBank);

        this.setBorder(BorderFactory.createTitledBorder("Common"));
        this.setLayout(new BorderLayout());
        this.add(algorithmPicture, BorderLayout.WEST);
        this.add(algorithmEditPanelTop, BorderLayout.CENTER);

        ChangeListener cl = new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                checkData();
            }
        };

        keyTranspose.addChangeListener(cl);
        algorithm.addChangeListener(cl);
        feedback.addChangeListener(cl);

        ActionListener al = new ActionListener() {
            public void actionPerformed(ActionEvent ae) {
                checkData();
            }
        };

        for (int i = 0; i < operatorEnabled.length; i++) {
            operatorEnabled[i].addActionListener(al);
        }
    }

    private void checkData() {
        if (isUpdatingData) {
            return;
        }

        if (this.blueX7 == null) {
            // System.err.println("[ERROR] AlgorithmCommonPanel::checkData() -
            // Tried to set data on null blueX7");
            return;
        }

        this.blueX7.algorithmCommon.keyTranspose = keyTranspose.getValue();
        this.blueX7.algorithmCommon.algorithm = algorithm.getValue();
        this.blueX7.algorithmCommon.feedback = feedback.getValue();

        for (int i = 0; i < operatorEnabled.length; i++) {
            this.blueX7.algorithmCommon.operators[i] = operatorEnabled[i]
                    .isSelected();
        }
    }

    public void editBlueX7(BlueX7 blueX7) {
        isUpdatingData = true;

        this.blueX7 = blueX7;

        if (blueX7 == null) {
            return;
        }

        AlgorithmCommonData common = blueX7.algorithmCommon;

        keyTranspose.setValue(common.keyTranspose);
        algorithm.setValue(common.algorithm);
        feedback.setValue(common.feedback);

        for (int i = 0; i < operatorEnabled.length; i++) {
            operatorEnabled[i].setSelected(common.operators[i]);
        }

        isUpdatingData = false;
    }

    public static void main(String[] args) {
        AlgorithmCommonPanel algorithmCommonPanel1 = new AlgorithmCommonPanel();
        blue.utility.GUI.showComponentAsStandalone(algorithmCommonPanel1,
                "AlgorithmCommonPanel Test", true);
    }
}