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
package blue.ui.core.score;

import blue.BlueData;
import blue.automation.AutomationManager;
import blue.components.AlphaMarquee;
import blue.gui.MyScrollPaneLayout;
import blue.gui.ScrollerButton;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.ScoreDataEvent;
import blue.score.ScoreListener;
import blue.score.TimeState;
import blue.score.layers.LayerGroup;
import blue.score.tempo.Tempo;
import blue.services.render.RenderTimeManager;
import blue.services.render.RenderTimeManagerListener;
import blue.settings.PlaybackSettings;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.components.IconFactory;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.layers.LayerGroupUIProviderManager;
import blue.ui.core.score.layers.SoundObjectProvider;
import blue.ui.core.score.manager.LayerGroupManagerDialog;
import blue.ui.core.score.manager.ScoreManagerDialog;
import blue.ui.core.score.tempo.TempoEditor;
import blue.ui.core.score.tempo.TempoEditorControl;
import blue.ui.utilities.LinearLayout;
import blue.utility.GUI;
import java.awt.*;
import java.awt.event.*;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.List;
import javax.swing.*;
import javax.swing.border.Border;
import javax.swing.border.LineBorder;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.util.ImageUtilities;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.lookup.AbstractLookup;
import org.openide.util.lookup.InstanceContent;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;

/**
 * TopComponent for Score Timeline.
 */
