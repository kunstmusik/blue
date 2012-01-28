package blue.plaf;

import java.awt.Color;
import java.awt.Font;

import javax.swing.plaf.ColorUIResource;
import javax.swing.plaf.FontUIResource;
import javax.swing.plaf.metal.DefaultMetalTheme;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class BlueTheme extends DefaultMetalTheme {
        
    private ColorUIResource primary1;

    private ColorUIResource primary2;

    private ColorUIResource primary3;

    private ColorUIResource secondary1;
            
    private ColorUIResource secondary2;

    private ColorUIResource secondary3;
    
    private ColorUIResource black;

    private ColorUIResource white;


    /**
     * The upper gradient color for components like JButton, JMenuBar and
     * JProgressBar.
     */
    private final Color gradientReflection = new Color(255, 255, 255, 86);

    /**
     * The lower gradient color for components like JButton, JMenuBar and
     * JProgressBar.
     */
    private final Color gradientShadow = new Color(188, 188, 180, 100);

    /**
     * The transluscent variation of the upper gradient color for components
     * like JButton, JMenuBar and JProgressBar.
     */
    private final Color gradientTranslucentReflection = new Color(
            gradientReflection.getRGB() & 0x00FFFFFF, true);

    /**
     * The transluscent variation of the lower gradient color for components
     * like JButton, JMenuBar and JProgressBar.
     */
    private final Color gradientTranslucentShadow = new Color(gradientShadow
            .getRGB() & 0x00FFFFFF, true);

    /*
     * private final ColorUIResource primary1 = new ColorUIResource(51,86,153);
     * private final ColorUIResource primary2 = new
     * ColorUIResource(102,137,204); private final ColorUIResource primary3 =
     * new ColorUIResource(46,67,107);
     * 
     * private final ColorUIResource secondary1 = new
     * ColorUIResource(179,196,230); private final ColorUIResource secondary2 =
     * new ColorUIResource(255,255,255); private final ColorUIResource
     * secondary3 = new ColorUIResource(0,0,0);
     */

    private FontUIResource boldFont = new FontUIResource("SansSerif",
            Font.PLAIN, 12);

    private FontUIResource plainFont = new FontUIResource("SansSerif",
            Font.PLAIN, 12);



    // ColorUIResource white = new ColorUIResource(new Color(240, 240, 255));
    // ColorUIResource black = new ColorUIResource(Color.black);

    public BlueTheme() {
       
//        String propFileName = BlueSystem.getUserConfigurationDirectory() +
//                File.separator + "blueTheme.properties";
//
//        Properties properties = new Properties();
//        try {
//            properties.load(new FileInputStream(propFileName));
//
//            String[] parts = properties.getProperty("primary1").split(",");
//            primary1 = new ColorUIResource(Integer.parseInt(parts[0]),
//                    Integer.parseInt(parts[1]),Integer.parseInt(parts[2]));
//
//            parts = properties.getProperty("primary2").split(",");
//            primary2 = new ColorUIResource(Integer.parseInt(parts[0]),
//                    Integer.parseInt(parts[1]),Integer.parseInt(parts[2]));
//
//            parts = properties.getProperty("primary3").split(",");
//            primary3 = new ColorUIResource(Integer.parseInt(parts[0]),
//                    Integer.parseInt(parts[1]),Integer.parseInt(parts[2]));
//
//            parts = properties.getProperty("secondary1").split(",");
//            secondary1 = new ColorUIResource(Integer.parseInt(parts[0]),
//                    Integer.parseInt(parts[1]),Integer.parseInt(parts[2]));
//
//            parts = properties.getProperty("secondary2").split(",");
//            secondary2 = new ColorUIResource(Integer.parseInt(parts[0]),
//                    Integer.parseInt(parts[1]),Integer.parseInt(parts[2]));
//
//            parts = properties.getProperty("secondary3").split(",");
//            secondary3 = new ColorUIResource(Integer.parseInt(parts[0]),
//                    Integer.parseInt(parts[1]),Integer.parseInt(parts[2]));
//
//            parts = properties.getProperty("white").split(",");
//            white = new ColorUIResource(Integer.parseInt(parts[0]),
//                    Integer.parseInt(parts[1]),Integer.parseInt(parts[2]));
//
//            parts = properties.getProperty("black").split(",");
//            black = new ColorUIResource(Integer.parseInt(parts[0]),
//                    Integer.parseInt(parts[1]),Integer.parseInt(parts[2]));
//
//            System.out.println("Using blue theme file: " + propFileName);
//        } catch (Exception e) {
            primary1 = new ColorUIResource(198, 226, 255);
            primary2 = new ColorUIResource(153, 153, 204);
            primary3 = new ColorUIResource(204, 204, 255);
            secondary1 = new ColorUIResource(102, 177, 253);
            secondary2 = new ColorUIResource(63, 102, 150);
            secondary3 = new ColorUIResource(38, 51, 76);
            black = new ColorUIResource(Color.black);
            white = new ColorUIResource(new Color(240, 240, 255));
            //        }
        
    }
    
    public String getName() {
        return "blue";
    }
    
   

    // these are blue in Metal Default Theme



    // these are gray in Metal Default Theme



    /**
     * Returns the primary 1 color.
     *
     * @return the primary 1 color
     */
    protected ColorUIResource getPrimary1() {
        return primary1;
    }

    /**
     * Returns the primary 2 color.
     *
     * @return the primary 2 color
     */
    protected ColorUIResource getPrimary2() {
        return primary2;
    }

    /**
     * Returns the primary 3 color.
     *
     * @return the primary 3 color
     */
    protected ColorUIResource getPrimary3() {
        return primary3;
    }

    /**
     * Returns the secondary 1 color.
     *
     * @return the secondary 1 color
     */
    protected ColorUIResource getSecondary1() {
        return secondary1;
    }

    /**
     * Returns the secondary 2 color.
     *
     * @return the secondary 2 color
     */
    protected ColorUIResource getSecondary2() {
        return secondary2;
    }

    /**
     * Returns the secondary 3 color.
     *
     * @return the secondary 3 color
     */
    protected ColorUIResource getSecondary3() {
        return secondary3;
    }

    /**
     * Returns the control text font.
     *
     * @return the control text font
     */
    public FontUIResource getControlTextFont() {
        return plainFont;
    }

    /**
     * Returns the system text font.
     *
     * @return the system text font
     */
    public FontUIResource getSystemTextFont() {
        return plainFont;
    }
   
    /**
     * Returns the user text font.
     *
     * @return the user text font
     */
    public FontUIResource getUserTextFont() {
        return plainFont;
    } 

    /**
     * Returns the menu text font.
     *
     * @return the menu text font
     */
    public FontUIResource getMenuTextFont() {
        return plainFont;
    }
    /**
     * Returns the window title font.
     *
     * @return the window title font
     */
    public FontUIResource getWindowTitleFont() {
        return boldFont;
    }
    
    /**
     * Returns the sub-text font.
     *
     * @return the sub-text font
     */
    public FontUIResource getSubTextFont() {
        return super.getSubTextFont();
    }

    /**
     * Returns the white color. This returns opaque white
     * ({@code 0xFFFFFFFF}).
     *
     * @return the white color
     */
    protected ColorUIResource getWhite() { return white; }

    /**
     * Returns the black color. This returns opaque black
     * ({@code 0xFF000000}).
     *
     * @return the black color
     */
    protected ColorUIResource getBlack() {
        return black; }

    /**
     * Returns the focus color. This returns the value of
     * {@code getPrimary2()}.
     *
     * @return the focus color
     */
    public ColorUIResource getFocusColor() { return getPrimary2(); }

    /**
     * Returns the desktop color. This returns the value of
     * {@code getPrimary2()}.
     *
     * @return the desktop color
     */
    public  ColorUIResource getDesktopColor() { return getPrimary2(); }

    /**
     * Returns the control color. This returns the value of
     * {@code getSecondary3()}.
     *
     * @return the control color
     */
    public ColorUIResource getControl() { return getSecondary3(); }  

    /**
     * Returns the control shadow color. This returns
     * the value of {@code getSecondary2()}.
     *
     * @return the control shadow color
     */
    public ColorUIResource getControlShadow() { return getSecondary2(); }  

    /**
     * Returns the control dark shadow color. This returns
     * the value of {@code getSecondary1()}.
     *
     * @return the control dark shadow color
     */
    public ColorUIResource getControlDarkShadow() { return getSecondary1(); }  

    /**
     * Returns the control info color. This returns
     * the value of {@code getBlack()}.
     *
     * @return the control info color
     */
    public ColorUIResource getControlInfo() { return getWhite(); } 

    /**
     * Returns the control highlight color. This returns
     * the value of {@code getWhite()}.
     *
     * @return the control highlight color
     */
    public ColorUIResource getControlHighlight() { 
        return getBlack(); }  

    /**
     * Returns the control disabled color. This returns
     * the value of {@code getSecondary2()}.
     *
     * @return the control disabled color
     */
    public ColorUIResource getControlDisabled() { return getSecondary2(); }  

    /**
     * Returns the primary control color. This returns
     * the value of {@code getPrimary3()}.
     *
     * @return the primary control color
     */
    public ColorUIResource getPrimaryControl() { return getPrimary3(); }  

    /**
     * Returns the primary control shadow color. This returns
     * the value of {@code getPrimary2()}.
     *
     * @return the primary control shadow color
     */
    public ColorUIResource getPrimaryControlShadow() { return getPrimary2(); }  
    /**
     * Returns the primary control dark shadow color. This 
     * returns the value of {@code getPrimary1()}.
     *
     * @return the primary control dark shadow color
     */
    public ColorUIResource getPrimaryControlDarkShadow() { return getPrimary1(); }  

    /**
     * Returns the primary control info color. This 
     * returns the value of {@code getBlack()}.
     *
     * @return the primary control info color
     */
    public ColorUIResource getPrimaryControlInfo() { return getWhite(); } 

    /**
     * Returns the primary control highlight color. This 
     * returns the value of {@code getWhite()}.
     *
     * @return the primary control highlight color
     */
    public ColorUIResource getPrimaryControlHighlight() { return getBlack(); }  

    /**
     * Returns the system text color. This returns the value of
     * {@code getBlack()}.
     *
     * @return the system text color
     */
    public ColorUIResource getSystemTextColor() { return getWhite(); }

    /**
     * Returns the control text color. This returns the value of
     * {@code getControlInfo()}.
     *
     * @return the control text color
     */
    public ColorUIResource getControlTextColor() { return getControlInfo(); }  

    /**
     * Returns the inactive control text color. This returns the value of
     * {@code getControlDisabled()}.
     *
     * @return the inactive control text color
     */
    public ColorUIResource getInactiveControlTextColor() { return getControlDisabled(); }  

    /**
     * Returns the inactive system text color. This returns the value of
     * {@code getSecondary2()}.
     *
     * @return the inactive system text color
     */
    public ColorUIResource getInactiveSystemTextColor() { return getSecondary2(); }

    /**
     * Returns the user text color. This returns the value of
     * {@code getBlack()}.
     *
     * @return the user text color
     */
    public ColorUIResource getUserTextColor() { return getWhite(); }

    /**
     * Returns the text highlight color. This returns the value of
     * {@code getPrimary3()}.
     *
     * @return the text highlight color
     */
    public ColorUIResource getTextHighlightColor() { return getPrimary3(); }

    /**
     * Returns the highlighted text color. This returns the value of
     * {@code getControlTextColor()}.
     *
     * @return the highlighted text color
     */
    public ColorUIResource getHighlightedTextColor() { return getControlTextColor(); }

    /**
     * Returns the window background color. This returns the value of
     * {@code getWhite()}.
     *
     * @return the window background color
     */
    public ColorUIResource getWindowBackground() { return getBlack(); }

    /**
     * Returns the window title background color. This returns the value of
     * {@code getPrimary3()}.
     *
     * @return the window title background color
     */
    public ColorUIResource getWindowTitleBackground() { return getPrimary3(); }

    /**
     * Returns the window title foreground color. This returns the value of
     * {@code getBlack()}.
     *
     * @return the window title foreground color
     */
    public ColorUIResource getWindowTitleForeground() { return getWhite(); }  

    /**
     * Returns the window title inactive background color. This
     * returns the value of {@code getSecondary3()}.
     *
     * @return the window title inactive background color
     */
    public ColorUIResource getWindowTitleInactiveBackground() { return getSecondary3(); }

    /**
     * Returns the window title inactive foreground color. This
     * returns the value of {@code getBlack()}.
     *
     * @return the window title inactive foreground color
     */
    public ColorUIResource getWindowTitleInactiveForeground() { return getWhite(); }

    /**
     * Returns the menu background color. This
     * returns the value of {@code getSecondary3()}.
     *
     * @return the menu background color
     */
    public ColorUIResource getMenuBackground() { return getSecondary3(); }

    /**
     * Returns the menu foreground color. This
     * returns the value of {@code getBlack()}.
     *
     * @return the menu foreground color
     */
    public ColorUIResource getMenuForeground() { return  getWhite(); }

    /**
     * Returns the menu selected background color. This
     * returns the value of {@code getPrimary2()}.
     *
     * @return the menu selected background color
     */
    public ColorUIResource getMenuSelectedBackground() { return getPrimary2(); }

    /**
     * Returns the menu selected foreground color. This
     * returns the value of {@code getBlack()}.
     *
     * @return the menu selected foreground color
     */
    public ColorUIResource getMenuSelectedForeground() { return getWhite(); }

    /**
     * Returns the menu disabled foreground color. This
     * returns the value of {@code getSecondary2()}.
     *
     * @return the menu disabled foreground color
     */
    public ColorUIResource getMenuDisabledForeground() { return getSecondary2(); }

    /**
     * Returns the separator background color. This
     * returns the value of {@code getWhite()}.
     *
     * @return the separator background color
     */
    public ColorUIResource getSeparatorBackground() { return getBlack(); }

    /**
     * Returns the separator foreground color. This
     * returns the value of {@code getPrimary1()}.
     *
     * @return the separator foreground color
     */
    public ColorUIResource getSeparatorForeground() { return getPrimary1(); }

    /**
     * Returns the accelerator foreground color. This
     * returns the value of {@code getPrimary1()}.
     *
     * @return the accelerator foreground color
     */
    public ColorUIResource getAcceleratorForeground() { return getPrimary1(); }

    /**
     * Returns the accelerator selected foreground color. This
     * returns the value of {@code getBlack()}.
     *
     * @return the accelerator selected foreground color
     */
    public ColorUIResource getAcceleratorSelectedForeground() { return getWhite(); }


    /**
     * Gets the upper gradient color for components like JButton, JMenuBar and
     * JProgressBar.
     * 
     * @return The gradient reflection color.
     */
    public Color getGradientReflection() {
        return gradientReflection;
    }

    /**
     * Gets the lower gradient color for components like JButton, JMenuBar and
     * JProgressBar.
     * 
     * @return The gradient shadow color.
     */
    public Color getGradientShadow() {
        return gradientShadow;
    }

    /**
     * Gets the transluscent variation of the upper gradient color for
     * components like JButton, JMenuBar and JProgressBar.
     * 
     * @return The transluscent gradient reflection color.
     */
    public Color getGradientTranslucentReflection() {
        return gradientTranslucentReflection;
    }

    /**
     * Gets the transluscent variation of the lower gradient color for
     * components like JButton, JMenuBar and JProgressBar.
     * 
     * @return The transluscent gradient shadow color.
     */
    public Color getGradientTranslucentShadow() {
        return gradientTranslucentShadow;
    }


}