package blue.soundObject.notation;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import javax.swing.JComponent;
import javax.swing.JFrame;

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

public class NotationStaffRenderer extends JComponent {
    public static final Color BACKGROUND_COLOR = Color.black;

    public static final Color NOTATION_COLOR = Color.white;

    public static final Color EDIT_COLOR = Color.orange;

    public static final int LINE_HEIGHT = 8;

    public static final int HALF_SPACE_HEIGHT = 4;

    public static final int TOP_MARGIN = 150;

    public static final int SIDE_MARGIN = 30;

    public static final int STAFF_NAME_WIDTH = 100;

    public static final int SIXTY_FOURTH_WIDTH = 10;

    public static final int DOT_WIDTH = 5;

    public static final int SPACE_BETWEEN_NOTES = 1;

    private NotationStaff staffData = null;

    private NotationEditPoint notationEditPoint = null;

    public NotationStaffRenderer() {
        this.setPreferredSize(new Dimension(400, 100));
    }

    public void setNotationEditPoint(NotationEditPoint notationEditPoint) {
        this.notationEditPoint = notationEditPoint;
    }

    public void setNotationStaff(NotationStaff staffData) {
        this.staffData = staffData;
    }

    public void paint(Graphics g) {
        // draw backgrounds
        g.setColor(BACKGROUND_COLOR);
        g.fillRect(0, 0, this.getWidth(), this.getHeight());

        if (this.staffData == null) {
            return;
        }

        g.setColor(NOTATION_COLOR);

        // draw staff name

        g.drawString(this.staffData.getStaffName(), SIDE_MARGIN, TOP_MARGIN
                + (2 * LINE_HEIGHT));

        // draw staff lines
        int line_y;

        for (int i = 0; i < 5; i++) {
            line_y = TOP_MARGIN + (i * LINE_HEIGHT);
            g.drawLine(SIDE_MARGIN + STAFF_NAME_WIDTH, line_y, this.getWidth()
                    - SIDE_MARGIN, line_y);
        }

        int totalX = SIDE_MARGIN + STAFF_NAME_WIDTH;

        // draw clef

        totalX += 60;

        // calculate center pitch to base relative values off of
        int centerPitchY, centerPitchValue;

        if (this.staffData.getClef() == NotationStaff.TREBLE) {
            centerPitchY = TOP_MARGIN + (5 * LINE_HEIGHT);
            centerPitchValue = 60;
        } else { // assume bass clef for now
            centerPitchY = TOP_MARGIN + (5 * HALF_SPACE_HEIGHT);
            centerPitchValue = 48;
        }

        // draw notes
        int size = this.staffData.size();
        NotationNote note;
        int noteX;
        int noteY;
        int spaceX;

        // size + 1 for drawing empty space for possible input
        for (int i = 0; i < size + 1; i++) {
            spaceX = 0;
            if (i != size) {

                note = this.staffData.getNotationNote(i);

                // draw accidentals

                // need to draw lines for pitches outside of staff

                noteY = (centerPitchValue - note.getMidiPitch())
                        * HALF_SPACE_HEIGHT;

                // draw note head
                g.fillOval(totalX + SPACE_BETWEEN_NOTES, centerPitchY + noteY
                        - HALF_SPACE_HEIGHT, LINE_HEIGHT
                        + (2 * SPACE_BETWEEN_NOTES), LINE_HEIGHT);

                // empty out note head if greater than quarter note
                if (note.getNoteDuration() > 5) {
                    g.setColor(BACKGROUND_COLOR);
                    g.fillOval(totalX + SPACE_BETWEEN_NOTES, centerPitchY
                            + noteY - (int) (.5 * HALF_SPACE_HEIGHT),
                            LINE_HEIGHT + (2 * SPACE_BETWEEN_NOTES),
                            HALF_SPACE_HEIGHT);
                    g.setColor(NOTATION_COLOR);
                }

                // draw dots

                // draw stem with flags

                if (note.getNoteDuration() < 7) {
                    int stemHeight = Math.abs(noteY - centerPitchY);
                    int x = totalX + LINE_HEIGHT + (2 * SPACE_BETWEEN_NOTES);
                    int y1 = centerPitchY + noteY;
                    int y2 = centerPitchY;

                    if (stemHeight < (5 * LINE_HEIGHT)) {
                        stemHeight = 5 * LINE_HEIGHT;
                        y2 = y1 - y2;
                        if (y2 > 0) {
                            y2 = y1 - stemHeight;
                        } else {
                            y2 = y1 + stemHeight;
                        }
                    }
                    g.drawLine(x, y1, x, y2);

                }

                spaceX = (2 * SPACE_BETWEEN_NOTES)
                        + (SIXTY_FOURTH_WIDTH * note.getNoteDuration());
                // needs a better algorithm
            }

            // draw edit point
            if (notationEditPoint != null) {
                if (notationEditPoint.getIndex() == i) {
                    g.setColor(EDIT_COLOR);
                    int editY = (centerPitchValue - notationEditPoint
                            .getMidiPch())
                            * HALF_SPACE_HEIGHT;
                    g.fillRect(totalX, centerPitchY + editY
                            - (int) (.5 * HALF_SPACE_HEIGHT), LINE_HEIGHT
                            + (2 * SPACE_BETWEEN_NOTES), HALF_SPACE_HEIGHT);
                    g.setColor(NOTATION_COLOR);
                    // draw edit caret
                }
            }

            // adjust x for next note

            totalX += spaceX;

        }
    }

    public void update(Graphics g) {
        paint(g);
    }

    public static void main(String[] args) {
        NotationStaff staff = new NotationStaff();
        staff.setClef(NotationStaff.TREBLE);

        for (int i = 0; i < 7; i++) {
            NotationNote n = new NotationNote();
            n.setMidiPitch(60 + i);
            n.setNoteDuration(i + 1);
            staff.addNotationNote(n);
        }

        NotationStaffRenderer notationStaff1 = new NotationStaffRenderer();
        notationStaff1.setNotationStaff(staff);
        NotationEditPoint nep = new NotationEditPoint();
        nep.setMidiPch(72);
        nep.setIndex(2);
        notationStaff1.setNotationEditPoint(nep);

        JFrame mFrame = new JFrame();
        mFrame.setSize(800, 600);

        mFrame.getContentPane().add(notationStaff1);

        mFrame.show();
        mFrame.addWindowListener(new WindowAdapter() {
            public void windowClosing(WindowEvent e) {
                System.exit(0);
            }
        });
    }
}