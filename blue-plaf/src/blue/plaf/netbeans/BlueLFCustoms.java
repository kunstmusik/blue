/*
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS HEADER.
 *
 * Copyright 1997-2010 Oracle and/or its affiliates. All rights reserved.
 *
 * Oracle and Java are registered trademarks of Oracle and/or its affiliates.
 * Other names may be trademarks of their respective owners.
 *
 * The contents of this file are subject to the terms of either the GNU
 * General Public License Version 2 only ("GPL") or the Common
 * Development and Distribution License("CDDL") (collectively, the
 * "License"). You may not use this file except in compliance with the
 * License. You can obtain a copy of the License at
 * http://www.netbeans.org/cddl-gplv2.html
 * or nbbuild/licenses/CDDL-GPL-2-CP. See the License for the
 * specific language governing permissions and limitations under the
 * License.  When distributing the software, include this License Header
 * Notice in each file and include the License file at
 * nbbuild/licenses/CDDL-GPL-2-CP.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the GPL Version 2 section of the License file that
 * accompanied this code. If applicable, add the following below the
 * License Header, with the fields enclosed by brackets [] replaced by
 * your own identifying information:
 * "Portions Copyrighted [year] [name of copyright owner]"
 *
 * Contributor(s):
 *
 * The Original Software is NetBeans. The Initial Developer of the Original
 * Software is Sun Microsystems, Inc. Portions Copyright 1997-2006 Sun
 * Microsystems, Inc. All Rights Reserved.
 *
 * If you wish your version of this file to be governed by only the CDDL
 * or only the GPL Version 2, indicate your decision by adding
 * "[Contributor] elects to include this software in this distribution
 * under the [CDDL or GPL Version 2] license." If you do not indicate a
 * single choice of license, a recipient has the option to distribute
 * your version of this file under either the CDDL, the GPL Version 2 or
 * to extend the choice of license to its licensees as provided above.
 * However, if you add GPL Version 2 code and therefore, elected the GPL
 * Version 2 license, then the option applies only if the new code is
 * made subject to such option by the copyright holder.
 */

package blue.plaf.netbeans;

import blue.plaf.BlueLookAndFeel;
import java.awt.Color;
import java.awt.Font;
import java.awt.Insets;
import javax.swing.BorderFactory;
import javax.swing.UIManager;
import javax.swing.border.Border;
import javax.swing.border.EmptyBorder;
import org.netbeans.swing.plaf.LFCustoms;
import org.netbeans.swing.plaf.util.UIUtils;


/** Default system-provided customizer for blue LF
 * Public only to be accessible by ProxyLazyValue, please don't abuse.
 */
public final class BlueLFCustoms extends LFCustoms {



    @Override
    public Object[] createLookAndFeelCustomizationKeysAndValues() {
        int fontsize = 11;
        Integer in = (Integer) UIManager.get(CUSTOM_FONT_SIZE); //NOI18N
        if (in != null) {
            fontsize = in.intValue();
        }
        
        //XXX fetch the custom font size here instead
        Font controlFont = new Font("Dialog", Font.PLAIN, fontsize); //NOI18N
        final Color tabBarColor = new Color(63, 102, 150);
        
        Object[] result = {
            //The assorted standard NetBeans metal font customizations
            CONTROLFONT, controlFont,
            SYSTEMFONT, controlFont,
            USERFONT, controlFont,
            MENUFONT, controlFont,
            WINDOWTITLEFONT, controlFont,
            LISTFONT, controlFont,
            TREEFONT, controlFont,
            PANELFONT, controlFont,
            SUBFONT, new Font ("Dialog", Font.PLAIN, Math.min(fontsize - 1, 6)),
            //Bug in JDK 1.5 thru b59 - pale blue is incorrectly returned for this
            "textInactiveText", Color.GRAY, //NOI18N
            // #61395        
            SPINNERFONT, controlFont,        
            EDITOR_ERRORSTRIPE_SCROLLBAR_INSETS, new Insets(16, 0, 16, 0),
            //slide bar
            "NbSlideBar.GroupSeparator.Gap.Before", 15,
            "NbSlideBar.GroupSeparator.Gap.After", 5,
            "NbSlideBar.RestoreButton.Gap", 10,
            
            "NbTabControl.selectedTabDarkerBackground", tabBarColor.darker(),
            "NbTabControl.selectedTabBrighterBackground", tabBarColor,
            "NbTabControl.mouseoverTabBrighterBackground", tabBarColor.darker().darker(),
            "NbTabControl.mouseoverTabDarkerBackground",tabBarColor.darker(),
            "NbTabControl.inactiveTabBrighterBackground", tabBarColor.darker().darker().darker(),
            "NbTabControl.inactiveTabDarkerBackground",tabBarColor.darker().darker(),
            
            "NbTabControl.borderColor", Color.BLACK,
            "NbTabControl.borderShadowColor", new Color(0,0,0, 32),
"NbTabControl.editorTabBackground", tabBarColor,
                "NbTabControl.focusedTabBackground", tabBarColor,

                
        }; 
        return result;
    }

