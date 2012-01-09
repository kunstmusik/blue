package blue.utility;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

import blue.BlueSystem;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Toolkit;
import java.awt.event.KeyEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import javax.swing.*;

public class GUI {

    public static final int ALIGN_LEFT = 0;

    public static final int ALIGN_HORIZONTAL_CENTER = 1;

    public static final int ALIGN_RIGHT = 2;

    public static final int ALIGN_TOP = 3;

    public static final int ALIGN_VERTICAL_CENTER = 4;

    public static final int ALIGN_BOTTOM = 5;

    public static final int DISTRIBUTE_LEFT = 0;

    public static final int DISTRIBUTE_HORIZONTAL_CENTER = 1;

    public static final int DISTRIBUTE_RIGHT = 2;

    public static final int DISTRIBUTE_TOP = 3;

    public static final int DISTRIBUTE_VERTICAL_CENTER = 4;

    public static final int DISTRIBUTE_BOTTOM = 5;

    private static Comparator leftComparator, horizontalCenterComparator,
            rightComparator, topComparator, verticalCenterComparator,
            bottomComparator;

    static {
        leftComparator = new Comparator() {

            public int compare(Object o1, Object o2) {
                JComponent a = (JComponent) o1;
                JComponent b = (JComponent) o2;

                return a.getX() - b.getX();
            }
        };

        horizontalCenterComparator = new Comparator() {

            public int compare(Object o1, Object o2) {
                JComponent a = (JComponent) o1;
                JComponent b = (JComponent) o2;

                int center1 = a.getX() + (a.getWidth() / 2);
                int center2 = b.getX() + (b.getWidth() / 2);

                return center1 - center2;
            }
        };

        rightComparator = new Comparator() {

            public int compare(Object o1, Object o2) {
                JComponent a = (JComponent) o1;
                JComponent b = (JComponent) o2;

                return (a.getX() + a.getWidth()) - (b.getX() + b.getWidth());
            }
        };

        topComparator = new Comparator() {

            public int compare(Object o1, Object o2) {
                JComponent a = (JComponent) o1;
                JComponent b = (JComponent) o2;

                return a.getY() - b.getY();
            }
        };

        verticalCenterComparator = new Comparator() {

            public int compare(Object o1, Object o2) {
                JComponent a = (JComponent) o1;
                JComponent b = (JComponent) o2;

                int center1 = a.getY() + (a.getHeight() / 2);
                int center2 = b.getY() + (b.getHeight() / 2);

                return center1 - center2;
            }
        };

        bottomComparator = new Comparator() {

            public int compare(Object o1, Object o2) {
                JComponent a = (JComponent) o1;
                JComponent b = (JComponent) o2;

                return (a.getY() + a.getHeight()) - (b.getY() + b.getHeight());
            }
        };
    }

    public static void align(ArrayList jComponents, int type) {
        int left, right, top, bottom, center;

        switch (type) {
            case ALIGN_LEFT:
                left = Integer.MAX_VALUE;

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    if (comp.getX() < left) {
                        left = comp.getX();
                    }
                }

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    comp.setLocation(left, comp.getY());
                }

