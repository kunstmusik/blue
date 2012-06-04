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
import blue.components.IconFactory;
import blue.components.JScrollNavigator;
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
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.layers.LayerGroupHeaderPanelProviderManager;
import blue.ui.core.score.layers.LayerGroupPanelProviderManager;
import blue.ui.core.score.layers.soundObject.MotionBuffer;
import blue.ui.core.score.manager.ScoreManagerDialog;
import blue.ui.core.score.tempo.TempoEditor;
import blue.ui.core.score.tempo.TempoEditorControl;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import java.awt.*;
import java.awt.event.*;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.logging.Logger;
import javax.swing.*;
import javax.swing.border.Border;
import javax.swing.border.LineBorder;
import org.openide.util.ImageUtilities;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;

/**
 * Top component which displays something.
 */
public final class ScoreTopComponent extends TopComponent 
        implements ScoreListener {

    private static ScoreTopComponent instance;

    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "ScoreTopComponent";

    private NoteProcessorDialog npcDialog = null;

    SoundObject bufferSoundObject;

    BlueData data;

    PolyObjectBar polyObjectBar = PolyObjectBar.getInstance();

    TimeBar timeBar = new TimeBar();

    Border libraryBorder = new LineBorder(Color.GREEN);

    JPanel leftPanel = new JPanel(new BorderLayout());
    JViewport layerHeaderViewPort = new JViewport();
    JPanel layerHeaderPanel = new JPanel();
    
    JPanel layerPanel = new JPanel();
    
    Point syncPosition = new Point(0,0);

    JToggleButton snapButton = new JToggleButton();

    JCheckBox checkBox = new JCheckBox();

    TimelinePropertiesPanel timeProperties = new TimelinePropertiesPanel();

    TempoEditorControl tempoControlPanel = new TempoEditorControl();

    TempoEditor tempoEditor = new TempoEditor();

    JScrollNavigator navigator = null;
    
    volatile boolean checkingSize = false;
    
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
        setName(NbBundle.getMessage(ScoreTopComponent.class, "CTL_ScoreTopComponent"));
        setToolTipText(NbBundle.getMessage(ScoreTopComponent.class, "HINT_ScoreTopComponent"));

        init();

//        polyObjectBar.addChangeListener(new PolyObjectChangeListener() {
//
//            public void polyObjectChanged(PolyObjectChangeEvent evt) {
//                setPolyObject(evt.getPolyObject());
//                setHorizontalScrollValue(evt.getX());
//                setVerticalScrollValue(evt.getY());
//            }
//        });

        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {
            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
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
        
        reinitialize();
        
    }

    public SoundObject[] getSoundObjectsAsArray() {
           return MotionBuffer.getInstance().getSoundObjectsAsArray();
    }

    protected void checkSize() {
        if(!checkingSize) {
            checkingSize = true;

            int height = 0;
            int width = 0;

            for(int i = 0; i < layerPanel.getComponentCount(); i++) {
                Component c = layerPanel.getComponent(i);
                Dimension d = c.getPreferredSize();
                width = (width > d.width) ? width : d.width;
                height += d.height;
            }


            if(width != getWidth() || height != getHeight()) {
                
                Dimension d = new Dimension(width, height);
                layerPanel.setSize(d);
                
                for(int i = 0; i < layerPanel.getComponentCount(); i++) {
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

        if(this.data != null) {
            data.getScore().removeScoreListener(this);
        }
        
        this.clearAll();
        this.data = currentData;
        AutomationManager.getInstance().setData(this.data);

        if (data != null) {

            Tempo tempo = data.getScore().getTempo();
            tempoControlPanel.setTempo(tempo);
            tempoEditor.setTempo(tempo);

            // FIXME
            
            layerPanel.removeAll();
            layerHeaderPanel.removeAll();
                        
            Score score = data.getScore();
            score.addScoreListener(this);
            
            for(int i = 0; i < score.getLayerGroupCount(); i++) {
                LayerGroup layerGroup = score.getLayerGroup(i);
                addPanelsForLayerGroup(-1, layerGroup, score);
            }
            
            layerPanel.revalidate();
            layerHeaderPanel.revalidate();
//            PolyObject pObj = (PolyObject)data.getScore().getLayerGroup(0);
//            TimeState timeState = data.getScore().getTimeState();
           // polyObjectBar.addPolyObject(pObj);

//            sLayerEditPanel.setNoteProcessorChainMap(data.getNoteProcessorChainMap());
            
            timeBar.setData(data);
            
            
            TimeState timeState = data.getScore().getTimeState();
            tempoEditor.setTimeState(timeState);
            timeBar.setTimeState(timeState);
            timeProperties.setTimeState(timeState);

//            float val = data.getRenderStartTime();
//            int pixelSecond = timeState.getPixelSecond();
//
//            int newX = (int) (val * pixelSecond);
//            sTimeCanvas.updateRenderStartPointerX(newX, false);
//
//            newX = (int) (data.getRenderEndTime() * pixelSecond);
//            sTimeCanvas.updateRenderLoopPointerX(newX);
            

            scrollPane.repaint();
            
            ModeManager.getInstance().setMode(ModeManager.getInstance().getMode());

            
        } else {
            
        }
    }

    private void addPanelsForLayerGroup(int index, LayerGroup layerGroup, Score score) {
        final JComponent comp = LayerGroupPanelProviderManager.getInstance().getLayerGroupPanel(
                layerGroup, score.getTimeState(), data);
        final JComponent comp2 = LayerGroupHeaderPanelProviderManager.getInstance().getLayerGroupHeaderPanel(layerGroup, score.getTimeState(), data);
        
        if(comp != null && comp2 != null) {
            
            if(index < 0 || index > layerPanel.getComponentCount() - 1) {
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
                             Dimension d = new Dimension(leftPanel.getWidth(), comp.getHeight());
                            //comp2.setPreferredSize(d);
                            //comp2.setMaximumSize(d);
                            comp2.setSize(d);
                            comp2.revalidate();
                        }
                        
                    });
                   
                }

            });
            comp.addPropertyChangeListener("preferredSize", layerPanelWidthListener);
        }
    }
    
    private void removePanelsForLayerGroups(int startIndex, int endIndex) {
        for(int i = 0; i <= endIndex - startIndex; i++) {
            layerPanel.remove(startIndex);
            layerHeaderPanel.remove(startIndex);
        }
        layerPanel.revalidate();
        layerHeaderPanel.revalidate();
    }

    public void clearAll() {
        polyObjectBar.reset();

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

                if (command.equals("minusHorizontal")) {
                    data.getScore().getTimeState().lowerPixelSecond();
                } else if (command.equals("plusHorizontal")) {
                    data.getScore().getTimeState().raisePixelSecond();
                }
            }
            
        };
        
        plusHorz.addActionListener(al);
        minusHorz.addActionListener(al);

        scrollPane.add(horizontalViewChanger,
                MyScrollPaneLayout.HORIZONTAL_RIGHT);

        scrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
        scrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);


        tempoControlPanel.setBorder(BorderFactory.createRaisedBevelBorder());

