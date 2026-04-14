package blue.ui.core.score.layers.soundObject;

import blue.BlueSystem;
import blue.gui.LabelledItemPanel;
import blue.score.ScoreObject;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import blue.ui.core.score.undo.DurationScoreObjectEdit;
import blue.ui.core.score.undo.StartTimeEdit;
import blue.ui.core.time.SoundObjectTimePanel;
import blue.ui.core.time.TimeUnitTextField;
import blue.undo.BlueUndoManager;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Container;
import java.awt.Frame;
import java.awt.event.KeyEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JOptionPane;
import javax.swing.KeyStroke;

/**
 * Popup for quick entry of start time and duration, used by ScoreTimeCanvas
 *
 * @author Steven Yi
 * @version 1.0
 */
public class QuickTimeDialog extends JDialog {

    private final LabelledItemPanel itemPanel = new LabelledItemPanel();

    private final SoundObjectTimePanel startTimePanel = new SoundObjectTimePanel();

    private final SoundObjectTimePanel durationPanel = new SoundObjectTimePanel();

    private ScoreObject scoreObj;

    public QuickTimeDialog(Frame owner) {
        super(owner);
        this.setTitle(BlueSystem.getString("scoreGUI.quickTimeDialog.title"));
        durationPanel.setDurationMode(true);

        itemPanel.addItem(BlueSystem
                .getString("soundObjectProperties.startTime"), startTimePanel);
        itemPanel
                .addItem(BlueSystem
                        .getString("soundObjectProperties.subjectiveDuration"),
                        durationPanel);

        this.addWindowListener(new WindowAdapter() {

            @Override
            public void windowDeactivated(WindowEvent e) {
                hide();
            }
        });
        registerKeyboardActions();
        registerTextFieldCommitActions(startTimePanel);
        registerTextFieldCommitActions(durationPanel);

        this.getContentPane().setLayout(new BorderLayout());
        this.getContentPane().add(itemPanel, BorderLayout.CENTER);
        this.pack();

        blue.utility.GUI.centerOnScreen(this);
    }

    private void registerKeyboardActions() {
        getRootPane().registerKeyboardAction(e -> hide(),
                KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0),
                JComponent.WHEN_IN_FOCUSED_WINDOW);
    }

    private void registerTextFieldCommitActions(Component component) {
        if (component instanceof TimeUnitTextField timeField) {
            timeField.addActionListener(e -> handleWindowDeactivated());
            return;
        }

        if (component instanceof Container container) {
            for (Component child : container.getComponents()) {
                registerTextFieldCommitActions(child);
            }
        }
    }

    private boolean requestFocusOnTimeField(Component component) {
        if (component instanceof TimeUnitTextField timeField) {
            return timeField.requestFocusInWindow();
        }

        if (component instanceof Container container) {
            for (Component child : container.getComponents()) {
                if (requestFocusOnTimeField(child)) {
                    return true;
                }
            }
        }

        return false;
    }

    private void handleWindowDeactivated() {
        if (scoreObj != null) {
            TimePosition newStart = startTimePanel.getTimePosition();
            TimeDuration newSubjectiveDuration = durationPanel.getTimeDuration();

            if (newStart == null || newSubjectiveDuration == null) {
                JOptionPane
                        .showMessageDialog(
                                null,
                                BlueSystem
                                .getString(
                                        "scoreGUI.quickTimeDialog.notDouble.message"),
                                BlueSystem
                                .getString(
                                        "scoreGUI.quickTimeDialog.notDouble.title"),
                                JOptionPane.ERROR_MESSAGE);
                this.show();
                requestFocusOnTimeField(startTimePanel);
                return;
            }

            TimePosition initialStart = scoreObj.getStartTime();
            TimeDuration initialSubjectiveDuration = scoreObj.getSubjectiveDuration();
            TimeContext context = TimeContextManager.getContext();

            BlueUndoManager.setUndoManager("score");

            StartTimeEdit edit = null;
            if (Double.compare(initialStart.toBeats(context), newStart.toBeats(context)) != 0) {
                scoreObj.setStartTime(newStart);
                edit = new StartTimeEdit(initialStart, newStart, scoreObj);
                BlueUndoManager.addEdit(edit);
            }

            if (Double.compare(
                    initialSubjectiveDuration.toBeats(context),
                    newSubjectiveDuration.toBeats(context)) != 0) {
                scoreObj.setSubjectiveDuration(newSubjectiveDuration);
                DurationScoreObjectEdit resizeEdit = new DurationScoreObjectEdit(
                        scoreObj, initialSubjectiveDuration, newSubjectiveDuration);

                if (edit != null) {
                    edit.addEdit(resizeEdit);
                } else {
                    BlueUndoManager.addEdit(resizeEdit);
                }
            }
        }
        hide();
    }

    public void show(ScoreObject scoreObject) {
        this.scoreObj = scoreObject;
        // Point p = new Point(sObjView.getX(), sObjView.getY());
        // SwingUtilities.convertPointToScreen(p, stCanvas);
        // this.setLocation(p.x, p.y - this.getHeight());

        startTimePanel.setTimePosition(scoreObj.getStartTime());
        durationPanel.setTimeDuration(scoreObj.getSubjectiveDuration());

        super.show();
        requestFocusOnTimeField(startTimePanel);
    }

}
