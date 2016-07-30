package blue.ui.core.orchestra.editor.blueX7;

import blue.gui.LabelledRangeBar;
import blue.orchestra.BlueX7;
import blue.orchestra.blueX7.LFOData;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Vector;
import javax.swing.BorderFactory;
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

public class LFOPanel extends JComponent {
    LabelledRangeBar speed = new LabelledRangeBar("Speed ", 0, 99);

    LabelledRangeBar delay = new LabelledRangeBar("Delay ", 0, 99);

    LabelledRangeBar pmd = new LabelledRangeBar("PMD ", 0, 99);

    LabelledRangeBar amd = new LabelledRangeBar("AMD ", 0, 99);

    JComboBox wave;

    JComboBox sync;

    BlueX7 blueX7;

    boolean isUpdatingData = false;

    public LFOPanel() {
        this.setBorder(BorderFactory.createTitledBorder("LFO"));

        this.setLayout(new GridLayout(5, 1));
        this.add(speed);
        this.add(delay);
        this.add(pmd);
        this.add(amd);

        Vector<String> items = new Vector<>();
        items.add("Triangle");
        items.add("Saw Down");
        items.add("Saw Up");
        items.add("Square");
        items.add("Sine");
        items.add("S/Hold");

        wave = new JComboBox(items);

        items = new Vector();
        items.add("Off");
        items.add("On");

        sync = new JComboBox(items);

        JPanel temp = new JPanel();
        temp.add(new JLabel("Wave "));
        temp.add(wave);
        temp.add(new JLabel("Sync "));
        temp.add(sync);

        this.add(temp);

        ChangeListener cl = new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                checkData();
            }
        };

        speed.addChangeListener(cl);
        delay.addChangeListener(cl);
        amd.addChangeListener(cl);
        pmd.addChangeListener(cl);

        ActionListener al = new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent ae) {
                checkData();
            }
        };

        wave.addActionListener(al);
        sync.addActionListener(al);

    }

    public void checkData() {
        if (isUpdatingData) {
            return;
        }

        if (this.blueX7 == null) {
            // System.err.println("[ERROR] LFOPanel::checkData() - Tried to set
            // data on null blueX7");
            return;
        }

        this.blueX7.lfo.speed = speed.getValue();
        this.blueX7.lfo.delay = delay.getValue();
        this.blueX7.lfo.AMD = amd.getValue();
        this.blueX7.lfo.PMD = pmd.getValue();
        this.blueX7.lfo.wave = wave.getSelectedIndex();
        this.blueX7.lfo.sync = sync.getSelectedIndex();

    }

    public void editBlueX7(BlueX7 blueX7) {
        this.isUpdatingData = true;

        this.blueX7 = blueX7;

        if (blueX7 == null) {
            return;
        }

        LFOData lfo = blueX7.lfo;

        speed.setValue(lfo.speed);
        delay.setValue(lfo.delay);
        amd.setValue(lfo.AMD);
        pmd.setValue(lfo.PMD);

        wave.setSelectedIndex(lfo.wave);
        sync.setSelectedIndex(lfo.sync);

        this.isUpdatingData = false;
    }

    public static void main(String[] args) {
        LFOPanel LFOPanel1 = new LFOPanel();
        blue.utility.GUI.showComponentAsStandalone(LFOPanel1, "LFO Panel Test",
                true);
    }
}