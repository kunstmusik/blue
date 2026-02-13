/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2025 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307 USA
 */
package blue.ui.core.score.meter;

import blue.BlueData;
import blue.score.Score;
import blue.score.TimeState;
import blue.time.MeasureMeterPair;
import blue.time.Meter;
import blue.time.MeterMap;
import blue.undo.BlueUndoManager;
import blue.ui.utilities.UiUtilities;

import javax.swing.*;
import javax.swing.undo.AbstractUndoableEdit;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

/**
 * Visual bar showing meter (time signature) regions.
 * Each region displays the time signature (e.g., "4/4", "3/4").
 * 
 * Features:
 * - Shows meter changes as labeled regions
 * - Double-click to add new meter change
 * - Right-click for context menu (edit/delete)
 * - Tooltips showing measure number and meter
 */
public class MeterRegionBar extends JComponent implements PropertyChangeListener {

    private static final int BAR_HEIGHT = 20;
    private static final Color BACKGROUND = new Color(30, 30, 40);
    private static final Color REGION_BORDER = new Color(80, 80, 100);
    private static final Color TEXT_COLOR = new Color(200, 200, 220);
    private static final Color HOVERED_BG = new Color(50, 50, 70);
    private static final Font METER_FONT = new Font("SansSerif", Font.PLAIN, 11);

    private MeterMap meterMap;
    private Score score;
    private TimeState timeState;
    
    private int hoveredRegionIndex = -1;

    public MeterRegionBar() {
        setPreferredSize(new Dimension(1, BAR_HEIGHT));
        setMinimumSize(new Dimension(1, BAR_HEIGHT));
        setBackground(BACKGROUND);
        setOpaque(true);
        
        MeterRegionMouseListener mouseListener = new MeterRegionMouseListener();
        addMouseListener(mouseListener);
        addMouseMotionListener(mouseListener);
        
        // Configure tooltips
        ToolTipManager.sharedInstance().registerComponent(this);
        ToolTipManager.sharedInstance().setInitialDelay(0);
        ToolTipManager.sharedInstance().setDismissDelay(Integer.MAX_VALUE);
    }

    public void setData(BlueData data) {
        if (this.meterMap != null) {
            this.meterMap.removeListener(this::onMeterMapChanged);
        }
        
        if (this.score != null) {
            this.score.getTimeState().removePropertyChangeListener(this);
        }
        
        this.score = data.getScore();
        this.meterMap = score.getTimeContext().getMeterMap();
        this.meterMap.addListener(this::onMeterMapChanged);
        this.score.getTimeState().addPropertyChangeListener(this);
        
        repaint();
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
        repaint();
    }
    