                break;
            case ALIGN_HORIZONTAL_CENTER:
                left = Integer.MAX_VALUE;
                right = 0;

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    if (comp.getX() < left) {
                        left = comp.getX();
                    }
                    int rightSide = comp.getX() + comp.getWidth();
                    if (rightSide > right) {
                        right = rightSide;
                    }
                }

                center = ((right - left) / 2) + left;

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();

                    comp.setLocation(center - (comp.getWidth() / 2), comp
                            .getY());
                }

                break;
            case ALIGN_RIGHT:
                right = 0;

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    int rightSide = comp.getX() + comp.getWidth();
                    if (rightSide > right) {
                        right = rightSide;
                    }
                }

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    comp.setLocation(right - comp.getWidth(), comp.getY());
                }

                break;
            case ALIGN_TOP:
                top = Integer.MAX_VALUE;

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    if (comp.getY() < top) {
                        top = comp.getY();
                    }
                }

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    comp.setLocation(comp.getX(), top);
                }
                break;
            case ALIGN_VERTICAL_CENTER:
                top = Integer.MAX_VALUE;
                bottom = 0;

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    if (comp.getY() < top) {
                        top = comp.getY();
                    }
                    int bottomSide = comp.getY() + comp.getHeight();
                    if (bottomSide > bottom) {
                        bottom = bottomSide;
                    }
                }

                center = ((bottom - top) / 2) + top;

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();

                    comp.setLocation(comp.getX(), center
                            - (comp.getHeight() / 2));
                }
                break;
            case ALIGN_BOTTOM:
                bottom = 0;

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    int bottomSide = comp.getY() + comp.getHeight();
                    if (bottomSide > bottom) {
                        bottom = bottomSide;
                    }
                }

                for (Iterator iter = jComponents.iterator(); iter.hasNext();) {
                    JComponent comp = (JComponent) iter.next();
                    comp.setLocation(comp.getX(), bottom - comp.getHeight());
                }
                break;

        }
    }

    public static void distribute(ArrayList jComponents, int type) {
        if (jComponents == null || jComponents.size() < 3) {
            return;
        }

        int size = jComponents.size();
        int spacing, firstCenter, lastCenter;
        JComponent first, last;

        switch (type) {
            case DISTRIBUTE_LEFT:
                Collections.sort(jComponents, leftComparator);

                first = (JComponent) jComponents.get(0);
                last = (JComponent) jComponents.get(size - 1);

                spacing = (last.getX() - first.getX()) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    JComponent comp = (JComponent) jComponents.get(i);

                    int newX = (i * spacing) + first.getX();

                    comp.setLocation(newX, comp.getY());
                }

                break;
            case DISTRIBUTE_HORIZONTAL_CENTER:
                Collections.sort(jComponents, horizontalCenterComparator);

                first = (JComponent) jComponents.get(0);
                last = (JComponent) jComponents.get(size - 1);

                firstCenter = first.getX() + (first.getWidth() / 2);
                lastCenter = last.getX() + (last.getWidth() / 2);

                spacing = (lastCenter - firstCenter) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    JComponent comp = (JComponent) jComponents.get(i);

                    int newX = (i * spacing) + firstCenter;
                    newX = newX - (comp.getWidth() / 2);

                    comp.setLocation(newX, comp.getY());
                }

                break;
            case DISTRIBUTE_RIGHT:
                Collections.sort(jComponents, rightComparator);

                first = (JComponent) jComponents.get(0);
                last = (JComponent) jComponents.get(size - 1);

                spacing = ((last.getX() + last.getWidth()) - (first.getX() + first
                        .getWidth()))
                        / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    JComponent comp = (JComponent) jComponents.get(i);

                    int newX = (i * spacing) + first.getX() + first.getWidth();
                    newX = newX - comp.getWidth();

                    comp.setLocation(newX, comp.getY());
                }
                break;
            case DISTRIBUTE_TOP:
                Collections.sort(jComponents, topComparator);

                first = (JComponent) jComponents.get(0);
                last = (JComponent) jComponents.get(size - 1);

                spacing = (last.getY() - first.getY()) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    JComponent comp = (JComponent) jComponents.get(i);

                    int newY = (i * spacing) + first.getY();

                    comp.setLocation(comp.getX(), newY);
                }

                break;
            case DISTRIBUTE_VERTICAL_CENTER:
                Collections.sort(jComponents, verticalCenterComparator);

                first = (JComponent) jComponents.get(0);
                last = (JComponent) jComponents.get(size - 1);

                firstCenter = first.getY() + (first.getHeight() / 2);
                lastCenter = last.getY() + (last.getHeight() / 2);

                spacing = (lastCenter - firstCenter) / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    JComponent comp = (JComponent) jComponents.get(i);

                    int newY = (i * spacing) + firstCenter;
                    newY = newY - (comp.getHeight() / 2);

                    comp.setLocation(comp.getX(), newY);
                }
                break;
            case DISTRIBUTE_BOTTOM:
                Collections.sort(jComponents, bottomComparator);

                first = (JComponent) jComponents.get(0);
                last = (JComponent) jComponents.get(size - 1);

                spacing = ((last.getY() + last.getHeight()) - (first.getY() + first
                        .getHeight()))
                        / (size - 1);

                for (int i = 1; i < size - 1; i++) {
                    JComponent comp = (JComponent) jComponents.get(i);

                    int newY = (i * spacing) + first.getY() + first.getHeight();
                    newY = newY - comp.getHeight();

                    comp.setLocation(comp.getX(), newY);
                }
                break;

        }
    }

    public static void centerOnScreen(Component comp) {
        Dimension screenDim = Toolkit.getDefaultToolkit().getScreenSize();
        comp.setLocation((screenDim.width - comp.getSize().width) / 2,
                (screenDim.height - comp.getSize().height) / 2);
    }

    public static void adjustIfOffScreen(JDialog dialog) {
        Dimension d = Toolkit.getDefaultToolkit().getScreenSize();
        int x = dialog.getX();
        int y = dialog.getY();
        int w = dialog.getWidth();
        int h = dialog.getHeight();
        if (x + w > d.width) {
            x = d.width - w;
        }
        if (x < 0) {
            x = 0;
        }
        if (y + h > d.height) {
            y = d.height - h;
        }
        if (y < 0) {
            y = 0;
        }
        dialog.setLocation(x, y);
    }

    public static void showComponentAsStandalone(Component comp, String title,
            boolean exitOnClose) {
        JFrame mFrame = new JFrame();
        mFrame.setTitle(title);

        mFrame.setSize(800, 600);
        mFrame.getContentPane().add(comp);
        blue.utility.GUI.centerOnScreen(mFrame);

        if (exitOnClose) {
            mFrame.addWindowListener(new WindowAdapter() {

                public void windowClosing(WindowEvent e) {
                    System.exit(0);
                }
            });
        }

        mFrame.show();
    }

    public static void setBlueLookAndFeel() {
//        LookAndFeel plaf = new blue.plaf.BlueLookAndFeel();
//
//        try {
//            UIManager.setLookAndFeel(plaf);
//        } catch (Exception e) {
//            e.printStackTrace();
//        }
    }

    public static void setAllEnabled(Component c, boolean enabled,
            boolean recurse) {
        if (c == null || !(c instanceof JComponent)) {
            return;
        }

        c.setEnabled(enabled);

        Component comp[] = ((JComponent) c).getComponents();

        for (int i = 0; i < comp.length; i++) {
            comp[i].setEnabled(enabled);

            if (recurse) {
                setAllEnabled(comp[i], enabled, true);
            }
        }

    }

    public static void setupForOSX(InputMap inputMap) {
        KeyStroke[] keys = inputMap.allKeys();

        if (keys == null) {
            return;
        }

        for (int i = 0; i < keys.length; i++) {

            boolean found = false;

            int modifiers = keys[i].getModifiers();

            if ((keys[i].getModifiers() & KeyEvent.CTRL_DOWN_MASK) == KeyEvent.CTRL_DOWN_MASK) {
                modifiers = modifiers - KeyEvent.CTRL_DOWN_MASK;
                found = true;
            }

            if ((keys[i].getModifiers() & KeyEvent.CTRL_MASK) == KeyEvent.CTRL_MASK) {
                modifiers = modifiers - KeyEvent.CTRL_MASK;
                found = true;
            }

            if (found) {
                modifiers = modifiers | BlueSystem.getMenuShortcutKey();
                KeyStroke keystroke = KeyStroke.getKeyStroke(keys[i]
                        .getKeyCode(), modifiers, keys[i].isOnKeyRelease());

                Object obj = inputMap.get(keys[i]);
                inputMap.remove(keys[i]);
                inputMap.put(keystroke, obj);

                // System.out.println("Old Key: " + keys[i]);
                // System.out.println("New Key: " + keystroke);

            }
        }

    }

}
