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

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.Rectangle;
import java.util.HashMap;
import java.util.Map;
import javax.swing.Action;
import javax.swing.Icon;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.UIManager;
import javax.swing.plaf.ComponentUI;
import org.netbeans.swing.tabcontrol.TabDisplayer;
import org.netbeans.swing.tabcontrol.plaf.BasicScrollingTabDisplayerUI;
import org.netbeans.swing.tabcontrol.plaf.TabCellRenderer;
import org.netbeans.swing.tabcontrol.plaf.TabControlButton;
import org.netbeans.swing.tabcontrol.plaf.TabState;

/**
 *
 * @author syi
 */
public class BlueEditorTabDisplayerUI extends BasicScrollingTabDisplayerUI {

    private JPanel controlButtons;

    private BlueTabControlButton btnScrollLeft;
    private BlueTabControlButton btnScrollRight;
    private BlueTabControlButton btnDropDown;
    private BlueTabControlButton btnMaximizeRestore;


    private static final Rectangle scratch5 = new Rectangle();
    private static Map<Integer, String[]> buttonIconPaths;

    private static boolean isGenericUI = !"Windows".equals( //NOI18N
        UIManager.getLookAndFeel().getID());

    /**
     * Creates a new instance of BlueEditorTabDisplayerUI
     */
    public BlueEditorTabDisplayerUI(TabDisplayer displayer) {
        super (displayer);
    }

    public static ComponentUI createUI(JComponent c) {
        return new BlueEditorTabDisplayerUI ((TabDisplayer) c);
    }

    @Override
    protected TabCellRenderer createDefaultRenderer() {
        return new BlueEditorTabCellRenderer();
    }


    @Override
    public Rectangle getTabRect(int idx, Rectangle rect) {
        Rectangle r = super.getTabRect (idx, rect);
        //For win classic, take up the full space, even the insets, to match
        //earlier appearance
        r.y = 0;
        r.height = displayer.getHeight();
        return r;
    }

    @Override
    public void install() {
        super.install();
        if (!isGenericUI) {
            displayer.setBackground( UIManager.getColor("tab_unsel_fill") );
            displayer.setOpaque(true);
        }
    }

    @Override
    public Dimension getPreferredSize(JComponent c) {
        int prefHeight = 28;
        Graphics g = BasicScrollingTabDisplayerUI.getOffscreenGraphics();
        if (g != null) {
            FontMetrics fm = g.getFontMetrics(displayer.getFont());
            Insets ins = getTabAreaInsets();
            prefHeight = fm.getHeight() + ins.top + ins.bottom + (isGenericUI ? 5 : 6);
        }
        return new Dimension(displayer.getWidth(), prefHeight);
    }

    private void genericPaintAfterTabs (Graphics g) {
        g.setColor (UIManager.getColor("controlShadow")); //NOI18N
        Insets ins = displayer.getInsets();
        Rectangle r = new Rectangle();
        getTabsVisibleArea(r);
        r.width = displayer.getWidth();
        int selEnd = 0;
        int last = getLastVisibleTab();
        if (last > -1) {
            getTabRect (last, scratch5);
            g.drawLine (scratch5.x + scratch5.width, displayer.getHeight() -1,
                displayer.getWidth() - (ins.left + ins.right) - 4,
                displayer.getHeight() - 1);
            g.drawLine (0, displayer.getHeight() - 2, 2, displayer.getHeight() -2);

            if ((tabState.getState(getFirstVisibleTab()) & TabState.CLIP_LEFT)
                !=0 && getFirstVisibleTab() !=
                displayer.getSelectionModel().getSelectedIndex()) {
                    //Draw a small gradient line continuing the left edge of
                    //the displayer up the left side of a left clipped tab
//                GradientPaint gp = ColorUtil.getGradientPaint(
//                    0, displayer.getHeight() / 2, UIManager.getColor("control"),
//                    0, displayer.getHeight(), UIManager.getColor("controlShadow"));
//                ((Graphics2D) g).setPaint(gp);
//                g.drawLine (0, displayer.getHeight() / 2, 0, displayer.getHeight());
            } else {
                //Fill the small gap between the top of the content displayer
                //and the bottom of the tabs, caused by the tab area bottom inset
                g.setColor (UIManager.getColor("controlShadow"));
                g.drawLine (0, displayer.getHeight(), 0, displayer.getHeight() - 2);
            }
            if ((tabState.getState(getLastVisibleTab()) & TabState.CLIP_RIGHT) != 0
                && getLastVisibleTab() !=
                displayer.getSelectionModel().getSelectedIndex()) {
//                GradientPaint gp = ColorUtil.getGradientPaint(
//                    0, displayer.getHeight() / 2, UIManager.getColor("control"),
//                    0, displayer.getHeight(), UIManager.getColor("controlShadow"));
//                ((Graphics2D) g).setPaint(gp);
//                getTabRect (getLastVisibleTab(), scratch5);
//                g.drawLine (scratch5.x + scratch5.width, displayer.getHeight() / 2,
//                    scratch5.x + scratch5.width, displayer.getHeight());
            }

        } else {
            g.drawLine(r.x, displayer.getHeight() - ins.bottom, r.x + r.width - 4,
                       displayer.getHeight() - ins.bottom);
        }
    }

