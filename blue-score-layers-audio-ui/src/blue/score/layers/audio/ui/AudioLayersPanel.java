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

import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.AudioLayer;
import blue.score.layers.audio.core.AudioLayerGroup;
import blue.score.layers.audio.core.AudioLayerListener;
import blue.ui.core.score.ScoreObjectView;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.layers.SelectionMarquee;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseWheelEvent;
import java.awt.event.MouseWheelListener;
import java.awt.geom.AffineTransform;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import javax.swing.JPanel;

/**
 *
 * @author stevenyi
 */
public class AudioLayersPanel extends JPanel implements LayerGroupListener,
        PropertyChangeListener, LayerGroupPanel, AudioLayerListener {

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
    Set<AudioClip> selectedClips = new HashSet<>();
    Map<AudioClip, AudioClipPanel> clipPanelMap = new HashMap<>();

    public AudioLayersPanel(AudioLayerGroup layerGroup, TimeState timeState) {
        this.setLayout(null);
        this.layerGroup = layerGroup;
        this.timeState = timeState;

        transform.setToIdentity();
        transform.setToScale(timeState.getPixelSecond(), 1.0);
        reverseTransform.setToIdentity();
        reverseTransform.setToScale(1 / timeState.getPixelSecond(), 1.0);

        layerGroup.addLayerGroupListener(this);
        timeState.addPropertyChangeListener(this);

        final Dimension d = checkSize();
        this.setSize(d);
        this.setBackground(Color.BLACK);

        this.addMouseWheelListener(new MouseWheelListener() {
            @Override
            public void mouseWheelMoved(MouseWheelEvent mwe) {
                mwe.getComponent().getParent().dispatchEvent(mwe);
            }
        });

        AudioLayerPanelMouseListener listener =
                new AudioLayerPanelMouseListener(this, layerGroup, timeState,
                selectedClips);
        this.addMouseListener(listener);
        this.addMouseMotionListener(listener);

        new AudioLayersDropTargetListener(this);

        heightListener = new PropertyChangeListener() {
            @Override
            public void propertyChange(PropertyChangeEvent evt) {
                checkSize();
            }
        };

        int y = 0;
        for (int i = 0; i < layerGroup.getSize(); i++) {
            AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
            int height = layer.getAudioLayerHeight();
            layer.addPropertyChangeListener(heightListener);
            layer.addAudioLayerListener(this);


            for (AudioClip clip : layer) {
                addClipPanel(clip, timeState, y, height);
            }
            y += height;
        }

    }

    public AudioLayerGroup getAudioLayerGroup() {
        return layerGroup;
    }

    public TimeState getTimeState() {
        return timeState;
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        layerGroup.removeLayerGroupListener(this);
        timeState.removePropertyChangeListener(this);

        for (int i = 0; i < layerGroup.getSize(); i++) {
            AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
            layer.removePropertyChangeListener(heightListener);
            layer.removeAudioLayerListener(this);
        }

        selectedClips.clear();
        clipPanelMap.clear();
    }

    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
        ArrayList<Layer> layers = event.getLayers();

        if (event.getType() == LayerGroupDataEvent.DATA_ADDED) {
            for (Layer layer : layers) {
                ((AudioLayer) layer).addPropertyChangeListener(heightListener);
                ((AudioLayer) layer).addAudioLayerListener(this);

                for (AudioClip clip : (AudioLayer) layer) {
                    addClipPanel(clip, timeState, 0, 0);
                }

            }

        } else if (event.getType() == LayerGroupDataEvent.DATA_REMOVED) {
            for (Layer layer : layers) {
                ((AudioLayer) layer).removePropertyChangeListener(heightListener);
                ((AudioLayer) layer).removeAudioLayerListener(this);

                for (AudioClip clip : (AudioLayer) layer) {
                    removeClipPanel(clip);
                }
            }
        }

        updateAudioClipYandHeight();
        checkSize();
        repaint();
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
            if (evt.getPropertyName().equals("pixelSecond")) {
                checkSize();
                transform.setToIdentity();
                transform.setToScale(timeState.getPixelSecond(), 1.0);
                reverseTransform.setToIdentity();
                reverseTransform.setToScale(1 / timeState.getPixelSecond(), 1.0);
            }
        }
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        paintAudioLayersBackground(g);
        //paintAudioClips(g);

    }

    @Override
    public void marqueeSelectionPerformed(SelectionMarquee marquee) {
        selectedClips.clear();
        if (marquee.intersects(this)) {

            Rectangle rect = marquee.getTranslatedRect(this);
            int top = rect.y;
            int bottom = top + rect.height;

            double start = rect.x / (double) timeState.getPixelSecond();
            double end = (rect.x + rect.width) / (double) timeState.getPixelSecond();

            int y = 0;

            for (int i = 0; i < layerGroup.getSize(); i++) {
                AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
                int layerHeight = layer.getAudioLayerHeight();

                if (y <= bottom && (y + layerHeight) >= top) {

                    for (AudioClip clip : layer) {
                        if (clip.getStartTime() <= end
                                && (clip.getStartTime() + clip.getSubjectiveDuration()) >= start) {
                            selectedClips.add(clip);
                            clipPanelMap.get(clip).setSelected(true);
                        } else {
                            clipPanelMap.get(clip).setSelected(false);
                        }
                    }
                } else {
                    for (AudioClip clip : layer) {
                        clipPanelMap.get(clip).setSelected(false);
                    }
                }

                y += layerHeight;
            }
        }
        //TODO - this could be smarter by calculating affected area and repainting
        // only the union of all changed clips
        repaint();

        // ignore as this panel does not handle this event
    }

    @Override
    public void paintNavigatorView(Graphics2D g2d) {
//        int pixelSecond = timeState.getPixelSecond();
//
//        int patternBeatsLength = layerGroup.getAudioBeatsLength();
//        int patternWidth = patternBeatsLength * pixelSecond;
//        
//        for (int i = 0; i < layerGroup.getSize(); i++) {
//            int y = i * Layer.LAYER_HEIGHT;
//            int x = 0; 
//            AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
//            AudioData data = layer.getAudioData();
//
//            g2d.setColor(PATTERN_COLOR);
//
//            for (int j = 0; x < getBounds().getMaxX(); j++) {
//                x = (j * patternBeatsLength) * pixelSecond;
//                if (data.isAudioSet(j)) {
//                    //System.out.println("pattern set: " + j);
//                    g2d.fillRect(x, y, patternWidth, Layer.LAYER_HEIGHT);
//                }
//            }
//        }
    }

    private void paintAudioLayersBackground(Graphics g) {
        int width = this.getWidth();

        g.setColor(Color.BLACK);
        g.fillRect(0, 0, width, this.getHeight());

        int y = 0;
        g.setColor(Color.DARK_GRAY);
        g.drawLine(0, 0, width, 0);

        for (int i = 0; i < layerGroup.getSize(); i++) {
            AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
            y += layer.getAudioLayerHeight();

            g.drawLine(0, y, width, y);
        }

        g.drawLine(0, getHeight() - 1, width, getHeight() - 1);
    }

