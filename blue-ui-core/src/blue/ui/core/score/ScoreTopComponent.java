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

import blue.ui.core.score.layers.soundObject.ScoreMouseWheelListener;
import blue.ui.core.score.layers.soundObject.SoundObjectView;
import blue.ui.core.score.layers.soundObject.ScoreTimeCanvas;
import blue.BlueData;
import blue.automation.AutomationManager;
import blue.components.IconFactory;
import blue.components.JScrollNavigator;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.gui.MyScrollPaneLayout;
import blue.gui.ScrollerButton;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.score.TimeState;
import blue.score.tempo.Tempo;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.layers.soundObject.MotionBuffer;
import blue.ui.core.score.soundLayer.SoundLayerListPanel;
import blue.ui.core.score.tempo.TempoEditor;
import blue.ui.core.score.tempo.TempoEditorControl;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.Toolkit;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.logging.Logger;
import javax.swing.BorderFactory;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JToggleButton;
import javax.swing.JViewport;
import javax.swing.border.Border;
import javax.swing.border.LineBorder;
import org.openide.util.ImageUtilities;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;

/**
 * Top component which displays something.
 */
public final class ScoreTopComponent extends TopComponent {

    private static ScoreTopComponent instance;

    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "ScoreTopComponent";

    protected TimePixelManager timePixel = new TimePixelManager();

    private NoteProcessorDialog npcDialog = null;

    SoundObject bufferSoundObject;

    SoundObjectView focused;

    BlueData data;

    PolyObjectBar polyObjectBar = PolyObjectBar.getInstance();

    PolyObject focusedPolyObject = null;

    TimeBar timeBar = new TimeBar();

    ScoreTimeCanvas sTimeCanvas;

    Border libraryBorder = new LineBorder(Color.GREEN);

    JPanel scoreLayerPanel = new JPanel();

    SoundLayerListPanel sLayerEditPanel;

    JToggleButton snapButton = new JToggleButton();

    JCheckBox checkBox = new JCheckBox();

    PropertyChangeListener pcl;

    TimelinePropertiesPanel timeProperties = new TimelinePropertiesPanel();

    TempoEditorControl tempoControlPanel = new TempoEditorControl();

    TempoEditor tempoEditor = new TempoEditor();

    JScrollNavigator navigator = null;

