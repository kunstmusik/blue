/*
 *  based on DKnob.java
 *  (c) 2000 by Joakim Eriksson
 *  http://www.dreamfabric.com
 * 	
 */
package blue.components;

import java.awt.BasicStroke;
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

    private final static double START = 225;

    private final static double LENGTH = 270;

    private final static double PI = (double) 3.1415;

    private final static double START_ANG = (START / 360) * PI * 2;

    private final static double LENGTH_ANG = (LENGTH / 360) * PI * 2;

    // private final static double DRAG_RES = (double) 0.01;
    private final static double MULTIP = 180 / PI;

    private final static Color DEFAULT_FOCUS_COLOR = new Color(0x8080ff);

    private int SHADOWX = 1;

    private int SHADOWY = 1;

    private double DRAG_SPEED;

    private double CLICK_SPEED;

    private int size;

    private int middle;

    public final static int SIMPLE = 1;

    public final static int ROUND = 2;

    private int dragType = ROUND;

    private final static Dimension MIN_SIZE = new Dimension(40, 40);

    // private final static Dimension PREF_SIZE = new Dimension(80, 80);
    private final static int DEFAULT_PREF_WIDTH = 80;

    private static final Color TRACK_BACKGROUND_COLOR = new Color(0, 0, 0, 64);

    private final static RenderingHints AALIAS;

    static {
        AALIAS = new RenderingHints(
                RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        AALIAS.put(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    }

    private ChangeEvent changeEvent = null;

    private final EventListenerList listenerList = new EventListenerList();

    private final Arc2D hitArc = new Arc2D.Double(Arc2D.PIE);

    private double ang = START_ANG;

    private double val;

    private int dragpos = -1;

    private double startVal;

    private Color focusColor;

    private double lastAng;

    private Color trackColor = new Color(63, 102, 150);

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
                    double f = DRAG_SPEED * ((me.getX() + me.getY()) - dragpos);
                    setValue(startVal + f);
                } else if (dragType == ROUND) {
                    // Measure relative the middle of the button!
                    int xpos = middle - me.getX();
                    int ypos = middle - me.getY();
                    double ang = Math.atan2(xpos, ypos);
                    double diff = lastAng - ang;
                    setValue((double) (getValue() + (diff / LENGTH_ANG)));

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
    public boolean isFocusable() {
        return true;
    }

    private void incValue() {
        setValue(val + CLICK_SPEED);
    }

    private void decValue() {
        setValue(val - CLICK_SPEED);
    }

    public double getValue() {
        return val;
    }

    public void setValue(double val) {
        setVal(val);
        fireChangeEvent();
    }

    public void setVal(double val) {
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
    public void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g;
        g2d.addRenderingHints(AALIAS);
        final var initialTransform = g2d.getTransform();

        int width = getWidth();
        int height = getHeight();
        size = Math.min(width, height) - 2;
        middle = size / 2;
        // check this
        hitArc.setFrame(0, 0, width, height);

        g2d.translate((width - size) / 2, (height - size) / 2);

//        g.setColor(getBackground());
//        g.fillRect(0, 0, width, height);
        g2d.setStroke(new BasicStroke(0.5f));

        // DRAW TRACK
        Arc2D.Double trackPath = new Arc2D.Double(0, 0, size, size, START, -LENGTH, Arc2D.PIE);
        g2d.setPaint(TRACK_BACKGROUND_COLOR);
        g2d.fill(trackPath);

        // DRAW TRACK VALUE
        Arc2D.Double path = new Arc2D.Double(0, 0, size, size, START, -LENGTH * getValue(), Arc2D.PIE);

        g2d.setPaint(trackColor);
        g2d.fill(path);
//        g2d.setPaint(trackColor.brighter()  );
//        g2d.draw(path);

        // DRAW TRACK BORDER
        g2d.setPaint(Color.BLACK);
        g2d.draw(trackPath);

        // DRAW KNOB CENTER
        g2d.setPaint(Color.BLACK);

        int knobCenterSize = (int) (size * .65);

        g2d.fillOval(middle - knobCenterSize / 2, middle - knobCenterSize / 2, knobCenterSize, knobCenterSize);

        /* VALUE INDICATOR */
        g2d.translate(middle, middle);
        final var extent = getValue() * .75;
        g2d.rotate(Math.PI * 2.0 * (-.625 + extent));
        g2d.setStroke(new BasicStroke(2.0f));

        // DRAW VALUE LINE
        g2d.setPaint(trackColor.brighter());
        g2d.drawLine(middle / 2, 0, middle - 2, 0);

        // DRAW KNOB VALUE INDICATOR LINE
        g2d.setPaint(trackColor);

//        var len = (int)(size * .35);
        int notchWidth = size / 9;
        int notchAdj = notchWidth / 2;
        var len = knobCenterSize / 2 + notchWidth;
        g2d.setStroke(new BasicStroke(1.0f));
        g2d.fillRoundRect(-notchAdj, -notchAdj,
                len, notchWidth, notchWidth, notchWidth);

        g2d.setPaint(Color.BLACK);

        g2d.drawRoundRect(-notchAdj, -notchAdj,
                len, notchWidth, notchWidth, notchWidth);

        // restore state
        g2d.setTransform(initialTransform);

        return;

//        // Paint the "markers"
//        for (double a2 = START_ANG; a2 >= START_ANG - LENGTH_ANG; a2 = a2
//                - (double) (LENGTH_ANG / 10.01)) {
//            int x = 10 + size / 2 + (int) ((6 + size / 2) * Math.cos(a2));
//            int y = 10 + size / 2 - (int) ((6 + size / 2) * Math.sin(a2));
//            g.drawLine(10 + size / 2, 10 + size / 2, x, y);
//
//        }
        // Set the position of the Zero
        // g.drawString("0", 2, size + 10);
        // Paint focus if in focus
//        if (hasFocus()) {
//            g.setColor(focusColor);
//        } else {
//            g.setColor(Color.white);
//        }
//
//        g.fillOval(10, 10, size, size);
//        g.setColor(Color.gray);
//        g.fillOval(14 + SHADOWX, 14 + SHADOWY, size - 8, size - 8);
//
//        g.setColor(Color.black);
//        g.drawArc(10, 10, size, size, 315, 270);
//        g.fillOval(14, 14, size - 8, size - 8);
//        g.setColor(Color.white);
//
//        int x = 10 + size / 2 + (int) (size / 2 * Math.cos(ang));
//        int y = 10 + size / 2 - (int) (size / 2 * Math.sin(ang));
//        g.drawLine(10 + size / 2, 10 + size / 2, x, y);
//        g.setColor(Color.gray);
//        int s2 = Math.max(size / 6, 6);
//        g.drawOval(10 + s2, 10 + s2, size - s2 * 2, size - s2 * 2);
//
//        int dx = (int) (2 * Math.sin(ang));
//        int dy = (int) (2 * Math.cos(ang));
//        g.drawLine(10 + dx + size / 2, 10 + dy + size / 2, x, y);
//        g.drawLine(10 - dx + size / 2, 10 - dy + size / 2, x, y);
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
