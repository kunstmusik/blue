/*
 * blue - object composition environment for csound
 * Copyright (C) 2020 
*  Steven Yi <stevenyi@gmail.com>
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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.orchestra.blueSynthBuilder.BSBGroup;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.editor.blueSynthBuilder.EditModeConditional;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Insets;
import javafx.beans.property.BooleanProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.ObservableList;
import javax.swing.JLabel;
import javax.swing.JLayeredPane;
import javax.swing.border.LineBorder;

/**
 * Panel that shows children items. Unconcerned with edit mode as user will
 * focus BSBPanel to edit at root level, so this component will largely just
 * show child components for usage mode or be covered by the BSBObjectViewHolder
 * for edit mode.
 *
 * @author stevenyi
 */
public class BSBGroupPanel extends BSBObjectView<BSBGroup> implements ResizeableView, EditModeConditional {

    JLabel label;
    JLayeredPane editorPanel;

    private BooleanProperty editEnabledProperty = null;
    private ObservableList<BSBGroup> groupsList;

    ChangeListener<Color> bgColorListener;
    ChangeListener<Color> borderColorListener;
    ChangeListener<Color> titleColorListener;
    ChangeListener<Boolean> titleEnabledListener;
    ChangeListener<String> titleListener;
    ChangeListener<Number> widthHeightListener;

    public BSBGroupPanel(BSBGroup bsbGroup) {
        super(bsbGroup);

        setLayout(new BorderLayout());

        label = new JLabel() {
            @Override
            public Insets getInsets(Insets insets) {
                if (insets != null) {
                    insets.set(1, 0, 2, 0);
                    return insets;
                }
                return new Insets(1, 0, 2, 0);
            }

        };
        label.setOpaque(true);
        label.setHorizontalAlignment(JLabel.CENTER);

        editorPanel = new JLayeredPane() {
            @Override
            public Dimension getPreferredSize() {
                int w = 10;
                int h = 10;

                for (var c : getComponents()) {
                    w = Math.max(w, c.getX() + c.getWidth());
                    h = Math.max(h, c.getY() + c.getHeight());
                }

                return new Dimension(w + 10, h + 10);
            }

            @Override
            protected void paintComponent(Graphics g) {
                super.paintComponent(g);

//                Graphics2D g2d = (Graphics2D) g.create();
//                g2d.setComposite(AlphaComposite.SrcOver.derive(getAlpha()));
                g.setColor(getBackground());
                g.fillRect(0, 0, getWidth(), getHeight());
//                g2d.dispose();
            }

        };

        add(label, BorderLayout.NORTH);
        add(editorPanel, BorderLayout.CENTER);

        editorPanel.setMinimumSize(new Dimension(20, 20));
        editorPanel.setLayout(null);
        editorPanel.setOpaque(false);

        updateBackgroundColor();
        updateBorderColor();
        updateTitleColor();
        label.setVisible(bsbObj.isTitleEnabled());

        bgColorListener = (obs, old, newVal) -> {
            updateBackgroundColor();
        };

        borderColorListener = (obs, old, newVal) -> {
            updateBorderColor();
        };

        titleColorListener = (obs, old, newVal) -> {
            updateTitleColor();
        };

        titleEnabledListener = (obs, old, newVal) -> {
            label.setVisible(newVal);
            setSize(getPreferredSize());
        };

        titleListener = (obs, old, newVal) -> {
            label.setText(newVal);
        };

        widthHeightListener = (obs, old, newVal) -> {
            editorPanel.setSize(editorPanel.getPreferredSize());
            setSize(getPreferredSize());
        };

        for (var bsbObj : bsbObj.interfaceItemsProperty()) {
            addBSBObject(bsbObj);
        }

        label.setText(bsbObj.getGroupName());
        updateBackgroundColor();
        updateBorderColor();

        setSize(getPreferredSize());
    }

