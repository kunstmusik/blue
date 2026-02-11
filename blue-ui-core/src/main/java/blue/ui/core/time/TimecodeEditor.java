package blue.ui.core.time;

import blue.time.TimeContext;
import blue.time.TimePosition;
import java.awt.BorderLayout;
import java.awt.Toolkit;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import javax.swing.JTextField;

public class TimecodeEditor extends TimeUnitEditor {

    public enum Mode {
        TIME,
        SMPTE
    }

    private final Mode mode;
    private final JTextField textField;

    private String lastValidText = "";
    private TimePosition pendingTimePosition = null;

    public TimecodeEditor(Mode mode) {
        super();
        this.mode = mode;

        setLayout(new BorderLayout());

        textField = new JTextField();
        textField.setColumns(mode == Mode.TIME ? 12 : 11);
        textField.addActionListener(e -> commit());
        textField.addFocusListener(new FocusAdapter() {
            @Override
            public void focusLost(FocusEvent e) {
                commit();
            }
        });

        add(textField, BorderLayout.CENTER);
    }

    private void commit() {
        if (isUpdating()) {
            return;
        }

        TimePosition parsed;
        try {
            parsed = parse(textField.getText());
        } catch (RuntimeException ex) {
            Toolkit.getDefaultToolkit().beep();
            textField.setText(lastValidText);
            return;
        }

        pendingTimePosition = parsed;
        try {
            fireStateChanged();
        } finally {
            pendingTimePosition = null;
        }
    }

    @Override
    protected void updateDisplay() {
        TimePosition timePosition = getTimePosition();

        if (mode == Mode.TIME) {
            if (timePosition instanceof TimePosition.TimeValue timeValue) {
                lastValidText = formatTime(timeValue.getHours(), timeValue.getMinutes(), timeValue.getSeconds(), timeValue.getMilliseconds());
            } else {
                lastValidText = formatTime(0, 0, 0, 0);
            }
        } else {
            // SMPTE is display-only — internally stored as TimeValue
            if (timePosition instanceof TimePosition.TimeValue tv) {
                double totalSeconds = tv.getHours() * 3600.0 + tv.getMinutes() * 60.0
                        + tv.getSeconds() + tv.getMilliseconds() / 1000.0;
                lastValidText = TimeUnitTextField.formatSecondsAsSMPTE(
                        totalSeconds, TimeContext.DEFAULT_SMPTE_FRAME_RATE);
            } else {
                lastValidText = formatSmpte(0, 0, 0, 0);
            }
        }

        textField.setText(lastValidText);
    }

    @Override
    protected TimePosition updateModel() {
        if (pendingTimePosition != null) {
            lastValidText = format(pendingTimePosition);
            return pendingTimePosition;
        }

        TimePosition parsed = parse(textField.getText());
        lastValidText = format(parsed);
        return parsed;
    }

    @Override
    protected void enableComponents(boolean enabled) {
        textField.setEnabled(enabled);
    }

    private TimePosition parse(String text) {
        String trimmed = text == null ? "" : text.trim();
        if (trimmed.isEmpty()) {
            return TimePosition.TimeValue.ZERO;
        }

        if (mode == Mode.TIME) {
            return parseTime(trimmed);
        }

        return parseSmpte(trimmed);
    }

    private String format(TimePosition timePosition) {
        if (timePosition instanceof TimePosition.TimeValue tv) {
            if (mode == Mode.SMPTE) {
                double totalSeconds = tv.getHours() * 3600.0 + tv.getMinutes() * 60.0
                        + tv.getSeconds() + tv.getMilliseconds() / 1000.0;
                return TimeUnitTextField.formatSecondsAsSMPTE(
                        totalSeconds, TimeContext.DEFAULT_SMPTE_FRAME_RATE);
            }
            return formatTime(tv.getHours(), tv.getMinutes(), tv.getSeconds(), tv.getMilliseconds());
        }
        return "";
    }

    private static String formatTime(long hours, long minutes, long seconds, long milliseconds) {
        return String.format("%d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
    }

    private static String formatSmpte(long hours, long minutes, long seconds, long frames) {
        return String.format("%d:%02d:%02d:%02d", hours, minutes, seconds, frames);
    }

    private static TimePosition parseTime(String text) {
        String[] parts = text.split(":");

        long hours = 0;
        long minutes;
        String secPart;

        if (parts.length == 3) {
            hours = parseNonNegativeLong(parts[0]);
            minutes = parseMinuteSecond(parts[1]);
            secPart = parts[2];
        } else if (parts.length == 2) {
            long totalMinutes = parseNonNegativeLong(parts[0]);
            hours = totalMinutes / 60;
            minutes = totalMinutes % 60;
            secPart = parts[1];
        } else {
            throw new IllegalArgumentException();
        }

        String[] secParts = secPart.split("\\.");
        long seconds = parseMinuteSecond(secParts[0]);
        long milliseconds = 0;
        if (secParts.length == 2) {
            milliseconds = parseMilliseconds(secParts[1]);
        } else if (secParts.length > 2) {
            throw new IllegalArgumentException();
        }

        return TimePosition.time(hours, minutes, seconds, milliseconds);
    }

    /**
     * Parses SMPTE timecode text (HH:MM:SS:FF) into a TimeValue.
     * SMPTE is display-only — frames are converted to milliseconds.
     */
    private static TimePosition parseSmpte(String text) {
        long frameRate = (long) TimeContext.DEFAULT_SMPTE_FRAME_RATE;

        String[] parts = text.split(":");

        long hours = 0;
        long minutes;
        long seconds;
        long frames;

        if (parts.length == 4) {
            hours = parseNonNegativeLong(parts[0]);
            minutes = parseMinuteSecond(parts[1]);
            seconds = parseMinuteSecond(parts[2]);
            frames = parseFrames(parts[3], frameRate);
        } else if (parts.length == 3) {
            long totalMinutes = parseNonNegativeLong(parts[0]);
            hours = totalMinutes / 60;
            minutes = totalMinutes % 60;
            seconds = parseMinuteSecond(parts[1]);
            frames = parseFrames(parts[2], frameRate);
        } else {
            throw new IllegalArgumentException();
        }

        // Convert frames to milliseconds and produce a TimeValue
        long milliseconds = (long) (frames * 1000.0 / frameRate);
        return TimePosition.time(hours, minutes, seconds, milliseconds);
    }

    private static long parseNonNegativeLong(String text) {
        long val = Long.parseLong(text.trim());
        if (val < 0) {
            throw new IllegalArgumentException();
        }
        return val;
    }

    private static long parseMinuteSecond(String text) {
        long val = Long.parseLong(text.trim());
        if (val < 0 || val >= 60) {
            throw new IllegalArgumentException();
        }
        return val;
    }

    private static long parseMilliseconds(String text) {
        String t = text.trim();
        if (t.isEmpty()) {
            return 0;
        }
        long val = Long.parseLong(t);
        if (val < 0 || val >= 1000) {
            throw new IllegalArgumentException();
        }
        return val;
    }

    private static long parseFrames(String text, long frameRate) {
        long val = Long.parseLong(text.trim());
        if (val < 0 || val >= frameRate) {
            throw new IllegalArgumentException();
        }
        return val;
    }
}