    @Override
    public Object[] createApplicationSpecificKeysAndValues () {
        Border outerBorder = BorderFactory.createLineBorder(UIManager.getColor("controlShadow")); //NOI18N
        //Object propertySheetColorings = new MetalPropertySheetColorings();
        Color unfocusedSelBg = UIManager.getColor("controlShadow");
        if (!Color.WHITE.equals(unfocusedSelBg.brighter())) { // #57145
            unfocusedSelBg = unfocusedSelBg.brighter();
        }

        Object[] result = {

            "EditorPaneUI", "blue.plaf.netbeans.HonorDisplayEditorPaneUI",

            
            DESKTOP_BORDER, new EmptyBorder(1, 1, 1, 1),
            SCROLLPANE_BORDER, new BlueScrollPaneBorder(),
            EXPLORER_STATUS_BORDER, new BlueStatusLineBorder(BlueStatusLineBorder.TOP),
            EDITOR_STATUS_LEFT_BORDER, new BlueStatusLineBorder(BlueStatusLineBorder.TOP | BlueStatusLineBorder.RIGHT),
            EDITOR_STATUS_RIGHT_BORDER, new BlueStatusLineBorder(BlueStatusLineBorder.TOP | BlueStatusLineBorder.LEFT),
            EDITOR_STATUS_INNER_BORDER, new BlueStatusLineBorder(BlueStatusLineBorder.TOP | BlueStatusLineBorder.LEFT | BlueStatusLineBorder.RIGHT),
            EDITOR_STATUS_ONLYONEBORDER, new BlueStatusLineBorder(BlueStatusLineBorder.TOP),
            EDITOR_TOOLBAR_BORDER, new BlueEditorToolbarBorder(),

//            PROPERTYSHEET_BOOTSTRAP, propertySheetColorings,

            "textText", BlueLookAndFeel.getWhite(),

            
            //UI Delegates for the tab control

            //EDITOR_TAB_DISPLAYER_UI, "blue.plaf.BlueEditorTabDisplayerUI",
            //VIEW_TAB_DISPLAYER_UI, "blue.plaf.BlueViewTabDisplayerUI",
            EDITOR_TAB_DISPLAYER_UI, "org.netbeans.swing.tabcontrol.plaf.AquaEditorTabDisplayerUI",
            VIEW_TAB_DISPLAYER_UI, "org.netbeans.swing.tabcontrol.plaf.AquaViewTabDisplayerUI",
            SLIDING_BUTTON_UI, "org.netbeans.swing.tabcontrol.plaf.AquaSlidingButtonUI", 
//            EDITOR_TAB_DISPLAYER_UI, "org.netbeans.swing.tabcontrol.plaf.MetalEditorTabDisplayerUI",
//            VIEW_TAB_DISPLAYER_UI, "org.netbeans.swing.tabcontrol.plaf.MetalViewTabDisplayerUI",
//            SLIDING_BUTTON_UI, "org.netbeans.swing.tabcontrol.plaf.MetalSlidingButtonUI",

            EDITOR_TAB_OUTER_BORDER, outerBorder,
            VIEW_TAB_OUTER_BORDER, outerBorder,

            EXPLORER_MINISTATUSBAR_BORDER, BorderFactory.createMatteBorder(1, 0, 0, 0, UIManager.getColor("controlShadow")),
            
            //#48951 invisible unfocused selection background in Metal L&F
            "nb.explorer.unfocusedSelBg", unfocusedSelBg,
                    
            PROGRESS_CANCEL_BUTTON_ICON, UIUtils.loadImage("org/netbeans/swing/plaf/resources/cancel_task_win_linux_mac.png"),
                    

            // progress component related
//            "nbProgressBar.Foreground", new Color(49, 106, 197),
//            "nbProgressBar.Background", Color.WHITE,
            "nbProgressBar.popupDynaText.foreground", new Color(115, 115, 115),
//            "nbProgressBar.popupText.background", new Color(231, 249, 249),        
            "nbProgressBar.popupText.foreground", UIManager.getColor("TextField.foreground"),
            "nbProgressBar.popupText.selectBackground", UIManager.getColor("List.selectionBackground"),
            "nbProgressBar.popupText.selectForeground", UIManager.getColor("List.selectionForeground"),                    

        }; //NOI18N

        //#108517 - turn off ctrl+page_up and ctrl+page_down mapping
        return UIUtils.addInputMapsWithoutCtrlPageUpAndCtrlPageDown( result );
    }

//    private class MetalPropertySheetColorings extends UIBootstrapValue.Lazy {
//        public MetalPropertySheetColorings () {
//            super (null);
//        }
//
//        @Override
//        public Object[] createKeysAndValues() {
//            return new Object[] {
//                //Property sheet settings as defined by HIE
//                 PROPSHEET_SELECTION_BACKGROUND, new Color(204,204,255),
//                 PROPSHEET_SELECTION_FOREGROUND, Color.BLACK,
//                 PROPSHEET_SET_BACKGROUND, new Color(224,224,224),
//                 PROPSHEET_SET_FOREGROUND, Color.BLACK,
//                 PROPSHEET_SELECTED_SET_BACKGROUND, new Color(204,204,255),
//                 PROPSHEET_SELECTED_SET_FOREGROUND, Color.BLACK,
//                 PROPSHEET_DISABLED_FOREGROUND, new Color(153,153,153),
//            };
//        }
//    }

}
