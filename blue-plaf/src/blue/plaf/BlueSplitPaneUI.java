/*
 * @(#)MetalSplitPaneUI.java	1.8 01/12/03
 *
 * Copyright 2002 Sun Microsystems, Inc. All rights reserved.
 * SUN PROPRIETARY/CONFIDENTIAL. Use is subject to license terms.
 */

package blue.plaf;

import javax.swing.JComponent;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicSplitPaneDivider;
import javax.swing.plaf.basic.BasicSplitPaneUI;

/**
 * Metal split pane.
 * <p>
 * <strong>Warning:</strong> Serialized objects of this class will not be
 * compatible with future Swing releases. The current serialization support is
 * appropriate for short term storage or RMI between applications running the
 * same version of Swing. As of 1.4, support for long term storage of all
 * JavaBeans<sup><font size="-2">TM</font></sup> has been added to the
 * <code>java.beans</code> package. Please see {@link java.beans.XMLEncoder}.
 * 
 * @version 1.8 12/03/01
 * @author Steve Wilson
 */
public class BlueSplitPaneUI extends BasicSplitPaneUI {

    /**
     * Creates a new MetalSplitPaneUI instance
     */
    public static ComponentUI createUI(JComponent x) {
        return new BlueSplitPaneUI();
    }

    /**
     * Creates the default divider.
     */
    public BasicSplitPaneDivider createDefaultDivider() {
        return new BlueSplitPaneDivider(this);
    }

    // protected void installDefaults(){
    // //LookAndFeel.installBorder(splitPane, "SplitPane.border");
    //
    // if (divider == null) divider = createDefaultDivider();
    // divider.setBasicSplitPaneUI(this);
    //
    // /*Border b = divider.getBorder();
    //
    // if (b == null || !(b instanceof UIResource)) {
    // divider.setBorder(UIManager.getBorder("SplitPaneDivider.border"));
    // }*/
    //
    // setOrientation(splitPane.getOrientation());
    //
    // // This plus 2 here is to provide backwards consistancy. Previously,
    // // the old size did not include the 2 pixel border around the divider,
    // // it now does.
    // splitPane.setDividerSize(((Integer) (UIManager.get(
    // "SplitPane.dividerSize"))).intValue());
    //
    // divider.setDividerSize(splitPane.getDividerSize());
    // dividerSize = divider.getDividerSize();
    // splitPane.add(divider, JSplitPane.DIVIDER);
    //
    // setContinuousLayout(splitPane.isContinuousLayout());
    //
    // resetLayoutManager();
    //
    // /* Install the nonContinuousLayoutDivider here to avoid having to
    // add/remove everything later. */
    // if(nonContinuousLayoutDivider == null) {
    // setNonContinuousLayoutDivider(
    // createDefaultNonContinuousLayoutDivider(),
    // true);
    // } else {
    // setNonContinuousLayoutDivider(nonContinuousLayoutDivider, true);
    // }
    // }
}
