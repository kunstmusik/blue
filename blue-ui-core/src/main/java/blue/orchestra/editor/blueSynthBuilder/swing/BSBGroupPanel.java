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
import blue.orchestra.editor.blueSynthBuilder.jfx.BSBEditSelection;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Insets;
import javafx.beans.property.BooleanProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.ObservableList;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.border.LineBorder;

/**
 * Panel that shows children items. Unconcerned with edit mode as user will
 * focus BSBPanel to edit at root level, so this component will largely just
 * show child components for usage mode or be covered by the BSBObjectViewHolder
 * for edit mode.
 *
 * @author stevenyi
 */
public class BSBGroupPanel extends BSBObjectView<BSBGroup> implements ResizeableView {

    JLabel label;
    JPanel editorPanel;

    private BooleanProperty editEnabledProperty = null;
    private BSBEditSelection selection;
    private ObservableList<BSBGroup> groupsList;

    ChangeListener<Color> bgColorListener;
    ChangeListener<Color> borderColorListener;
    ChangeListener<Color> titleColorListener;
    ChangeListener<Boolean> titleEnabledListener;
    ChangeListener<String> titleListener;
    ChangeListener<Number> widthHeightListener;

//    SetChangeListener<BSBObject> scl = sce -> {
//        if (sce.wasAdded()) {
//            addBSBObject(sce.getElementAdded());
//        } else {
//            removeBSBObject(sce.getElementRemoved());
//        }
//    };
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

        editorPanel = new JPanel(null) {
            @Override
            public Dimension getPreferredSize() {
                int w = 10;
                int h = 10;

                for (var c : getComponents()) {
                    w = Math.max(w, c.getX() + c.getWidth());
                    h = Math.max(w, c.getX() + c.getHeight());
                }

                return new Dimension(w + 10, h + 10);
            }

        };

//        label.setSize(label.getWidth(), label.getHeight() + 10);
        add(label, BorderLayout.NORTH);
        add(editorPanel, BorderLayout.CENTER);

        editorPanel.setMinimumSize(new Dimension(20, 20));
        editorPanel.setLayout(null);

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
//        label.textProperty().bind(bsbGroup.groupNameProperty());
//                bsbGroup.interfaceItemsProperty().addListener(scl);
//                bsbGroup.backgroundColorProperty().addListener(bgColorListener);
//                bsbGroup.borderColorProperty().addListener(borderColorListener);
//                label.textFillProperty().bind(bsbGroup.labelTextColorProperty());
//
//                if (bsbGroup.isTitleEnabled()) {
//                    setTop(label);
//                } else {
//                    setTop(null);
//                }
//                bsbGroup.titleEnabledProperty().addListener(titleEnabledListener);
//
//                resizePane.prefWidthProperty().bind(
//                        Bindings.createDoubleBinding(() -> {
//                            return Math.max(bsbGroup.getWidth(), editorPane.prefWidth(USE_PREF_SIZE));
//                        }, bsbGroup.widthProperty(), editorPane.boundsInParentProperty()));
//                resizePane.prefHeightProperty().bind(
//                        Bindings.createDoubleBinding(() -> {
//                            return Math.max(bsbGroup.getHeight(), editorPane.prefHeight(USE_PREF_SIZE));
//                        }, bsbGroup.heightProperty(), editorPane.boundsInParentProperty()));
//                bsbGroup.commentProperty().addListener(toolTipListener);
//                tooltip.textProperty().bind(bsbGroup.commentProperty());
//                toolTipListener.changed(null, null, null);

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

        //          label.textProperty().unbind();
//                bsbGroup.interfaceItemsProperty().removeListener(scl);
//                bsbGroup.backgroundColorProperty().removeListener(bgColorListener);
//                bsbGroup.borderColorProperty().removeListener(borderColorListener);
//                label.textFillProperty().unbind();
//                bsbGroup.titleEnabledProperty().removeListener(titleEnabledListener);
//                resizePane.prefWidthProperty().unbind();
//                resizePane.prefHeightProperty().unbind();
//                tooltip.textProperty().unbind();
//                bsbGroup.commentProperty().removeListener(toolTipListener);
//                BSBTooltipUtil.install(label, null);
    }

//    private void setupSizes() {
//
//        var labelD = label.getPreferredSize();
//        var width = Math.max(bsbObj.getWidth(), labelD.width);
//        var height = Math.max(bsbObj.getHeight(), labelD.height);
//
//        var components = editorPanel.getComponents();
//
//        if (components.length > 0) {
//            for (var c : components) {
//                var p = c.getPreferredSize();
//                width = Math.max(width, c.getX() + p.width);
//                height = Math.max(height, c.getY() + p.height);
//            }
//
//            // add inset size
////                d.width += parent.getInsets().right;
////                d.height += parent.getInsets().bottom;
//            width += 10;
//            height += 10;
//        }
//
//        editorPanel.setSize(new Dimension(width, height));
//        editorPanel.setPreferredSize(new Dimension(width, height));
//
//        setSize(getPreferredSize());
//    }
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
        objectView.setLocation(bsbObj.getX(), bsbObj.getY());
        editorPanel.add(objectView);

//        try {
//            Region objectView = blue.orchestra.editor.blueSynthBuilder.jfx.BSBObjectEditorFactory.getView(bsbObj);
//            // FIXME
////            BooleanProperty editEnabledProperty = allowEditing ? bsbInterface.editEnabledProperty() : null;
//            blue.orchestra.editor.blueSynthBuilder.jfx.BSBObjectViewHolder viewHolder = new blue.orchestra.editor.blueSynthBuilder.jfx.BSBObjectViewHolder(editEnabledProperty,
//                    selection, groupsList, objectView);
//            if (objectView instanceof EditModeOnly) {
//                if (editEnabledProperty != null) {
//                    viewHolder.visibleProperty().bind(editEnabledProperty);
//                } else {
//                    viewHolder.setVisible(false);
//                }
//            }
//            if (bsbObj instanceof BSBGroup) {
//                BSBGroupView bsbGroupView = (BSBGroupView) objectView;
//                bsbGroupView.initialize(editEnabledProperty, selection, groupsList);
//            }
//            editorPane.getChildren().add(viewHolder);
//        } catch (Exception e) {
//            Exceptions.printStackTrace(e);
//        }
    }

    @Override
    public Dimension getPreferredSize() {
        int base = label.isVisible() ? label.getHeight() : 0;
        final Dimension labelPrefSize = label.getPreferredSize();
        
        var w = Math.max(bsbObj.getWidth(), editorPanel.getPreferredSize().width);

        w = Math.max(labelPrefSize.width, w);
        var h = base + Math.max(bsbObj.getHeight(),
                editorPanel.getPreferredSize().height);
        if (label.isVisible()) {
            h += labelPrefSize.height;
        }

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
        double base = label.isVisible() ? label.getHeight(): 0;
        bsbObj.setHeight(Math.max(20, height - (int) base));
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
}