@ConvertAsProperties(
        dtd = "-//blue.ui.core.score//Score//EN",
        autostore = false
)
@TopComponent.Description(
        preferredID = "ScoreTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "editor", openAtStartup = false)
@ActionID(category = "Window", id = "blue.ui.core.score.ScoreTopComponent")
@ActionReferences({
    @ActionReference(path = "Menu/Window", position = 1000, separatorBefore = 990),
    @ActionReference(path = "Shortcuts", name = "D-1")
})
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_ScoreAction",
        preferredID = "ScoreTopComponent"
)
@NbBundle.Messages({
    "CTL_ScoreAction=Score",
    "CTL_ScoreTopComponent=Score",
    "HINT_ScoreTopComponent=This is a Score window"
})
public final class ScoreTopComponent extends TopComponent
        implements ScoreListener, RenderTimeManagerListener,
        PropertyChangeListener, SoundObjectProvider, ScoreControllerListener {

    private final InstanceContent content = new InstanceContent();
    private static ScoreTopComponent instance;
    private NoteProcessorDialog npcDialog = null;
    SoundObject bufferSoundObject;
    BlueData data;
    ScoreObjectBar scoreObjectBar = new ScoreObjectBar();
    TimeBar timeBar = new TimeBar();
    Border libraryBorder = new LineBorder(Color.GREEN);
    JPanel leftPanel = new JPanel(new BorderLayout());
    JViewport layerHeaderViewPort = new JViewport();
    JPanel layerHeaderPanel = new JPanel();
    JLayeredPane scorePanel = new JLayeredPane();
    JPanel layerPanel = new JPanel();
    Point syncPosition = new Point(0, 0);
    TimePointer renderStartPointer = new TimePointer(Color.GREEN);
    TimePointer renderLoopPointer = new TimePointer(Color.YELLOW);
    TimePointer renderTimePointer = new TimePointer(Color.ORANGE);
    float renderStart = -1.0f;
    float timePointer = -1.0f;
    JToggleButton snapButton = new JToggleButton();
    JCheckBox checkBox = new JCheckBox();
    TimelinePropertiesPanel timeProperties = new TimelinePropertiesPanel();
    TempoEditorControl tempoControlPanel = new TempoEditorControl();
    TempoEditor tempoEditor = new TempoEditor();
    ScoreNavigatorDialog navigator = null;
    volatile boolean checkingSize = false;
    AlphaMarquee marquee = new AlphaMarquee();
    ScoreMouseWheelListener mouseWheelListener;
    ScoreMouseListener listener = new ScoreMouseListener(this, content);
    TimeState currentTimeState = null;
    RenderTimeManager renderTimeManager
            = Lookup.getDefault().lookup(RenderTimeManager.class);
    PropertyChangeListener layerPanelWidthListener = new PropertyChangeListener() {
        @Override
        public void propertyChange(PropertyChangeEvent evt) {
            SwingUtilities.invokeLater(new Runnable() {
                @Override
                public void run() {
                    checkSize();
                }
            });
        }
    };

    private ScoreTopComponent() {
        initComponents();

        associateLookup(new AbstractLookup(content));

        setName(NbBundle.getMessage(ScoreTopComponent.class,
                "CTL_ScoreTopComponent"));
        setToolTipText(NbBundle.getMessage(ScoreTopComponent.class,
                "HINT_ScoreTopComponent"));

        init();

        final ScoreController scoreController = ScoreController.getInstance();

        scoreController.addScoreControllerListener(scoreObjectBar);
        scoreController.addScoreControllerListener(this);
        scoreController.setLookupAndContent(getLookup(), content);
        scoreController.setScrollPane(scrollPane);

        BlueProjectManager.getInstance().addPropertyChangeListener(
                new PropertyChangeListener() {
                    @Override
                    public void propertyChange(PropertyChangeEvent evt) {
                        if (BlueProjectManager.CURRENT_PROJECT.equals(
                                evt.getPropertyName())) {
                            reinitialize();
                        }
                    }
                });

        scrollPane.getVerticalScrollBar().addAdjustmentListener(
                new AdjustmentListener() {
                    @Override
                    public void adjustmentValueChanged(AdjustmentEvent ae) {
                        syncPosition.setLocation(0, ae.getValue());
                        layerHeaderViewPort.setViewPosition(syncPosition);
                    }
                });

        renderTimeManager.addPropertyChangeListener(this);
        renderTimeManager.addRenderTimeManagerListener(this);

        reinitialize();

        layerPanel.addMouseListener(listener);
        layerPanel.addMouseMotionListener(listener);

        layerHeaderViewPort.addMouseWheelListener(new MouseWheelListener() {

            @Override
            public void mouseWheelMoved(MouseWheelEvent e) {
                if (!e.isShiftDown()) {
                    for (MouseWheelListener listener : scrollPane.getMouseWheelListeners()) {
                        listener.mouseWheelMoved(e);
                    }
                }
            }
        });

    }

    protected void checkSize() {
        if (!checkingSize) {
            checkingSize = true;

            int height = ((layerPanel.getComponentCount() - 1) * Score.SPACER);
            int width = scrollPane.getViewport().getWidth();

            for (int i = 0; i < layerPanel.getComponentCount(); i++) {
                Component c = layerPanel.getComponent(i);
                Dimension d = c.getPreferredSize();
                width = (width > d.width) ? width : d.width;
                height += d.height;
            }

            if (width != getWidth() || height != getHeight()) {

                Dimension d = new Dimension(width, height);
                layerPanel.setSize(d);

                for (int i = 0; i < layerPanel.getComponentCount(); i++) {
                    Component c = layerPanel.getComponent(i);
                    Dimension d2 = c.getPreferredSize();
                    c.setSize(width, d2.height);
                }

                layerPanel.revalidate();
            }
            checkingSize = false;
        }
    }

    public synchronized void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData currentData = null;
        if (project != null) {
            currentData = project.getData();
        }

        if (this.currentTimeState != null) {
            this.currentTimeState.removePropertyChangeListener(this);
        }

        if (this.data != null) {
            this.data.removePropertyChangeListener(this);
            data.getScore().removeScoreListener(this);
            content.remove(data.getScore());
        }

        this.clearAll();
        this.data = currentData;
        AutomationManager.getInstance().setData(this.data);

        if (data != null) {

            Tempo tempo = data.getScore().getTempo();
            tempoControlPanel.setTempo(tempo);
            tempoEditor.setTempo(tempo);

            timeBar.setData(data);

            this.data.addPropertyChangeListener(this);

            Score score = data.getScore();
            score.addScoreListener(this);
            ScoreController.getInstance().setScore(score);

            content.add(score);
        } else {
        }

        layerHeaderPanel.repaint();
    }

    private void addPanelsForLayerGroup(int index, LayerGroup layerGroup, TimeState timeState) {
        final JComponent comp = LayerGroupUIProviderManager.getInstance().getLayerGroupPanel(
                layerGroup, timeState, data, content);
        final JComponent comp2 = LayerGroupUIProviderManager.getInstance().getLayerGroupHeaderPanel(
                layerGroup, timeState, data, content);

        if (comp != null && comp2 != null) {

            comp.putClientProperty("layerGroup", layerGroup);

            if (index < 0 || index > layerPanel.getComponentCount() - 1) {
                layerPanel.add(comp);
                layerHeaderPanel.add(comp2);
            } else {
                layerPanel.add(comp, index);
                layerHeaderPanel.add(comp2, index);
            }

            final Dimension d = new Dimension(comp2.getWidth(), comp.getHeight());
            comp2.setSize(d);

            comp.addComponentListener(new ComponentAdapter() {
                @Override
                public void componentResized(ComponentEvent e) {
                    SwingUtilities.invokeLater(new Runnable() {
                        @Override
                        public void run() {
                            Dimension d = new Dimension(leftPanel.getWidth(),
                                    comp.getHeight());
                            //comp2.setPreferredSize(d);
                            //comp2.setMaximumSize(d);
                            comp2.setSize(d);
                            comp2.revalidate();
                        }
                    });

                }
            });
            comp.addPropertyChangeListener("preferredSize",
                    layerPanelWidthListener);
        }
    }

    private void removePanelsForLayerGroups(int startIndex, int endIndex) {
        for (int i = 0; i <= endIndex - startIndex; i++) {
            Component comp = layerPanel.getComponent(startIndex);
            layerPanel.remove(startIndex);
            layerHeaderPanel.remove(startIndex);
        }
        layerPanel.revalidate();
        layerPanel.repaint();
        layerHeaderPanel.revalidate();
        layerHeaderPanel.repaint();
    }

    public void clearAll() {
//        scoreObjectBar.reset();

        scrollPane.revalidate();
    }

    private void formInit() {
        scrollPane.setLayout(new MyScrollPaneLayout());
        JPanel horizontalViewChanger = new JPanel(new GridLayout(1, 2));

        ScrollerButton plusHorz = new ScrollerButton("+");
        ScrollerButton minusHorz = new ScrollerButton("-");
        plusHorz.setActionCommand("plusHorizontal");
        minusHorz.setActionCommand("minusHorizontal");

        horizontalViewChanger.add(plusHorz);
        horizontalViewChanger.add(minusHorz);

        ActionListener al = new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                String command = e.getActionCommand();
                switch (command) {
                    case "minusHorizontal":
                        currentTimeState.lowerPixelSecond();
                        break;
                    case "plusHorizontal":
                        currentTimeState.raisePixelSecond();
                        break;
                }
            }
        };

        plusHorz.addActionListener(al);
        minusHorz.addActionListener(al);

        scrollPane.add(horizontalViewChanger,
                MyScrollPaneLayout.HORIZONTAL_RIGHT);

        scrollPane.setHorizontalScrollBarPolicy(
                JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
        scrollPane.setVerticalScrollBarPolicy(
                JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);

        tempoControlPanel.setBorder(BorderFactory.createRaisedBevelBorder());

        JButton manageButton = new JButton("Manage");
        manageButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                ScorePath path = ScoreController.getInstance().getScorePath();

                JDialog dialog;

                if (path.getLastLayerGroup() == null) {
                    ScoreManagerDialog dlg = new ScoreManagerDialog(
                            WindowManager.getDefault().getMainWindow(), true);
                    dlg.setScore(data.getScore());
                    dlg.setSize(600, 500);
                    dialog = dlg;
                } else {
                    LayerGroupManagerDialog dlg = new LayerGroupManagerDialog(
                            WindowManager.getDefault().getMainWindow(), true);
                    dlg.setLayerGroup(path.getLastLayerGroup());
                    dlg.setSize(300, 500);
                    dialog = dlg;
                }

                GUI.centerOnScreen(dialog);
                dialog.setVisible(true);
            }
        });
        manageButton.setPreferredSize(new Dimension(100, 20));

        JPanel bottomHeaderPanel = new JPanel();
        bottomHeaderPanel.setPreferredSize(new Dimension(100, 14));

        layerHeaderViewPort.setBorder(null);
        layerHeaderViewPort.setView(layerHeaderPanel);

        JPanel leftHeaderView = new JPanel(new BorderLayout());
        leftHeaderView.add(tempoControlPanel, BorderLayout.NORTH);
        leftHeaderView.add(manageButton, BorderLayout.SOUTH);

        leftPanel.add(leftHeaderView, BorderLayout.NORTH);
        leftPanel.add(layerHeaderViewPort, BorderLayout.CENTER);
        leftPanel.add(bottomHeaderPanel, BorderLayout.SOUTH);
        tempoControlPanel.addComponentListener(new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                layerHeaderPanel.setSize(layerHeaderViewPort.getWidth(),
                        layerHeaderPanel.getHeight());
                leftPanel.revalidate();
            }
        });

        final JPanel headerPanel = new JPanel(new BorderLayout());
        headerPanel.setBackground(Color.BLACK);

        headerPanel.add(tempoEditor, BorderLayout.CENTER);
        headerPanel.add(timeBar, BorderLayout.SOUTH);

        tempoEditor.addComponentListener(new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                headerPanel.revalidate();
            }
        });

        ImageIcon icon = new ImageIcon(ImageUtilities.loadImage(
                "blue/resources/images/ZoomIn16.gif"));
        JButton zoomButton = new JButton(icon);
        zoomButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (navigator == null) {
                    navigator = new ScoreNavigatorDialog(
                            WindowManager.getDefault().getMainWindow());
                    navigator.setJScrollPane(scrollPane);
                    navigator.setLayerPanel(layerPanel);
                }
                navigator.setVisible(true);
            }
        });

        scrollPane.setColumnHeaderView(headerPanel);
        scrollPane.setCorner(JScrollPane.LOWER_RIGHT_CORNER, zoomButton);
        scrollPane.setCorner(JScrollPane.UPPER_RIGHT_CORNER, snapButton);

        layerPanel.setBackground(Color.BLACK);
        layerPanel.setOpaque(true);
        layerPanel.setLayout(new LinearLayout(Score.SPACER));
        layerHeaderPanel.setLayout(new LinearLayout(Score.SPACER));

        scorePanel.add(layerPanel, JLayeredPane.DEFAULT_LAYER);

        scrollPane.getViewport().setView(scorePanel);
        scrollPane.getViewport().setScrollMode(JViewport.BLIT_SCROLL_MODE);
        scrollPane.getViewport().setBackground(Color.BLACK);

        topSplitPane.add(scrollPane, JSplitPane.RIGHT);
        topSplitPane.add(leftPanel, JSplitPane.LEFT);
        topSplitPane.setDividerLocation(175);

        timeProperties.setVisible(false);
        timeProperties.setPreferredSize(new Dimension(150, 40));

        timeProperties.setVisible(false);
        timeProperties.setPreferredSize(new Dimension(150, 40));

        topPanel.setLayout(new BorderLayout());
        topPanel.add(new ModeSelectionPanel(), BorderLayout.WEST);
        topPanel.add(scoreObjectBar, BorderLayout.CENTER);

        this.add(timeProperties, BorderLayout.EAST);

        snapButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                // showSnapPopup();
                timeProperties.setVisible(!timeProperties.isVisible());
            }
        });

        scorePanel.add(renderStartPointer, JLayeredPane.DRAG_LAYER);
        scorePanel.add(renderLoopPointer, JLayeredPane.DRAG_LAYER);
        scorePanel.add(renderTimePointer, JLayeredPane.DRAG_LAYER);

    }

    private void init() {
        snapButton.setIcon(IconFactory.getLeftArrowIcon());
        snapButton.setSelectedIcon(IconFactory.getRightArrowIcon());
        snapButton.setFocusable(false);

        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();

        layerPanel.addComponentListener(new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                int newHeight = layerPanel.getHeight();

                Dimension d = new Dimension(layerPanel.getWidth(), 20);
                timeBar.setMinimumSize(d);
                timeBar.setPreferredSize(d);
                timeBar.setSize(d);
                timeBar.repaint();

                scorePanel.setSize(layerPanel.getSize());
                scorePanel.setPreferredSize(layerPanel.getSize());

                renderStartPointer.setSize(1, newHeight);
                renderLoopPointer.setSize(1, newHeight);
                renderTimePointer.setSize(1, newHeight);
            }
        });

        try {
            formInit();
        } catch (Exception e) {
            e.printStackTrace();
        }

        this.mouseWheelListener = new ScoreMouseWheelListener(scrollPane);

        ModeManager.getInstance().setMode(ModeManager.MODE_SCORE);
    }

    // FIXME - this needs to be better done, perhaps hidden behind an interface
    public int getHorizontalScrollValue() {
        return scrollPane.getHorizontalScrollBar().getValue();
    }

    public int getVerticalScrollValue() {
        return scrollPane.getVerticalScrollBar().getValue();
    }

    public void setHorizontalScrollValue(int value) {
        scrollPane.getHorizontalScrollBar().setValue(value);
    }

    public void setVerticalScrollValue(int value) {
        scrollPane.getVerticalScrollBar().setValue(value);
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        topSplitPane = new javax.swing.JSplitPane();
        scrollPane = new javax.swing.JScrollPane();
        topPanel = new javax.swing.JPanel();

        setLayout(new java.awt.BorderLayout());

        topSplitPane.setDividerLocation(160);

        scrollPane.setBorder(null);
        topSplitPane.setRightComponent(scrollPane);

        add(topSplitPane, java.awt.BorderLayout.CENTER);
        add(topPanel, java.awt.BorderLayout.PAGE_START);
    }// </editor-fold>//GEN-END:initComponents
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JScrollPane scrollPane;
    private javax.swing.JPanel topPanel;
    private javax.swing.JSplitPane topSplitPane;
    // End of variables declaration//GEN-END:variables

    public static synchronized ScoreTopComponent getDefault() {
        if (instance == null) {
            instance = new ScoreTopComponent();
        }
        return instance;
    }

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    /**
     * replaces this in object stream
     */
    @Override
    public Object writeReplace() {
        return new ResolvableHelper();
    }

    void writeProperties(java.util.Properties p) {
        p.setProperty("version", "1.0");
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
    }

    @Override
    public void layerGroupsChanged(ScoreDataEvent sde) {
        if (sde.getType() == ScoreDataEvent.DATA_ADDED) {
            Score score = data.getScore();
            for (int i = sde.getStartIndex(); i <= sde.getEndIndex(); i++) {
                addPanelsForLayerGroup(i, score.getLayerGroup(i),
                        score.getTimeState());
            }
            layerHeaderPanel.revalidate();
            checkSize();
        } else if (sde.getType() == ScoreDataEvent.DATA_REMOVED) {
            removePanelsForLayerGroups(sde.getStartIndex(), sde.getEndIndex());
        } else if (sde.getType() == ScoreDataEvent.DATA_CHANGED) {
            List<LayerGroup> layerGroups = sde.getLayerGroups();
            JComponent c = (JComponent) layerPanel.getComponent(
                    sde.getStartIndex());
            LayerGroup lGroup = (LayerGroup) c.getClientProperty("layerGroup");

            if (layerGroups.get(1) == lGroup) {
                // handle push down
                Component comp = layerPanel.getComponent(sde.getEndIndex());
                layerPanel.remove(comp);
                layerPanel.add(comp, sde.getStartIndex());

                Component comp2 = layerHeaderPanel.getComponent(
                        sde.getEndIndex());
                layerHeaderPanel.remove(comp2);
                layerHeaderPanel.add(comp2, sde.getStartIndex());

                layerPanel.revalidate();
                layerHeaderPanel.revalidate();

                layerPanel.repaint();
                layerHeaderPanel.repaint();
            } else {
                // handle push up
                Component comp = layerPanel.getComponent(sde.getStartIndex());
                layerPanel.remove(comp);
                layerPanel.add(comp, sde.getEndIndex());

                Component comp2 = layerHeaderPanel.getComponent(
                        sde.getStartIndex());
                layerHeaderPanel.remove(comp2);
                layerHeaderPanel.add(comp2, sde.getEndIndex());

                layerPanel.revalidate();
                layerHeaderPanel.revalidate();

                layerPanel.repaint();
                layerHeaderPanel.repaint();
            }

        }
    }

