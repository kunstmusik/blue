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
import blue.automation.ParameterLinePanel;
import blue.components.AlphaMarquee;
import blue.components.lines.Line;
import blue.gui.MyScrollPaneLayout;
import blue.gui.ScrollerButton;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.Layer;
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
import blue.util.ObservableListEvent;
import blue.util.ObservableListListener;
import blue.utility.GUI;
import java.awt.*;
import java.awt.event.*;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import javax.swing.*;
import javax.swing.border.Border;
import javax.swing.border.LineBorder;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;
import org.openide.util.ImageUtilities;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.Utilities;
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
@TopComponent.Registration(mode = "editor", openAtStartup = true,
        position = 100)
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
        implements ObservableListListener<LayerGroup<? extends Layer>>, RenderTimeManagerListener,
        PropertyChangeListener, SoundObjectProvider, ScoreControllerListener {

    private final InstanceContent content = new InstanceContent();
    private final ScoreController scoreController = ScoreController.getInstance();

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
    double renderStart = -1.0f;
    double timePointer = -1.0f;
    JToggleButton snapButton = new JToggleButton();
    JCheckBox checkBox = new JCheckBox();
    TimelinePropertiesPanel timeProperties = new TimelinePropertiesPanel();
    TempoEditorControl tempoControlPanel = new TempoEditorControl();
    TempoEditor tempoEditor = new TempoEditor();
    ScoreNavigatorDialog navigator = null;
    volatile boolean checkingSize = false;
    AlphaMarquee marquee = new AlphaMarquee();
    ScoreMouseWheelListener mouseWheelListener;
    LayerHeightWheelListener layerHeightWheelListener;
    ScoreMouseListener listener = new ScoreMouseListener(this, content);
    TimeState currentTimeState = null;
    RenderTimeManager renderTimeManager
            = Lookup.getDefault().lookup(RenderTimeManager.class);
    PropertyChangeListener layerPanelWidthListener = (PropertyChangeEvent evt) -> {
        SwingUtilities.invokeLater(this::checkSize);
    };
    private ScorePath currentScorePath;

    private ScoreTopComponent() {
        initComponents();

        associateLookup(new AbstractLookup(content));

        setName(Bundle.CTL_ScoreTopComponent());
        setToolTipText(Bundle.HINT_ScoreTopComponent());

        init();

        scoreController.addScoreControllerListener(scoreObjectBar);
        scoreController.addScoreControllerListener(this);
        scoreController.setLookupAndContent(getLookup(), content);
        scoreController.setScrollPane(scrollPane);

        BlueProjectManager.getInstance().addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if (BlueProjectManager.CURRENT_PROJECT.equals(
                    evt.getPropertyName())) {
                reinitialize();
            }
        });

        scrollPane.getVerticalScrollBar().addAdjustmentListener((AdjustmentEvent ae) -> {
            syncPosition.setLocation(0, ae.getValue());
            layerHeaderViewPort.setViewPosition(syncPosition);
        });

        renderTimeManager.addPropertyChangeListener(this);
        renderTimeManager.addRenderTimeManagerListener(this);

        reinitialize();

        layerPanel.addMouseListener(listener);
        layerPanel.addMouseMotionListener(listener);

        layerHeaderViewPort.addMouseWheelListener((MouseWheelEvent e) -> {
            if (!e.isShiftDown()) {
                for (MouseWheelListener listener1 : scrollPane.getMouseWheelListeners()) {
                    listener1.mouseWheelMoved(e);
                }
            }
        });

        FileObject[] files = FileUtil.getConfigFile(
                "blue/score/shortcuts").getChildren();
        InputMap inputMap = scorePanel.getInputMap(
                WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        ActionMap actionMap = scorePanel.getActionMap();
        for (FileObject fObj : files) {
            Action a = FileUtil.getConfigObject(fObj.getPath(), Action.class);
            KeyStroke ks = Utilities.stringToKey(fObj.getName());
            inputMap.put(ks, a.getValue(Action.NAME));
            actionMap.put(a.getValue(Action.NAME), a);
        }

        SingleLineScoreSelection.getInstance().addListener(new SingleLineScoreSelection.SingleLineScoreSelectionListener() {
            WeakReference<Line> lastLine = null;
            int[] lastYHeight = null;

            @Override
            public void singleLineScoreSelectionPerformed(SingleLineScoreSelection selection) {
                if (selection.getSourceLine() != null) {
                    int[] yHeight;

                    if (lastLine != null && lastLine.get() == selection.getSourceLine()) {
                        yHeight = lastYHeight;
                    } else {
                        yHeight = ParameterLinePanel.getYHeight(selection.getSourceLine());
                        lastYHeight = yHeight;
                        lastLine = new WeakReference<>(selection.getSourceLine());
                    }

                    if (yHeight == null) {
                        marquee.setVisible(false);
                        return;
                    }

                    marquee.setVisible(true);
                    double pixelSecond = data.getScore().getTimeState().getPixelSecond();
                    final var start = selection.getRangeStartTime();
                    final var end = selection.getRangeEndTime();
                    int x = (int) (start * pixelSecond);
                    int width = (int) Math.ceil((end - start) * pixelSecond);
                    marquee.setBounds(x, yHeight[0], width, yHeight[1]);
                } else {
                    marquee.setVisible(false);
                    lastYHeight = null;
                    lastLine = null;
                }
            }
        }
        );

        final MultiLineScoreSelection multiSelection
                = MultiLineScoreSelection.getInstance();
        multiSelection.addListener((updateType) -> {
            final var selectedLayers = multiSelection.getSelectedLayers();
            if (selectedLayers == null || selectedLayers.size() == 0) {
                marquee.setBounds(-1, -1, 0, 0);
                marquee.setVisible(false);
            } else {
                double pixelSecond = data.getScore().getTimeState().getPixelSecond();
                var scale = multiSelection.getScale();
                double newStart = multiSelection.getStartTime();
                double newEnd = multiSelection.getEndTime();

                if (updateType == MultiLineScoreSelection.UpdateType.TRANSLATION
                        || updateType == MultiLineScoreSelection.UpdateType.SCALE) {
                    newStart = scale.getRangeStart();
                    newEnd = scale.getRangeEnd();
                }

                int x = (int) (newStart * pixelSecond);
                int width = (int) Math.ceil((newEnd - newStart) * pixelSecond);

                int min = Integer.MAX_VALUE, max = Integer.MIN_VALUE;
                Score score = BlueProjectManager.getInstance().getCurrentBlueData().getScore();
                for (Layer layer : selectedLayers) {
                    int[] minMax = ScorePath.getTopBottomForLayer(layer, score);
                    min = Math.min(min, minMax[0]);
                    max = Math.max(max, minMax[1]);
                }

                marquee.setVisible(true);
                marquee.setBounds(x, min, width, max - min);
            }

        });

        scoreController.addScoreControllerListener((path) -> {
            currentScorePath = path;
        });
        currentScorePath = scoreController.getScorePath();
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
            data.getScore().removeListener(this);
            content.remove(data.getScore());
        }

        this.clearAll();
        this.data = currentData;
        AutomationManager.getInstance().setData(this.data);

        for (ScoreObject scoreObj : getLookup().lookupAll(ScoreObject.class
        )) {
            content.remove(scoreObj);
        }

        if (data != null) {

            Tempo tempo = data.getScore().getTempo();
            tempoControlPanel.setTempo(tempo);
            tempoEditor.setTempo(tempo);

            timeBar.setData(data);

            this.data.addPropertyChangeListener(this);

            Score score = data.getScore();
            score.addListener(this);
            scoreController.setScore(score);

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
                    SwingUtilities.invokeLater(() -> {
                        Dimension d1 = new Dimension(leftPanel.getWidth(),
                                comp.getHeight());
                        //comp2.setPreferredSize(d);
                        //comp2.setMaximumSize(d);
                        comp2.setSize(d1);
                        comp2.revalidate();
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

        ActionListener al = (ActionEvent e) -> {
            String command = e.getActionCommand();
            switch (command) {
                case "minusHorizontal":
                    currentTimeState.lowerPixelSecond();
                    break;
                case "plusHorizontal":
                    currentTimeState.raisePixelSecond();
                    break;
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
        manageButton.addActionListener((ActionEvent e) -> {
            if (currentScorePath == null) {
                return;
            }

            JDialog dialog;

            if (currentScorePath.getLastLayerGroup() == null) {
                ScoreManagerDialog dlg = new ScoreManagerDialog(
                        WindowManager.getDefault().getMainWindow(), true);
                dlg.setScore(data.getScore());
                dlg.setSize(600, 500);
                dialog = dlg;
            } else {
                LayerGroupManagerDialog dlg = new LayerGroupManagerDialog(
                        WindowManager.getDefault().getMainWindow(), true);
                dlg.setLayerGroup(currentScorePath.getLastLayerGroup());
                dlg.setSize(300, 500);
                dialog = dlg;
            }

            GUI.centerOnScreen(dialog);
            dialog.setVisible(true);
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
        zoomButton.addActionListener((ActionEvent e) -> {
            if (navigator == null) {
                navigator = new ScoreNavigatorDialog(
                        WindowManager.getDefault().getMainWindow());
                navigator.setJScrollPane(scrollPane);
                navigator.setLayerPanel(layerPanel);
            }
            navigator.setVisible(true);
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

        snapButton.addActionListener((ActionEvent e) -> {
            // showSnapPopup();
            timeProperties.setVisible(!timeProperties.isVisible());
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
        this.layerHeightWheelListener = new LayerHeightWheelListener(layerPanel);
        layerPanel.addMouseWheelListener(layerHeightWheelListener);

        ModeManager.getInstance().setMode(ScoreMode.SCORE);

        ModeManager.getInstance().addModeListener((ScoreMode mode) -> {
            SingleLineScoreSelection.getInstance().clear();
            MultiLineScoreSelection.getInstance().reset();
            scoreController.setSelectedScoreObjects(null);
        });
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

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    void writeProperties(java.util.Properties p) {
        p.setProperty("version", "1.0");
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
    }

    public void scrollToRenderStartPointer() {
        var x = renderStartPointer.getX();
        if (x > 0) {
            var scrollX = scrollPane.getHorizontalScrollBar().getValue();
            var w = scrollPane.getViewport().getWidth();
                        
            final int newX = (x < scrollX || x > scrollX + w) ? 
                    Math.max(0, x - 40) :
                    -1;
                    
            if(newX >= 0) {
            Runnable runner = () -> scrollPane.getHorizontalScrollBar().setValue(newX);
                if (!SwingUtilities.isEventDispatchThread()) {
                    SwingUtilities.invokeLater(runner);
                } else {
                    runner.run();
                };
            }
        }
    }

    public void scrollToRenderLoopPointer() {
        var x = renderLoopPointer.getX();
        if (x > 0) {
            var scrollX = scrollPane.getHorizontalScrollBar().getValue();
            var w = scrollPane.getViewport().getWidth();
                        
            final int newX = (x < scrollX || x > scrollX + w) ? 
                    Math.max(0, x - w + 40) :
                    -1;
                    
            if(newX >= 0) {
            Runnable runner = () -> scrollPane.getHorizontalScrollBar().setValue(newX);
                if (!SwingUtilities.isEventDispatchThread()) {
                    SwingUtilities.invokeLater(runner);
                } else {
                    runner.run();
                };
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

        if (currentScorePath == null || currentScorePath.getLastLayerGroup() != null) {
            return;
        }

        if (!renderTimeManager.isCurrentProjectRendering()) {
            return;
        }

        double latency = PlaybackSettings.getInstance().getPlaybackLatencyCorrection();

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
    public void renderTimeUpdated(double timePointer) {
        this.timePointer = timePointer;
        updateRenderTimePointer();
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == renderTimeManager) {
            //FIXME - check if root score object
//            if (this.pObj.isRoot()) {
            if (evt.getPropertyName().equals(RenderTimeManager.RENDER_START)) {
                this.renderStart = ((Double) evt.getNewValue()).doubleValue();
                this.timePointer = -1.0f;
                updateRenderTimePointer();
            }
            /* else if (prop.equals(RenderTimeManager.TIME_POINTER)) {
             this.timePointer = ((Double) evt.getNewValue()).doubleValue();
             updateRenderTimePointer();
             } */
//            } else {
//                this.timePointer = -1.0f;
//                updateRenderTimePointer();
//            }

        } else if (evt.getSource() == currentTimeState) {
            if (evt.getPropertyName().equals("pixelSecond")) {
                int pixelSecond = currentTimeState.getPixelSecond();
                double val = data.getRenderStartTime();

                int newX = (int) (val * pixelSecond);
                updateRenderStartPointerX(newX, true);

                val = data.getRenderEndTime();
                newX = (int) (val * pixelSecond);

                updateRenderLoopPointerX(newX);

                if (marquee.isVisible()) {
                    newX = (int) (marquee.startTime * pixelSecond);
                    marquee.setLocation(newX, marquee.getY());
                    int newW = (int) (marquee.endTime * pixelSecond) - newX;
                    marquee.setSize(newW, marquee.getHeight());
                }
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

                double val = ((Double) evt.getNewValue());

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

        scoreController.setSelectedScoreObjects(null);

        this.clearAll();

        if (score != null) {

            layerPanel.removeAll();
            layerHeaderPanel.removeAll();

            for (LayerGroup layerGroup : score) {
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
            timeState.addPropertyChangeListener(0, this);

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

            scrollPane.getHorizontalScrollBar().setValue(scrollX);
            scrollPane.getVerticalScrollBar().setValue(scrollY);
        }
    }

//    @Override
    public void scoreBarLayerGroupSelected(LayerGroup layerGroup, int scrollX, int scrollY) {
        //FIXME - this should not be hardcoded to PolyObject

        if (!(layerGroup instanceof PolyObject)) {
            return;
        }

        scoreController.setSelectedScoreObjects(null);

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

            scrollPane.getHorizontalScrollBar().setValue(scrollX);
            scrollPane.getVerticalScrollBar().setValue(scrollY);
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

    @Override
    public void listChanged(ObservableListEvent<LayerGroup<? extends Layer>> evt) {
        if (evt.getType() == ObservableListEvent.DATA_ADDED) {
            Score score = data.getScore();
            for (int i = evt.getStartIndex(); i <= evt.getEndIndex(); i++) {
                addPanelsForLayerGroup(i, score.get(i),
                        score.getTimeState());
            }
            layerHeaderPanel.revalidate();
            checkSize();
        } else if (evt.getType() == ObservableListEvent.DATA_REMOVED) {
            removePanelsForLayerGroups(evt.getStartIndex(), evt.getEndIndex());
        } else if (evt.getType() == ObservableListEvent.DATA_CHANGED) {
            List<LayerGroup<? extends Layer>> layerGroups = evt.getAffectedItems();
            JComponent c = (JComponent) layerPanel.getComponent(
                    evt.getStartIndex());
            LayerGroup lGroup = (LayerGroup) c.getClientProperty("layerGroup");

            if (layerGroups.get(1) == lGroup) {
                // handle push down
                Component comp = layerPanel.getComponent(evt.getEndIndex());
                layerPanel.remove(comp);
                layerPanel.add(comp, evt.getStartIndex());

                Component comp2 = layerHeaderPanel.getComponent(
                        evt.getEndIndex());
                layerHeaderPanel.remove(comp2);
                layerHeaderPanel.add(comp2, evt.getStartIndex());

                layerPanel.revalidate();
                layerHeaderPanel.revalidate();

                layerPanel.repaint();
                layerHeaderPanel.repaint();
            } else {
                // handle push up
                Component comp = layerPanel.getComponent(evt.getStartIndex());
                layerPanel.remove(comp);
                layerPanel.add(comp, evt.getEndIndex());

                Component comp2 = layerHeaderPanel.getComponent(
                        evt.getStartIndex());
                layerHeaderPanel.remove(comp2);
                layerHeaderPanel.add(comp2, evt.getEndIndex());

                layerPanel.revalidate();
                layerHeaderPanel.revalidate();

                layerPanel.repaint();
                layerHeaderPanel.repaint();
            }

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

    public List<LayerGroupPanel> getLayerGroupPanels() {
        List<LayerGroupPanel> lgPanels = new ArrayList<>();

        for (int i = 0; i < layerPanel.getComponentCount(); i++) {
            Component c = layerPanel.getComponent(i);

            if (c instanceof LayerGroupPanel) {
                lgPanels.add((LayerGroupPanel<LayerGroup>) c);
            }
        }
        return lgPanels;
    }
}
