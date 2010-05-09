package blue.plaf;

import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Insets;

import java.awt.Toolkit;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import java.util.Enumeration;
import javax.swing.InputMap;
import javax.swing.KeyStroke;
import javax.swing.UIDefaults;
import javax.swing.border.AbstractBorder;
import javax.swing.plaf.ColorUIResource;
import javax.swing.plaf.InputMapUIResource;
import javax.swing.plaf.metal.MetalLookAndFeel;


/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class BlueLookAndFeel extends MetalLookAndFeel {
    static BlueTheme blueTheme;

    public BlueLookAndFeel() {
        super();

    }

    public String getID() {
        return "Blue";
    }

    public String getName() {
        return "Blue";
    }

    public String getDescription() {
        return "Look and Feel for 'blue'";
    }

    public boolean isNativeLookAndFeel() {
        return false;
    }

    public boolean isSupportedLookAndFeel() {
        return true;
    }

    protected void initClassDefaults(UIDefaults table) {
        super.initClassDefaults(table);

        // putDefault(table, "ButtonUI");
        // putDefault(table, "ToggleButtonUI");
        putDefault(table, "TabbedPaneUI");
        putDefault(table, "TextFieldUI");
        // putDefault(table, "TextFieldUI");
        // putDefault(table, "PasswordFieldUI");
        // putDefault(table, "ListUI"); // you might want to delete this line
        putDefault(table, "MenuBarUI");
        putDefault(table, "ToolTipUI");

        putDefault(table, "SplitPaneUI");

        // putDefault(table, "MenuItemUI");
        // putDefault(table, "MenuUI");
        putDefault(table, "ToolBarUI");
        putDefault(table, "ScrollBarUI");
        putDefault(table, "TableUI");

        // putDefault(table, "ScrollButton");
        // putDefault(table, "TableHeaderUI");
        // putDefault(table, "CheckBoxUI");
        // try {
        // String className =
        // "com.incors.plaf.kunststoff.KunststoffCheckBoxIcon";
        // table.put("CheckBox.icon", className);
        // } catch (Exception ex) {
        // ex.printStackTrace();
        // }

        // table.put("SplitPaneUI", "javax.swing.plaf.basic.BasicSplitPaneUI");

        // Set entries = table.entrySet();
        // Iterator iter = entries.iterator();
        //
        // while (iter.hasNext()) {
        // System.out.println(iter.next());
        // }
        //

    }

    protected void putDefault(UIDefaults table, String uiKey) {
        try {
            String className = "blue.plaf.Blue" + uiKey;
            table.put(uiKey, className);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    public UIDefaults getDefaults() {
        blueTheme = new BlueTheme();
        setCurrentTheme(blueTheme);
        return super.getDefaults();
    }

    protected void initComponentDefaults(UIDefaults table) {
        super.initComponentDefaults(table);
        table.put("Table.gridColor", new javax.swing.plaf.ColorUIResource(
                Color.darkGray));
        table.put("SplitPane.highlight", table.getColor("controlShadow"));
        table.put("SplitPane.darkShadow", table.getColor("window"));
        table.put("SplitPane.dividerSize", new Integer(5));

        table.put("TableHeader.cellBorder", new BlueTableBorder());

        table.put("ToolTip.foreground", new ColorUIResource(Color.black));

        // Object a = table.get("Scrollbar.hilight");
        // table.put("Scrollbar.hilight", table.get("Scrollbar.shadow"));
        // table.put("Scrollbar.shadow", a);

        table.put("Button.border", BlueBorderUtilities.getButtonBorder());
        table.put("ToggleButton.border", BlueBorderUtilities
                .getToggleButtonBorder());
        table.put("TextField.border", BlueBorderUtilities.getTextFieldBorder());
        table.put("TableHeader.cellBorder", new BlueTableHeaderBorder());

        table.put("SplitPane.dividerSize", new Integer(6));

        table.put("ScrollPane.border", BlueBorderUtilities.getTextBorder());

        // table.put("Menu.font", new FontUIResource("Dialog", Font.PLAIN, 12));
        // table.put("MenuItem.font", new FontUIResource("Dialog", Font.PLAIN,
        // 12));

//        String osName = System.getProperty("os.name");
//
//        if (osName.toLowerCase().indexOf("mac") >= 0) {
//
//            Enumeration keys = table.keys();
//
//            ArrayList inputMapKeys = new ArrayList();
//
//            while (keys.hasMoreElements()) {
//                String key = keys.nextElement().toString();
//
//                if (key.indexOf("InputMap") >= 0) {
//                    inputMapKeys.add(key);
//                }
//            }
//
//            for (int i = 0; i < inputMapKeys.size(); i++) {
//                Object obj = table.get(inputMapKeys.get(i));
//
//                if (obj instanceof InputMapUIResource) {
//                    InputMapUIResource inputMap = (InputMapUIResource) obj;
//
//                    setupForOSX(inputMap);
//                }
//            }
//
//        }
    }

    private void setupForOSX(InputMap inputMap) {
        KeyStroke[] keys = inputMap.allKeys();

        if (keys == null) {
            return;
        }

        int menuShortcutKey = Toolkit.getDefaultToolkit()
                    .getMenuShortcutKeyMask();

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
                modifiers = modifiers | menuShortcutKey;
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

    protected void initSystemColorDefaults(UIDefaults table) {
        super.initSystemColorDefaults(table);
        // we made the color a bit darker because the were complaints about the
        // color
        // being very difficult to see
        table.put("textHighlight", getTranslucentColor(getTextHighlightColor(),
                128));
    }

    // helper to simplify creation of translucent colors
    private Color getTranslucentColor(Color c, int alpha) {
        return new Color(c.getRed(), c.getGreen(), c.getBlue(), alpha);
    }

    /**
     * Gets the upper gradient color for components like JButton, JMenuBar and
     * JProgressBar.
     * 
     * @return The gradient reflection color.
     */
    public static Color getGradientReflection() {
        return blueTheme.getGradientReflection();
    }

    /**
     * Gets the lower gradient color for components like JButton, JMenuBar and
     * JProgressBar.
     * 
     * @return The gradient shadow color.
     */
    public static Color getGradientShadow() {
        return blueTheme.getGradientShadow();
    }

    /**
     * Gets the transluscent variation of the upper gradient color for
     * components like JButton, JMenuBar and JProgressBar.
     * 
     * @return The transluscent gradient reflection color.
     */
    public static Color getGradientTranslucentReflection() {
        return blueTheme.getGradientTranslucentReflection();
    }

    /**
     * Gets the transluscent variation of the lower gradient color for
     * components like JButton, JMenuBar and JProgressBar.
     * 
     * @return The transluscent gradient shadow color.
     */
    public static Color getGradientTranslucentShadow() {
        return blueTheme.getGradientTranslucentShadow();
    }

}

class BlueTableBorder extends AbstractBorder {

    protected Insets editorBorderInsets = new Insets(2, 2, 2, 0);

    public void paintBorder(Component c, Graphics g, int x, int y, int w, int h) {
        g.translate(x, y);

        g.setColor(BlueLookAndFeel.getControlHighlight());
        g.drawLine(w - 1, 0, w - 1, h - 1);
        g.drawLine(1, h - 1, w - 1, h - 1);
        g.setColor(BlueLookAndFeel.getControlDarkShadow());
        g.drawLine(0, 0, w - 2, 0);
        g.drawLine(0, 0, 0, h - 2);

        g.translate(-x, -y);
    }

    public Insets getBorderInsets(Component c) {
        return editorBorderInsets;
    }
}