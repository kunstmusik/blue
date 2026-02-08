/*
 * blue - object composition environment for csound
 * Copyright (C) 2025
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.time;

import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.time.TimeDuration;
import blue.time.TimeUnit;
import blue.time.TimeUnitMath;
import blue.time.TimeUtilities;
import java.awt.Toolkit;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.util.function.Supplier;
import javax.swing.JTextField;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.EventListenerList;

/**
 * A unified text field for editing TimeUnit values in various formats.
 * Supports parsing and formatting for all TimeBase types:
 * <ul>
 *   <li>CSOUND_BEATS: decimal number (e.g., "4.5", "12.25")</li>
 *   <li>BBT: bar.beat.ticks (e.g., "1.1.0", "2.3.240")</li>
 *   <li>BBST: bar.beat.sixteenth.ticks (e.g., "1.1.1.0", "2.3.2.60")</li>
 *   <li>BBF: bar.beat.fraction (e.g., "1.1.0", "2.3.50")</li>
 *   <li>TIME: H:MM:SS.mmm (e.g., "0:00:00.000", "1:30:45.500")</li>
 *   <li>SMPTE: HH:MM:SS:FF (e.g., "00:00:00:00", "01:30:45:15")</li>
 *   <li>FRAME: integer sample number (e.g., "0", "44100", "88200")</li>
 * </ul>
 * 
 * @author steven yi
 */
public class TimeUnitTextField extends JTextField {

    private TimeBase timeBase = TimeBase.CSOUND_BEATS;
    private TimeUnit timeUnit;
    private String lastValidText = "";
    private boolean updating = false;
    private int ppq = 480; // Default PPQ for BBT/BBST conversions
    private boolean durationMode = false;
    private Supplier<TimeContext> timeContextSupplier;
    
    protected EventListenerList listenerList = new EventListenerList();

    public TimeUnitTextField() {
        super();
        setColumns(14);
        
        addActionListener(e -> commit());
        addFocusListener(new FocusAdapter() {
            @Override
            public void focusLost(FocusEvent e) {
                commit();
            }
        });
        
        updatePlaceholder();
    }

    /**
     * Gets the current TimeBase format.
     */
    public TimeBase getTimeBase() {
        return timeBase;
    }

    /**
     * Sets the TimeBase format for parsing and display.
     * This will reformat the current value if one is set.
     */
    public void setTimeBase(TimeBase timeBase) {
        if (this.timeBase == timeBase) {
            return;
        }
        this.timeBase = timeBase;
        updatePlaceholder();
        
        // Reformat current value if set
        if (timeUnit != null) {
            updateDisplay();
        }
    }

    /**
     * Gets the PPQ (Pulses Per Quarter note) for BBT/BBST conversions.
     */
    public int getPPQ() {
        return ppq;
    }

    /**
     * Sets the PPQ for BBT/BBST conversions.
     */
    public void setPPQ(int ppq) {
        this.ppq = ppq;
    }

    /**
     * Gets the current TimeUnit value.
     */
    public TimeUnit getTimeUnit() {
        return timeUnit;
    }

    /**
     * Sets the TimeUnit value to display.
     */
    public void setTimeUnit(TimeUnit timeUnit) {
        this.timeUnit = timeUnit;
        updating = true;
        try {
            updateDisplay();
        } finally {
            updating = false;
        }
    }

    private void updateDisplay() {
        if (timeUnit == null) {
            lastValidText = "";
            setText("");
            return;
        }
        
        if (durationMode && timeContextSupplier != null) {
            lastValidText = formatDuration(timeUnit, timeBase, ppq, timeContextSupplier.get());
        } else {
            lastValidText = format(timeUnit, timeBase, ppq);
        }
        setText(lastValidText);
    }

    /**
     * Sets duration mode. In duration mode, measure-based formats (BBT, BBST, BBF)
     * use 0-based bars/beats for display and parsing.
     */
    public void setDurationMode(boolean durationMode) {
        this.durationMode = durationMode;
        updatePlaceholder();
        if (timeUnit != null) {
            updating = true;
            try {
                updateDisplay();
            } finally {
                updating = false;
            }
        }
    }

