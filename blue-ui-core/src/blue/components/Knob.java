/*
 *  based on DKnob.java
 *  (c) 2000 by Joakim Eriksson
 *  http://www.dreamfabric.com
 * 	
 */
package blue.components;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.FocusEvent;
import java.awt.event.FocusListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.awt.geom.Arc2D;
import javax.swing.JComponent;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.EventListenerList;

public class Knob extends JComponent {
    private final static float START = 225;

    private final static float LENGTH = 270;

    private final static float PI = (float) 3.1415;

    private final static float START_ANG = (START / 360) * PI * 2;

    private final static float LENGTH_ANG = (LENGTH / 360) * PI * 2;

    // private final static float DRAG_RES = (float) 0.01;
    private final static float MULTIP = 180 / PI;

    private final static Color DEFAULT_FOCUS_COLOR = new Color(0x8080ff);

    private int SHADOWX = 1;

    private int SHADOWY = 1;

    private float DRAG_SPEED;

    private float CLICK_SPEED;

    private int size;

    private int middle;

    public final static int SIMPLE = 1;

    public final static int ROUND = 2;

    private int dragType = ROUND;

    private final static Dimension MIN_SIZE = new Dimension(40, 40);

    // private final static Dimension PREF_SIZE = new Dimension(80, 80);

    private final static int DEFAULT_PREF_WIDTH = 80;

