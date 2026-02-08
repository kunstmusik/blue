/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
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
import blue.score.TimeState;
import blue.services.render.RenderTimeManager;
import blue.services.render.RenderTimeManagerListener;
import blue.settings.PlaybackSettings;
import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.ui.core.score.TimeDisplayFormat;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeListener;
import javax.swing.ButtonGroup;
import javax.swing.JCheckBoxMenuItem;
import javax.swing.JLabel;
import javax.swing.JMenu;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import org.openide.util.Lookup;

/**
 * Panel displaying current playhead time position.
 * Shows time in a format that can sync to the primary ruler or be independently set.
 * Right-click to change display format.
 *
 * @author Steven Yi
 */
public class PlayheadDisplayPanel extends JPanel {

    private static final Color DISPLAY_COLOR = new Color(192, 225, 255, 196);
    private static final Color LABEL_COLOR = DISPLAY_COLOR.darker();
    private static final Font LABEL_FONT = new Font("Monospaced", Font.PLAIN, 10);
    private static final Font VALUE_FONT = new Font("Monospaced", Font.PLAIN, 14);
    private static final String PROTOTYPE_TEXT = "00:00:00.000";

    private final JLabel playheadLabel;
    private final JLabel primaryValue;
    private final JLabel secondaryValue;

    private BlueData data;
    private TimeState timeState;
    private PropertyChangeListener dataListener;
    private PropertyChangeListener timeStateListener;

    private final RenderTimeManager renderTimeManager;
    private double playheadTimeValue = 0.0;

    private boolean primarySyncToRuler = true;
    private boolean secondarySyncToRuler = true;
    private TimeDisplayFormat primaryFormat = TimeDisplayFormat.BEATS;
    private TimeDisplayFormat secondaryFormat = TimeDisplayFormat.TIME;
    private boolean secondaryEnabled = true;

    private JPopupMenu popupMenu;