    public boolean isDurationMode() {
        return durationMode;
    }

    /**
     * Sets the TimeContext supplier for duration mode conversions.
     */
    public void setTimeContextSupplier(Supplier<TimeContext> supplier) {
        this.timeContextSupplier = supplier;
    }

    private void updatePlaceholder() {
        setToolTipText(durationMode ? getDurationFormatHint(timeBase) : getFormatHint(timeBase));
    }

    private void commit() {
        if (updating) {
            return;
        }

        String text = getText().trim();
        if (text.equals(lastValidText)) {
            return; // No change
        }

        TimeUnit parsed;
        try {
            if (durationMode && timeContextSupplier != null) {
                parsed = parseDuration(text, timeBase, ppq, timeContextSupplier.get());
            } else {
                parsed = parse(text, timeBase, ppq);
            }
        } catch (RuntimeException ex) {
            Toolkit.getDefaultToolkit().beep();
            setText(lastValidText);
            return;
        }

        timeUnit = parsed;
        if (durationMode && timeContextSupplier != null) {
            lastValidText = formatDuration(parsed, timeBase, ppq, timeContextSupplier.get());
        } else {
            lastValidText = format(parsed, timeBase, ppq);
        }
        setText(lastValidText);
        fireStateChanged();
    }

    /**
     * Adds a ChangeListener to be notified when the TimeUnit value changes.
     */
    public void addChangeListener(ChangeListener listener) {
        listenerList.add(ChangeListener.class, listener);
    }

    /**
     * Removes a ChangeListener.
     */
    public void removeChangeListener(ChangeListener listener) {
        listenerList.remove(ChangeListener.class, listener);
    }

    protected void fireStateChanged() {
        ChangeEvent event = new ChangeEvent(this);
        for (ChangeListener listener : listenerList.getListeners(ChangeListener.class)) {
            listener.stateChanged(event);
        }
    }

    // ========== Format Hints ==========

    private static String getFormatHint(TimeBase timeBase) {
        return switch (timeBase) {
            case CSOUND_BEATS -> "Format: decimal beats (e.g., 4.5, 12.25)";
            case BBT -> "Format: bar.beat.ticks (e.g., 1.1.0, 2.3.240)";
            case BBST -> "Format: bar.beat.16th.ticks (e.g., 1.1.1.0, 2.3.2.60)";
            case BBF -> "Format: bar.beat.fraction (e.g., 1.1.0, 2.3.50)";
            case TIME -> "Format: H:MM:SS.mmm (e.g., 0:00:00.000)";
            case SMPTE -> "Format: HH:MM:SS:FF (e.g., 00:00:00:00)";
            case FRAME -> "Format: sample frames (e.g., 44100)";
        };
    }

    private static String getDurationFormatHint(TimeBase timeBase) {
        return switch (timeBase) {
            case CSOUND_BEATS -> "Duration: decimal beats (e.g., 4.0, 0.5)";
            case BBT -> "Duration: bars.beats.ticks (0-based, e.g., 0.0.0, 1.2.240)";
            case BBST -> "Duration: bars.beats.16th.ticks (0-based, e.g., 0.0.0.0, 1.2.1.60)";
            case BBF -> "Duration: bars.beats.fraction (0-based, e.g., 0.0.00, 1.2.50)";
            case TIME -> "Duration: H:MM:SS.mmm (e.g., 0:00:04.000)";
            case SMPTE -> "Duration: HH:MM:SS:FF (e.g., 00:00:04:00)";
            case FRAME -> "Duration: sample frames (e.g., 44100)";
        };
    }

    // ========== Formatting ==========

    /**
     * Formats a TimeUnit to a string representation for the given TimeBase.
     */
    public static String format(TimeUnit timeUnit, TimeBase timeBase, int ppq) {
        return switch (timeBase) {
            case CSOUND_BEATS -> formatBeats(timeUnit);
            case BBT -> formatBBT(timeUnit, ppq);
            case BBST -> formatBBST(timeUnit, ppq);
            case BBF -> formatBBF(timeUnit);
            case TIME -> formatTime(timeUnit);
            case SMPTE -> formatSMPTE(timeUnit);
            case FRAME -> formatFrames(timeUnit);
        };
    }

