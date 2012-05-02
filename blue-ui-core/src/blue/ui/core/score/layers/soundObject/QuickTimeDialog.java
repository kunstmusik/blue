package blue.ui.core.score.layers.soundObject;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

import javax.swing.JDialog;
import javax.swing.JOptionPane;
import javax.swing.JTextField;

import blue.BlueSystem;
import blue.gui.LabelledItemPanel;
import blue.ui.core.score.undo.ResizeSoundObjectEdit;
import blue.ui.core.score.undo.StartTimeEdit;
import blue.undo.BlueUndoManager;

/**
 * Popup for quick entry of start time and duration, used by ScoreTimeCanvas
 * 
 * @author Steven Yi
 * @version 1.0
 */

public class QuickTimeDialog extends JDialog {

    LabelledItemPanel itemPanel = new LabelledItemPanel();

    JTextField startText = new JTextField();

    JTextField durText = new JTextField();

    ScoreTimeCanvas stCanvas;

    SoundObjectView sObjView;

    public QuickTimeDialog(ScoreTimeCanvas stCanvas) {
        this.setTitle(BlueSystem.getString("scoreGUI.quickTimeDialog.title"));
        this.stCanvas = stCanvas;
        itemPanel.addItem(BlueSystem
                .getString("soundObjectProperties.startTime"), startText);
        itemPanel
                .addItem(BlueSystem
                        .getString("soundObjectProperties.subjectiveDuration"),
                        durText);

        startText.setPreferredSize(new Dimension(130, 17));
        durText.setPreferredSize(new Dimension(130, 17));

        this.addWindowListener(new WindowAdapter() {

            public void windowDeactivated(WindowEvent e) {
                hide();
            }
        });

        KeyListener k = new KeyAdapter() {

            public void keyTyped(KeyEvent e) {
                // handleKeyTyped(e);
            }

            public void keyPressed(KeyEvent e) {
                handleKeyTyped(e);
            }
        };

        startText.addKeyListener(k);
        durText.addKeyListener(k);

        this.getContentPane().setLayout(new BorderLayout());
        this.getContentPane().add(itemPanel, BorderLayout.CENTER);
        this.pack();

        blue.utility.GUI.centerOnScreen(this);
    }

    private void handleKeyTyped(KeyEvent e) {
        switch (e.getKeyCode()) {
            case KeyEvent.VK_ESCAPE:
                hide();
                break;
            case KeyEvent.VK_ENTER:
                handleWindowDeactivated();
                break;
        }
    }

    private void handleWindowDeactivated() {
        if (sObjView != null) {
            try {
                float initialStart = sObjView.getStartTime();
                float initialSubjectiveDuration = sObjView
                        .getSubjectiveDuration();

                float newStart = Float.parseFloat(startText.getText());
                float newSubjectiveDuration = Float.parseFloat(durText
                        .getText());

                sObjView.setStartTime(newStart);
                sObjView.setSubjectiveTime(newSubjectiveDuration);

                BlueUndoManager.setUndoManager("score");

                if (initialStart != newStart) {
                    BlueUndoManager.addEdit(new StartTimeEdit(initialStart,
                            newStart, sObjView.getSoundObject()));
                }

                if (initialSubjectiveDuration != newSubjectiveDuration) {
                    BlueUndoManager.addEdit(new ResizeSoundObjectEdit(sObjView
                            .getSoundObject(), initialSubjectiveDuration,
                            newSubjectiveDuration));
                }

            } catch (NumberFormatException nfe) {
                JOptionPane
                        .showMessageDialog(
                                null,
                                BlueSystem
                                        .getString("scoreGUI.quickTimeDialog.notFloat.message"),
                                BlueSystem
                                        .getString("scoreGUI.quickTimeDialog.notFloat.title"),
                                JOptionPane.ERROR_MESSAGE);
                this.show();
                startText.requestFocus();
                return;
            }
        }
        hide();
    }

    public void show(SoundObjectView sObjView) {
        this.sObjView = sObjView;
        // Point p = new Point(sObjView.getX(), sObjView.getY());
        // SwingUtilities.convertPointToScreen(p, stCanvas);
        // this.setLocation(p.x, p.y - this.getHeight());

        startText.setText(Float.toString(sObjView.getStartTime()));
        durText.setText(Float.toString(sObjView.getSubjectiveDuration()));

        super.show();
        startText.requestFocus();
    }

}