    private ScoreTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(ScoreTopComponent.class, "CTL_ScoreTopComponent"));
        setToolTipText(NbBundle.getMessage(ScoreTopComponent.class, "HINT_ScoreTopComponent"));

        init();

        polyObjectBar.addChangeListener(new PolyObjectChangeListener() {

            public void polyObjectChanged(PolyObjectChangeEvent evt) {
                setPolyObject(evt.getPolyObject());
                setHorizontalScrollValue(evt.getX());
                setVerticalScrollValue(evt.getY());
            }
        });

        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {
            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    reinitialize();
                }
            }
        });

        reinitialize();
    }

    public SoundObject[] getSoundObjectsAsArray() {
           return MotionBuffer.getInstance().getSoundObjectsAsArray();
    }


    public void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData currentData = null;
        if (project != null) {
            currentData = project.getData();
        }

        if (this.data != null) {
            this.data.removePropertyChangeListener(pcl);
        }

        this.clearAll();
        this.data = currentData;
        AutomationManager.getInstance().setData(this.data);

        if (data != null) {

            data.addPropertyChangeListener(pcl);

            Tempo tempo = data.getScore().getTempo();
            tempoControlPanel.setTempo(tempo);
            tempoEditor.setTempo(tempo);

            // FIXME
            PolyObject pObj = (PolyObject)data.getScore().getLayerGroup(0);
            TimeState timeState = data.getScore().getTimeState();
            polyObjectBar.addPolyObject(pObj);

            sLayerEditPanel.setNoteProcessorChainMap(data.getNoteProcessorChainMap());

            timeBar.setData(data);

            float val = data.getRenderStartTime();
            int pixelSecond = timeState.getPixelSecond();

            int newX = (int) (val * pixelSecond);
            sTimeCanvas.updateRenderStartPointerX(newX, false);

            newX = (int) (data.getRenderEndTime() * pixelSecond);
            sTimeCanvas.updateRenderLoopPointerX(newX);

            scrollPane.repaint();
        } else {
            
        }
    }

    public void clearAll() {
        sLayerEditPanel.setPolyObject(null);
        polyObjectBar.reset();

        scrollPane.revalidate();

        focused = null;
    }

    private void formInit() {
        scrollPane.setLayout(new MyScrollPaneLayout());
        JPanel horizontalViewChanger = new JPanel(new GridLayout(1, 2));

        ScrollerButton plusHorz = new ScrollerButton("+");
        ScrollerButton minusHorz = new ScrollerButton("-");
        plusHorz.setActionCommand("plusHorizontal");
        minusHorz.setActionCommand("minusHorizontal");

        sTimeCanvas.setAutoscrolls(true);

        horizontalViewChanger.add(plusHorz);
        horizontalViewChanger.add(minusHorz);

        plusHorz.addActionListener(timePixel);
        minusHorz.addActionListener(timePixel);

        scrollPane.add(horizontalViewChanger,
                MyScrollPaneLayout.HORIZONTAL_RIGHT);

        scrollPane.getVerticalScrollBar().addAdjustmentListener(
                sLayerEditPanel);

        scrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
        scrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);


        tempoControlPanel.setBorder(BorderFactory.createRaisedBevelBorder());

        final JPanel leftPanel = new JPanel(new BorderLayout());
        leftPanel.add(tempoControlPanel, BorderLayout.NORTH);
        leftPanel.add(sLayerEditPanel, BorderLayout.CENTER);
        tempoControlPanel.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
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

        scrollPane.getViewport().setView(sTimeCanvas);
        scrollPane.getViewport().setScrollMode(JViewport.BLIT_SCROLL_MODE);
        scrollPane.getViewport().setBackground(Color.BLACK);

        scrollPane.getViewport().addComponentListener(
            new ComponentAdapter() {

                public void componentResized(ComponentEvent e) {
                    sTimeCanvas.checkSize();
                }
            });

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

        sLayerEditPanel = new SoundLayerListPanel();

        sTimeCanvas = new ScoreTimeCanvas();

        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();

        sTimeCanvas.addSelectionListener(new SelectionListener() {

            public void selectionPerformed(SelectionEvent e) {
                SoundObjectView sObjView = (SoundObjectView) e.getSelectedItem();

                Object item;
                if (sObjView == null) {
                    item = null;
                } else {
                    item = sObjView.getSoundObject();
                }

                SelectionEvent selectionEvent = new SelectionEvent(item, e.getSelectionType());
                SoundObjectSelectionBus.getInstance().selectionPerformed(selectionEvent);
            }
        });

        sTimeCanvas.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                Dimension d = new Dimension(sTimeCanvas.getWidth(), 20);
                timeBar.setMinimumSize(d);
                timeBar.setPreferredSize(d);
                timeBar.setSize(d);
            }
        });

        try {
            formInit();
        } catch (Exception e) {
            e.printStackTrace();
        }

        pcl = new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                boolean isRenderStartTime = evt.getPropertyName().equals(
                        "renderStartTime");
                boolean isRenderLoopTime = evt.getPropertyName().equals(
                        "renderLoopTime");

                if (evt.getSource() == data && (isRenderStartTime || isRenderLoopTime)) {

                    if (data.getScore() == null) {
                        return;
                    }

                    float val = ((Float) evt.getNewValue()).floatValue();
                                
                    //FIXME
                    PolyObject pObj = (PolyObject)data.getScore().getLayerGroup(0);
                    TimeState timeState = data.getScore().getTimeState();
                    int newX = (int) (val * timeState.getPixelSecond());

                    if (isRenderStartTime) {
                        sTimeCanvas.updateRenderStartPointerX(newX, true);
                    } else if (isRenderLoopTime) {
                        sTimeCanvas.updateRenderLoopPointerX(newX);
                    }
                }

            }
        };

        new ScoreMouseWheelListener(scrollPane, timePixel);

        ModeManager.getInstance().setMode(ModeManager.MODE_SCORE);
    }

    public void setPolyObject(PolyObject pObj) {
        tempoControlPanel.setPolyObject(pObj);
        
        TimeState timeState = data.getScore().getTimeState();
        
        tempoEditor.setTimeState(timeState);

        timePixel.setTimeState(timeState);

        scrollPane.repaint();

        focusedPolyObject = pObj;

        sTimeCanvas.setPolyObject(pObj, timeState);
        sLayerEditPanel.setPolyObject(pObj);

        timeBar.setTimeState(timeState);
        timeProperties.setTimeState(timeState);
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

    final static class ResolvableHelper implements Serializable {

        private static final long serialVersionUID = 1L;

        public Object readResolve() {
            return ScoreTopComponent.getDefault();
        }
    }
}
