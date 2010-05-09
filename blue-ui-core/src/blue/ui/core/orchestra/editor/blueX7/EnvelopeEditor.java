package blue.ui.core.orchestra.editor.blueX7;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;

import javax.swing.BorderFactory;
import javax.swing.JComponent;

import blue.orchestra.blueX7.EnvelopePoint;

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

public class EnvelopeEditor extends JComponent {
    EnvelopePoint[] points;

    PointListener pl;

    public EnvelopeEditor() {
        EnvelopeMouseListener eml = new EnvelopeMouseListener(this);
        this.addMouseListener(eml);
        this.addMouseMotionListener(eml);
        
        this.setBackground(Color.BLACK);
        this.setBorder(BorderFactory.createLineBorder(Color.GRAY));
        this.setOpaque(true);
    }

    public void setPointListener(PointListener pl) {
        this.pl = pl;
    }

    public void setPoints(EnvelopePoint[] points) {
        this.points = points;
    }

    public EnvelopePoint[] getPoints() {
        return this.points;
    }

    public void paintComponent(Graphics g) {
        
        super.paintComponent(g);
        
        g.setColor(getBackground());
        g.fillRect(0, 0, getWidth(), getHeight());
                
        
        if (points != null) {
            g.setColor(getForeground());
            
            int xMaxWidth = this.getWidth() / 4;
            int yMaxHeight = this.getHeight();

            int runningX = 0;
            int lastY = yMaxHeight;

            for (int i = 0; i < points.length; i++) {
                int targetX = runningX
                        + (int) ((points[i].x / 99.0f) * xMaxWidth);
                int targetY = (int) (((1.0f - points[i].y / 99.0f)) * yMaxHeight);

                g.drawLine(runningX, lastY, targetX, targetY);

                g.fillRect(targetX - 3, targetY - 3, 7, 7);

                runningX = targetX;
                lastY = targetY;

            }

        }
    }

    public static void main(String[] args) {
        EnvelopeEditor envelopeEditor1 = new EnvelopeEditor();
        envelopeEditor1.points = new EnvelopePoint[4];
        for (int i = 0; i < envelopeEditor1.points.length; i++) {
            envelopeEditor1.points[i] = new EnvelopePoint();
            envelopeEditor1.points[i].x = 77;
            envelopeEditor1.points[i].y = ((i + 1) * 99) / 4;
        }
        blue.utility.GUI.showComponentAsStandalone(envelopeEditor1,
                "EnvelopEditor Test", true);
    }
}

class EnvelopeMouseListener implements MouseListener, MouseMotionListener {
    EnvelopeEditor env;

    EnvelopePoint p;

    int minX, maxX;

    public EnvelopeMouseListener(EnvelopeEditor env) {
        this.env = env;
    }

    public void mouseClicked(MouseEvent e) {
    }

    public void mousePressed(MouseEvent e) {
        if (env.points != null) {
            int pointX = e.getX();
            int pointY = e.getY();

            // System.out.println("x: " + pointX + " y: " + pointY);

            int xMaxWidth = env.getWidth() / 4;
            int yMaxHeight = env.getHeight();

            int runningX = 0;

            for (int i = 0; i < env.points.length; i++) {
                int newX = runningX
                        + (int) ((env.points[i].x / 99.0f) * xMaxWidth);
                int newY = (int) (((1.0f - env.points[i].y / 99.0f)) * yMaxHeight);

                // System.out.println("point.x: " + env.points[i].x + " point.y:
                // " + env.points[i].y);
                // System.out.println("newX: " + newX + " newY: " + newY);

                if (pointX > newX - 3 && pointX < newX + 3 && pointY > newY - 3
                        && pointY < newY + 3) {
                    // System.out.println("point found: " + i);
                    p = env.points[i];
                    minX = runningX;
                    maxX = runningX + xMaxWidth;

                }

                runningX += (int) ((env.points[i].x / 99.0f) * xMaxWidth);
            }
        }
        // System.out.println("");
    }

    public void mouseReleased(MouseEvent e) {
        p = null;
    }

    public void mouseEntered(MouseEvent e) {
    }

    public void mouseExited(MouseEvent e) {
    }

    public void mouseDragged(MouseEvent e) {
        if (p != null) {
            int xMaxWidth = env.getWidth() / 4;
            int yMaxHeight = env.getHeight();

            int newX = e.getX() - minX;
            int newY = e.getY();

            if (newX < 0) {
                newX = 0;
            } else if (newX > xMaxWidth) {
                newX = xMaxWidth;
            }

            if (newY < 0) {
                newY = 0;
            } else if (newY > yMaxHeight) {
                newY = yMaxHeight;
            }

            newX = Math.round(((float) newX / (float) xMaxWidth) * 99.0f);
            newY = Math
                    .round((1 - ((float) newY / (float) yMaxHeight)) * 99.0f);

            p.x = newX;
            p.y = newY;

            env.repaint();

            if (env.pl != null) {
                env.pl.updateLabels();
            }
        }
    }

    public void mouseMoved(MouseEvent e) {
    }

}