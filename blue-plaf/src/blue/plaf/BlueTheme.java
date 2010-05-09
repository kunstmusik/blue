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
            black = new ColorUIResource(new Color(240, 240, 255));
            white = new ColorUIResource(Color.black);
//        }
        
    }
    
    public String getName() {
        return "blue";
    }
    
    protected ColorUIResource getBlack() {
        return black;
    }

    protected ColorUIResource getWhite() {
        return white;
    }

    // these are blue in Metal Default Theme
    protected ColorUIResource getPrimary1() {
        return primary1;
    }

    protected ColorUIResource getPrimary2() {
        return primary2;
    }

    protected ColorUIResource getPrimary3() {
        return primary3;
    }

    // these are gray in Metal Default Theme
    protected ColorUIResource getSecondary1() {
        return secondary1;
    }

    protected ColorUIResource getSecondary2() {
        return secondary2;
    }

    protected ColorUIResource getSecondary3() {
        return secondary3;
    }

    /**
     * Gets the Font of Labels in many cases.
     * 
     * @return The Font of Labels in many cases.
     */
    public FontUIResource getControlTextFont() {
        return plainFont;
    }

    /**
     * Gets the Font of Menus and MenuItems.
     * 
     * @return The Font of Menus and MenuItems.
     */
    public FontUIResource getMenuTextFont() {
        return plainFont;
    }

    /**
     * Gets the Font of Nodes in JTrees.
     * 
     * @return The Font of Nodes in JTrees.
     */
    public FontUIResource getSystemTextFont() {
        return plainFont;
    }

    /**
     * Gets the Font in TextFields, EditorPanes, etc.
     * 
     * @return The Font in TextFields, EditorPanes, etc.
     */
    public FontUIResource getUserTextFont() {
        return plainFont;
    }

    public FontUIResource getWindowTitleFont() {
        return boldFont;
    }

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