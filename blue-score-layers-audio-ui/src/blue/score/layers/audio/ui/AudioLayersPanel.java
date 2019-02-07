/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.score.layers.audio.ui;

import blue.components.SoloMarquee;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.AudioLayer;
import blue.score.layers.audio.core.AudioLayerGroup;
import blue.score.layers.audio.core.AudioLayerListener;
import blue.ui.core.score.ModeListener;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.ScoreObjectView;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.layers.SelectionMarquee;
import blue.ui.core.score.layers.soundObject.AutomationLayerPanel;
import blue.ui.utilities.ParentDispatchingMouseAdapter;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseWheelEvent;
import java.awt.geom.AffineTransform;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.JLayeredPane;
import javax.swing.SwingUtilities;
import org.openide.util.Utilities;
import org.openide.util.lookup.InstanceContent;

/**
 *
 * @author stevenyi
 */
public class AudioLayersPanel extends JLayeredPane implements LayerGroupListener,
        PropertyChangeListener, LayerGroupPanel<AudioLayerGroup>, AudioLayerListener,
        ModeListener {

    private static Font renderFont = new Font("Dialog", Font.BOLD, 12);
    private static final Color PATTERN_COLOR = new Color(198, 226, 255);
    private AudioLayerGroup layerGroup;
    private final TimeState timeState;
    private PropertyChangeListener heightListener;
    // tranforms from virtual time to screen
    AffineTransform transform = new AffineTransform();
    // transforms from screen to virtual time
    AffineTransform reverseTransform = new AffineTransform();
    double srcPts[] = new double[4];
    double destPts[] = new double[4];
    Map<AudioClip, AudioClipPanel> clipPanelMap = new HashMap<>();
    private final InstanceContent content;
    SoloMarquee marquee = new SoloMarquee();
    AutomationLayerPanel automationPanel = new AutomationLayerPanel(marquee);
    private ComponentListener sObjViewListener;

    BiConsumer<AudioClip, Double> splitHandler = (ac, time) -> {
        int layerNum = layerGroup.getLayerNumForScoreObject(ac);
        AudioLayer layer = layerGroup.get(layerNum);

        AudioLayerGroupUtils.splitAudioClip(layer, ac, time);
    };

    public AudioLayersPanel(AudioLayerGroup layerGroup, TimeState timeState, InstanceContent content) {
        this.setLayout(null);
        this.layerGroup = layerGroup;
        this.timeState = timeState;
        this.content = content;

        transform.setToIdentity();
        transform.setToScale(timeState.getPixelSecond(), 1.0);
        reverseTransform.setToIdentity();
        reverseTransform.setToScale(1 / timeState.getPixelSecond(), 1.0);

        final Dimension d = checkSize();
        this.setSize(d);
        this.setBackground(Color.BLACK);

        this.addMouseWheelListener((MouseWheelEvent mwe) -> {
            mwe.getComponent().getParent().dispatchEvent(mwe);
        });

//        AudioLayerPanelMouseListener listener =
//                new AudioLayerPanelMouseListener(this, layerGroup, timeState,
//                selectedClips);
//        this.addMouseListener(listener);
//        this.addMouseMotionListener(listener);
        new AudioLayersDropTargetListener(this);

        heightListener = (PropertyChangeEvent evt) -> {
            checkSize();
            updateAudioClipYandHeight();
        };

        sObjViewListener = new ComponentListener() {
            @Override
            public void componentResized(ComponentEvent ce) {
                checkSize();
            }

            @Override
            public void componentMoved(ComponentEvent ce) {
                checkSize();
            }

            @Override
            public void componentShown(ComponentEvent ce) {
            }

            @Override
            public void componentHidden(ComponentEvent ce) {
            }

        };

        int y = 0;
        for (AudioLayer layer : layerGroup) {
            int height = layer.getAudioLayerHeight();

            for (AudioClip clip : layer) {
                addClipPanel(clip, timeState, y, height);
            }
            y += height;
        }
        
        ModeManager.getInstance().addModeListener(this);


        // This is here as the existing mouselisteners prevent bubbling up of
        // events (i.e. from ToolTipManager)
        MouseAdapter mouseAdapter = new ParentDispatchingMouseAdapter(this);
        this.addMouseListener(mouseAdapter);
        this.addMouseMotionListener(mouseAdapter);
        this.addMouseWheelListener(mouseAdapter);

        automationPanel.setLayerGroup(layerGroup, timeState);
        automationPanel.setSize(getSize());

        this.add(automationPanel, MODAL_LAYER);
        this.addComponentListener(new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                automationPanel.setSize(getSize());
            }
        });
        
        this.add(marquee, JLayeredPane.DRAG_LAYER);

    }

    public AudioLayerGroup getAudioLayerGroup() {
        return layerGroup;
    }

    public TimeState getTimeState() {
        return timeState;
    }
    
    
    @Override
    public void modeChanged(ScoreMode mode) {
        marquee.setVisible(false);
    }

    @Override
    public void addNotify() {
        super.addNotify();

        if (layerGroup == null) {
            return;
        }

        layerGroup.addLayerGroupListener(this);
        timeState.addPropertyChangeListener(this);

        for (AudioLayer layer : layerGroup) {
            layer.addPropertyChangeListener(heightListener);
            layer.addAudioLayerListener(this);
        }
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        layerGroup.removeLayerGroupListener(this);
        timeState.removePropertyChangeListener(this);

        for (AudioLayer layer : layerGroup) {
            layer.removePropertyChangeListener(heightListener);
            layer.removeAudioLayerListener(this);
        }

//        clipPanelMap.clear();
    }

    @Override
    public void layerGroupChanged(final LayerGroupDataEvent event) {
        final ArrayList<Layer> layers = event.getLayers();

        SwingUtilities.invokeLater(new Runnable() {

            @Override
            public void run() {
                if (event.getType() == LayerGroupDataEvent.DATA_ADDED) {
                    for (Layer layer : layers) {
                        ((AudioLayer) layer).addPropertyChangeListener(
                                heightListener);
                        ((AudioLayer) layer).addAudioLayerListener(
                                AudioLayersPanel.this);

                        for (AudioClip clip : (AudioLayer) layer) {
                            addClipPanel(clip, timeState, 0, 0);
                        }

                    }

                } else if (event.getType() == LayerGroupDataEvent.DATA_REMOVED) {
                    for (Layer layer : layers) {
                        ((AudioLayer) layer).removePropertyChangeListener(
                                heightListener);
                        ((AudioLayer) layer).removeAudioLayerListener(
                                AudioLayersPanel.this);

                        for (AudioClip clip : (AudioLayer) layer) {
                            removeClipPanel(clip);
                        }
                    }
                }

                updateAudioClipYandHeight();
                checkSize();
                repaint();
            }

        });
    }

    protected Dimension checkSize() {
        int h = layerGroup.getTotalHeight();
        int tempTime = (int) (layerGroup.getMaxTime() / 60) + 2;
        int width = tempTime * timeState.getPixelSecond() * 60;
        final Dimension d = new Dimension(width, h);
        this.setPreferredSize(d);
        return d;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == timeState) {
            String prop = evt.getPropertyName();
            switch (prop) {
                case "pixelSecond":
                    checkSize();
                    transform.setToIdentity();
                    transform.setToScale(timeState.getPixelSecond(), 1.0);
                    reverseTransform.setToIdentity();
                    reverseTransform.setToScale(1 / timeState.getPixelSecond(),
                            1.0);
                    break;
                case "snapEnabled":
                case "snapValue":
                    repaint();
                    break;
            }
        }
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        paintAudioLayersBackground(g);
    }

    @Override
    public void marqueeSelectionPerformed(SelectionMarquee marquee) {
        Component[] comps = getComponents();
        for (int i = 0; i < comps.length; i++) {
            if (!(comps[i] instanceof AudioClipPanel)) {
                continue;
            }

            if (marquee.intersects((JComponent) comps[i])) {
                content.add(((AudioClipPanel) comps[i]).getScoreObject());
            }

        }
    }

    @Override
    public void paintNavigatorView(Graphics2D g2d) {

        Component[] components = getComponents();

        for (Component c : components) {
            AudioClipPanel component = (AudioClipPanel) c;
            Rectangle r = component.getBounds();

            g2d.setColor(component.getScoreObject().getBackgroundColor());
            g2d.fillRect(r.x, r.y, r.width, r.height);
        }
    }

    private void paintAudioLayersBackground(Graphics g) {
        int width = getWidth();
        int height = getHeight();

        g.setColor(Color.BLACK);
        g.fillRect(0, 0, width, height);

        int y = 0;
        g.setColor(Color.DARK_GRAY);
        g.drawLine(0, 0, width, 0);

        for (AudioLayer layer : layerGroup) {
            y += layer.getAudioLayerHeight();
            g.drawLine(0, y, width, y);
        }

        g.drawLine(0, getHeight() - 1, width, height - 1);

        if (timeState.isSnapEnabled()) {
            int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());
            int x = 0;
            if (snapPixels <= 0) {
                return;
            }

            double snapValue = timeState.getSnapValue();
            int pixelSecond = timeState.getPixelSecond();

            for (int i = 0; x < getWidth(); i++) {
                x = (int) ((i * snapValue) * pixelSecond);
                g.drawLine(x, 0, x, height);
            }

        }
    }

    protected Rectangle getAudioLayerRect(AudioLayer layer) {
        int y = 0;

        for (AudioLayer temp : layerGroup) {
            if (layer == temp) {
                return new Rectangle(0, y, 0, temp.getAudioLayerHeight());
            }
            y += temp.getAudioLayerHeight();
        }
        return null;
    }

    @Override
    public void audioClipAdded(final AudioLayer source, final AudioClip clip) {
        SwingUtilities.invokeLater(() -> {
            Rectangle rect = getAudioLayerRect(source);
            addClipPanel(clip, timeState, rect.y, rect.height);
            checkSize();
            repaint();
        });
    }

    @Override
    public void audioClipRemoved(final AudioLayer source, final AudioClip clip) {
        SwingUtilities.invokeLater(new Runnable() {
            @Override
            public void run() {
                removeClipPanel(clip);
                checkSize();
                repaint();
            }
        });
    }

    private void addClipPanel(AudioClip clip, TimeState timeState, int y, int height) {
        AudioClipPanel panel = new AudioClipPanel(clip, timeState, splitHandler);
        panel.addComponentListener(sObjViewListener);
        panel.setBounds(panel.getX(), y, panel.getWidth(), height);
        add(panel, DEFAULT_LAYER);
        clipPanelMap.put(clip, panel);
    }

    private void removeClipPanel(AudioClip clip) {
        AudioClipPanel panel = clipPanelMap.get(clip);
        panel.removeComponentListener(sObjViewListener);
        remove(panel);
        clipPanelMap.remove(clip);

        //TODO - need to see if this is where clip should be removed from selected
    }

    private void updateAudioClipYandHeight() {
        int y = 0;
        int height = 0;

        for (AudioLayer layer : layerGroup) {
            height = layer.getAudioLayerHeight();

            for (AudioClip clip : layer) {
                AudioClipPanel panel = clipPanelMap.get(clip);
                panel.setBounds(new Rectangle(panel.getX(), y, panel.getWidth(),
                        height));
            }
            y += height;
        }
    }

    @Override
    public ScoreObjectView<?> getScoreObjectViewAtPoint(Point p) {
        for (Component c : getComponentsInLayer(DEFAULT_LAYER)) {
            if (c instanceof ScoreObjectView && c.contains(p.x - c.getX(),
                    p.y - c.getY())) {
                return (ScoreObjectView) c;
            }
        }
        return null;
    }

    @Override
    public Action[] getLayerActions() {
        List<? extends Action> list = Utilities.actionsForPath(
                "blue/score/layers/audio/actions");
        return list.toArray(new Action[0]);
    }

    @Override
    public AudioLayerGroup getLayerGroup() {
        return layerGroup;
    }
}
