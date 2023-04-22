/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.editor.pattern;

import blue.soundObject.PatternObject;
import blue.soundObject.pattern.Pattern;
import blue.utility.GUI;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JComponent;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;

public class PatternCanvas extends JComponent implements TableModelListener,
        PropertyChangeListener {

    private static final Color PATTERN_COLOR = new Color(198, 226, 255);
    private static final Color INACTIVE_COLOR0 = new Color(16,16,16);
    private static final Color INACTIVE_COLOR1 = new Color(32,32,32);

    private PatternObject patObj;

    public PatternCanvas() {
        PatternCanvasMouseListener mListener = new PatternCanvasMouseListener(
                this);

        this.addMouseListener(mListener);
        this.addMouseMotionListener(mListener);
    }

    public void setPatternObject(PatternObject patObj) {
        if (this.patObj != null) {
            this.patObj.removeTableModelListener(this);
            this.patObj.removePropertyChangeListener(this);
        }
        this.patObj = patObj;
        this.patObj.addTableModelListener(this);
        this.patObj.addPropertyChangeListener(this);

        checkSize();
        repaint();
    }

    private void checkSize() {

        int viewHeight = PatternsConstants.patternViewHeight;
        int width = patObj.getBeats() * patObj.getSubDivisions() * viewHeight;
        int height = patObj.size() * viewHeight;

        this.setPreferredSize(new Dimension(width, height));
    }

    @Override
    public void paintComponent(Graphics g) {

        super.paintComponent(g);

        Graphics2D graphics = (Graphics2D) g;
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);

        if (patObj == null) {
            return;
        }

        g.setColor(Color.black);
        g.fillRect(0, 0, this.getWidth(), this.getHeight());

        if (patObj.size() == 0) {
            return;
        }

        // draw patternBoxes in
        int x1, y1;

        int subDivisions = patObj.getSubDivisions();
        int steps = patObj.getBeats() * subDivisions;
        int h = PatternsConstants.patternViewHeight;
        int patternWidth = steps * h;
        int patternHeight = (patObj.size()) * h;

        for (int i = 0; i < patObj.size(); i++) {

            Pattern p = patObj.getPattern(i);

            for (int j = 0; j < steps; j++) {

                x1 = j * h;
                y1 = i * h;

                if (p.values[j]) {
                    g.setColor(PATTERN_COLOR);
                } else {
                    g.setColor(i % 2 == 0 ? INACTIVE_COLOR0 : INACTIVE_COLOR1);
                }
                g.fillRoundRect(x1 + 3, y1 + 3, h - 5, h - 5, 5, 5);

            }
        }

        // draw horizontal lines
        g.setColor(Color.darkGray);
        for (int i = 0; i < patObj.size(); i++) {
            g.drawLine(0, (i + 1) * h, patternWidth, (i + 1) * h);
        }

        for (int i = 0; i < steps; i++) {
            if (i % subDivisions == 0) {
                g.setColor(Color.gray);
            } else {
                g.setColor(Color.darkGray);
            }

            g.drawLine(i * h, 0, i * h, patternHeight);

        }

        g.setColor(Color.gray);
        g.drawLine(steps * h, 0, steps * h, patternHeight);

    }

    @Override
    public void tableChanged(TableModelEvent e) {
        this.checkSize();
        this.revalidate();
        this.repaint();
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();

        PatternCanvas canvas = new PatternCanvas();

        PatternObject patternObject = new PatternObject();
        patternObject.addPattern(0);
        patternObject.addPattern(1);
        patternObject.addPattern(2);
        patternObject.addPattern(3);

        canvas.setPatternObject(patternObject);

        GUI.showComponentAsStandalone(canvas, "Pattern Canvas", true);
    }

    public PatternObject getPatternObject() {
        return this.patObj;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.patObj) {
            if (evt.getPropertyName().equals("time")) {
                checkSize();
                repaint();
            }
        }
    }

}

class PatternCanvasMouseListener implements MouseListener, MouseMotionListener {

    PatternCanvas canvas;

    boolean isWrite = false;

    private PatternObject patternObj = null;

    public PatternCanvasMouseListener(PatternCanvas canvas) {
        this.canvas = canvas;
    }

    @Override
    public void mousePressed(MouseEvent e) {
        processMousePressed(e);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        processMouseReleased(e);
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        processMouseDragged(e);
    }

    @Override
    public void mouseMoved(MouseEvent e) {
    }

    @Override
    public void mouseExited(MouseEvent e) {
    }

    @Override
    public void mouseEntered(MouseEvent e) {
    }

    @Override
    public void mouseClicked(MouseEvent e) {
    }

    void processMousePressed(MouseEvent e) {

        this.patternObj = canvas.getPatternObject();

        if (this.patternObj == null) {
            return;
        }

        int x = e.getX();
        int y = e.getY();

        this.isWrite = !getPatternValue(x, y);

        // System.out.println("Is Write:" + this.isWrite + " : " + x + " : " +
        // y);
        setPatternValue(x, y, this.isWrite);

        canvas.repaint();
    }

    void processMouseDragged(MouseEvent e) {
        if (this.patternObj == null) {
            return;
        }

        setPatternValue(e.getX(), e.getY(), this.isWrite);
        canvas.repaint();
    }

    void processMouseReleased(MouseEvent e) {
    }

    public boolean getPatternValue(int x, int y) {
        if (this.patternObj == null) {
            return false;
        }
        int patternNum = y / PatternsConstants.patternViewHeight;
        // patternNum--;

        if (patternNum >= this.patternObj.size() || patternNum < 0) {
            return false;
        }

        Pattern p = patternObj.getPattern(patternNum);

        int measureNum = x / PatternsConstants.patternViewHeight;

        if (measureNum >= p.values.length || measureNum < 0) {
            return false;
        }

        return p.values[measureNum];
    }

    public void setPatternValue(int x, int y, boolean val) {
        if (this.patternObj == null) {
            return;
        }

        int patternNum = y / PatternsConstants.patternViewHeight;
        // patternNum--;

        if (patternNum >= this.patternObj.size() || patternNum < 0) {
            return;
        }

        Pattern p = patternObj.getPattern(patternNum);

        int measureNum = x / PatternsConstants.patternViewHeight;

        if (measureNum >= p.values.length || measureNum < 0) {
            return;
        }

        p.values[measureNum] = val;
    }

}