    @Override
    protected void paintAfterTabs(Graphics g) {
        if (isGenericUI) {
            genericPaintAfterTabs(g);
            return;
        }
        Rectangle r = new Rectangle();
        getTabsVisibleArea(r);
        r.width = displayer.getWidth();
        g.setColor(displayer.isActive() ?
                   defaultRenderer.getSelectedActivatedBackground() :
                   defaultRenderer.getSelectedBackground());

        Insets ins = getTabAreaInsets();
        ins.bottom++;
        g.fillRect(r.x, r.y + r.height, r.x + r.width,
                   displayer.getHeight() - (r.y + r.height));

        g.setColor(UIManager.getColor("controlLtHighlight")); //NOI18N

        int selEnd = 0;
        int i = selectionModel.getSelectedIndex();
        if (i != -1) {
            getTabRect(i, scratch5);
            if (scratch5.width != 0) {
                if (r.x < scratch5.x) {
                    g.drawLine(r.x, displayer.getHeight() - ins.bottom,
                               scratch5.x - 1,
                               displayer.getHeight() - ins.bottom);
                }
                if (scratch5.x + scratch5.width < r.x + r.width) {
                    selEnd = scratch5.x + scratch5.width;
                    //If the last tab is not clipped, the final tab is one
                    //pixel smaller; we need to overwrite one pixel of the
                    //border or there will be a small stub sticking down
                    if (!scroll().isLastTabClipped()) {
                        selEnd--;
                    }
                    g.drawLine(selEnd, displayer.getHeight() - ins.bottom,
                               r.x + r.width,
                               displayer.getHeight() - ins.bottom);
                }
            }
            return;
        }

        g.drawLine(r.x, displayer.getHeight() - ins.bottom, r.x + r.width,
                   displayer.getHeight() - ins.bottom);
    }

    private static void initIcons() {
        if( null == buttonIconPaths ) {
            buttonIconPaths = new HashMap<Integer, String[]>(7);

            //left button
            String[] iconPaths = new String[4];
            iconPaths[TabControlButton.STATE_DEFAULT] = "blue/plaf/resources/metal_scrollleft_enabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_DISABLED] = "blue/plaf/resources/metal_scrollleft_disabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_ROLLOVER] = "blue/plaf/resources/metal_scrollleft_rollover.png"; // NOI18N
            iconPaths[TabControlButton.STATE_PRESSED] = "blue/plaf/resources/metal_scrollleft_pressed.png"; // NOI18N
            buttonIconPaths.put( TabControlButton.ID_SCROLL_LEFT_BUTTON, iconPaths );

            //right button
            iconPaths = new String[4];
            iconPaths[TabControlButton.STATE_DEFAULT] = "blue/plaf/resources/metal_scrollright_enabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_DISABLED] = "blue/plaf/resources/metal_scrollright_disabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_ROLLOVER] = "blue/plaf/resources/metal_scrollright_rollover.png"; // NOI18N
            iconPaths[TabControlButton.STATE_PRESSED] = "blue/plaf/resources/metal_scrollright_pressed.png"; // NOI18N
            buttonIconPaths.put( TabControlButton.ID_SCROLL_RIGHT_BUTTON, iconPaths );