    private static String formatBeats(TimeUnit timeUnit) {
        if (timeUnit instanceof TimeUnit.BeatTime bt) {
            double beats = bt.getCsoundBeats();
            if (beats == Math.floor(beats)) {
                return String.format("%.1f", beats);
            }
            return String.format("%.4f", beats).replaceAll("0+$", "").replaceAll("\\.$", ".0");
        }
        return "0.0";
    }

    private static String formatBBT(TimeUnit timeUnit, int ppq) {
        if (timeUnit instanceof TimeUnit.BBTTime bbt) {
            return String.format("%d.%d.%d", bbt.getBar(), bbt.getBeat(), bbt.getTicks());
        }
        if (timeUnit instanceof TimeUnit.BBSTTime bbst) {
            // Convert BBST to BBT
            int totalTicks = (bbst.getSixteenth() - 1) * (ppq / 4) + bbst.getTicks();
            return String.format("%d.%d.%d", bbst.getBar(), bbst.getBeat(), totalTicks);
        }
        return "1.1.0";
    }

    private static String formatBBST(TimeUnit timeUnit, int ppq) {
        if (timeUnit instanceof TimeUnit.BBSTTime bbst) {
            return String.format("%d.%d.%d.%d", bbst.getBar(), bbst.getBeat(), 
                    bbst.getSixteenth(), bbst.getTicks());
        }
        if (timeUnit instanceof TimeUnit.BBTTime bbt) {
            // Convert BBT to BBST
            int ticksPerSixteenth = ppq / 4;
            int sixteenth = (bbt.getTicks() / ticksPerSixteenth) + 1;
            int ticks = bbt.getTicks() % ticksPerSixteenth;
            return String.format("%d.%d.%d.%d", bbt.getBar(), bbt.getBeat(), sixteenth, ticks);
        }
        return "1.1.1.0";
    }

    private static String formatBBF(TimeUnit timeUnit) {
        if (timeUnit instanceof TimeUnit.BBFTime bbf) {
            return String.format("%d.%d.%d", bbf.getBar(), bbf.getBeat(), bbf.getFraction());
        }
        return "1.1.0";
    }

    private static String formatTime(TimeUnit timeUnit) {
        if (timeUnit instanceof TimeUnit.TimeValue tv) {
            return String.format("%d:%02d:%02d.%03d", 
                    tv.getHours(), tv.getMinutes(), tv.getSeconds(), tv.getMilliseconds());
        }
        return "0:00:00.000";
    }

    private static String formatSMPTE(TimeUnit timeUnit) {
        if (timeUnit instanceof TimeUnit.SMPTEValue smpte) {
            return String.format("%02d:%02d:%02d:%02d", 
                    smpte.getHours(), smpte.getMinutes(), smpte.getSeconds(), smpte.getFrames());
        }
        return "00:00:00:00";
    }

    private static String formatFrames(TimeUnit timeUnit) {
        if (timeUnit instanceof TimeUnit.FrameValue fv) {
            return String.valueOf(fv.getFrameNumber());
        }
        return "0";
    }

    // ========== Parsing ==========

    /**
     * Parses a string to a TimeUnit for the given TimeBase.
     */
    public static TimeUnit parse(String text, TimeBase timeBase, int ppq) {
        String trimmed = text == null ? "" : text.trim();
        
        return switch (timeBase) {
            case CSOUND_BEATS -> parseBeats(trimmed);
            case BBT -> parseBBT(trimmed);
            case BBST -> parseBBST(trimmed);
            case BBF -> parseBBF(trimmed);
            case TIME -> parseTime(trimmed);
            case SMPTE -> parseSMPTE(trimmed);
            case FRAME -> parseFrames(trimmed);
        };
    }

    private static TimeUnit parseBeats(String text) {
        if (text.isEmpty()) {
            return TimeUnit.beats(0.0);
        }
        double beats = Double.parseDouble(text);
        if (beats < 0) {
            throw new IllegalArgumentException("Beats cannot be negative");
        }
        return TimeUnit.beats(beats);
    }

