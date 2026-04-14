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
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;

/**
 * Panel displaying selection start/end times and duration in a horizontal layout.
 * Matches Reaper-style: "Selection:  start  end  duration"
 * Right-click to change display format.
 *
 * @author Steven Yi
 */
public class SelectionDisplayPanel extends JPanel {

    private static final Color DISPLAY_COLOR = new Color(192, 225, 255, 196);
    private static final Color LABEL_COLOR = DISPLAY_COLOR.darker();
    private static final Font LABEL_FONT = new Font("Monospaced", Font.PLAIN, 10);
    private static final Font VALUE_FONT = new Font("Monospaced", Font.PLAIN, 14);
    private static final String PROTOTYPE_TEXT = "00:00:00.000";
    private static final int PANEL_HEIGHT = 48;
    private static final String NO_VALUE = "-";

    private final JLabel selectionLabel;
    private final JLabel startValue;
    private final JLabel endValue;
    private final JLabel durationValue;

    private BlueData data;
    private TimeState timeState;
    private PropertyChangeListener dataListener;
    private PropertyChangeListener timeStateListener;

    private boolean syncToRuler = true;
    private TimeDisplayFormat displayFormat = TimeDisplayFormat.BBF;

    private JPopupMenu popupMenu;

    public SelectionDisplayPanel() {
        selectionLabel = new JLabel("Selection:");
        startValue = new JLabel(NO_VALUE);
        endValue = new JLabel(NO_VALUE);
        durationValue = new JLabel(NO_VALUE);

        selectionLabel.setForeground(LABEL_COLOR);
        startValue.setForeground(DISPLAY_COLOR);
        endValue.setForeground(DISPLAY_COLOR);
        durationValue.setForeground(DISPLAY_COLOR);

        selectionLabel.setFont(LABEL_FONT);
        startValue.setFont(VALUE_FONT);
        endValue.setFont(VALUE_FONT);
        durationValue.setFont(VALUE_FONT);

        startValue.setHorizontalAlignment(SwingConstants.RIGHT);
        endValue.setHorizontalAlignment(SwingConstants.RIGHT);
        durationValue.setHorizontalAlignment(SwingConstants.RIGHT);

        startValue.setToolTipText("Selection Start");
        endValue.setToolTipText("Selection End");
        durationValue.setToolTipText("Selection Duration");

        setFixedValueWidth(startValue);
        setFixedValueWidth(endValue);
        setFixedValueWidth(durationValue);

        initLayout();
        initPopupMenu();

        dataListener = evt -> {
            switch (evt.getPropertyName()) {
                case "renderStartTime", "renderLoopTime" -> updateDisplay();
            }
        };

        timeStateListener = evt -> {
            if ("timeDisplay".equals(evt.getPropertyName()) && syncToRuler) {
                displayFormat = TimeDisplayFormat.fromTimeBase((TimeBase) evt.getNewValue());
                updateDisplay();
            }
        };

        addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                if (SwingUtilities.isRightMouseButton(e)) {
                    rebuildPopupMenu();
                    popupMenu.show(SelectionDisplayPanel.this, e.getX(), e.getY());
                }
            }
        });
    }

    private void setFixedValueWidth(JLabel label) {
        FontMetrics fm = label.getFontMetrics(VALUE_FONT);
        int width = fm.stringWidth(PROTOTYPE_TEXT) + 4;
        Dimension d = new Dimension(width, fm.getHeight());
        label.setPreferredSize(d);
        label.setMinimumSize(d);
    }

    private void initLayout() {
        setLayout(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();

        // "Selection:" label spanning top row
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.gridwidth = 3;
        gbc.anchor = GridBagConstraints.WEST;
        gbc.insets = new Insets(4, 8, 0, 8);
        add(selectionLabel, gbc);

        // Start, End, Duration values in a horizontal row
        gbc.gridy = 1;
        gbc.gridwidth = 1;
        gbc.anchor = GridBagConstraints.EAST;
        gbc.insets = new Insets(2, 8, 4, 4);
        add(startValue, gbc);

        gbc.gridx = 1;
        gbc.insets = new Insets(2, 4, 4, 4);
        add(endValue, gbc);

        gbc.gridx = 2;
        gbc.insets = new Insets(2, 4, 4, 8);
        add(durationValue, gbc);

        Dimension pref = getPreferredSize();
        setPreferredSize(new Dimension(pref.width, PANEL_HEIGHT));
    }

    private void initPopupMenu() {
        popupMenu = new JPopupMenu();
        rebuildPopupMenu();
    }

    private void rebuildPopupMenu() {
        popupMenu.removeAll();
        ButtonGroup group = new ButtonGroup();

        JCheckBoxMenuItem syncItem = new JCheckBoxMenuItem("Sync to Primary Ruler");
        syncItem.setSelected(syncToRuler);
        syncItem.addActionListener(e -> {
            syncToRuler = true;
            if (timeState != null) {
                displayFormat = TimeDisplayFormat.fromTimeBase(timeState.getTimeDisplay());
            }
            updateDisplay();
        });
        group.add(syncItem);
        popupMenu.add(syncItem);

        popupMenu.addSeparator();

        for (TimeDisplayFormat format : TimeDisplayFormat.values()) {
            JCheckBoxMenuItem item = new JCheckBoxMenuItem(format.getMenuLabel());
            item.setSelected(!syncToRuler && displayFormat == format);
            item.addActionListener(e -> {
                syncToRuler = false;
                displayFormat = format;
                updateDisplay();
            });
            group.add(item);
            popupMenu.add(item);
        }
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
            if (syncToRuler) {
                displayFormat = TimeDisplayFormat.fromTimeBase(timeState.getTimeDisplay());
            }
            updateDisplay();
        }
    }

    private void updateDisplay() {
        if (data == null) {
            startValue.setText(NO_VALUE);
            endValue.setText(NO_VALUE);
            durationValue.setText(NO_VALUE);
            return;
        }

        TimeContext context = (data.getScore() != null)
                ? data.getScore().getTimeContext()
                : null;

        double start = data.getRenderStartTime();
        double end = data.getRenderEndTime();

        if (end < 0.0) {
            startValue.setText(NO_VALUE);
            endValue.setText(NO_VALUE);
            durationValue.setText(NO_VALUE);
        } else {
            startValue.setText(displayFormat.format(start, context));
            endValue.setText(displayFormat.format(end, context));
            double duration = end - start;
            if (duration > 0) {
                durationValue.setText(displayFormat.formatDuration(duration, context));
            } else {
                durationValue.setText(NO_VALUE);
            }
        }
    }
}
