/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.ui.core.toolbar;

import blue.BlueData;
import blue.BlueSystem;
import blue.orchestra.editor.blueSynthBuilder.BSBPreferences;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.services.render.RenderTimeManager;
import blue.services.render.RenderTimeManagerListener;
import blue.settings.PlaybackSettings;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.NumberUtilities;
import java.awt.Color;
import java.awt.Dimension;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JTextField;
import javax.swing.JToolBar;
import javax.swing.border.EmptyBorder;
import jiconfont.icons.font_awesome.FontAwesome;
import jiconfont.swing.IconFontSwing;
import org.openide.util.Lookup;

/**
 * @author steven
 */
public class MainToolBar extends JToolBar {

    private static final Color ICON_COLOR = new Color(230, 230, 255);

    private static MainToolBar instance = null;

    private final TransportControls transportControls;

    private final TimeDisplayPanel timePanel;

    JButton widgetInfoButton = new JButton();

    public static MainToolBar getInstance() {
        if (instance == null) {
            instance = new MainToolBar();
        }
        return instance;
    }

    private MainToolBar() {
        setFloatable(false);

        transportControls = new TransportControls();
        timePanel = new TimeDisplayPanel();
        timePanel.setBorder(BorderFactory.createEmptyBorder(5, 0, 0, 0));

        final var widgetInfoShowingIcon = IconFontSwing.buildIcon(FontAwesome.INFO_CIRCLE, 16, ICON_COLOR);
        final var widgetInfoNotShowingIcon = IconFontSwing.buildIcon(FontAwesome.INFO_CIRCLE, 16, Color.LIGHT_GRAY);
        final var prefs = BSBPreferences.getInstance();

        Runnable updateWidgetIcon = () -> {
            var icon = prefs.getShowWidgetComments() ? widgetInfoShowingIcon : widgetInfoNotShowingIcon;
            widgetInfoButton.setIcon(icon);
        };

        widgetInfoButton.addActionListener(ae -> {
            UiUtilities.invokeOnSwingThread(() -> {
                prefs.setShowWidgetComments(!prefs.getShowWidgetComments());
            });
        });
        widgetInfoButton.setFocusable(false);
        widgetInfoButton.setToolTipText("Toggle showing BSB Widget information as tooltips in usage mode");

        prefs.showWidgetCommentsProperty().addListener((obs, old, newVal) -> {
            updateWidgetIcon.run();
        });

        updateWidgetIcon.run();

        this.add(transportControls);

        this.add(widgetInfoButton, null);

        this.add(Box.createHorizontalGlue());

        this.add(timePanel);
        this.add(Box.createHorizontalGlue());

        BlueProjectManager.getInstance().addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if (BlueProjectManager.CURRENT_PROJECT.equals(evt.
                    getPropertyName())) {
                reinitialize();
            }
        });

        reinitialize();
    }

    private void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        if (project != null) {
            setData(project.getData());
        }
    }

    /**
     * @param data2
     */
    public void setData(BlueData data) {
        transportControls.setData(data);
        timePanel.setData(data);
    }

}
