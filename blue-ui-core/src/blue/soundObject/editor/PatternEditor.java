/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JToggleButton;
import javax.swing.ScrollPaneConstants;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;

import blue.ui.components.IconFactory;
import blue.soundObject.PatternObject;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.pattern.PatternCanvas;
import blue.soundObject.editor.pattern.PatternLayerEditPanel;
import blue.soundObject.editor.pattern.PatternObjectPropertiesPanel;
import blue.soundObject.editor.pattern.PatternScoreEditor;
import blue.soundObject.editor.pattern.PatternTimeBar;
import blue.soundObject.pattern.Pattern;
import blue.utility.GUI;

/**
 * @author Steven Yi
 */
public class PatternEditor extends SoundObjectEditor {

    private PatternLayerEditPanel layerPanel = new PatternLayerEditPanel();

    private PatternCanvas canvas = new PatternCanvas();

    private PatternScoreEditor patternScore = new PatternScoreEditor();

    private PatternTimeBar timeBar = new PatternTimeBar();

    private PatternObject patternObj;

    private PatternObjectPropertiesPanel props = new PatternObjectPropertiesPanel();

    public PatternEditor() {
        this.setLayout(new BorderLayout());

        layerPanel.addListSelectionListener(new ListSelectionListener() {

            public void valueChanged(ListSelectionEvent e) {
                if (e.getValueIsAdjusting()) {
                    return;
                } else {

                    Pattern p = layerPanel.getSelectedPattern();
                    patternScore.setPattern(p);
                }

            }

        });

        JToggleButton setTimeButton = new JToggleButton();
        setTimeButton.setIcon(IconFactory.getLeftArrowIcon());
        setTimeButton.setSelectedIcon(IconFactory.getRightArrowIcon());
        setTimeButton.setFocusable(false);

        setTimeButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                props.setVisible(!props.isVisible());
            }

        });

        JScrollPane scroll = new JScrollPane(canvas);

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
        topPanel.add(props, BorderLayout.EAST);

        JSplitPane mainSplitPane = new JSplitPane(JSplitPane.VERTICAL_SPLIT);
        mainSplitPane.add(topPanel);
        mainSplitPane.add(patternScore);
        mainSplitPane.setDividerLocation(0.8d);

        props.setVisible(false);

        this.add(mainSplitPane, BorderLayout.CENTER);

    }

    public void editSoundObject(SoundObject sObj) {
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

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();

        PatternEditor patternEditor = new PatternEditor();

        patternEditor.editSoundObject(new PatternObject());

        GUI.showComponentAsStandalone(patternEditor, "Pattern Editor", true);
    }
}