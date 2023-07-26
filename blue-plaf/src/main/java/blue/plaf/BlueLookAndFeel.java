package blue.plaf;

import java.awt.Color;
import java.awt.Component;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.Toolkit;
import java.awt.event.KeyEvent;
import javax.swing.BorderFactory;
import javax.swing.InputMap;
import javax.swing.KeyStroke;
import javax.swing.UIDefaults;
import javax.swing.border.AbstractBorder;
import javax.swing.border.EmptyBorder;
import javax.swing.border.LineBorder;
import javax.swing.plaf.ColorUIResource;
import javax.swing.plaf.FontUIResource;
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

    @Override
    public String getID() {
        return "Blue";
    }

    @Override
    public String getName() {
        return "Blue";
    }

    @Override
    public String getDescription() {
        return "Look and Feel for 'blue'";
    }

    @Override
    public boolean isNativeLookAndFeel() {
        return false;
    }

    @Override
    public boolean isSupportedLookAndFeel() {
        return true;
    }

    @Override
    protected void initClassDefaults(UIDefaults table) {
        super.initClassDefaults(table);
        
        putDefault(table, "ButtonUI");
        putDefault(table, "ComboBoxUI");
        putDefault(table, "ToggleButtonUI");
        putDefault(table, "TabbedPaneUI");
        putDefault(table, "TableHeaderUI");
        putDefault(table, "TextFieldUI");
        // putDefault(table, "PasswordFieldUI");
        // putDefault(table, "ListUI"); // you might want to delete this line
        putDefault(table, "MenuBarUI");
        putDefault(table, "ToolTipUI");

        putDefault(table, "SplitPaneUI");

        putDefault(table, "SliderUI");
        // putDefault(table, "MenuItemUI");
        // putDefault(table, "MenuUI");
        putDefault(table, "ToolBarUI");
        putDefault(table, "ScrollBarUI");
        putDefault(table, "ScrollPaneUI");
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

    @Override
    public UIDefaults getDefaults() {
//        blueTheme = new BlueTheme();
//        setCurrentTheme(blueTheme);
        return super.getDefaults();
    }

    @Override
    protected void initComponentDefaults(UIDefaults table) {
        super.initComponentDefaults(table);
        
        Font controlFont = new Font("Roboto", Font.PLAIN, 12); //NOI18N
        
        Object[] defaults = {
        
            "CheckBox.icon", BlueIconFactory.getCheckBoxIcon(),
            "RadioButton.icon", BlueIconFactory.getRadioButtonIcon(),
          
            
            "Table.gridColor", new javax.swing.plaf.ColorUIResource(
                getCurrentTheme().getControl()),
            
            "SplitPane.highlight", table.getColor("controlShadow"),
            "SplitPane.darkShadow", table.getColor("window"),
            "SplitPane.dividerSize", new Integer(5),

            "Table.cellNoFocusBorder", new EmptyBorder(7,3,7,3),

            "Table.focusSelectedCellHighlightBorder", BorderFactory.createCompoundBorder(
            new LineBorder(getCurrentTheme().getFocusColor()),new EmptyBorder(6,2,6,2)),
            "Table.focusCellHighlightBorder", new EmptyBorder(7,3,7,3),
//            "Table.rowHeight", 28,

            "TableHeader.cellBorder", new BlueTableBorder(),

            "ToolTip.foreground", new ColorUIResource(Color.black),

            "Button.border", BlueBorderUtilities.getButtonBorder(),
//            "Button.border", new BorderUIResource.CompoundBorderUIResource(BorderFactory.createEtchedBorder(EtchedBorder.LOWERED), new BasicBorders.MarginBorder()),
            "ToggleButton.border", BlueBorderUtilities
                    .getToggleButtonBorder(),
            "TextField.border", BlueBorderUtilities.getTextFieldBorder(),
            "TableHeader.cellBorder", new BlueTableHeaderBorder(),

            "SplitPane.dividerSize", new Integer(6),

            "ScrollPane.border", BorderFactory.createLineBorder(getCurrentTheme().getControl()),
            "ScrollPane.viewportBorder", null,
            
            "ScrollBar.width", 14,
            "ScrollBar.background", getCurrentTheme().getControl().darker(),
            "ScrollBar.shadow", getCurrentTheme().getControl().darker(),
            "ScrollBar.darkShadow", getCurrentTheme().getControl().darker(),
            
            "Slider.horizontalThumbIcon", BlueIconFactory.getHorizontalSliderThumbIcon(),
            "Slider.verticalThumbIcon", BlueIconFactory.getVerticalSliderThumbIcon(),
            
            "Spinner.border", BlueBorderUtilities.getTextFieldBorder(),
            "Spinner.arrowButtonBorder", BlueBorderUtilities.getButtonBorder(),
            "Spinner.background", Color.BLACK,
            
            // FONTS
            
            "Button.font", controlFont,
            "ToggleButton.font", controlFont,
            "RadioButton.font", controlFont,
            "CheckBox.font", controlFont,
            "ColorChooser.font", controlFont,
            "ComboBox.font", controlFont,
            "Label.font", controlFont,
            "List.font", controlFont,
            "MenuBar.font", controlFont,
            "MenuItem.font", controlFont,
            "RadioButtonMenuItem.font", controlFont,
            "CheckBoxMenuItem.font", controlFont,
            "Menu.font", controlFont,
            "PopupMenu.font", controlFont,
            "OptionPane.font", controlFont,
            "Panel.font", controlFont,
            "ProgressBar.font", controlFont,
            "ScrollPane.font", controlFont,
            "Viewport.font", controlFont,
            "TabbedPane.font", controlFont,
            "Table.font", controlFont,
            "TableHeader.font", controlFont,
            "TextField.font", controlFont,
            "PasswordField.font", controlFont,
            "TextArea.font", controlFont,
            "TextPane.font", controlFont,
            "EditorPane.font", controlFont,
            "TitledBorder.font", controlFont,
            "ToolBar.font", controlFont,
            "ToolTip.font", controlFont,
            "Tree.font", controlFont,

        };

        table.putDefaults(defaults);

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

    @Override
    protected void initSystemColorDefaults(UIDefaults table) {
        super.initSystemColorDefaults(table);
        // we made the color a bit darker because the were complaints about the
        // color
        // being very difficult to see
        table.put("textHighlight", getTranslucentColor(getTextHighlightColor(),
                128));
        table.put("text", getBlack());
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

    @Override
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

    @Override
    public Insets getBorderInsets(Component c) {
        return editorBorderInsets;
    }
}