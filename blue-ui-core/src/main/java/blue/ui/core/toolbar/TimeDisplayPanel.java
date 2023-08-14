/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/GUIForms/JPanel.java to edit this template
 */
package blue.ui.core.toolbar;

import blue.BlueData;
import blue.services.render.RenderTimeManager;
import blue.services.render.RenderTimeManagerListener;
import blue.settings.PlaybackSettings;
import blue.time.TimeUtilities;
import blue.utility.NumberUtilities;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.beans.PropertyChangeListener;
import javax.swing.plaf.basic.BasicHTML;
import org.openide.util.Lookup;

/**
 *
 * @author stevenyi
 */
public class TimeDisplayPanel extends javax.swing.JPanel {

    private static final Color DISPLAY_COLOR = new Color(192, 225, 255, 196);
    private static final Color LABEL_COLOR = DISPLAY_COLOR.darker();

    BlueData data;
    PropertyChangeListener dataListener;

    RenderTimeManager renderTimeManager
            = Lookup.getDefault().lookup(RenderTimeManager.class);

    double playheadTimeValue = 0.0;

    /**
     * Creates new form TimeDisplayPanel
     */
    public TimeDisplayPanel() {
        initComponents();

        playheadLabel.setForeground(LABEL_COLOR);
        startLabel.setForeground(LABEL_COLOR);
        endLabel.setForeground(LABEL_COLOR);
        playheadTime.setForeground(DISPLAY_COLOR);
        startTime.setForeground(DISPLAY_COLOR);
        playheadTime2.setForeground(DISPLAY_COLOR);
        endTime.setForeground(DISPLAY_COLOR);

        dataListener = (evt) -> {
            switch (evt.getPropertyName()) {
                case "renderStartTime":
                    updateStartTime();
                    updatePlayheadTime();

                    RenderTimeManager renderTimeManager
                            = Lookup.getDefault().lookup(RenderTimeManager.class);
                    break;
                case "renderLoopTime":
                    updateEndTime();
                    break;
            }
        };

        renderTimeManager.addRenderTimeManagerListener(new RenderTimeManagerListener() {
            @Override
            public void renderInitiated() {
                updatePlayheadTime();
            }

            @Override
            public void renderEnded() {
                updatePlayheadTime();
            }

            @Override
            public void renderTimeUpdated(double timePointer) {

                if (timePointer >= 0) {
                    double latency = PlaybackSettings.getInstance().
                            getPlaybackLatencyCorrection();

                    playheadTimeValue = timePointer + renderTimeManager.getRenderStartTime() - latency;

                    updatePlayheadTime();
                }
            }

        });
    }

    private void updateStartTime() {
        if (data != null) {
            startTime.setText(NumberUtilities.formatDouble(data.getRenderStartTime()));

            if (!renderTimeManager.isCurrentProjectRendering()) {
                playheadTimeValue = data.getRenderStartTime();
                updatePlayheadTime();
            }
        }
    }

    private void updateEndTime() {
        if (data != null) {
            var end = data.getRenderEndTime();
            endTime.setText(end < 0.0 ? "" : NumberUtilities.formatDouble(end));
        }
    }

    private void updatePlayheadTime() {
        playheadTime.setText(
                NumberUtilities.formatDouble(playheadTimeValue));

        playheadTime2.setText(
                TimeUtilities.convertSecondsToTimeString(playheadTimeValue));
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
        }

        playheadTimeValue = data.getRenderStartTime();

        updateStartTime();
        updateEndTime();
        updatePlayheadTime();

    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        var w = getWidth();
        var h = getHeight();
        
        var insets = getInsets();
        
        System.out.println(insets);

        g.setColor(Color.BLACK);
        g.fillRoundRect(insets.left, insets.top, w - insets.right - insets.left, h - insets.top - insets.bottom, 16, 16);
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        playheadLabel = new javax.swing.JLabel();
        startLabel = new javax.swing.JLabel();
        endLabel = new javax.swing.JLabel();
        playheadTime = new javax.swing.JLabel();
        endTime = new javax.swing.JLabel();
        playheadTime2 = new javax.swing.JLabel();
        startTime = new javax.swing.JLabel();

        setPreferredSize(new java.awt.Dimension(260, 80));

        playheadLabel.setFont(new java.awt.Font("Monospaced", 0, 10)); // NOI18N
        org.openide.awt.Mnemonics.setLocalizedText(playheadLabel, org.openide.util.NbBundle.getMessage(TimeDisplayPanel.class, "TimeDisplayPanel.playheadLabel.text")); // NOI18N

        startLabel.setFont(new java.awt.Font("Monospaced", 0, 10)); // NOI18N
        org.openide.awt.Mnemonics.setLocalizedText(startLabel, org.openide.util.NbBundle.getMessage(TimeDisplayPanel.class, "TimeDisplayPanel.startLabel.text")); // NOI18N

        endLabel.setFont(new java.awt.Font("Monospaced", 0, 10)); // NOI18N
        org.openide.awt.Mnemonics.setLocalizedText(endLabel, org.openide.util.NbBundle.getMessage(TimeDisplayPanel.class, "TimeDisplayPanel.endLabel.text")); // NOI18N

        playheadTime.setFont(new java.awt.Font("Monospaced", 0, 13)); // NOI18N
        org.openide.awt.Mnemonics.setLocalizedText(playheadTime, org.openide.util.NbBundle.getMessage(TimeDisplayPanel.class, "TimeDisplayPanel.playheadTime.text")); // NOI18N

        endTime.setFont(new java.awt.Font("Monospaced", 0, 12)); // NOI18N
        org.openide.awt.Mnemonics.setLocalizedText(endTime, org.openide.util.NbBundle.getMessage(TimeDisplayPanel.class, "TimeDisplayPanel.endTime.text")); // NOI18N

        playheadTime2.setFont(new java.awt.Font("Monospaced", 0, 13)); // NOI18N
        org.openide.awt.Mnemonics.setLocalizedText(playheadTime2, org.openide.util.NbBundle.getMessage(TimeDisplayPanel.class, "TimeDisplayPanel.playheadTime2.text")); // NOI18N

        startTime.setFont(new java.awt.Font("Monospaced", 0, 12)); // NOI18N
        org.openide.awt.Mnemonics.setLocalizedText(startTime, org.openide.util.NbBundle.getMessage(TimeDisplayPanel.class, "TimeDisplayPanel.startTime.text")); // NOI18N

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(playheadLabel)
                    .addGroup(layout.createSequentialGroup()
                        .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addComponent(playheadTime, javax.swing.GroupLayout.PREFERRED_SIZE, 113, javax.swing.GroupLayout.PREFERRED_SIZE)
                            .addComponent(startTime)
                            .addComponent(startLabel))
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addComponent(endLabel)
                            .addComponent(endTime)
                            .addComponent(playheadTime2))))
                .addContainerGap(15, Short.MAX_VALUE))
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(playheadLabel)
                .addGap(0, 0, 0)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(playheadTime)
                    .addComponent(playheadTime2))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(startLabel)
                    .addComponent(endLabel))
                .addGap(0, 0, 0)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(endTime)
                    .addComponent(startTime))
                .addContainerGap(javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
        );
    }// </editor-fold>//GEN-END:initComponents


    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JLabel endLabel;
    private javax.swing.JLabel endTime;
    private javax.swing.JLabel playheadLabel;
    private javax.swing.JLabel playheadTime;
    private javax.swing.JLabel playheadTime2;
    private javax.swing.JLabel startLabel;
    private javax.swing.JLabel startTime;
    // End of variables declaration//GEN-END:variables
}