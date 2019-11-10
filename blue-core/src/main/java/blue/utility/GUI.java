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
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import javax.swing.*;

public class GUI {

    

    

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

                @Override
                public void windowClosing(WindowEvent e) {
                    System.exit(0);
                }
            });
        }

        mFrame.setVisible(true);
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

        Component[] comp = ((JComponent) c).getComponents();

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