    private void onMeterMapChanged() {
        repaint();
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (score != null && evt.getSource() == score.getTimeState()) {
            repaint();
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        
        if (meterMap == null || timeState == null) {
            return;
        }

        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        int width = getWidth();
        int height = getHeight();

        // Background
        g2d.setColor(BACKGROUND);
        g2d.fillRect(0, 0, width, height);

        // Draw each meter region
        for (int i = 0; i < meterMap.size(); i++) {
            MeasureMeterPair pair = meterMap.get(i);
            double startBeat = getMeasureStartBeat(i);
            double endBeat = (i < meterMap.size() - 1) 
                ? getMeasureStartBeat(i + 1) 
                : getMaxVisibleBeat();
            
            int x = beatToScreenX(startBeat);
            int endX = beatToScreenX(endBeat);
            int regionWidth = endX - x;
            
            if (endX < 0 || x > width) {
                continue; // Skip off-screen regions
            }
            
            drawMeterRegion(g2d, x, regionWidth, height, pair.getMeter(), i);
        }

        // Bottom border
        g2d.setColor(REGION_BORDER);
        g2d.drawLine(0, height - 1, width, height - 1);
    }

    private void drawMeterRegion(Graphics2D g2d, int x, int width, int height, Meter meter, int index) {
        // Hover highlight
        if (index == hoveredRegionIndex) {
            g2d.setColor(HOVERED_BG);
            g2d.fillRect(x, 0, width, height - 1);
        }
        
        // Region border (left edge)
        g2d.setColor(REGION_BORDER);
        g2d.drawLine(x, 0, x, height - 1);
        
        // Draw meter text if region is wide enough
        if (width > 20) {
            drawMeterText(g2d, x, width, height, meter);
        }
    }

    private void drawMeterText(Graphics2D g2d, int x, int width, int height, Meter meter) {
        g2d.setFont(METER_FONT);
        g2d.setColor(TEXT_COLOR);
        
        String text = meter.numBeats + "/" + meter.beatLength;
        FontMetrics fm = g2d.getFontMetrics();
        int textWidth = fm.stringWidth(text);
        int textHeight = fm.getAscent();
        
        // Left-align text with small padding, but if left edge is off-screen, 
        // position at left edge of visible area
        int textX = Math.max(x + 4, 4);
        int textY = (height + textHeight) / 2 - 2;
        
        // Only draw if it fits within the region
        int rightEdge = x + width;
        if (textX + textWidth < rightEdge - 2) {
            g2d.drawString(text, textX, textY);
        }
    }

    private double getMeasureStartBeat(int meterIndex) {
        // Use the cached measureStartBeats from MeterMap
        // We need to access it - for now calculate it
        if (meterIndex == 0) {
            return 0;
        }
        
        double beat = 0;
        for (int i = 0; i < meterIndex; i++) {
            MeasureMeterPair pair = meterMap.get(i);
            MeasureMeterPair nextPair = meterMap.get(i + 1);
            long measureCount = nextPair.getMeasureNumber() - pair.getMeasureNumber();
            beat += measureCount * pair.getMeter().getMeasureBeatDuration();
        }
        return beat;
    }

    private double getMaxVisibleBeat() {
        return getWidth() / timeState.getPixelSecond() + 10;
    }

    private int beatToScreenX(double beat) {
        return (int) Math.round(beat * timeState.getPixelSecond());
    }

    private double screenXToBeat(int x) {
        return x / timeState.getPixelSecond();
    }

    private int findRegionAt(int x) {
        if (meterMap == null || meterMap.isEmpty()) {
            return -1;
        }
        
        double beat = screenXToBeat(x);
        
        for (int i = meterMap.size() - 1; i >= 0; i--) {
            double regionStart = getMeasureStartBeat(i);
            if (beat >= regionStart) {
                return i;
            }
        }
        return 0;
    }

    private void updateTooltip(int regionIndex) {
        if (regionIndex < 0 || meterMap == null || regionIndex >= meterMap.size()) {
            setToolTipText(null);
            return;
        }
        
        MeasureMeterPair pair = meterMap.get(regionIndex);
        String tooltip = String.format("<html>Measure %d<br>Time Signature: %s</html>",
            pair.getMeasureNumber(),
            pair.getMeter().toString());
        setToolTipText(tooltip);
    }

    private void showRegionPopupMenu(MouseEvent e, int regionIndex) {
        JPopupMenu popup = new JPopupMenu();
        
        JMenuItem editItem = new JMenuItem("Edit Time Signature...");
        editItem.addActionListener(evt -> {
            showEditMeterDialog(regionIndex);
        });
        popup.add(editItem);
        
        if (regionIndex > 0) {
            popup.addSeparator();
            JMenuItem deleteItem = new JMenuItem("Delete Time Signature Change");
            deleteItem.addActionListener(evt -> {
                MeterMap snapshot = new MeterMap(meterMap);
                meterMap.remove(regionIndex);
                MeterMap afterSnapshot = new MeterMap(meterMap);
                BlueUndoManager.addEdit("Delete Time Signature", new AbstractUndoableEdit() {
                    @Override
                    public void undo() {
                        super.undo();
                        meterMap.replaceAll(snapshot);
                    }
                    @Override
                    public void redo() {
                        super.redo();
                        meterMap.replaceAll(afterSnapshot);
                    }
                });
            });
            popup.add(deleteItem);
        }
        
        popup.show(this, e.getX(), e.getY());
    }

    private void showEditMeterDialog(int regionIndex) {
        MeasureMeterPair pair = meterMap.get(regionIndex);
        
        JPanel panel = new JPanel(new GridLayout(2, 2, 5, 5));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        // Calculate valid measure range to avoid duplicates
        int minMeasure = 1;
        int maxMeasure = Integer.MAX_VALUE;
        
        if (regionIndex > 0) {
            // Min is previous signature's measure + 1
            minMeasure = (int) meterMap.get(regionIndex - 1).getMeasureNumber() + 1;
        }
        if (regionIndex < meterMap.size() - 1) {
            // Max is next signature's measure - 1
            maxMeasure = (int) meterMap.get(regionIndex + 1).getMeasureNumber() - 1;
        }
        
        JSpinner measureSpinner = new JSpinner(new SpinnerNumberModel(
            (int) pair.getMeasureNumber(), minMeasure, maxMeasure, 1));
        JTextField meterField = new JTextField(pair.getMeter().toString());
        
        panel.add(new JLabel("Measure:"));
        panel.add(measureSpinner);
        panel.add(new JLabel("Time Signature:"));
        panel.add(meterField);
        
        // Disable measure editing for first entry (must stay at measure 1)
        if (regionIndex == 0) {
            measureSpinner.setEnabled(false);
        }
        
        int result = JOptionPane.showConfirmDialog(
            SwingUtilities.getWindowAncestor(this),
            panel,
            "Edit Time Signature",
            JOptionPane.OK_CANCEL_OPTION,
            JOptionPane.PLAIN_MESSAGE
        );
        
        if (result == JOptionPane.OK_OPTION) {
            try {
                long newMeasure = ((Number) measureSpinner.getValue()).longValue();
                String[] parts = meterField.getText().trim().split("/");
                if (parts.length == 2) {
                    int numBeats = Integer.parseInt(parts[0].trim());
                    int beatLength = Integer.parseInt(parts[1].trim());
                    if (numBeats > 0 && beatLength > 0) {
                        MeterMap snapshot = new MeterMap(meterMap);
                        Meter newMeter = new Meter(numBeats, beatLength);
                        meterMap.set(regionIndex, new MeasureMeterPair(newMeasure, newMeter));
                        MeterMap afterSnapshot = new MeterMap(meterMap);
                        BlueUndoManager.addEdit("Edit Time Signature", new AbstractUndoableEdit() {
                            @Override
                            public void undo() {
                                super.undo();
                                meterMap.replaceAll(snapshot);
                            }
                            @Override
                            public void redo() {
                                super.redo();
                                meterMap.replaceAll(afterSnapshot);
                            }
                        });
                    }
                }
            } catch (NumberFormatException ex) {
                // Ignore invalid input
            }
        }
    }

    private void addOrEditMeterAtBeat(double beat) {
        // Find which measure this beat falls in
        long measureNumber = 1;
        double accumulatedBeat = 0;
        
        for (int i = 0; i < meterMap.size(); i++) {
            MeasureMeterPair pair = meterMap.get(i);
            double measureDuration = pair.getMeter().getMeasureBeatDuration();
            
            double nextMeterBeat = (i < meterMap.size() - 1) 
                ? getMeasureStartBeat(i + 1) 
                : Double.MAX_VALUE;
            
            if (beat < nextMeterBeat) {
                // This beat is in this meter region
                long measuresIntoRegion = (long) ((beat - accumulatedBeat) / measureDuration);
                measureNumber = pair.getMeasureNumber() + measuresIntoRegion;
                break;
            }
            accumulatedBeat = nextMeterBeat;
        }
        
        // Check if there's already a meter at this measure
        for (int i = 0; i < meterMap.size(); i++) {
            if (meterMap.get(i).getMeasureNumber() == measureNumber) {
                // Edit existing meter
                showEditMeterDialog(i);
                return;
            }
        }
        
        // No existing meter at this measure - add new one with default 4/4
        MeterMap snapshot = new MeterMap(meterMap);
        Meter defaultMeter = new Meter(4, 4);
        meterMap.add(new MeasureMeterPair(measureNumber, defaultMeter));
        MeterMap afterSnapshot = new MeterMap(meterMap);
        BlueUndoManager.addEdit("Add Time Signature", new AbstractUndoableEdit() {
            @Override
            public void undo() {
                super.undo();
                meterMap.replaceAll(snapshot);
            }
            @Override
            public void redo() {
                super.redo();
                meterMap.replaceAll(afterSnapshot);
            }
        });
    }

    private class MeterRegionMouseListener extends MouseAdapter {
        @Override
        public void mousePressed(MouseEvent e) {
            if (meterMap == null) {
                return;
            }
            
            int regionIndex = findRegionAt(e.getX());
            
            if (UiUtilities.isRightMouseButton(e)) {
                if (regionIndex >= 0) {
                    showRegionPopupMenu(e, regionIndex);
                }
            } else if (SwingUtilities.isLeftMouseButton(e) && e.getClickCount() == 2) {
                // Double-click to add new meter change or edit existing one
                double beat = screenXToBeat(e.getX());
                addOrEditMeterAtBeat(beat);
            }
            
            repaint();
        }

        @Override
        public void mouseMoved(MouseEvent e) {
            int newHovered = findRegionAt(e.getX());
            if (newHovered != hoveredRegionIndex) {
                hoveredRegionIndex = newHovered;
                updateTooltip(hoveredRegionIndex);
                repaint();
            }
        }

        @Override
        public void mouseExited(MouseEvent e) {
            if (hoveredRegionIndex != -1) {
                hoveredRegionIndex = -1;
                setToolTipText(null);
                repaint();
            }
        }
    }
}