    private static TimeUnit parseBBT(String text) {
        if (text.isEmpty()) {
            return TimeUnit.bbt(1, 1, 0);
        }
        
        String[] parts = text.split("\\.");
        if (parts.length < 2 || parts.length > 3) {
            throw new IllegalArgumentException("BBT format: bar.beat.ticks");
        }
        
        long bar = Long.parseLong(parts[0].trim());
        int beat = Integer.parseInt(parts[1].trim());
        int ticks = parts.length == 3 ? Integer.parseInt(parts[2].trim()) : 0;
        
        return TimeUnit.bbt(bar, beat, ticks);
    }

    private static TimeUnit parseBBST(String text) {
        if (text.isEmpty()) {
            return TimeUnit.bbst(1, 1, 1, 0);
        }
        
        String[] parts = text.split("\\.");
        if (parts.length < 3 || parts.length > 4) {
            throw new IllegalArgumentException("BBST format: bar.beat.sixteenth.ticks");
        }
        
        long bar = Long.parseLong(parts[0].trim());
        int beat = Integer.parseInt(parts[1].trim());
        int sixteenth = Integer.parseInt(parts[2].trim());
        int ticks = parts.length == 4 ? Integer.parseInt(parts[3].trim()) : 0;
        
        return TimeUnit.bbst(bar, beat, sixteenth, ticks);
    }

    private static TimeUnit parseBBF(String text) {
        if (text.isEmpty()) {
            return TimeUnit.bbf(1, 1, 0);
        }
        
        String[] parts = text.split("\\.");
        if (parts.length < 2 || parts.length > 3) {
            throw new IllegalArgumentException("BBF format: bar.beat.fraction");
        }
        
        long bar = Long.parseLong(parts[0].trim());
        int beat = Integer.parseInt(parts[1].trim());
        int fraction = parts.length == 3 ? Integer.parseInt(parts[2].trim()) : 0;
        
        return TimeUnit.bbf(bar, beat, fraction);
    }

    private static TimeUnit parseTime(String text) {
        if (text.isEmpty()) {
            return TimeUnit.TimeValue.ZERO;
        }
        
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
            throw new IllegalArgumentException("Time format: H:MM:SS.mmm");
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

    private static TimeUnit parseSMPTE(String text) {
        if (text.isEmpty()) {
            return TimeUnit.SMPTEValue.ZERO;
        }
        
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
            frames = parseFrameNumber(parts[3], frameRate);
        } else if (parts.length == 3) {
            long totalMinutes = parseNonNegativeLong(parts[0]);
            hours = totalMinutes / 60;
            minutes = totalMinutes % 60;
            seconds = parseMinuteSecond(parts[1]);
            frames = parseFrameNumber(parts[2], frameRate);
        } else {
            throw new IllegalArgumentException("SMPTE format: HH:MM:SS:FF");
        }

        return TimeUnit.smpte(hours, minutes, seconds, frames);
    }

    private static TimeUnit parseFrames(String text) {
        if (text.isEmpty()) {
            return TimeUnit.frames(0);
        }
        long frames = Long.parseLong(text);
        if (frames < 0) {
            throw new IllegalArgumentException("Frames cannot be negative");
        }
        return TimeUnit.frames(frames);
    }

    // ========== Duration Formatting ==========