//        JPanel layerTitlePanel = new JPanel();
//        
//        layerTitlePanel.setSize(new Dimension(100, 20));
//        layerTitlePanel.setPreferredSize(new Dimension(100, 20));
//        layerTitlePanel.setBorder(BorderFactory.createBevelBorder(BevelBorder.RAISED));
        
        JButton manageButton = new JButton("Manage");
        manageButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                ScoreManagerDialog dialog = new ScoreManagerDialog(WindowManager.getDefault().getMainWindow(), true);
                dialog.setSize(600, 500);
                GUI.centerOnScreen(dialog);
                dialog.setScore(data.getScore());
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

            public void componentResized(ComponentEvent e) {
                layerHeaderPanel.setSize(layerHeaderViewPort.getWidth(), layerHeaderPanel.getHeight());
                leftPanel.revalidate();
            }
        });

        final JPanel headerPanel = new JPanel(new BorderLayout());
        headerPanel.setBackground(Color.BLACK);

        headerPanel.add(tempoEditor, BorderLayout.CENTER);
        headerPanel.add(timeBar, BorderLayout.SOUTH);

        tempoEditor.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                headerPanel.revalidate();
            }
        });

        ImageIcon icon = new ImageIcon(ImageUtilities.loadImage("blue/resources/images/ZoomIn16.gif"));
        JButton zoomButton = new JButton(icon);
        zoomButton.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) {
                if(navigator == null) {
                    navigator = new JScrollNavigator(WindowManager.getDefault().getMainWindow());
                    navigator.setJScrollPane(scrollPane);
                }
                navigator.setVisible(true);
            }
        });
        
        scrollPane.setColumnHeaderView(headerPanel);
        scrollPane.setCorner(JScrollPane.LOWER_RIGHT_CORNER, zoomButton);
        scrollPane.setCorner(JScrollPane.UPPER_RIGHT_CORNER, snapButton);

        layerPanel.setBackground(Color.BLACK);
        layerPanel.setOpaque(true);
        layerPanel.setLayout(new LinearLayout());
        layerHeaderPanel.setLayout(new LinearLayout());
        
        scrollPane.getViewport().setView(layerPanel);
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
        topPanel.add(polyObjectBar, BorderLayout.CENTER);

        this.add(timeProperties, BorderLayout.EAST);

