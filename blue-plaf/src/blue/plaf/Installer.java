/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.plaf;

import blue.plaf.netbeans.BlueLFCustoms;
import java.awt.Color;
import java.awt.EventQueue;
import java.awt.event.KeyEvent;
import java.lang.reflect.InvocationTargetException;
import java.util.Map;
import java.util.logging.Logger;
import javax.swing.BorderFactory;
import javax.swing.KeyStroke;
import javax.swing.LookAndFeel;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import javax.swing.UnsupportedLookAndFeelException;
import javax.swing.plaf.InputMapUIResource;
import javax.swing.plaf.metal.MetalLookAndFeel;
import org.netbeans.swing.tabcontrol.plaf.*;
import org.openide.modules.ModuleInstall;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.windows.WindowManager;

/**
 * Manages a module's lifecycle. Remember that an installer is optional and
 * often not needed at all.
 */
public class Installer extends ModuleInstall {

    Logger logger = Logger.getLogger("blue.plaf.Installer");

    @Override
    public void restored() {

        // Initiate TimingFramework
//        TimingSource source = new SwingTimerTimingSource(30, TimeUnit.MILLISECONDS);
//        Animator.setDefaultTimingSource(source); // shared timing source
//        source.init(); // starts the timer
        //RepaintManager.setCurrentManager(new CheckThreadViolationRepaintManager()); 
        EventQueue.invokeLater(new Runnable() {

            @Override
            public void run() {
                boolean isMac = System.getProperty("os.name").toLowerCase().startsWith(
                        "mac");

                Object[] macEntries = null;
                // Necessary for Node renderers to use swing rendering
                System.setProperty("nb.useSwingHtmlRendering", "true");
                if (isMac) {
                    try {
                        System.setProperty("apple.laf.useScreenMenuBar", "true");

                        UIManager.setLookAndFeel(
                                UIManager.getSystemLookAndFeelClassName());

                        macEntries = new Object[7];

                        macEntries[0] = UIManager.get("MenuBarUI");
                        //macEntries[1] = UIManager.get("MenuUI");
                        //macEntries[2] = UIManager.get("MenuItemUI");
                        macEntries[3] = UIManager.get("CheckboxMenuItemUI");
                        macEntries[4] = UIManager.get("RadioButtonMenuItemUI");
                        macEntries[5] = UIManager.get("PopupMenuUI");
                        macEntries[6] = UIManager.get("PopupMenuSeparatorUI");

                    } catch (ClassNotFoundException ex) {
                        Exceptions.printStackTrace(ex);
                    } catch (InstantiationException ex) {
                        Exceptions.printStackTrace(ex);
                    } catch (IllegalAccessException ex) {
                        Exceptions.printStackTrace(ex);
                    } catch (UnsupportedLookAndFeelException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                }

                try {
                    Integer in = (Integer) UIManager.get("customFontSize"); //NOI18N
                    UIManager.getDefaults().clear();
                   
                    if (in == null || in <= 11) {
                        UIManager.put("customFontSize", 12);
                    } else {
                        UIManager.put("customFontSize", in.intValue());
                    }
                    
                    ClassLoader cl = Lookup.getDefault().lookup(
                            ClassLoader.class);
                    UIManager.put("ClassLoader", cl);
                    UIManager.put("Nb.BlueLFCustoms", new BlueLFCustoms());
                    UIManager.put("swing.boldMetal", "false");
                    MetalLookAndFeel.setCurrentTheme(new BlueTheme());
                    LookAndFeel plaf = new blue.plaf.BlueLookAndFeel();
                    UIManager.setLookAndFeel(plaf);
                } catch (Exception e) {
                    e.printStackTrace();
                }

                UIManager.put(DefaultTabbedContainerUI.KEY_EDITOR_CONTENT_BORDER,
                        BorderFactory.createEmptyBorder());
                UIManager.put(DefaultTabbedContainerUI.KEY_EDITOR_OUTER_BORDER,
                        new BlueViewBorder(UIManager.getColor(
                                        "SplitPane.highlight"),
                                UIManager.getColor("SplitPane.darkShadow")));

                UIManager.put(DefaultTabbedContainerUI.KEY_VIEW_CONTENT_BORDER,
                        BorderFactory.createEmptyBorder());
                UIManager.put(DefaultTabbedContainerUI.KEY_VIEW_OUTER_BORDER,
                        new BlueViewBorder(UIManager.getColor(
                                        "SplitPane.highlight"),
                                UIManager.getColor("SplitPane.darkShadow")));

                UIManager.put("nb.output.foreground", Color.WHITE); //NOI18N

                if (isMac && macEntries != null) {
                    UIManager.put("MenuBarUI", macEntries[0]);
                    //UIManager.put("MenuUI", macEntries[1]);
                    //UIManager.put("MenuItemUI", macEntries[2]);
                    UIManager.put("CheckboxMenuItemUI", macEntries[3]);
                    UIManager.put("RadioButtonMenuItemUI", macEntries[4]);
                    UIManager.put("PopupMenuUI", macEntries[5]);
                    UIManager.put("PopupMenuSeparatorUI", macEntries[6]);
                }

                if (isMac) {
                    replaceCtrlShortcutsWithMacShortcuts();

                }

                logger.info("Finished blue PLAF installation");

                MacFullScreenUtil.setWindowCanFullScreen(
                        WindowManager.getDefault().getMainWindow());

            }

        });
    }

    /**
     * Replaces ctrl- shortcuts with command- shortcuts for OSX
     */
    protected void replaceCtrlShortcutsWithMacShortcuts() {

        for (Object keyObj : UIManager.getLookAndFeelDefaults().keySet()) {
            String key = keyObj.toString();

            if (key.contains("InputMap")) {

                //System.out.println("MAP: " + key);
                Object val = UIManager.getLookAndFeelDefaults().get(key);

                if (val instanceof InputMapUIResource) {
                    InputMapUIResource map = (InputMapUIResource) val;

                    for (KeyStroke keyStroke : map.allKeys()) {

                        int modifiers = keyStroke.getModifiers();

                        if ((modifiers & KeyEvent.CTRL_MASK) > 0) {
                            modifiers -= KeyEvent.CTRL_DOWN_MASK;
                            modifiers -= KeyEvent.CTRL_MASK;
                            modifiers += KeyEvent.META_DOWN_MASK + KeyEvent.META_MASK;

                            KeyStroke k = KeyStroke.getKeyStroke(
                                    keyStroke.getKeyCode(), modifiers);

                            Object mapVal = map.get(keyStroke);
                            map.remove(keyStroke);
                            map.put(k, mapVal);

//                            System.out.println("Old: " + keyStroke);
//                            System.out.println("New: " + k);
                        }

                    }
                }
            }

        }

    }
}