// TODO - Reevaulate to see if this can't be done with a
    // PropertyChangeListener on BlueData
    public void updateRenderStartPointerX(int x, boolean fireUpdate) {

        boolean left = x < renderStartPointer.getX();

        renderStartPointer.setLocation(x, 0);

        if (fireUpdate) {
            JViewport viewPort = (JViewport) scorePanel.getParent();

            Rectangle rect;

            if (left) {
                rect = new Rectangle(x - 20,
                        viewPort.getViewPosition().y,
                        1,
                        1);
            } else {
                rect = new Rectangle(x + 20,
                        viewPort.getViewPosition().y,
                        1,
                        1);
            }

            scrollRectToVisible(rect);
        }
    }

    // TODO - Reevaulate to see if this can't be done with a
    // PropertyChangeListener on BlueData
    public void updateRenderLoopPointerX(int newX) {
        renderLoopPointer.setLocation(newX, 0);
    }

    private void updateRenderTimePointer() {

        ScorePath path = ScoreController.getInstance().getScorePath();
        if (path.getLastLayerGroup() != null) {
            return;
        }

        if (!renderTimeManager.isCurrentProjectRendering()) {
            return;
        }

        float latency = PlaybackSettings.getInstance().getPlaybackLatencyCorrection();

        if (renderStart < 0.0f || timePointer < latency) {
            renderTimePointer.setLocation(-1, 0);
        } else {
            int x = (int) ((renderStart + timePointer - latency) * data.getScore().getTimeState().getPixelSecond());
            renderTimePointer.setLocation(x, 0);
        }
    }

    @Override
    public void renderInitiated() {
    }

    @Override
    public void renderEnded() {
    }

    @Override
    public void renderTimeUpdated(float timePointer) {
        this.timePointer = timePointer;
        updateRenderTimePointer();;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == renderTimeManager) {
            //FIXME - check if root score object
//            if (this.pObj.isRoot()) {
            if (evt.getPropertyName().equals(RenderTimeManager.RENDER_START)) {
                this.renderStart = ((Float) evt.getNewValue()).floatValue();
                this.timePointer = -1.0f;
                updateRenderTimePointer();
            } /* else if (prop.equals(RenderTimeManager.TIME_POINTER)) {
             this.timePointer = ((Float) evt.getNewValue()).floatValue();
             updateRenderTimePointer();
             } */
//            } else {
//                this.timePointer = -1.0f;
//                updateRenderTimePointer();
//            }

        } else if (evt.getSource() == currentTimeState) {
            if (evt.getPropertyName().equals("pixelSecond")) {
                float val = data.getRenderStartTime();

                int newX = (int) (val * currentTimeState.getPixelSecond());
                updateRenderStartPointerX(newX, true);

                val = data.getRenderEndTime();
                newX = (int) (val * currentTimeState.getPixelSecond());

                updateRenderLoopPointerX(newX);

            }
        } else if (evt.getSource() == data) {
            boolean isRenderStartTime = evt.getPropertyName().equals(
                    "renderStartTime");
            boolean isRenderLoopTime = evt.getPropertyName().equals(
                    "renderLoopTime");

            if (isRenderStartTime || isRenderLoopTime) {

                if (data.getScore() == null) {
                    return;
                }

                float val = ((Float) evt.getNewValue()).floatValue();

                //FIXME
                TimeState timeState = data.getScore().getTimeState();
                int newX = (int) (val * timeState.getPixelSecond());

                if (isRenderStartTime) {
                    updateRenderStartPointerX(newX, true);
                } else if (isRenderLoopTime) {
                    updateRenderLoopPointerX(newX);
                }

            }
        }
    }

    /* SCORE BAR LISTENER METHODS */
