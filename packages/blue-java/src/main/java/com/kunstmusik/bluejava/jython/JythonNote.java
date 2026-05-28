package com.kunstmusik.bluejava.jython;

import java.util.ArrayList;
import java.util.List;

public final class JythonNote {
    private final List<String> pfields = new ArrayList<>();
    private double subjectiveDuration;
    private boolean tied;

    public JythonNote(List<String> pfields, double subjectiveDuration, boolean tied) {
        if (pfields != null) {
            this.pfields.addAll(pfields);
        }
        this.subjectiveDuration = Math.abs(subjectiveDuration);
        this.tied = tied;
        ensurePFieldSize(3);
        syncDurationPField();
    }

    public JythonNote(JythonNote other) {
        this(other.getPfields(), other.getSubjectiveDuration(), other.isTied());
    }

    public List<String> getPfields() {
        return new ArrayList<>(pfields);
    }

    public String getPField(int index) {
        if (index <= 0 || index > pfields.size()) {
            return "";
        }
        return pfields.get(index - 1);
    }

    public void setPField(String value, int index) {
        if (index <= 0) {
            return;
        }

        ensurePFieldSize(index);
        pfields.set(index - 1, value != null ? value : "");

        if (index == 3) {
            double parsed = parseDouble(value);
            this.subjectiveDuration = Math.abs(parsed);
            this.tied = parsed < 0;
            syncDurationPField();
        }
    }

    public double getStartTime() {
        return parseDouble(getPField(2));
    }

    public void setStartTime(double startTime) {
        ensurePFieldSize(2);
        pfields.set(1, Double.toString(startTime));
    }

    public double getDuration() {
        return getSubjectiveDuration();
    }

    public void setDuration(double duration) {
        this.subjectiveDuration = Math.abs(duration);
        this.tied = duration < 0;
        syncDurationPField();
    }

    public double getSubjectiveDuration() {
        return subjectiveDuration;
    }

    public void setSubjectiveDuration(double subjectiveDuration) {
        this.subjectiveDuration = Math.abs(subjectiveDuration);
        syncDurationPField();
    }

    public boolean isTied() {
        return tied;
    }

    public void setTied(boolean tied) {
        this.tied = tied;
        syncDurationPField();
    }

    public JythonNote copy() {
        return new JythonNote(this);
    }

    private void ensurePFieldSize(int size) {
        while (pfields.size() < size) {
            pfields.add("");
        }
    }

    private void syncDurationPField() {
        ensurePFieldSize(3);
        double value = tied ? -subjectiveDuration : subjectiveDuration;
        pfields.set(2, Double.toString(value));
    }

    private static double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return 0.0;
        }

        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ex) {
            return 0.0;
        }
    }
}