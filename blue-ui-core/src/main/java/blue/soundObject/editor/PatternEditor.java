/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor;

import blue.BlueSystem;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.NoteList;
import blue.soundObject.PatternObject;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.pattern.PatternCanvas;
import blue.soundObject.editor.pattern.PatternLayerEditPanel;
import blue.soundObject.editor.pattern.PatternObjectPropertiesPanel;
import blue.soundObject.editor.pattern.PatternScoreEditor;
import blue.soundObject.editor.pattern.PatternTimeBar;
import blue.soundObject.pattern.Pattern;
import blue.ui.components.IconFactory;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseWheelEvent;
import java.awt.event.MouseWheelListener;
import javax.swing.JButton;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JToggleButton;
import javax.swing.ScrollPaneConstants;
import javax.swing.SwingUtilities;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;

/**
 * @author Steven Yi
 */
@ScoreObjectEditorPlugin(scoreObjectType = PatternObject.class)
public class PatternEditor extends ScoreObjectEditor {
    
    private final PatternLayerEditPanel layerPanel = new PatternLayerEditPanel();
    
    private final PatternCanvas canvas = new PatternCanvas();
    
    private final PatternScoreEditor patternScore = new PatternScoreEditor();
    
    private final PatternTimeBar timeBar = new PatternTimeBar();
    
    private PatternObject patternObj;
    
    private final PatternObjectPropertiesPanel props = new PatternObjectPropertiesPanel();
    
    private final JSplitPane mainSplitPane;
    
    public PatternEditor() {
        this.setLayout(new BorderLayout());
        
        layerPanel.addListSelectionListener((ListSelectionEvent e) -> {
            if (e.getValueIsAdjusting()) {
                return;
            } else {
                
                Pattern p = layerPanel.getSelectedPattern();
                patternScore.setPattern(p);
            }
        });
        
        JToggleButton setTimeButton = new JToggleButton();
        setTimeButton.setIcon(IconFactory.getLeftArrowIcon());
        setTimeButton.setSelectedIcon(IconFactory.getRightArrowIcon());
        setTimeButton.setFocusable(false);
        
        JButton testButton = new JButton(BlueSystem.getString("common.test"));
        testButton.addActionListener((ae) -> testSoundObject());
        JPanel rightPanel = new JPanel(new BorderLayout());
        rightPanel.add(testButton, BorderLayout.NORTH);
        rightPanel.add(props, BorderLayout.CENTER);
        
        setTimeButton.addActionListener((ActionEvent e) -> {
            rightPanel.setVisible(!rightPanel.isVisible());
        });
        
        final JScrollPane scroll = new JScrollPane(canvas);
        
        scroll.setColumnHeaderView(timeBar);
        scroll.setCorner(JScrollPane.UPPER_RIGHT_CORNER, setTimeButton);
        scroll.getVerticalScrollBar().addAdjustmentListener(layerPanel);
        scroll
                .setHorizontalScrollBarPolicy(ScrollPaneConstants.HORIZONTAL_SCROLLBAR_ALWAYS);
        scroll
                .setVerticalScrollBarPolicy(ScrollPaneConstants.VERTICAL_SCROLLBAR_ALWAYS);
        
        JSplitPane topSplitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        topSplitPane.add(layerPanel);
        topSplitPane.add(scroll);
        topSplitPane.setDividerLocation(200);
        
        JPanel topPanel = new JPanel(new BorderLayout());
        topPanel.add(topSplitPane, BorderLayout.CENTER);
        topPanel.add(rightPanel, BorderLayout.EAST);
        
        mainSplitPane = new JSplitPane(JSplitPane.VERTICAL_SPLIT);
        mainSplitPane.add(topPanel);
        mainSplitPane.add(patternScore);
        mainSplitPane.setDividerLocation(0.8d);
        
        rightPanel.setVisible(false);
        
        this.add(mainSplitPane, BorderLayout.CENTER);
        
        layerPanel.getViewPort().addMouseWheelListener((MouseWheelEvent e) -> {
            if (!e.isShiftDown()) {
                for (MouseWheelListener listener : scroll.getMouseWheelListeners()) {
                    listener.mouseWheelMoved(e);
                }
            }
        });
        
        var cl = new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                super.componentResized(e);                
                if (mainSplitPane.getHeight() > 400) {
                    mainSplitPane.setDividerLocation(mainSplitPane.getHeight() - 200);
                } else {
                    mainSplitPane.setDividerLocation(0.6d);
                }
                mainSplitPane.removeComponentListener(this);
            }
            
        };
        mainSplitPane.addComponentListener(cl);
    }    
    
    @Override
    public void editScoreObject(ScoreObject sObj) {
        if (sObj == null) {
            return;
        }
        
        if (!(sObj instanceof PatternObject)) {
            return;
        }
        
        PatternObject p = (PatternObject) sObj;
        
        this.patternObj = p;
        
        layerPanel.setPatternObject(p);
        canvas.setPatternObject(p);
        timeBar.setPatternObject(p);
        props.setPatternObject(p);
        
    }
    
    public final void testSoundObject() {
        if (this.patternObj == null) {
            return;
        }
        
        NoteList notes = null;
        
        try {
            notes = patternObj.generateForCSD(null, 0.0f, -1.0f);
        } catch (Exception e) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this), e);
        }
        
        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                    .getString("soundObject.generatedScore"));
        }
    }
    
    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        
        PatternEditor patternEditor = new PatternEditor();
        
        patternEditor.editScoreObject(new PatternObject());
        
        GUI.showComponentAsStandalone(patternEditor, "Pattern Editor", true);
    }
}