    /**
     * Formats a TimeUnit as a duration string. For measure-based formats (BBT, BBST, BBF),
     * uses 0-based bars/beats. For other formats, delegates to regular format.
     */
    public static String formatDuration(TimeUnit timeUnit, TimeBase timeBase, int ppq, TimeContext context) {
        return switch (timeBase) {
            case CSOUND_BEATS -> formatBeats(timeUnit);
            case BBT -> {
                TimeDuration dur = TimeUnitMath.fromTimeUnit(timeUnit, TimeBase.BBT, context);
                if (dur instanceof TimeDuration.DurationBBT d) {
                    yield String.format("%d.%d.%d", d.getBars(), d.getBeats(), d.getTicks());
                }
                yield "0.0.0";
            }
            case BBST -> {
                TimeDuration dur = TimeUnitMath.fromTimeUnit(timeUnit, TimeBase.BBST, context);
                if (dur instanceof TimeDuration.DurationBBST d) {
                    yield String.format("%d.%d.%d.%d", d.getBars(), d.getBeats(), d.getSixteenth(), d.getTicks());
                }
                yield "0.0.0.0";
            }
            case BBF -> {
                TimeDuration dur = TimeUnitMath.fromTimeUnit(timeUnit, TimeBase.BBF, context);
                if (dur instanceof TimeDuration.DurationBBF d) {
                    yield String.format("%d.%d.%02d", d.getBars(), d.getBeats(), d.getFraction());
                }
                yield "0.0.00";
            }
            case TIME -> formatTime(timeUnit);
            case SMPTE -> formatSMPTE(timeUnit);
            case FRAME -> formatFrames(timeUnit);
        };
    }

    // ========== Duration Parsing ==========

    /**
     * Parses a duration string to a TimeUnit. For measure-based formats (BBT, BBST, BBF),
     * interprets values as 0-based and converts through beats to the target TimeBase.
     */
    public static TimeUnit parseDuration(String text, TimeBase timeBase, int ppq, TimeContext context) {
        String trimmed = text == null ? "" : text.trim();

        return switch (timeBase) {
            case CSOUND_BEATS -> parseBeats(trimmed);
            case BBT -> {
                if (trimmed.isEmpty()) yield TimeUnit.beats(0.0);
                String[] parts = trimmed.split("\\.");
                if (parts.length < 2 || parts.length > 3)
                    throw new IllegalArgumentException("Duration BBT format: bars.beats.ticks");
                long bars = Long.parseLong(parts[0].trim());
                int beats = Integer.parseInt(parts[1].trim());
                int ticks = parts.length == 3 ? Integer.parseInt(parts[2].trim()) : 0;
                TimeDuration dur = TimeDuration.bbt(bars, beats, ticks);
                double totalBeats = dur.toBeats(context);
                yield TimeUtilities.beatsToTimeUnit(totalBeats, TimeBase.BBT, context);
            }
            case BBST -> {
                if (trimmed.isEmpty()) yield TimeUnit.beats(0.0);
                String[] parts = trimmed.split("\\.");
                if (parts.length < 3 || parts.length > 4)
                    throw new IllegalArgumentException("Duration BBST format: bars.beats.16th.ticks");
                long bars = Long.parseLong(parts[0].trim());
                int beats = Integer.parseInt(parts[1].trim());
                int sixteenth = Integer.parseInt(parts[2].trim());
                int ticks = parts.length == 4 ? Integer.parseInt(parts[3].trim()) : 0;
                TimeDuration dur = TimeDuration.bbst(bars, beats, sixteenth, ticks);
                double totalBeats = dur.toBeats(context);
                yield TimeUtilities.beatsToTimeUnit(totalBeats, TimeBase.BBST, context);
            }
            case BBF -> {
                if (trimmed.isEmpty()) yield TimeUnit.beats(0.0);
                String[] parts = trimmed.split("\\.");
                if (parts.length < 2 || parts.length > 3)
                    throw new IllegalArgumentException("Duration BBF format: bars.beats.fraction");
                long bars = Long.parseLong(parts[0].trim());
                int beats = Integer.parseInt(parts[1].trim());
                int fraction = parts.length == 3 ? Integer.parseInt(parts[2].trim()) : 0;
                TimeDuration dur = TimeDuration.bbf(bars, beats, fraction);
                double totalBeats = dur.toBeats(context);
                yield TimeUtilities.beatsToTimeUnit(totalBeats, TimeBase.BBF, context);
            }
            case TIME -> parseTime(trimmed);
            case SMPTE -> parseSMPTE(trimmed);
            case FRAME -> parseFrames(trimmed);
        };
    }

    // ========== Parse Helpers ==========

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

    private static long parseFrameNumber(String text, long frameRate) {
        long val = Long.parseLong(text.trim());
        if (val < 0 || val >= frameRate) {
            throw new IllegalArgumentException();
        }
        return val;
    }
}