    @Override
    public void addNotify() {
        super.addNotify();

        bsbObj.backgroundColorProperty().addListener(bgColorListener);
        bsbObj.borderColorProperty().addListener(borderColorListener);
        bsbObj.labelTextColorProperty().addListener(titleColorListener);
        bsbObj.titleEnabledProperty().addListener(titleEnabledListener);
        bsbObj.groupNameProperty().addListener(titleListener);
        bsbObj.widthProperty().addListener(widthHeightListener);
        bsbObj.heightProperty().addListener(widthHeightListener);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        bsbObj.backgroundColorProperty().removeListener(bgColorListener);
        bsbObj.borderColorProperty().removeListener(borderColorListener);
        bsbObj.labelTextColorProperty().removeListener(titleColorListener);
        bsbObj.titleEnabledProperty().removeListener(titleEnabledListener);
        bsbObj.groupNameProperty().removeListener(titleListener);
        bsbObj.widthProperty().removeListener(widthHeightListener);
        bsbObj.heightProperty().removeListener(widthHeightListener);
    }

    private void updateBackgroundColor() {
        editorPanel.setBackground(bsbObj.getBackgroundColor());
    }

    private void updateBorderColor() {
        label.setBackground(bsbObj.getBorderColor());
        editorPanel.setBorder(new LineBorder(bsbObj.getBorderColor()));
    }

    private void updateTitleColor() {
        label.setForeground(bsbObj.getLabelTextColor());
    }

    protected void addBSBObject(BSBObject bsbObj) {

        BSBObjectView objectView = BSBObjectEditorFactory.getView(bsbObj);

        if(objectView instanceof EditModeConditional) {
            ((EditModeConditional) objectView).setEditEnabledProperty(editEnabledProperty);
        }
        
        objectView.setLocation(bsbObj.getX(), bsbObj.getY());
        
        editorPanel.add(objectView);
    }

    @Override
    public Dimension getPreferredSize() {
        int base = label.isVisible() ? label.getPreferredSize().height : 0;
        final Dimension labelPrefSize = label.getPreferredSize();

        var w = Math.max(bsbObj.getWidth(), editorPanel.getPreferredSize().width);

        w = Math.max(labelPrefSize.width, w);
        var h = base + Math.max(bsbObj.getHeight(),
                editorPanel.getPreferredSize().height);

        return new Dimension(w, h);
    }

    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return true;
    }

    public int getWidgetMinimumWidth() {
        return Math.max(label.getMinimumSize().width, editorPanel.getPreferredSize().width);
////        double base = editorPane.prefWidth(editorPane.getPrefHeight());
////        if (getTop() == label) {
////            base = Math.max(label.minWidth(label.getPrefHeight()), base);
////        }
////        return Math.max(20, (int) base);
//        return 0;
    }

    public int getWidgetMinimumHeight() {
        int base = label.isVisible() ? label.getHeight() : 0;
        return Math.max(20, base + editorPanel.getPreferredSize().height);
//        return Math.max(20, base)
//        double base = (getTop() == label) ? label.minHeight(label.getPrefWidth()) : 0;
//        return Math.max(20,
//                (int) (base + editorPane.prefHeight(editorPane.getPrefWidth())));
//        return 0;
    }

    public int getWidgetWidth() {
        return (int) getWidth();
    }

    public void setWidgetWidth(int width) {
        bsbObj.setWidth(Math.max(20, width));
    }

    public int getWidgetHeight() {
//        double base = label.isVisible() ? label.getHeight() : 0;
        return getPreferredSize().height;
    }

    public void setWidgetHeight(int height) {
        int base = label.isVisible() ? label.getHeight() : 0;
        bsbObj.setHeight(Math.max(20, height - base));
    }

    public void setWidgetX(int x) {
        bsbObj.setX(x);
    }

    public int getWidgetX() {
        return bsbObj.getX();
    }

    public void setWidgetY(int y) {
        bsbObj.setY(y);
    }

    public int getWidgetY() {
        return bsbObj.getY();
    }

    @Override
    public void setEditEnabledProperty(BooleanProperty editEnabled) {
        this.editEnabledProperty = editEnabled;
        
        for(var c: editorPanel.getComponents()) {
            if(c instanceof EditModeConditional) {
                ((EditModeConditional) c).setEditEnabledProperty(editEnabled);
            }
        }
    }
}