            //drop down button
            iconPaths = new String[4];
            iconPaths[TabControlButton.STATE_DEFAULT] = "blue/plaf/resources/metal_popup_enabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_DISABLED] = "blue/plaf/resources/metal_popup_disabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_ROLLOVER] = "blue/plaf/resources/metal_popup_rollover.png"; // NOI18N
            iconPaths[TabControlButton.STATE_PRESSED] = "blue/plaf/resources/metal_popup_pressed.png"; // NOI18N
            buttonIconPaths.put( TabControlButton.ID_DROP_DOWN_BUTTON, iconPaths );

            //maximize/restore button
            iconPaths = new String[4];
            iconPaths[TabControlButton.STATE_DEFAULT] = "blue/plaf/resources/metal_maximize_enabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_DISABLED] = "blue/plaf/resources/metal_maximize_disabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_ROLLOVER] = "blue/plaf/resources/metal_maximize_rollover.png"; // NOI18N
            iconPaths[TabControlButton.STATE_PRESSED] = "blue/plaf/resources/metal_maximize_pressed.png"; // NOI18N
            buttonIconPaths.put( TabControlButton.ID_MAXIMIZE_BUTTON, iconPaths );

            iconPaths = new String[4];
            iconPaths[TabControlButton.STATE_DEFAULT] = "blue/plaf/resources/metal_restore_enabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_DISABLED] = "blue/plaf/resources/metal_restore_disabled.png"; // NOI18N
            iconPaths[TabControlButton.STATE_ROLLOVER] = "blue/plaf/resources/metal_restore_rollover.png"; // NOI18N
            iconPaths[TabControlButton.STATE_PRESSED] = "blue/plaf/resources/metal_restore_pressed.png"; // NOI18N
            buttonIconPaths.put( TabControlButton.ID_RESTORE_BUTTON, iconPaths );
        }
    }

    @Override
    public Icon getButtonIcon(int buttonId, int buttonState) {
        Icon res = null;
        initIcons();
        String[] paths = buttonIconPaths.get( buttonId );
        if( null != paths && buttonState >=0 && buttonState < paths.length ) {
            res = BlueTabControlButtonFactory.getIcon( paths[buttonState] );
        }
        return res;
    }

    @Override
    protected Rectangle getControlButtonsRectangle( Container parent ) {
        Component c = getControlButtons();
        return new Rectangle( parent.getWidth()-c.getWidth()-4, 4, c.getWidth(), c.getHeight() );
    }

    @Override
    public Insets getTabAreaInsets() {
        Insets retValue = super.getTabAreaInsets();
        retValue.right += 4;
        return retValue;
    }

        /**
     * @return A component that holds control buttons (scroll left/right, drop down menu)
     * that are displayed to right of the tab area.
     */
    @Override
    protected Component getControlButtons() {
        if( null == controlButtons ) {
            JPanel buttonsPanel = new JPanel( null );
            buttonsPanel.setOpaque( false );

            int width = 0;
            int height = 0;

            final boolean isGTK = "GTK".equals(UIManager.getLookAndFeel().getID());

            //create scroll-left button
            Action a = scroll().getBackwardAction();
            a.putValue( "control", displayer ); //NO18N
            btnScrollLeft = BlueTabControlButtonFactory.createScrollLeftButton( displayer, a, isGTK );
            buttonsPanel.add( btnScrollLeft );
            Dimension prefDim = btnScrollLeft.getPreferredSize();
            btnScrollLeft.setBounds( width, 0, prefDim.width, prefDim.height );
            width += prefDim.width;
            height = prefDim.height;

            //create scroll-right button
            a = scroll().getForwardAction();
            a.putValue( "control", displayer ); //NO18N
            btnScrollRight = BlueTabControlButtonFactory.createScrollRightButton( displayer, a, isGTK );
            buttonsPanel.add( btnScrollRight );
            prefDim = btnScrollRight.getPreferredSize();
            btnScrollRight.setBounds( width, 0, prefDim.width, prefDim.height );
            width += prefDim.width;
            height = Math.max ( height, prefDim.height );

            //create drop down button
            btnDropDown = BlueTabControlButtonFactory.createDropDownButton( displayer, isGTK );
            buttonsPanel.add( btnDropDown );

            width += 3;
            prefDim = btnDropDown.getPreferredSize();
            btnDropDown.setBounds( width, 0, prefDim.width, prefDim.height );
            width += prefDim.width;
            height = Math.max ( height, prefDim.height );

            //maximize / restore button
            if( null != displayer.getContainerWinsysInfo()
                    && displayer.getContainerWinsysInfo().isTopComponentMaximizationEnabled()) {
                width += 3;
                btnMaximizeRestore = BlueTabControlButtonFactory.createMaximizeRestoreButton( displayer, isGTK );
                buttonsPanel.add( btnMaximizeRestore );
                prefDim = btnMaximizeRestore.getPreferredSize();
                btnMaximizeRestore.setBounds( width, 0, prefDim.width, prefDim.height );
                width += prefDim.width;
                height = Math.max ( height, prefDim.height );
            }

            Dimension size = new Dimension( width, height );
            buttonsPanel.setMinimumSize( size );
            buttonsPanel.setSize( size );
            buttonsPanel.setPreferredSize( size );
            buttonsPanel.setMaximumSize( size );

            controlButtons = buttonsPanel;
        }
        return controlButtons;
    }

}
