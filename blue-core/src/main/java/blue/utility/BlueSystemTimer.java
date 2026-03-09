package blue.utility;

import java.util.Calendar;

public class BlueSystemTimer {

    private static BlueSystemTimer instance = null;

    private Calendar calendar;

    private BlueSystemTimer() {
    }

    public static BlueSystemTimer getInstance() {
        if (instance == null) {
            instance = new BlueSystemTimer();
        }
        return instance;
    }

    public void startTimer() {
        this.calendar = Calendar.getInstance();
    }

    public String getStartTime() {
        if (this.calendar == null) {
            return "";
        }

        int h = calendar.get(Calendar.HOUR);
        int m = calendar.get(Calendar.MINUTE);
        int s = calendar.get(Calendar.SECOND);

        String meridian;

        if (h > 11) {
            h = h - 12;
            meridian = "PM";
        } else {
            meridian = "AM";
            if (h == 0) {
                h = 12;
            }
        }

        return formatTwoDigits(h) + ":" + formatTwoDigits(m) + ":" + s + " "
                + meridian;
    }

    private String formatTwoDigits(int val) {
        if (val < 10) {
            return "0" + val;
        }
        return Integer.toString(val);
    }

    public String getElapsedTime() {
        if (this.calendar == null) {
            return "No Timer Found";
        }

        double elapsedDur = (System.currentTimeMillis() - calendar
                .getTimeInMillis()) / 1000;

        return NumberUtilities.formatTime(elapsedDur);
    }
}
