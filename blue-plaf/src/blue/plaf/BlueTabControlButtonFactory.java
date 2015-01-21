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
import java.awt.Image;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.FocusEvent;
import java.awt.event.MouseEvent;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.imageio.ImageIO;
import javax.swing.Action;
import javax.swing.Icon;
import javax.swing.ImageIcon;
import javax.swing.Timer;
import javax.swing.ToolTipManager;
import org.netbeans.swing.tabcontrol.TabData;
import org.netbeans.swing.tabcontrol.TabDisplayer;
import org.netbeans.swing.tabcontrol.TabListPopupAction;
import org.netbeans.swing.tabcontrol.WinsysInfoForTabbedContainer;

/**
 *
 * @author syi
 */
public class BlueTabControlButtonFactory {

    private static IconLoader iconCache = null;

    public static Icon getIcon(String iconPath) {
        if (null == iconCache) {
            iconCache = new IconLoader();
        }
        return iconCache.obtainIcon(iconPath);
    }

    /**
     * Create default maximize/restore button. The button changes icons depending
     * on the state of tab component.
     */
    public static BlueTabControlButton createMaximizeRestoreButton(
            TabDisplayer displayer, boolean showBorder) {
        return new MaximizeRestoreButton(displayer, showBorder);
    }

    public static BlueTabControlButton createScrollLeftButton(TabDisplayer displayer,
            Action scrollAction, boolean showBorder) {
        BlueTabControlButton button = new TimerButton(
                BlueTabControlButton.ID_SCROLL_LEFT_BUTTON, displayer, scrollAction,
                showBorder);
        button.setToolTipText(java.util.ResourceBundle.getBundle(
                "blue/plaf/Bundle").getString(
                "Tip_Scroll_Documents_Left"));
        return button;
    }

    public static BlueTabControlButton createScrollRightButton(
            TabDisplayer displayer, Action scrollAction, boolean showBorder) {
        BlueTabControlButton button = new TimerButton(
                BlueTabControlButton.ID_SCROLL_RIGHT_BUTTON, displayer, scrollAction,
                showBorder);
        button.setToolTipText(java.util.ResourceBundle.getBundle(
                "blue/plaf/Bundle").getString(
                "Tip_Scroll_Documents_Right"));
        return button;
    }

    public static BlueTabControlButton createDropDownButton(TabDisplayer displayer,
            boolean showBorder) {
        return new DropDownButton(displayer, showBorder);
    }


        private static class MaximizeRestoreButton extends BlueTabControlButton {

        public MaximizeRestoreButton( TabDisplayer displayer, boolean showBorder ) {
            super( -1, displayer, showBorder );
            ToolTipManager toolTipManager = ToolTipManager.sharedInstance();
            toolTipManager.registerComponent( this );
        }

        protected String getTabActionCommand( ActionEvent e ) {
            return TabDisplayer.COMMAND_MAXIMIZE;
        }

        @Override
        protected int getButtonId() {
            int retValue = BlueTabControlButton.ID_MAXIMIZE_BUTTON;
            Component currentTab = getActiveTab( getTabDisplayer() );
            if( null != currentTab ) {
                WinsysInfoForTabbedContainer winsysInfo = getTabDisplayer().getContainerWinsysInfo();
                if( null != winsysInfo ) {
                    if( winsysInfo.inMaximizedMode( currentTab ) ) {
                        retValue = BlueTabControlButton.ID_RESTORE_BUTTON;
                    }
                }
            }

            return retValue;
        }

        @Override
        public String getToolTipText() {
            if( getButtonId() == BlueTabControlButton.ID_MAXIMIZE_BUTTON )
                return java.util.ResourceBundle.getBundle("blue/plaf/Bundle").getString("Tip_Maximize_Window");
            return java.util.ResourceBundle.getBundle("blue/plaf/Bundle").getString("Tip_Restore_Window");
        }
    }

    private static Component getActiveTab( TabDisplayer displayer ) {
        Component res = null;
        int selIndex = displayer.getSelectionModel().getSelectedIndex();
        if( selIndex >= 0 ) {
            TabData tab = displayer.getModel().getTab( selIndex );
            res = tab.getComponent();
        }
        return res;
    }


    /**
     * A convenience button class which will continue re-firing its action
     * on a timer for as long as the button is depressed.  Used for left-right scroll
     * buttons.
     */
    private static class TimerButton extends BlueTabControlButton implements ActionListener {
        Timer timer = null;