    // Set the antialiasing to get the right look!
    private final static RenderingHints AALIAS = new RenderingHints(
            RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

    private ChangeEvent changeEvent = null;

    private final EventListenerList listenerList = new EventListenerList();

    private final Arc2D hitArc = new Arc2D.Float(Arc2D.PIE);

    private float ang = START_ANG;

    private float val;

    private int dragpos = -1;

    private float startVal;

    private Color focusColor;

    private double lastAng;

    public Knob() {
        createKnob(DEFAULT_PREF_WIDTH);
    }

    public Knob(int preferredWidth) {
        createKnob(preferredWidth);
    }

    private void createKnob(int preferredWidth) {
        DRAG_SPEED = 0.01F;
        CLICK_SPEED = 0.01F;
        SHADOWX = 1;
        SHADOWY = 1;

        focusColor = DEFAULT_FOCUS_COLOR;

        Dimension prefSize = new Dimension(preferredWidth, preferredWidth);

        setPreferredSize(prefSize);
        hitArc.setAngleStart(235); // Degrees ??? Radians???
        addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent me) {
                dragpos = me.getX() + me.getY();
                startVal = val;

                // Fix last angle
                int xpos = middle - me.getX();
                int ypos = middle - me.getY();
                lastAng = Math.atan2(xpos, ypos);

                requestFocus();
            }

            @Override
            public void mouseClicked(MouseEvent me) {
                hitArc.setAngleExtent(-(LENGTH + 20));
                if (hitArc.contains(me.getX(), me.getY())) {
                    hitArc.setAngleExtent(MULTIP * (ang - START_ANG) - 10);
                    if (hitArc.contains(me.getX(), me.getY())) {
                        decValue();
                    } else {
                        incValue();
                    }
                }
            }
        });

        // Let the user control the knob with the mouse
        addMouseMotionListener(new MouseMotionAdapter() {
            @Override
            public void mouseDragged(MouseEvent me) {
                if (dragType == SIMPLE) {
                    float f = DRAG_SPEED * ((me.getX() + me.getY()) - dragpos);
                    setValue(startVal + f);
                } else if (dragType == ROUND) {
                    // Measure relative the middle of the button!
                    int xpos = middle - me.getX();
                    int ypos = middle - me.getY();
                    double ang = Math.atan2(xpos, ypos);
                    double diff = lastAng - ang;
                    setValue((float) (getValue() + (diff / LENGTH_ANG)));

                    lastAng = ang;
                }
            }

            @Override
            public void mouseMoved(MouseEvent me) {
            }
        });

        // Let the user control the knob with the keyboard
        addKeyListener(new KeyListener() {

            @Override
            public void keyTyped(KeyEvent e) {
            }

            @Override
            public void keyReleased(KeyEvent e) {
            }

            @Override
            public void keyPressed(KeyEvent e) {
                int k = e.getKeyCode();
                if (k == KeyEvent.VK_RIGHT) {
                    incValue();
                } else if (k == KeyEvent.VK_LEFT) {
                    decValue();
                }
            }
        });

        // Handle focus so that the knob gets the correct focus highlighting.
        addFocusListener(new FocusListener() {
            @Override
            public void focusGained(FocusEvent e) {
                repaint();
            }

            @Override
            public void focusLost(FocusEvent e) {
                repaint();
            }
        });
    }

    public void setDragType(int type) {
        dragType = type;
    }

    public int getDragType() {
        return dragType;
    }

    @Override
    public boolean isManagingFocus() {
        return true;
    }

    @Override
    public boolean isFocusTraversable() {
        return true;
    }

    private void incValue() {
        setValue(val + CLICK_SPEED);
    }

    private void decValue() {
        setValue(val - CLICK_SPEED);
    }

    public float getValue() {
        return val;
    }

    public void setValue(float val) {
        setVal(val);
        fireChangeEvent();
    }

    public void setVal(float val) {
        if (val < 0) {
            val = 0;
        }
        if (val > 1) {
            val = 1;
        }
        this.val = val;
        ang = START_ANG - LENGTH_ANG * val;
        repaint();
    }

    public void addChangeListener(ChangeListener cl) {
        listenerList.add(ChangeListener.class, cl);
    }

    public void removeChangeListener(ChangeListener cl) {
        listenerList.remove(ChangeListener.class, cl);
    }

    @Override
    public Dimension getMinimumSize() {
        return MIN_SIZE;
    }

    protected void fireChangeEvent() {
        // Guaranteed to return a non-null array
        Object[] listeners = listenerList.getListenerList();
        // Process the listeners last to first, notifying
        // those that are interested in this event
        for (int i = listeners.length - 2; i >= 0; i -= 2) {
            if (listeners[i] == ChangeListener.class) {
                // Lazily create the event:
                if (changeEvent == null) {
                    changeEvent = new ChangeEvent(this);
                }
                ((ChangeListener) listeners[i + 1]).stateChanged(changeEvent);
            }
        }
    }

    // Paint the DKnob
    @Override
    public void paint(Graphics g) {
        int width = getWidth();
        int height = getHeight();
        size = Math.min(width, height) - 22;
        middle = 10 + size / 2;

        if (g instanceof Graphics2D) {
            Graphics2D g2d = (Graphics2D) g;
            g2d.setBackground(getParent().getBackground());
            g2d.addRenderingHints(AALIAS);

            // For the size of the "mouse click" area
            hitArc.setFrame(4, 4, size + 12, size + 12);
        }

        // Paint the "markers"
        for (float a2 = START_ANG; a2 >= START_ANG - LENGTH_ANG; a2 = a2
                - (float) (LENGTH_ANG / 10.01)) {
            int x = 10 + size / 2 + (int) ((6 + size / 2) * Math.cos(a2));
            int y = 10 + size / 2 - (int) ((6 + size / 2) * Math.sin(a2));
            g.drawLine(10 + size / 2, 10 + size / 2, x, y);

        }

        // Set the position of the Zero
        // g.drawString("0", 2, size + 10);

        // Paint focus if in focus
        if (hasFocus()) {
            g.setColor(focusColor);
        } else {
            g.setColor(Color.white);
        }

        g.fillOval(10, 10, size, size);
        g.setColor(Color.gray);
        g.fillOval(14 + SHADOWX, 14 + SHADOWY, size - 8, size - 8);

        g.setColor(Color.black);
        g.drawArc(10, 10, size, size, 315, 270);
        g.fillOval(14, 14, size - 8, size - 8);
        g.setColor(Color.white);

        int x = 10 + size / 2 + (int) (size / 2 * Math.cos(ang));
        int y = 10 + size / 2 - (int) (size / 2 * Math.sin(ang));
        g.drawLine(10 + size / 2, 10 + size / 2, x, y);
        g.setColor(Color.gray);
        int s2 = Math.max(size / 6, 6);
        g.drawOval(10 + s2, 10 + s2, size - s2 * 2, size - s2 * 2);

        int dx = (int) (2 * Math.sin(ang));
        int dy = (int) (2 * Math.cos(ang));
        g.drawLine(10 + dx + size / 2, 10 + dy + size / 2, x, y);
        g.drawLine(10 - dx + size / 2, 10 - dy + size / 2, x, y);
    }

//    public static void main(String args[]) {
//        try {
//            UIManager.setLookAndFeel(new BlueLookAndFeel());
//        } catch (UnsupportedLookAndFeelException e) {
//            e.printStackTrace();
//        }
//        JPanel panel = new JPanel();
//        for (int i = 0; i < 5; i++) {
//            panel.add(new Knob((i * 10) + 50));
//        }
//        blue.utility.GUI.showComponentAsStandalone(panel, "Knob Test", true);
//    }
}
