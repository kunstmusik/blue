package blue.plaf;

import java.awt.Color;

import javax.swing.plaf.basic.BasicMenuItemUI;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class BlueMenuItemUI extends BasicMenuItemUI {

    public BlueMenuItemUI() {
        super();
        selectionBackground = Color.white;
        selectionForeground = Color.black;

    }
}