//    @Override
    public void scoreBarScoreSelected(Score score, int scrollX, int scrollY) {

        if (this.currentTimeState != null) {
            this.currentTimeState.removePropertyChangeListener(this);
        }

        ScoreController.getInstance().setSelectedScoreObjects(null);

        this.clearAll();

        if (score != null) {

            layerPanel.removeAll();
            layerHeaderPanel.removeAll();

            for (int i = 0; i < score.getLayerGroupCount(); i++) {
                LayerGroup layerGroup = score.getLayerGroup(i);
                addPanelsForLayerGroup(-1, layerGroup, score.getTimeState());
            }

            checkSize();

            layerPanel.revalidate();
            layerHeaderPanel.revalidate();

            TimeState timeState = score.getTimeState();
            tempoEditor.setTimeState(timeState);
            tempoEditor.setVisible(true);
            tempoControlPanel.setVisible(true);
            timeBar.setRootTimeline(true);
            timeBar.setTimeState(timeState);
            timeProperties.setTimeState(timeState);
            mouseWheelListener.setTimeState(timeState);

            this.currentTimeState = timeState;
            timeState.addPropertyChangeListener(this);

            scrollPane.repaint();

            ModeManager.getInstance().setMode(
                    ModeManager.getInstance().getMode());

            int startTime = (int) (data.getRenderStartTime() * timeState.getPixelSecond());
            int endTime = (int) (data.getRenderEndTime() * timeState.getPixelSecond());

            renderStartPointer.setVisible(true);
            renderLoopPointer.setVisible(true);
            renderTimePointer.setVisible(true);

            scorePanel.add(marquee, new Integer(500));
            marquee.setVisible(false);

            updateRenderStartPointerX(startTime, false);
            updateRenderLoopPointerX(endTime);
            renderTimePointer.setLocation(-1, 0);
            updateRenderTimePointer();

            layerHeaderPanel.repaint();

            setHorizontalScrollValue(scrollX);
            setVerticalScrollValue(scrollY);
        }
    }

