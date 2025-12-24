package blue.ui.core.time;

import blue.time.TimeUnit;
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
    private TimeUnit pendingTimeUnit = null;

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

        TimeUnit parsed;
        try {
            parsed = parse(textField.getText());
        } catch (RuntimeException ex) {
            Toolkit.getDefaultToolkit().beep();
            textField.setText(lastValidText);
            return;
        }

        pendingTimeUnit = parsed;
        try {
            fireStateChanged();
        } finally {
            pendingTimeUnit = null;
        }
    }

    @Override
    protected void updateDisplay() {
        TimeUnit timeUnit = getTimeUnit();

        if (mode == Mode.TIME) {
            if (timeUnit instanceof TimeUnit.TimeValue timeValue) {
                lastValidText = formatTime(timeValue.getHours(), timeValue.getMinutes(), timeValue.getSeconds(), timeValue.getMilliseconds());
            } else {
                lastValidText = formatTime(0, 0, 0, 0);
            }
        } else {
            if (timeUnit instanceof TimeUnit.SMPTEValue smpteValue) {
                lastValidText = formatSmpte(smpteValue.getHours(), smpteValue.getMinutes(), smpteValue.getSeconds(), smpteValue.getFrames());
            } else {
                lastValidText = formatSmpte(0, 0, 0, 0);
            }
        }

        textField.setText(lastValidText);
    }

    @Override
    protected TimeUnit updateModel() {
        if (pendingTimeUnit != null) {
            lastValidText = format(pendingTimeUnit);
            return pendingTimeUnit;
        }

        TimeUnit parsed = parse(textField.getText());
        lastValidText = format(parsed);
        return parsed;
    }

    @Override
    protected void enableComponents(boolean enabled) {
        textField.setEnabled(enabled);
    }

    private TimeUnit parse(String text) {
        String trimmed = text == null ? "" : text.trim();
        if (trimmed.isEmpty()) {
            return mode == Mode.TIME ? TimeUnit.TimeValue.ZERO : TimeUnit.SMPTEValue.ZERO;
        }

        if (mode == Mode.TIME) {
            return parseTime(trimmed);
        }

        return parseSmpte(trimmed);
    }

    private static String format(TimeUnit timeUnit) {
        if (timeUnit instanceof TimeUnit.TimeValue tv) {
            return formatTime(tv.getHours(), tv.getMinutes(), tv.getSeconds(), tv.getMilliseconds());
        }
        if (timeUnit instanceof TimeUnit.SMPTEValue smpte) {
            return formatSmpte(smpte.getHours(), smpte.getMinutes(), smpte.getSeconds(), smpte.getFrames());
        }
        return "";
    }

    private static String formatTime(long hours, long minutes, long seconds, long milliseconds) {
        return String.format("%d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
    }

    private static String formatSmpte(long hours, long minutes, long seconds, long frames) {
        return String.format("%d:%02d:%02d:%02d", hours, minutes, seconds, frames);
    }

    private static TimeUnit parseTime(String text) {
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

        return TimeUnit.time(hours, minutes, seconds, milliseconds);
    }

    private static TimeUnit parseSmpte(String text) {
        // NOTE: TimeUnit.SMPTEValue currently uses a default 30fps for conversions;
        // keep editor validation aligned with that.
        long frameRate = 30;

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

        return TimeUnit.smpte(hours, minutes, seconds, frames);
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
