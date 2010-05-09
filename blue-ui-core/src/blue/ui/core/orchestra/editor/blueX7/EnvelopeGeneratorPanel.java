package blue.ui.core.orchestra.editor.blueX7;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.GridLayout;

import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;

import blue.orchestra.blueX7.EnvelopePoint;

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

public class EnvelopeGeneratorPanel extends JComponent implements PointListener {
    JLabel[] labels = new JLabel[8];

    EnvelopeEditor env = new EnvelopeEditor();

    public EnvelopeGeneratorPanel(String label, String xLabel, String yLabel) {
        JPanel labelPanel = new JPanel(new GridLayout(8, 2));
        Dimension boxSize = new Dimension(50, 27);

        for (int i = 0; i < 8; i += 2) {
            labels[i] = new JLabel();
            labels[i].setPreferredSize(boxSize);

            labels[i + 1] = new JLabel();
            labels[i + 1].setPreferredSize(boxSize);

            JLabel xLabelItem = new JLabel(xLabel + ((i / 2) + 1) + ": ");
            xLabelItem.setAlignmentX(1.0f);

            JLabel yLabelItem = new JLabel(yLabel + ((i / 2) + 1) + ": ");
            yLabelItem.setAlignmentX(1.0f);

            labelPanel.add(xLabelItem);
            labelPanel.add(labels[i]);
            labelPanel.add(yLabelItem);
            labelPanel.add(labels[i + 1]);
        }

        this.setLayout(new BorderLayout());
        this.add(new JLabel("[ " + label + " ]"), BorderLayout.NORTH);
        this.add(labelPanel, BorderLayout.EAST);
        this.add(env, BorderLayout.CENTER);
    }

    public void updateLabels() {
        EnvelopePoint[] points = env.getPoints();
        for (int i = 0; i < 4; i++) {
            labels[i * 2].setText(Integer.toString(points[i].x));
            labels[(i * 2) + 1].setText(Integer.toString(points[i].y));
        }
    }

    public void setPoints(EnvelopePoint[] points) {
        env.setPoints(points);
        updateLabels();
    }

    public static void main(String[] args) {
        EnvelopeGeneratorPanel envelopeGeneratorPanel1 = new EnvelopeGeneratorPanel(
                "Envelope Generator", "R", "L");
        blue.utility.GUI.showComponentAsStandalone(envelopeGeneratorPanel1,
                "EnvelopeGeneratorPanel Test", true);
    }
}