//    @Override
    public void scoreBarLayerGroupSelected(LayerGroup layerGroup, int scrollX, int scrollY) {
        //FIXME - this should not be hardcoded to PolyObject

        if (!(layerGroup instanceof PolyObject)) {
            return;
        }

        ScoreController.getInstance().setSelectedScoreObjects(null);

        PolyObject pObj = (PolyObject) layerGroup;

        tempoEditor.setVisible(false);
        tempoControlPanel.setVisible(false);

        if (this.currentTimeState != null) {
            this.currentTimeState.removePropertyChangeListener(this);
        }

        this.clearAll();

        if (layerGroup != null) {

            layerPanel.removeAll();
            layerHeaderPanel.removeAll();

            addPanelsForLayerGroup(-1, layerGroup, pObj.getTimeState());

            checkSize();

            layerPanel.revalidate();
            layerHeaderPanel.revalidate();

            TimeState timeState = pObj.getTimeState();
            tempoEditor.setTimeState(timeState);
            tempoEditor.setVisible(true);
            tempoControlPanel.setVisible(true);
            timeBar.setRootTimeline(false);
            timeBar.setTimeState(timeState);
            timeProperties.setTimeState(timeState);
            mouseWheelListener.setTimeState(timeState);

            this.currentTimeState = timeState;
            timeState.addPropertyChangeListener(this);

            scrollPane.repaint();

            ModeManager.getInstance().setMode(
                    ModeManager.getInstance().getMode());

            renderStartPointer.setVisible(false);
            renderLoopPointer.setVisible(false);
            renderTimePointer.setVisible(false);

            layerHeaderPanel.repaint();

            setHorizontalScrollValue(scrollX);
            setVerticalScrollValue(scrollY);
        }
    }

    public JLayeredPane getScorePanel() {
        return scorePanel;
    }

    public AlphaMarquee getMarquee() {
        return marquee;
    }

    public JPanel getLayerPanel() {
        return layerPanel;
    }

    @Override
    public void scorePathChanged(ScorePath path) {
        LayerGroup layerGroup = path.getLastLayerGroup();
        if (layerGroup == null) {
            scoreBarScoreSelected(path.getScore(), 0, 0);
        } else {

            scoreBarLayerGroupSelected(layerGroup, 0, 0);
        }
    }

    final static class ResolvableHelper implements Serializable {

        private static final long serialVersionUID = 1L;

        public Object readResolve() {
            return ScoreTopComponent.getDefault();
        }
    }

    public LayerGroupPanel getLayerGroupPanelAtPoint(MouseEvent e) {
        LayerGroupPanel retVal = null;

        Point p = SwingUtilities.convertPoint(e.getComponent(), e.getPoint(),
                layerPanel);

        Component c = layerPanel.getComponentAt(p);
        if (c instanceof LayerGroupPanel) {
            retVal = (LayerGroupPanel) c;
        }
        return retVal;
    }

    public ScoreObjectView getScoreObjectViewAtPoint(MouseEvent e) {
        LayerGroupPanel retVal = getLayerGroupPanelAtPoint(e);

        if (retVal == null) {
            return null;
        }

        return retVal.getScoreObjectViewAtPoint(
                SwingUtilities.convertPoint(e.getComponent(),
                        e.getPoint(), (JComponent) retVal));
    }

    public TimeState getTimeState() {
        return this.currentTimeState;
    }
}
