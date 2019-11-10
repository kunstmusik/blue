/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.ceciliaModule;

import blue.utility.GUI;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.util.ArrayList;
import java.util.Iterator;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import javax.swing.border.BevelBorder;
import javax.swing.border.Border;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/**
 * @author steven
 */
public class FloatSlider extends JComponent {

    private static int SLIDER_HEIGHT = 14;

    private ArrayList listeners = new ArrayList();

    private ArrayList actionListeners = new ArrayList();

    ChangeEvent changeEvent = new ChangeEvent(this);

    String name = "";

    float value = 0.0f;

    float rangeMax = 1.0f;

    float rangeMin = 0.0f;

    float resolution = 0.1f;

    boolean updatingValue = false;

    Thumb thumb;

    public FloatSlider() {
        setPreferredSize(new Dimension(200, 15));

        this.setLayout(null);

        thumb = new Thumb();
        thumb.setLocation(1, 1);

        thumb.addComponentListener(new ComponentAdapter() {

            @Override
            public void componentMoved(ComponentEvent e) {
                if (!updatingValue && thumb.isEditingValue()) {
                    updateValue();
                }
            }

        });

        this.addComponentListener(new ComponentAdapter() {

            @Override
            public void componentResized(ComponentEvent e) {
                updateThumb();
                repaint();
            }
        });

        this.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {
                int x = e.getX();
                int y = e.getY();

                nudge(x, y);
            }
        });

        this.add(thumb);
    }

    private void updateValue() {
        int range = this.getWidth() - 2 - thumb.getWidth();

        int loc = thumb.getX() - 1;

        value = (float) loc / (float) range;

        fireChangeEvent(changeEvent);
    }

    private void updateThumb() {
        int range = this.getWidth() - 2 - thumb.getWidth();

        int newX = (int) (value * range) + 1;

        int newY = (getHeight() / 2) - (thumb.getHeight() / 2);

        thumb.setLocation(newX, newY);
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        int w = getWidth();
        int h = getHeight();

        int center = h / 2;

        int top = center - (SLIDER_HEIGHT / 2);
        int bottom = center + (SLIDER_HEIGHT / 2);

        // g.setColor(getBackground());

        // g.fillRect(0,0, w, 14);

        g.setColor(Color.BLACK);

        g.drawLine(0, top, w, top);
        g.drawLine(0, top, 0, bottom);

        g.setColor(UIManager.getColor("ScrollBar.trackHighlight"));

        g.drawLine(0, bottom, w - 1, bottom);
        g.drawLine(w - 1, top, w - 1, bottom);

    }

    public void setValue(float value) {
        updatingValue = true;

        this.value = value;

        updateThumb();

        updatingValue = false;
    }

    public float getValue() {
        return value;
    }

    public float getValueFromRange() {
        return (value * (rangeMax - rangeMin)) + rangeMin;
    }

    private void fireChangeEvent(ChangeEvent ce) {
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            ChangeListener listener = (ChangeListener) iter.next();

            listener.stateChanged(ce);
        }
    }

    public void addChangeListener(ChangeListener cl) {
        listeners.add(cl);
    }

    public void removeChangeListener(ChangeListener cl) {
        listeners.remove(cl);
    }

    private void fireActionEvent(ActionEvent ae) {
        for (Iterator iter = actionListeners.iterator(); iter.hasNext();) {
            ActionListener listener = (ActionListener) iter.next();

            listener.actionPerformed(ae);
        }
    }

    public void addActionListener(ActionListener al) {
        actionListeners.add(al);
    }

    public void removeActionListener(ActionListener al) {
        actionListeners.remove(al);
    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        GUI.showComponentAsStandalone(new FloatSlider(), "Float Slider", true);
    }

    /**
     * @return Returns the name.
     */
    @Override
    public String getName() {
        return name;
    }

    /**
     * @param name
     *            The name to set.
     */
    @Override
    public void setName(String name) {
        this.name = name;
    }

    /**
     * @return Returns the rangeMax.
     */
    public float getRangeMax() {
        return rangeMax;
    }

    /**
     * @param rangeMax
     *            The rangeMax to set.
     */
    public void setRangeMax(float rangeMax) {
        this.rangeMax = rangeMax;
    }

    /**
     * @return Returns the rangeMin.
     */
    public float getRangeMin() {
        return rangeMin;
    }

    /**
     * @param rangeMin
     *            The rangeMin to set.
     */
    public void setRangeMin(float rangeMin) {
        this.rangeMin = rangeMin;
    }

    public float getResolution() {
        return resolution;
    }

    public void setResolution(float resolution) {
        this.resolution = resolution;
    }

    /**
     * @param x
     * @param y
     */
    private void nudge(int x, int y) {
        if (y < thumb.getY() || y > thumb.getY() + thumb.getHeight()) {
            return;
        }

        if (x < thumb.getX()) {
            ActionEvent ae = new ActionEvent(this,
                    ActionEvent.ACTION_PERFORMED, "nudgeLeft");
            fireActionEvent(ae);

        } else {
            ActionEvent ae = new ActionEvent(this,
                    ActionEvent.ACTION_PERFORMED, "nudgeRight");
            fireActionEvent(ae);
        }
    }
}

class Thumb extends JComponent {

    Border NORMAL_BORDER = BorderFactory.createBevelBorder(BevelBorder.RAISED,
            UIManager.getColor("ScrollBar.trackHighlight"), Color.BLACK);

    Border DOWN_BORDER = BorderFactory.createBevelBorder(BevelBorder.LOWERED,
            UIManager.getColor("ScrollBar.trackHighlight"), Color.BLACK);

    Point origin = null;

    private boolean isEditingValue = false;

    public Thumb() {
        Dimension d = new Dimension(30, 12);
        this.setPreferredSize(d);
        this.setSize(d);

        this.setBorder(NORMAL_BORDER);

        this.addMouseListener(new MouseListener() {

            @Override
            public void mouseClicked(MouseEvent e) {
                // TODO Auto-generated method stub

            }

            @Override
            public void mousePressed(MouseEvent e) {
                origin = e.getPoint();
                setBorder(DOWN_BORDER);
                setEditingValue(true);
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                origin = null;
                setBorder(NORMAL_BORDER);
                setEditingValue(false);
            }

            @Override
            public void mouseEntered(MouseEvent e) {
                // TODO Auto-generated method stub

            }

            @Override
            public void mouseExited(MouseEvent e) {
                // TODO Auto-generated method stub

            }

        });

        this.addMouseMotionListener(new MouseMotionListener() {

            @Override
            public void mouseDragged(MouseEvent e) {
                moveThumb(e.getX(), e.getY());

            }

            @Override
            public void mouseMoved(MouseEvent e) {
                // TODO Auto-generated method stub

            }

        });

    }

    private void moveThumb(int x, int y) {

        if (getParent() == null) {
            return;
        }

        int xVal = SwingUtilities.convertPoint(this, x, y, getParent()).x;

        int newX = xVal - origin.x;

        int max = getParent().getWidth() - 30 - 1;

        if (newX < 1) {
            newX = 1;
        }

        if (newX > max) {
            newX = max;
        }

        this.setLocation(newX, this.getY());

    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        int w = getWidth();
        int h = getHeight();

        // g.setColor(Color.GREEN);
        // g.fillRect(0,0,w,h);
    }

    /**
     * @return Returns the isEditingValue.
     */
    public boolean isEditingValue() {
        return isEditingValue;
    }

    /**
     * @param isEditingValue
     *            The isEditingValue to set.
     */
    public void setEditingValue(boolean isEditingValue) {
        this.isEditingValue = isEditingValue;
    }
}