//    private void paintAudioClips(Graphics g) {
//        Graphics2D g2d = (Graphics2D) g;
//        g2d.setComposite(AlphaComposite.Src);
//        g2d.setFont(renderFont);
//
////        AffineTransform originalTransform = g2d.getTransform();
////        originalTransform
////        g2d.transform(transform);
//
//        Rectangle2D rect = new Rectangle2D.Double();
//        
//        int y = 0;
//        
//        
//        for (int i = 0; i < layerGroup.getSize(); i++) {
//            AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
//            int layerHeight = layer.getAudioLayerHeight() - 2;
//            
//            Color bg, border, text;
//            
//            for (AudioClip clip : layer) {
//                
//                if (selectedClips.contains(clip)) {
//                    bg = Color.WHITE;
//                    border = Color.DARK_GRAY;
//                    text = Color.BLACK;                    
//                } else {
//                    bg = Color.DARK_GRAY;
//                    border = Color.BLACK;
//                    text = Color.WHITE;
//                }
//                
//                srcPts[0] = clip.getStart();
//                srcPts[2] = clip.getDuration();
//                transform.transform(srcPts, 0, destPts, 0, 2);
//                
//                rect.setRect(destPts[0], y + 1, destPts[2], layerHeight);
//                
//                g2d.setColor(bg);
//                g2d.fill(rect);
//                
//                g2d.setColor(border);
//                g2d.draw(rect);
//                
//                g2d.setColor(text);
//                g2d.drawString(clip.getName(), (int) destPts[0] + 5, 15 + y);
//            }
//            
//            
//            y += layer.getAudioLayerHeight();
//        }
//
////        g2d.setTransform(originalTransform);
//    }
    protected Rectangle getAudioLayerRect(AudioLayer layer) {
        int y = 0;
        AudioLayer temp;

        for (int i = 0; i < layerGroup.getSize(); i++) {
            temp = (AudioLayer) layerGroup.getLayerAt(i);
            if (layer == temp) {
                return new Rectangle(0, y, 0, temp.getAudioLayerHeight());
            }
            y += temp.getAudioLayerHeight();
        }
        return null;
    }

    @Override
    public void audioClipAdded(AudioLayer source, AudioClip clip) {
        Rectangle rect = getAudioLayerRect(source);
        addClipPanel(clip, timeState, rect.y, rect.height);
    }

    @Override
    public void audioClipRemoved(AudioLayer source, AudioClip clip) {
        removeClipPanel(clip);
    }

    private void addClipPanel(AudioClip clip, TimeState timeState, int y, int height) {
        AudioClipPanel panel = new AudioClipPanel(clip, timeState);
        panel.setBounds(panel.getX(), y, panel.getWidth(), height);
        add(panel);
        clipPanelMap.put(clip, panel);
    }

    private void removeClipPanel(AudioClip clip) {
        AudioClipPanel panel = clipPanelMap.get(clip);
        remove(panel);
        clipPanelMap.remove(clip);
    }

    private void updateAudioClipYandHeight() {
        int y = 0;
        int height = 0;

        for (int i = 0; i < layerGroup.getSize(); i++) {
            AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
            height = layer.getAudioLayerHeight();

            for (AudioClip clip : layer) {
                AudioClipPanel panel = clipPanelMap.get(clip);
                panel.setBounds(new Rectangle(panel.getX(), y, panel.getWidth(),
                        height));
            }
            y += height;
        }
    }

    protected void setSelectedAudioClip(AudioClipPanel panel) {
        selectedClips.clear();
        for (int i = 0; i < getComponentCount(); i++) {
            Component c = getComponent(i);

            if (c == panel) {
                selectedClips.add(panel.getScoreObject());
                panel.setSelected(true);
            } else if (c instanceof AudioClipPanel) {
                ((AudioClipPanel) c).setSelected(false);
            }
        }
    }

    protected void toggleSelectedAudioClip(AudioClipPanel panel) {
        if (panel.isSelected()) {
            selectedClips.remove(panel.getScoreObject());
        } else {
            selectedClips.add(panel.getScoreObject());
        }
        panel.setSelected(!panel.isSelected());
    }

    @Override
    public ScoreObjectView getScoreObjectViewAtPoint(Point p) {
        Point temp = new Point();
        for(AudioClipPanel panel : clipPanelMap.values()) {
            temp.x = p.x - panel.getX();
            temp.y = p.y - panel.getY();
            if(panel.contains(temp)) {
                return panel; 
            }
        }

        return null;
    }
}
