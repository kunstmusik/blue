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

import blue.plaf.fonts.Fonts;
import com.formdev.flatlaf.FlatLaf;
import java.awt.Color;
import java.awt.event.KeyEvent;
import java.util.logging.Logger;
import java.util.prefs.Preferences;
import javax.swing.BorderFactory;
import javax.swing.KeyStroke;
import javax.swing.UIManager;
import javax.swing.UnsupportedLookAndFeelException;
import javax.swing.plaf.InputMapUIResource;
import org.netbeans.swing.tabcontrol.plaf.*;
import org.openide.modules.ModuleInstall;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;
import org.openide.windows.WindowManager;

/**
 * Manages a module's lifecycle. Remember that an installer is optional and
 * often not needed at all.
 */
public class Installer extends ModuleInstall {

    Logger logger = Logger.getLogger("blue.plaf.Installer");
//    private BlueLFCustoms customs = new BlueLFCustoms();

    @Override
    public void validate() throws IllegalStateException {
        Fonts.registerRobotoFonts();
        
       Preferences prefs = NbPreferences.root().node("laf");
       prefs.put("laf", "com.formdev.flatlaf.FlatDarkLaf");

//        UIManager.put("Nb.BlueLFCustoms", customs);
//        UIManager.put("nb.dark.theme", true);
        boolean isMac = System.getProperty("os.name").toLowerCase().startsWith(
                "mac");

        Object[] macEntries = null;
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
//                UIManager.getDefaults().clear();

            if (in == null || in <= 11) {
                UIManager.put("customFontSize", 12
                //                                (int) Math.ceil(Font.getDefault().getSize())
                );
            } else {
                UIManager.put("customFontSize", in.intValue());
            }
//            UIManager.installLookAndFeel("Blue", BlueLookAndFeel.class.getName());
//            UIManager.put("Nb.BlueLFCustoms", customs);
//            UIManager.put("swing.boldMetal", false);
//            MetalLookAndFeel.setCurrentTheme(new BlueTheme());
//            LookAndFeel plaf = new blue.plaf.BlueLookAndFeel();
//            UIManager.setLookAndFeel(plaf);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Doing this work here since there appears to be some kind of race 
        // condition and sometimes BlueLFCustoms isn't found when app starts...
        // Doing this work here ensures the keys/values are registered and tab
        // colors are correct 
//        UIManager.getDefaults().putDefaults(customs.createGuaranteedKeysAndValues());
//        UIManager.getDefaults().putDefaults(customs.createApplicationSpecificKeysAndValues());
//        UIManager.getDefaults().putDefaults(customs.createLookAndFeelCustomizationKeysAndValues());

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

        // let comboboxes be smaller than 72px
        // see https://github.com/kunstmusik/blue/issues/719
        UIManager.put( "ComboBox.minimumWidth", 0 );

        
//        BlueLaf.setup();
        FlatLaf.registerCustomDefaultsSource("blue.plaf.themes", getClass().getClassLoader());

        logger.info("Finished blue PLAF installation");

    }

