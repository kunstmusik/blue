/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
import blue.soundObject.JMask;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObjectException;
import blue.soundObject.editor.jmask.EditorListPanel;
import blue.soundObject.jmask.Field;
import blue.soundObject.jmask.Parameter;
import blue.ui.components.IconFactory;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.geom.Rectangle2D;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JCheckBoxMenuItem;
import javax.swing.JLabel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JSpinner;
import javax.swing.KeyStroke;
import javax.swing.SpinnerNumberModel;
import javax.swing.SwingUtilities;
import javax.swing.border.BevelBorder;
import javax.swing.border.EmptyBorder;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import skt.swing.SwingUtil;

@ScoreObjectEditorPlugin(scoreObjectType = JMask.class)
public class JMaskEditor extends ScoreObjectEditor implements ActionListener {

    EditorListPanel editorListPanel = new EditorListPanel();
    JMask jmask;
    Field field;
    JPopupMenu popup = new JPopupMenu();
    JCheckBox useSeedCheckBox = new JCheckBox("Seed");
    JSpinner seedSpinner = new JSpinner(new SpinnerNumberModel(0L, Long.MIN_VALUE,
            Long.MAX_VALUE, 1L));

    public JMaskEditor() {
        this.setLayout(new BorderLayout());

        JScrollPane jsp = new JScrollPane(editorListPanel);
        jsp.setBorder(null);

        this.add(jsp, BorderLayout.CENTER);

        final Box topPanel = new Box(BoxLayout.X_AXIS);
        topPanel.setBorder(BorderFactory.createCompoundBorder(BorderFactory.
                createBevelBorder(BevelBorder.RAISED), new EmptyBorder(3, 3,
                        3, 3)));
        topPanel.add(new JLabel("JMask"));
        topPanel.add(Box.createHorizontalStrut(5));
        final JButton optionsButton = new JButton(IconFactory.getDownArrowIcon());
        optionsButton.setMargin(new java.awt.Insets(0, 0, 0, 0));
        optionsButton.setMaximumSize(new java.awt.Dimension(17, 16));
        optionsButton.setPreferredSize(new java.awt.Dimension(17, 16));
        optionsButton.setFocusPainted(false);
        topPanel.add(optionsButton);
        topPanel.add(Box.createGlue());

        optionsButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                updatePopup();
                popup.show(topPanel, optionsButton.getX(),
                        optionsButton.getY() + optionsButton.getHeight());
            }
        });

        useSeedCheckBox.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if(jmask != null) {
                    jmask.setSeedUsed(useSeedCheckBox.isSelected());
                }
            }
        });
        
        seedSpinner.addChangeListener(new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                if(jmask != null) {
                    jmask.setSeed(((Number)seedSpinner.getValue()).longValue());
                }
            }
        });
        
        seedSpinner.setMaximumSize(new Dimension(140,200));
        seedSpinner.setPreferredSize(new Dimension(140,22));
        
        topPanel.add(useSeedCheckBox);
        topPanel.add(seedSpinner);
        topPanel.add(Box.createHorizontalStrut(5));

        JButton testButton = new JButton("Test");
        testButton.setFocusPainted(false);
        testButton.setFocusable(false);
        testButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                testScore();
            }
        });

        topPanel.add(testButton);
        this.add(topPanel, BorderLayout.NORTH);

        Action testAction = new AbstractAction("test-action") {

            @Override
            public void actionPerformed(ActionEvent ae) {
                testScore();
            }
        };
        testAction.putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                KeyEvent.VK_T, BlueSystem.getMenuShortcutKey()));

        SwingUtil.installActions(this, new Action[]{testAction},
                WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
    }

    @Override
    public void editScoreObject(ScoreObject sObj) {
        if (sObj == null) {
            return;
        }

        if (!(sObj instanceof JMask)) {
            return;
        }

        JMask jmask = (JMask) sObj;
        this.jmask = null;
        
        useSeedCheckBox.setSelected(jmask.isSeedUsed());
        seedSpinner.setValue(jmask.getSeed());
        
        editorListPanel.setJMask(jmask);

        this.jmask = jmask;
        this.field = jmask.getField();

        updatePopup();
    }

    private void testScore() {
        if (this.jmask == null) {
            return;
        }
        NoteList notes = null;

        try {
            notes = ((JMask) jmask.clone()).generateNotes(0.0f, -1.0f);
        } catch (SoundObjectException e) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this), e);
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem.getString(
                            "soundObject.generatedScore"));
        }
    }

    public static void main(String args[]) {
        GUI.setBlueLookAndFeel();
        JMaskEditor editor = new JMaskEditor();

        JMask jmask = new JMask();
        jmask.setSubjectiveDuration(5.0f);

        editor.editScoreObject(jmask);
        GUI.showComponentAsStandalone(editor, "JMask Editor", true);
    }

    private void updatePopup() {
        popup.removeAll();

        for (int i = 0; i < this.field.getSize(); i++) {
            Parameter param = this.field.getParameter(i);
            JCheckBoxMenuItem menuItem = new JCheckBoxMenuItem(
                    "Parameter " + (i + 1));
            menuItem.setSelected(param.isVisible());
            menuItem.putClientProperty("parameter", param);
            popup.add(menuItem);

            menuItem.addActionListener(this);
        }
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        JCheckBoxMenuItem menuItem = (JCheckBoxMenuItem) e.getSource();
        Parameter param = (Parameter) menuItem.getClientProperty("parameter");
        param.setVisible(menuItem.isSelected());
    }
}