//        sObjEditPanel.setMinimumSize(new Dimension(0, 0));

        snapButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                // showSnapPopup();
                timeProperties.setVisible(!timeProperties.isVisible());
            }
        });
        
    }

    private void init() {
        snapButton.setIcon(IconFactory.getLeftArrowIcon());
        snapButton.setSelectedIcon(IconFactory.getRightArrowIcon());
        snapButton.setFocusable(false);

        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();

        layerPanel.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                Dimension d = new Dimension(layerPanel.getWidth(), 20);
                timeBar.setMinimumSize(d);
                timeBar.setPreferredSize(d);
                timeBar.setSize(d);
                timeBar.repaint();
            }
        });

        try {
            formInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        new ScoreMouseWheelListener(scrollPane);

        ModeManager.getInstance().setMode(ModeManager.MODE_SCORE);
    }

    public void setPolyObject(PolyObject pObj) {
        tempoControlPanel.setPolyObject(pObj);
        
//        TimeState timeState = data.getScore().getTimeState();
//        
//        tempoEditor.setTimeState(timeState);

//        scrollPane.repaint();

//        focusedPolyObject = pObj;

       // sTimeCanvas.setPolyObject(pObj, timeState);
//        sLayerEditPanel.setPolyObject(pObj);

//        timeBar.setTimeState(timeState);
//        timeProperties.setTimeState(timeState);
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

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
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

    /**
     * Gets default instance. Do not use directly: reserved for *.settings files only,
     * i.e. deserialization routines; otherwise you could get a non-deserialized instance.
     * To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized ScoreTopComponent getDefault() {
        if (instance == null) {
            instance = new ScoreTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the ScoreTopComponent instance. Never call {@link #getDefault} directly!
     */
    public static synchronized ScoreTopComponent findInstance() {
        TopComponent win = WindowManager.getDefault().findTopComponent(PREFERRED_ID);
        if (win == null) {
            Logger.getLogger(ScoreTopComponent.class.getName()).warning(
                    "Cannot find " + PREFERRED_ID + " component. It will not be located properly in the window system.");
            return getDefault();
        }
        if (win instanceof ScoreTopComponent) {
            return (ScoreTopComponent) win;
        }
        Logger.getLogger(ScoreTopComponent.class.getName()).warning(
                "There seem to be multiple components with the '" + PREFERRED_ID +
                "' ID. That is a potential source of errors and unexpected behavior.");
        return getDefault();
    }

    @Override
    public int getPersistenceType() {
        return TopComponent.PERSISTENCE_ALWAYS;
    }

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    /** replaces this in object stream */
    @Override
    public Object writeReplace() {
        return new ResolvableHelper();
    }

    @Override
    protected String preferredID() {
        return PREFERRED_ID;
    }

    @Override
    public void layerGroupsChanged(ScoreDataEvent sde) {
        if(sde.getType() == ScoreDataEvent.DATA_ADDED) {
            Score score = data.getScore();
            for(int i = sde.getStartIndex(); i <= sde.getEndIndex(); i++) {
                addPanelsForLayerGroup(i, score.getLayerGroup(i), score);
            }
        } else if (sde.getType() == ScoreDataEvent.DATA_REMOVED) {
            removePanelsForLayerGroups(sde.getStartIndex(), sde.getEndIndex());
        }
    }

    final static class ResolvableHelper implements Serializable {

        private static final long serialVersionUID = 1L;

        public Object readResolve() {
            return ScoreTopComponent.getDefault();
        }
    }
}