    @Override
    public void restored() {
//        System.setProperty("awt.useSystemAAFontSettings","lcd");
        // Initiate TimingFramework
//        TimingSource source = new SwingTimerTimingSource(30, TimeUnit.MILLISECONDS);
//        Animator.setDefaultTimingSource(source); // shared timing source
//        source.init(); // starts the timer
        //RepaintManager.setCurrentManager(new CheckThreadViolationRepaintManager()); 
//        EventQueue.invokeLater(() -> {
//            boolean isMac = System.getProperty("os.name").toLowerCase().startsWith(
//                    "mac");
//
//            Object[] macEntries = null;
//            if (isMac) {
//                try {
//                    System.setProperty("apple.laf.useScreenMenuBar", "true");
//
//                    UIManager.setLookAndFeel(
//                            UIManager.getSystemLookAndFeelClassName());
//
//                    macEntries = new Object[7];
//
//                    macEntries[0] = UIManager.get("MenuBarUI");
//                    //macEntries[1] = UIManager.get("MenuUI");
//                    //macEntries[2] = UIManager.get("MenuItemUI");
//                    macEntries[3] = UIManager.get("CheckboxMenuItemUI");
//                    macEntries[4] = UIManager.get("RadioButtonMenuItemUI");
//                    macEntries[5] = UIManager.get("PopupMenuUI");
//                    macEntries[6] = UIManager.get("PopupMenuSeparatorUI");
//
//                } catch (ClassNotFoundException ex) {
//                    Exceptions.printStackTrace(ex);
//                } catch (InstantiationException ex) {
//                    Exceptions.printStackTrace(ex);
//                } catch (IllegalAccessException ex) {
//                    Exceptions.printStackTrace(ex);
//                } catch (UnsupportedLookAndFeelException ex) {
//                    Exceptions.printStackTrace(ex);
//                }
//            }
//
//            try {
//                Integer in = (Integer) UIManager.get("customFontSize"); //NOI18N
//                UIManager.getDefaults().clear();
//
//                if (in == null || in <= 11) {
//                    UIManager.put("customFontSize", 12
//                    //                                (int) Math.ceil(Font.getDefault().getSize())
//                    );
//                } else {
//                    UIManager.put("customFontSize", in.intValue());
//                }
//                ClassLoader cl = Lookup.getDefault().lookup(
//                        ClassLoader.class);
//                UIManager.put("ClassLoader", cl);
//                UIManager.put("Nb.BlueLFCustoms", customs);
//                UIManager.put("swing.boldMetal", false);
//                MetalLookAndFeel.setCurrentTheme(new BlueTheme());
//                LookAndFeel plaf = new blue.plaf.BlueLookAndFeel();
//                UIManager.setLookAndFeel(plaf);
//            } catch (Exception e) {
//                e.printStackTrace();
//            }
//
//            UIManager.put(DefaultTabbedContainerUI.KEY_EDITOR_CONTENT_BORDER,
//                    BorderFactory.createEmptyBorder());
//            UIManager.put(DefaultTabbedContainerUI.KEY_EDITOR_OUTER_BORDER,
//                    new BlueViewBorder(UIManager.getColor(
//                            "SplitPane.highlight"),
//                            UIManager.getColor("SplitPane.darkShadow")));
//
//            UIManager.put(DefaultTabbedContainerUI.KEY_VIEW_CONTENT_BORDER,
//                    BorderFactory.createEmptyBorder());
//            UIManager.put(DefaultTabbedContainerUI.KEY_VIEW_OUTER_BORDER,
//                    new BlueViewBorder(UIManager.getColor(
//                            "SplitPane.highlight"),
//                            UIManager.getColor("SplitPane.darkShadow")));
//
//            UIManager.put("nb.output.foreground", Color.WHITE); //NOI18N
//
//            if (isMac && macEntries != null) {
//                UIManager.put("MenuBarUI", macEntries[0]);
//                //UIManager.put("MenuUI", macEntries[1]);
//                //UIManager.put("MenuItemUI", macEntries[2]);
//                UIManager.put("CheckboxMenuItemUI", macEntries[3]);
//                UIManager.put("RadioButtonMenuItemUI", macEntries[4]);
//                UIManager.put("PopupMenuUI", macEntries[5]);
//                UIManager.put("PopupMenuSeparatorUI", macEntries[6]);
//            }
//
//            if (isMac) {
//                replaceCtrlShortcutsWithMacShortcuts();
//
//            }
//
//            logger.info("Finished blue PLAF installation");
//
//            MacFullScreenUtil.setWindowCanFullScreen(
//                    WindowManager.getDefault().getMainWindow());
//        });

        WindowManager.getDefault().invokeWhenUIReady(
                () -> {
                    MacFullScreenUtil.setWindowCanFullScreen(
                            WindowManager.getDefault().getMainWindow());
//                    WindowManager.getDefault().updateUI();
//                    SwingUtilities.updateComponentTreeUI(
//                            WindowManager.getDefault().getMainWindow());
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

                    if(map == null || map.allKeys() == null) {
                        return;
                    }
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
