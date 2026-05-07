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
import blue.time.TimePosition;
import blue.time.TimeUnitMath;
import blue.time.TimeUtilities;
import java.awt.Toolkit;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.function.Supplier;
import javax.swing.JTextField;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.EventListenerList;

/**
 * A unified text field for editing TimePosition values in various formats.
 * Supports parsing and formatting for all TimeBase types:
 * <ul>
 *   <li>BEATS: decimal number (e.g., "4.5", "12.25")</li>
 *   <li>BBT: bar.beat.ticks (e.g., "1.1.0", "2.3.240")</li>
 *   <li>BBST: bar.beat.sixteenth.ticks (e.g., "1.1.1.0", "2.3.2.60")</li>
 *   <li>BBF: bar.beat.fraction, normalized to two digits (e.g., "1.1.00", "2.3.50")</li>
 *   <li>TIME: H:MM:SS.mmm (e.g., "0:00:00.000", "1:30:45.500")</li>
 *   <li>SMPTE: HH:MM:SS:FF (e.g., "00:00:00:00", "01:30:45:15")</li>
 *   <li>FRAME: integer sample number (e.g., "0", "44100", "88200")</li>
 * </ul>
 * 
 * @author steven yi
 */
public class TimeUnitTextField extends JTextField {

    private TimeBase timeBase = TimeBase.BEATS;
    private TimePosition timePosition;
    private String lastValidText = "";
    private boolean updating = false;
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
        if (timePosition != null) {
            updateDisplay();
        }
    }

    /**
     * Gets the current TimePosition value.
     */
    public TimePosition getTimePosition() {
        return timePosition;
    }

    /**
     * Sets the TimePosition value to display.
     */
    public void setTimePosition(TimePosition timePosition) {
        this.timePosition = timePosition;
        updating = true;
        try {
            updateDisplay();
        } finally {
            updating = false;
        }
    }

    private void updateDisplay() {
        if (timePosition == null) {
            lastValidText = "";
            setText("");
            return;
        }
        
        TimeContext context = getTimeContext();
        if (durationMode && context != null) {
            lastValidText = formatDuration(timePosition, timeBase, context);
        } else {
            lastValidText = format(timePosition, timeBase, context);
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
        if (timePosition != null) {
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
     * Sets the TimeContext supplier for context-dependent parsing and formatting.
     */
    public void setTimeContextSupplier(Supplier<TimeContext> supplier) {
        this.timeContextSupplier = supplier;
    }

    private TimeContext getTimeContext() {
        return timeContextSupplier == null ? null : timeContextSupplier.get();
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

        TimeContext context = getTimeContext();
        TimePosition parsed;
        try {
            if (durationMode && context != null) {
                parsed = parseDuration(text, timeBase, context);
            } else {
                parsed = parse(text, timeBase, context);
            }
        } catch (RuntimeException ex) {
            Toolkit.getDefaultToolkit().beep();
            setText(lastValidText);
            return;
        }

        timePosition = parsed;
        if (durationMode && context != null) {
            lastValidText = formatDuration(parsed, timeBase, context);
        } else {
            lastValidText = format(parsed, timeBase, context);
        }
        setText(lastValidText);
        fireStateChanged();
    }

    /**
     * Adds a ChangeListener to be notified when the TimePosition value changes.
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
            case BEATS -> "Format: decimal beats (e.g., 4.5, 12.25)";
            case BBT -> "Format: bar.beat.ticks (e.g., 1.1.0, 2.3.240)";
            case BBST -> "Format: bar.beat.16th.ticks (e.g., 1.1.1.0, 2.3.2.60)";
            case BBF -> "Format: bar.beat.fraction (normalized to two digits, e.g., 1.1.00, 2.3.50)";
            case TIME -> "Format: H:MM:SS.mmm (e.g., 0:00:00.000)";
            case SECONDS -> "Format: decimal seconds (e.g., 12.345, 0.5)";
            case SMPTE -> "Format: HH:MM:SS:FF (e.g., 00:00:00:00)";
            case FRAME -> "Format: sample frames (e.g., 44100)";
        };
    }

    private static String getDurationFormatHint(TimeBase timeBase) {
        return switch (timeBase) {
            case BEATS -> "Duration: decimal beats (e.g., 4.0, 0.5)";
            case BBT -> "Duration: bars.beats.ticks (0-based, e.g., 0.0.0, 1.2.240)";
            case BBST -> "Duration: bars.beats.16th.ticks (0-based, e.g., 0.0.0.0, 1.2.1.60)";
            case BBF -> "Duration: bars.beats.fraction (0-based, normalized to two digits, e.g., 0.0.00, 1.2.50)";
            case TIME -> "Duration: H:MM:SS.mmm (e.g., 0:00:04.000)";
            case SECONDS -> "Duration: decimal seconds (e.g., 4.0, 0.5)";
            case SMPTE -> "Duration: HH:MM:SS:FF (e.g., 00:00:04:00)";
            case FRAME -> "Duration: sample frames (e.g., 44100)";
        };
    }

    // ========== Formatting ==========

    /**
     * Formats a TimePosition to a string representation for the given TimeBase.
     * PPQ is fixed at {@link TimeContext#DEFAULT_PPQ} (960).
     */
    public static String format(TimePosition timePosition, TimeBase timeBase) {
        return format(timePosition, timeBase, null);
    }

    /**
     * Formats a TimePosition to a string representation for the given TimeBase.
     * Uses the supplied TimeContext for context-dependent formats such as SMPTE.
     */
    public static String format(TimePosition timePosition, TimeBase timeBase, TimeContext context) {
        int ppq = TimeContext.DEFAULT_PPQ;
        return switch (timeBase) {
            case BEATS -> formatBeats(timePosition);
            case BBT -> formatBBT(timePosition, ppq);
            case BBST -> formatBBST(timePosition, ppq);
            case BBF -> formatBBF(timePosition);
            case TIME -> formatTime(timePosition);
            case SECONDS -> formatSeconds(timePosition, context);
            case SMPTE -> formatSMPTE(timePosition, context);
            case FRAME -> formatFrames(timePosition);
        };
    }

    private static String formatBeats(TimePosition timePosition) {
        if (timePosition instanceof TimePosition.BeatTime bt) {
            double beats = bt.getCsoundBeats();
            if (beats == Math.floor(beats)) {
                return String.format("%.1f", beats);
            }
            return String.format("%.4f", beats).replaceAll("0+$", "").replaceAll("\\.$", ".0");
        }
        return "0.0";
    }

    private static String formatBBT(TimePosition timePosition, int ppq) {
        if (timePosition instanceof TimePosition.BBTTime bbt) {
            return String.format("%d.%d.%d", bbt.getBar(), bbt.getBeat(), bbt.getTicks());
        }
        if (timePosition instanceof TimePosition.BBSTTime bbst) {
            // Convert BBST to BBT
            int totalTicks = (bbst.getSixteenth() - 1) * (ppq / 4) + bbst.getTicks();
            return String.format("%d.%d.%d", bbst.getBar(), bbst.getBeat(), totalTicks);
        }
        return "1.1.0";
    }

    private static String formatBBST(TimePosition timePosition, int ppq) {
        if (timePosition instanceof TimePosition.BBSTTime bbst) {
            return String.format("%d.%d.%d.%d", bbst.getBar(), bbst.getBeat(), 
                    bbst.getSixteenth(), bbst.getTicks());
        }
        if (timePosition instanceof TimePosition.BBTTime bbt) {
            // Convert BBT to BBST
            int ticksPerSixteenth = ppq / 4;
            int sixteenth = (bbt.getTicks() / ticksPerSixteenth) + 1;
            int ticks = bbt.getTicks() % ticksPerSixteenth;
            return String.format("%d.%d.%d.%d", bbt.getBar(), bbt.getBeat(), sixteenth, ticks);
        }
        return "1.1.1.0";
    }

    private static String formatBBF(TimePosition timePosition) {
        if (timePosition instanceof TimePosition.BBFTime bbf) {
            return bbf.toString();
        }
        return "1.1.00";
    }

    private static String formatTime(TimePosition timePosition) {
        if (timePosition instanceof TimePosition.TimeValue tv) {
            return String.format("%d:%02d:%02d.%03d", 
                    tv.getHours(), tv.getMinutes(), tv.getSeconds(), tv.getMilliseconds());
        }
        return "0:00:00.000";
    }

    private static String formatSeconds(TimePosition timePosition, TimeContext context) {
        Double totalSeconds = extractTotalSeconds(timePosition, context);
        if (totalSeconds == null) {
            return "0.0";
        }
        return formatDecimalSeconds(totalSeconds, 6, true);
    }

    /**
     * Formats a TimePosition as SMPTE timecode (HH:MM:SS:FF).
     * SMPTE is display-only, so the TimePosition is converted to seconds first.
     */
    private static String formatSMPTE(TimePosition timePosition, TimeContext context) {
        Double totalSeconds = extractTotalSeconds(timePosition, context);
        if (totalSeconds != null) {
            return formatSecondsAsSMPTE(totalSeconds, getSmpteFrameRate(context));
        }
        return "00:00:00:00";
    }

    /**
     * Formats seconds as SMPTE timecode string (HH:MM:SS:FF).
     */
    static String formatSecondsAsSMPTE(double totalSeconds, double frameRate) {
        int hours = (int) (totalSeconds / 3600);
        int minutes = (int) ((totalSeconds % 3600) / 60);
        int seconds = (int) (totalSeconds % 60);
        int frames = (int) ((totalSeconds - (int) totalSeconds) * frameRate);
        // Clamp frames to valid range
        int maxFrames = (int) Math.ceil(frameRate) - 1;
        if (frames > maxFrames) frames = maxFrames;
        if (frames < 0) frames = 0;
        return String.format("%02d:%02d:%02d:%02d", hours, minutes, seconds, frames);
    }

    private static String formatFrames(TimePosition timePosition) {
        if (timePosition instanceof TimePosition.FrameValue fv) {
            return String.valueOf(fv.getFrameNumber());
        }
        return "0";
    }

    // ========== Parsing ==========

    /**
     * Parses a string to a TimePosition for the given TimeBase.
     */
    public static TimePosition parse(String text, TimeBase timeBase) {
        return parse(text, timeBase, null);
    }

    /**
     * Parses a string to a TimePosition for the given TimeBase.
     * Uses the supplied TimeContext for context-dependent formats such as SMPTE.
     */
    public static TimePosition parse(String text, TimeBase timeBase, TimeContext context) {
        String trimmed = java.util.Objects.requireNonNullElse(text, "").trim();
        
        return switch (timeBase) {
            case BEATS -> parseBeats(trimmed);
            case BBT -> parseBBT(trimmed);
            case BBST -> parseBBST(trimmed);
            case BBF -> parseBBF(trimmed);
            case TIME -> parseTime(trimmed);
            case SECONDS -> parseSeconds(trimmed);
            case SMPTE -> parseSMPTE(trimmed, context);
            case FRAME -> parseFrames(trimmed);
        };
    }

    private static TimePosition parseBeats(String text) {
        if (text.isEmpty()) {
            return TimePosition.beats(0.0);
        }
        double beats = Double.parseDouble(text);
        if (beats < 0) {
            throw new IllegalArgumentException("Beats cannot be negative");
        }
        return TimePosition.beats(beats);
    }

    private static TimePosition parseBBT(String text) {
        if (text.isEmpty()) {
            return TimePosition.bbt(1, 1, 0);
        }
        
        String[] parts = text.split("\\.");
        if (parts.length < 2 || parts.length > 3) {
            throw new IllegalArgumentException("BBT format: bar.beat.ticks");
        }
        
        long bar = Long.parseLong(parts[0].trim());
        int beat = Integer.parseInt(parts[1].trim());
        int ticks = parts.length == 3 ? Integer.parseInt(parts[2].trim()) : 0;
        
        return TimePosition.bbt(bar, beat, ticks);
    }

    private static TimePosition parseBBST(String text) {
        if (text.isEmpty()) {
            return TimePosition.bbst(1, 1, 1, 0);
        }
        
        String[] parts = text.split("\\.");
        if (parts.length < 3 || parts.length > 4) {
            throw new IllegalArgumentException("BBST format: bar.beat.sixteenth.ticks");
        }
        
        long bar = Long.parseLong(parts[0].trim());
        int beat = Integer.parseInt(parts[1].trim());
        int sixteenth = Integer.parseInt(parts[2].trim());
        int ticks = parts.length == 4 ? Integer.parseInt(parts[3].trim()) : 0;
        
        return TimePosition.bbst(bar, beat, sixteenth, ticks);
    }

    private static TimePosition parseBBF(String text) {
        if (text.isEmpty()) {
            return TimePosition.bbf(1, 1, 0);
        }
        
        String[] parts = text.split("\\.");
        if (parts.length < 2 || parts.length > 3) {
            throw new IllegalArgumentException("BBF format: bar.beat.fraction");
        }
        
        long bar = Long.parseLong(parts[0].trim());
        int beat = Integer.parseInt(parts[1].trim());
        int fraction = parts.length == 3 ? parseBbfFraction(parts[2]) : 0;
        if (fraction >= 100) {
            fraction = 0;
            beat++;
        }
        
        return TimePosition.bbf(bar, beat, fraction);
    }

    private static TimePosition parseTime(String text) {
        if (text.isEmpty()) {
            return TimePosition.TimeValue.ZERO;
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

        return TimePosition.time(hours, minutes, seconds, milliseconds);
    }

    private static TimePosition parseSeconds(String text) {
        if (text.isEmpty()) {
            return TimePosition.SecondsValue.ZERO;
        }
        double seconds = Double.parseDouble(text);
        if (!Double.isFinite(seconds)) {
            throw new IllegalArgumentException("Seconds must be finite");
        }
        if (seconds < 0) {
            throw new IllegalArgumentException("Seconds cannot be negative");
        }
        return TimePosition.seconds(seconds);
    }

    /**
     * Parses SMPTE timecode text (HH:MM:SS:FF) into a TimeValue.
     * SMPTE is display-only, so parsed frames are converted to milliseconds.
     */
    private static TimePosition parseSMPTE(String text, TimeContext context) {
        if (text.isEmpty()) {
            return TimePosition.TimeValue.ZERO;
        }
        
        double frameRate = getSmpteFrameRate(context);
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

        // Convert frames to milliseconds and produce a TimeValue
        long milliseconds = Math.round(frames * 1000.0 / frameRate);
        return TimePosition.time(hours, minutes, seconds, milliseconds);
    }

    private static TimePosition parseFrames(String text) {
        if (text.isEmpty()) {
            return TimePosition.frames(0);
        }
        long frames = Long.parseLong(text);
        if (frames < 0) {
            throw new IllegalArgumentException("Frames cannot be negative");
        }
        return TimePosition.frames(frames);
    }

    // ========== Duration Formatting ==========

    /**
     * Formats a TimePosition as a duration string. For measure-based formats (BBT, BBST, BBF),
     * uses 0-based bars/beats. For other formats, delegates to regular format.
     * PPQ is fixed at {@link TimeContext#DEFAULT_PPQ} (960).
     */
    public static String formatDuration(TimePosition timePosition, TimeBase timeBase, TimeContext context) {
        return switch (timeBase) {
            case BEATS -> formatBeats(timePosition);
            case BBT -> {
                TimeDuration dur = TimeUnitMath.fromTimePosition(timePosition, TimeBase.BBT, context);
                if (dur instanceof TimeDuration.DurationBBT d) {
                    yield String.format("%d.%d.%d", d.getBars(), d.getBeats(), d.getTicks());
                }
                yield "0.0.0";
            }
            case BBST -> {
                TimeDuration dur = TimeUnitMath.fromTimePosition(timePosition, TimeBase.BBST, context);
                if (dur instanceof TimeDuration.DurationBBST d) {
                    yield String.format("%d.%d.%d.%d", d.getBars(), d.getBeats(), d.getSixteenth(), d.getTicks());
                }
                yield "0.0.0.0";
            }
            case BBF -> {
                TimeDuration dur = TimeUnitMath.fromTimePosition(timePosition, TimeBase.BBF, context);
                if (dur instanceof TimeDuration.DurationBBF d) {
                    yield String.format("%d.%d.%02d", d.getBars(), d.getBeats(), d.getFraction());
                }
                yield "0.0.00";
            }
            case TIME -> formatTime(timePosition);
            case SECONDS -> formatSeconds(timePosition, context);
            case SMPTE -> formatSMPTE(timePosition, context);
            case FRAME -> formatFrames(timePosition);
        };
    }

    // ========== Duration Parsing ==========

    /**
     * Parses a duration string to a TimePosition. For measure-based formats (BBT, BBST, BBF),
     * interprets values as 0-based and converts through beats to the target TimeBase.
     */
    public static TimePosition parseDuration(String text, TimeBase timeBase, TimeContext context) {
        String trimmed = java.util.Objects.requireNonNullElse(text, "").trim();

        return switch (timeBase) {
            case BEATS -> parseBeats(trimmed);
            case BBT -> {
                if (trimmed.isEmpty()) yield TimePosition.beats(0.0);
                String[] parts = trimmed.split("\\.");
                if (parts.length < 2 || parts.length > 3)
                    throw new IllegalArgumentException("Duration BBT format: bars.beats.ticks");
                long bars = Long.parseLong(parts[0].trim());
                int beats = Integer.parseInt(parts[1].trim());
                int ticks = parts.length == 3 ? Integer.parseInt(parts[2].trim()) : 0;
                TimeDuration dur = TimeDuration.bbt(bars, beats, ticks);
                double totalBeats = dur.toBeats(context);
                yield TimeUtilities.beatsToTimePosition(totalBeats, TimeBase.BBT, context);
            }
            case BBST -> {
                if (trimmed.isEmpty()) yield TimePosition.beats(0.0);
                String[] parts = trimmed.split("\\.");
                if (parts.length < 3 || parts.length > 4)
                    throw new IllegalArgumentException("Duration BBST format: bars.beats.16th.ticks");
                long bars = Long.parseLong(parts[0].trim());
                int beats = Integer.parseInt(parts[1].trim());
                int sixteenth = Integer.parseInt(parts[2].trim());
                int ticks = parts.length == 4 ? Integer.parseInt(parts[3].trim()) : 0;
                TimeDuration dur = TimeDuration.bbst(bars, beats, sixteenth, ticks);
                double totalBeats = dur.toBeats(context);
                yield TimeUtilities.beatsToTimePosition(totalBeats, TimeBase.BBST, context);
            }
            case BBF -> {
                if (trimmed.isEmpty()) yield TimePosition.beats(0.0);
                String[] parts = trimmed.split("\\.");
                if (parts.length < 2 || parts.length > 3)
                    throw new IllegalArgumentException("Duration BBF format: bars.beats.fraction");
                long bars = Long.parseLong(parts[0].trim());
                int beats = Integer.parseInt(parts[1].trim());
                int fraction = parts.length == 3 ? parseBbfFraction(parts[2]) : 0;
                if (fraction >= 100) {
                    fraction = 0;
                    beats++;
                }
                TimeDuration dur = TimeDuration.bbf(bars, beats, fraction);
                double totalBeats = dur.toBeats(context);
                yield TimeUtilities.beatsToTimePosition(totalBeats, TimeBase.BBF, context);
            }
            case TIME -> parseTime(trimmed);
            case SECONDS -> parseSeconds(trimmed);
            case SMPTE -> parseSMPTE(trimmed, context);
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

    private static long parseFrameNumber(String text, double frameRate) {
        long val = Long.parseLong(text.trim());
        if (val < 0 || val >= Math.ceil(frameRate)) {
            throw new IllegalArgumentException();
        }
        return val;
    }

    private static int parseBbfFraction(String text) {
        String fractionText = text.trim();
        if (fractionText.isEmpty()) {
            return 0;
        }
        if (!fractionText.chars().allMatch(Character::isDigit)) {
            throw new IllegalArgumentException("BBF fraction must contain digits only");
        }

        BigDecimal fraction = new BigDecimal("0." + fractionText);
        return fraction.movePointRight(2)
                .setScale(0, RoundingMode.HALF_UP)
                .intValueExact();
    }

    private static Double extractTotalSeconds(TimePosition timePosition, TimeContext context) {
        if (timePosition instanceof TimePosition.SecondsValue sv) {
            return sv.getTotalSeconds();
        }
        if (timePosition instanceof TimePosition.TimeValue tv) {
            return tv.toTotalSeconds();
        }
        if (timePosition instanceof TimePosition.FrameValue fv) {
            if (context == null) {
                return null;
            }
            return fv.toTotalSeconds(context.getSampleRate());
        }
        if (timePosition != null && context != null) {
            return timePosition.toSeconds(context);
        }
        return null;
    }

    private static String formatDecimalSeconds(double value, int maxFractionDigits, boolean forceFractionDigit) {
        String text = BigDecimal.valueOf(value)
                .setScale(maxFractionDigits, RoundingMode.HALF_UP)
                .stripTrailingZeros()
                .toPlainString();
        if (forceFractionDigit && !text.contains(".")) {
            return text + ".0";
        }
        return text;
    }

    private static double getSmpteFrameRate(TimeContext context) {
        return context == null ? TimeContext.DEFAULT_SMPTE_FRAME_RATE : context.getSmpteFrameRate();
    }
}