        public TimerButton( int buttonId, TabDisplayer displayer, Action a, boolean showBorder ) {
            super( buttonId, displayer, showBorder );
            setAction( a );
        }

        private Timer getTimer() {
            if (timer == null) {
                timer = new Timer(400, this);
                timer.setRepeats(true);
            }
            return timer;
        }

        int count = 0;

        public void actionPerformed( ActionEvent e ) {
            count++;
            if (count > 2) {
                if (count > 5) {
                    timer.setDelay(75);
                } else {
                    timer.setDelay(200);
                }
            }
            performAction();
        }

        private void performAction() {
            if (!isEnabled()) {
                stopTimer();
                return;
            }
            getAction().actionPerformed(new ActionEvent(this,
                                                        ActionEvent.ACTION_PERFORMED,
                                                        getActionCommand()));
        }

        private void startTimer() {
            Timer t = getTimer();
            if (t.isRunning()) {
                return;
            }
            repaint();
            t.setDelay(400);
            t.start();
        }

        private void stopTimer() {
            if (timer != null) {
                timer.stop();
            }
            repaint();
            count = 0;
        }

        @Override
        protected void processMouseEvent(MouseEvent me) {
            if (isEnabled() && me.getID() == MouseEvent.MOUSE_PRESSED) {
                startTimer();
            } else if (me.getID() == MouseEvent.MOUSE_RELEASED) {
                stopTimer();
            }
            super.processMouseEvent(me);
        }

        @Override
        protected void processFocusEvent(FocusEvent fe) {
            super.processFocusEvent(fe);
            if (fe.getID() == FocusEvent.FOCUS_LOST) {
                stopTimer();
            }
        }

        protected String getTabActionCommand(ActionEvent e) {
            return null;
        }
    }

    /**
     * A button for editor tab control to show a list of opened documents.
     */
    private static class DropDownButton extends BlueTabControlButton {

        private boolean forcePressedIcon = false;

        public DropDownButton( TabDisplayer displayer, boolean showBorder ) {
            super( BlueTabControlButton.ID_DROP_DOWN_BUTTON, displayer, showBorder );
            setAction( new TabListPopupAction( displayer ) );
            setToolTipText( java.util.ResourceBundle.getBundle("blue/plaf/Bundle").getString("Tip_Show_Opened_Documents_List") );
        }

        @Override
        protected void processMouseEvent(MouseEvent me) {
            super.processMouseEvent(me);
            if (isEnabled() && me.getID() == me.MOUSE_PRESSED) {
                forcePressedIcon = true;
                repaint();
                getAction().actionPerformed(new ActionEvent(this,
                                                            ActionEvent.ACTION_PERFORMED,
                                                            "pressed"));
            } else if (isEnabled() && me.getID() == me.MOUSE_RELEASED) {
                forcePressedIcon = false;
                repaint();
            }
        }

        protected String getTabActionCommand(ActionEvent e) {
            return null;
        }

        @Override
        void performAction( ActionEvent e ) {
        }

        @Override
        public Icon getRolloverIcon() {
            if( forcePressedIcon )
                return getPressedIcon();

            return super.getRolloverIcon();
        }

        @Override
        public Icon getIcon() {
            if( forcePressedIcon )
                return getPressedIcon();

            return super.getIcon();
        }
    }


    final private static class IconLoader {
        /* mapping <String, Icon> from resource paths to icon objects, used as cache */

        private Map<String, Icon> paths2Icons;

        /**
         * Finds and returns icon instance from cache, if present. Otherwise
         * loads icon using given resource path and stores icon into cache for
         * next access.
         *
         * @return icon image
         */
        public Icon obtainIcon(String iconPath) {
            if (paths2Icons == null) {
                paths2Icons = new HashMap<String, Icon>(6);
            }
            Icon icon = paths2Icons.get(iconPath);
            if (icon == null) {
                // not yet in cache, load and store
                Image image = loadImage(iconPath);
                if (image == null) {
                    throw new IllegalArgumentException(
                            "Icon with resource path: " + iconPath + " can't be loaded, probably wrong path.");
                }
                icon = new ImageIcon(image);
                paths2Icons.put(iconPath, icon);
            }
            return icon;
        }
    } // end of IconLoader

    private static Image loadImage(String path) {
        try {
            URL url = BlueTabControlButtonFactory.class.getResource("/" + path);
            return ImageIO.read(url);
        } catch (Exception e) {
            Logger.getLogger(BlueTabControlButtonFactory.class.getName()).
                    log(Level.WARNING, "Cannot load image", e);
            return null;
        }
    }
}
