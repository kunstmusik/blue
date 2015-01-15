package blue.ui.core.score.layers.soundObject;

import blue.BlueSystem;
import blue.gui.LabelledItemPanel;
import blue.score.ScoreObject;
import blue.ui.core.score.undo.StartTimeEdit;
import blue.undo.BlueUndoManager;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import javax.swing.JDialog;
import javax.swing.JOptionPane;
import javax.swing.JTextField;

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

    private ScoreObject scoreObj;

    public QuickTimeDialog(Frame owner) {
        super(owner);
        this.setTitle(BlueSystem.getString("scoreGUI.quickTimeDialog.title"));
        itemPanel.addItem(BlueSystem
                .getString("soundObjectProperties.startTime"), startText);
        itemPanel
                .addItem(BlueSystem
                        .getString("soundObjectProperties.subjectiveDuration"),
                        durText);

        startText.setPreferredSize(new Dimension(130, 17));
        durText.setPreferredSize(new Dimension(130, 17));

        this.addWindowListener(new WindowAdapter() {

            @Override
            public void windowDeactivated(WindowEvent e) {
                hide();
            }
        });

        KeyListener k = new KeyAdapter() {

            @Override
            public void keyTyped(KeyEvent e) {
                // handleKeyTyped(e);
            }

            @Override
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
        if (scoreObj != null) {
            try {
                float initialStart = scoreObj.getStartTime();
                float initialSubjectiveDuration = scoreObj 
                        .getSubjectiveDuration();

                float newStart = Float.parseFloat(startText.getText());
                float newSubjectiveDuration = Float.parseFloat(durText
                        .getText());

                scoreObj.setStartTime(newStart);
                scoreObj.setSubjectiveDuration(newSubjectiveDuration);

                BlueUndoManager.setUndoManager("score");

                if (initialStart != newStart) {
                    BlueUndoManager.addEdit(new StartTimeEdit(initialStart,
                            newStart, scoreObj));
                }

                if (initialSubjectiveDuration != newSubjectiveDuration) {
                    // FIXME
//                    BlueUndoManager.addEdit(new ResizeSoundObjectEdit(sObjView
//                            .getSoundObject(), initialSubjectiveDuration,
//                            newSubjectiveDuration));
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

    public void show(ScoreObject scoreObject) {
        this.scoreObj = scoreObject;
        // Point p = new Point(sObjView.getX(), sObjView.getY());
        // SwingUtilities.convertPointToScreen(p, stCanvas);
        // this.setLocation(p.x, p.y - this.getHeight());

        startText.setText(Float.toString(scoreObj.getStartTime()));
        durText.setText(Float.toString(scoreObj.getSubjectiveDuration()));

        super.show();
        startText.requestFocus();
    }

}