    public PlayheadDisplayPanel() {
        renderTimeManager = Lookup.getDefault().lookup(RenderTimeManager.class);

        playheadLabel = new JLabel("Playhead");
        primaryValue = new JLabel("");
        secondaryValue = new JLabel("");

        playheadLabel.setForeground(LABEL_COLOR);
        primaryValue.setForeground(DISPLAY_COLOR);
        secondaryValue.setForeground(DISPLAY_COLOR);

        playheadLabel.setFont(LABEL_FONT);
        primaryValue.setFont(VALUE_FONT);
        secondaryValue.setFont(VALUE_FONT);

        primaryValue.setHorizontalAlignment(SwingConstants.RIGHT);
        secondaryValue.setHorizontalAlignment(SwingConstants.RIGHT);

        setFixedValueWidth(primaryValue);
        setFixedValueWidth(secondaryValue);

        rebuildLayout();
        initPopupMenu();

        dataListener = evt -> {
            if ("renderStartTime".equals(evt.getPropertyName())) {
                if (!renderTimeManager.isCurrentProjectRendering()) {
                    playheadTimeValue = data.getRenderStartTime();
                    updateDisplay();
                }
            }
        };

        timeStateListener = evt -> {
            switch (evt.getPropertyName()) {
                case "timeDisplay" -> {
                    if (primarySyncToRuler) {
                        primaryFormat = TimeDisplayFormat.fromTimeBase((TimeBase) evt.getNewValue());
                        updateDisplay();
                    }
                }
                case "secondaryTimeDisplay" -> {
                    if (secondarySyncToRuler) {
                        secondaryFormat = TimeDisplayFormat.fromTimeBase((TimeBase) evt.getNewValue());
                        updateDisplay();
                    }
                }
            }
        };

        renderTimeManager.addRenderTimeManagerListener(new RenderTimeManagerListener() {
            @Override
            public void renderInitiated() {
                updateDisplay();
            }

            @Override
            public void renderEnded() {
                updateDisplay();
            }

            @Override
            public void renderTimeUpdated(double timePointer) {
                if (timePointer >= 0) {
                    double latency = PlaybackSettings.getInstance().getPlaybackLatencyCorrection();
                    playheadTimeValue = timePointer + renderTimeManager.getRenderStartTime() - latency;
                    updateDisplay();
                }
            }
        });

        addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                if (SwingUtilities.isRightMouseButton(e)) {
                    rebuildPopupMenu();
                    popupMenu.show(PlayheadDisplayPanel.this, e.getX(), e.getY());
                }
            }
        });

        updateDisplay();
    }

    private void setFixedValueWidth(JLabel label) {
        FontMetrics fm = label.getFontMetrics(VALUE_FONT);
        int width = fm.stringWidth(PROTOTYPE_TEXT) + 4;
        Dimension d = new Dimension(width, fm.getHeight());
        label.setPreferredSize(d);
        label.setMinimumSize(d);
    }

    private void rebuildLayout() {
        removeAll();
        setLayout(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();

        int columns = secondaryEnabled ? 2 : 1;

        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.gridwidth = columns;
        gbc.anchor = GridBagConstraints.WEST;
        gbc.insets = new Insets(4, 8, 0, 8);
        add(playheadLabel, gbc);

        gbc.gridy = 1;
        gbc.gridwidth = 1;
        gbc.anchor = GridBagConstraints.EAST;
        gbc.insets = new Insets(2, 8, 4, secondaryEnabled ? 4 : 8);
        add(primaryValue, gbc);

        if (secondaryEnabled) {
            gbc.gridx = 1;
            gbc.insets = new Insets(2, 4, 4, 8);
            add(secondaryValue, gbc);
        }

        revalidate();
        repaint();
    }

    private void initPopupMenu() {
        popupMenu = new JPopupMenu();
        rebuildPopupMenu();
    }

    private void rebuildPopupMenu() {
        popupMenu.removeAll();

        // Primary submenu
        JMenu primaryMenu = new JMenu("Primary");
        ButtonGroup primaryGroup = new ButtonGroup();

        JCheckBoxMenuItem primarySyncItem = new JCheckBoxMenuItem("Sync to Primary Ruler");
        primarySyncItem.setSelected(primarySyncToRuler);
        primarySyncItem.addActionListener(e -> {
            primarySyncToRuler = true;
            if (timeState != null) {
                primaryFormat = TimeDisplayFormat.fromTimeBase(timeState.getTimeDisplay());
            }
            updateDisplay();
        });
        primaryGroup.add(primarySyncItem);
        primaryMenu.add(primarySyncItem);
        primaryMenu.addSeparator();
        for (TimeDisplayFormat format : TimeDisplayFormat.values()) {
            JCheckBoxMenuItem item = new JCheckBoxMenuItem(format.getMenuLabel());
            item.setSelected(!primarySyncToRuler && primaryFormat == format);
            item.addActionListener(e -> {
                primarySyncToRuler = false;
                primaryFormat = format;
                updateDisplay();
            });
            primaryGroup.add(item);
            primaryMenu.add(item);
        }
        popupMenu.add(primaryMenu);

        // Secondary submenu
        JMenu secondaryMenu = new JMenu("Secondary");
        ButtonGroup secondaryGroup = new ButtonGroup();

        JCheckBoxMenuItem offItem = new JCheckBoxMenuItem("Off");
        offItem.setSelected(!secondaryEnabled);
        offItem.addActionListener(e -> {
            secondaryEnabled = false;
            rebuildLayout();
            updateDisplay();
        });
        secondaryGroup.add(offItem);
        secondaryMenu.add(offItem);

        secondaryMenu.addSeparator();

        JCheckBoxMenuItem secondarySyncItem = new JCheckBoxMenuItem("Sync to Secondary Ruler");
        secondarySyncItem.setSelected(secondaryEnabled && secondarySyncToRuler);
        secondarySyncItem.addActionListener(e -> {
            boolean wasEnabled = secondaryEnabled;
            secondaryEnabled = true;
            secondarySyncToRuler = true;
            if (timeState != null) {
                secondaryFormat = TimeDisplayFormat.fromTimeBase(timeState.getSecondaryTimeDisplay());
            }
            if (!wasEnabled) {
                rebuildLayout();
            }
            updateDisplay();
        });
        secondaryGroup.add(secondarySyncItem);
        secondaryMenu.add(secondarySyncItem);
        secondaryMenu.addSeparator();

        for (TimeDisplayFormat format : TimeDisplayFormat.values()) {
            JCheckBoxMenuItem item = new JCheckBoxMenuItem(format.getMenuLabel());
            item.setSelected(secondaryEnabled && !secondarySyncToRuler && secondaryFormat == format);
            item.addActionListener(e -> {
                boolean wasEnabled = secondaryEnabled;
                secondaryEnabled = true;
                secondarySyncToRuler = false;
                secondaryFormat = format;
                if (!wasEnabled) {
                    rebuildLayout();
                }
                updateDisplay();
            });
            secondaryGroup.add(item);
            secondaryMenu.add(item);
        }
        popupMenu.add(secondaryMenu);
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        var w = getWidth();
        var h = getHeight();
        var insets = getInsets();

        g.setColor(Color.BLACK);
        g.fillRoundRect(insets.left, insets.top,
                w - insets.right - insets.left,
                h - insets.top - insets.bottom, 16, 16);
    }

    @Override
    public Dimension getMaximumSize() {
        return getPreferredSize();
    }

    public void setData(BlueData data) {
        if (this.data != null) {
            this.data.removePropertyChangeListener(dataListener);
        }

        this.data = data;

        if (data != null) {
            data.addPropertyChangeListener(dataListener);
            playheadTimeValue = data.getRenderStartTime();
            updateDisplay();
        }
    }

    public void setTimeState(TimeState timeState) {
        if (this.timeState != null) {
            this.timeState.removePropertyChangeListener(timeStateListener);
        }

        this.timeState = timeState;

        if (timeState != null) {
            timeState.addPropertyChangeListener(timeStateListener);
            if (primarySyncToRuler) {
                primaryFormat = TimeDisplayFormat.fromTimeBase(timeState.getTimeDisplay());
            }
            if (secondarySyncToRuler) {
                secondaryFormat = TimeDisplayFormat.fromTimeBase(timeState.getSecondaryTimeDisplay());
            }
            updateDisplay();
        }
    }

    private void updateDisplay() {
        TimeContext context = (data != null && data.getScore() != null)
                ? data.getScore().getTimeContext()
                : null;

        primaryValue.setText(primaryFormat.format(playheadTimeValue, context));

        if (secondaryEnabled) {
            secondaryValue.setText(secondaryFormat.format(playheadTimeValue, context));
        }
    }
}
