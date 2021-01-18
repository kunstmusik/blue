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
public class BSBGroupPanel extends BSBObjectView<BSBGroup> implements ResizeableView{

    JLabel label;
    JPanel editorPanel = new JPanel(null);

    private BooleanProperty editEnabledProperty = null;
    private BSBEditSelection selection;
    private ObservableList<BSBGroup> groupsList;

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

//        label.setSize(label.getWidth(), label.getHeight() + 10);
        add(label, BorderLayout.NORTH);
        add(editorPanel, BorderLayout.CENTER);

        editorPanel.setMinimumSize(new Dimension(20, 20));
        editorPanel.setLayout(null);

//        label.setPadding(new Insets(2, 8, 2, 8));
//        editorPane.setPadding(new Insets(0, 9, 9, 0));
//        containerPane.getChildren().addAll(resizePane, editorPane);
//        setTop(label);
//        setCenter(containerPane);
//        editorPane.setMinSize(20.0, 20.0);
//        label.setMaxWidth(Double.MAX_VALUE);
        updateBackgroundColor();
        updateBorderColor();

        ChangeListener bgColorListener = (obs, old, newVal) -> {
            updateBackgroundColor();
        };

        ChangeListener borderColorListener = (obs, old, newVal) -> {
            updateBorderColor();
        };

        ChangeListener<Boolean> titleEnabledLIstener = (obs, old, newVal) -> {
            if (newVal) {
                remove(label);
            } else {
                add(label, BorderLayout.NORTH);
            }
        };

        for (var bsbObj : bsbObj.interfaceItemsProperty()) {
            addBSBObject(bsbObj);
        }

        label.setText(bsbObj.getGroupName());
        updateBackgroundColor();
        updateBorderColor();
        setupSizes();

    }

    @Override
    public void addNotify() {
        super.addNotify();
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
//                bsbGroup.titleEnabledProperty().addListener(titleEnabledLIstener);
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

    private void setupSizes() {

        var labelD = label.getPreferredSize();
        var width = Math.max(bsbObj.getWidth(), labelD.width);
        var height = Math.max(bsbObj.getHeight(), labelD.height);

        var components = editorPanel.getComponents();

        if (components.length > 0) {
            for (var c : components) {
                var p = c.getPreferredSize();
                width = Math.max(width, c.getX() + p.width);
                height = Math.max(height, c.getY() + p.height);
            }

            // add inset size
//                d.width += parent.getInsets().right;
//                d.height += parent.getInsets().bottom;
            width += 10;
            height += 10;
        }

        editorPanel.setSize(new Dimension(width, height));
        editorPanel.setPreferredSize(new Dimension(width, height));

        setSize(getPreferredSize());
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

//          label.textProperty().unbind();
//                bsbGroup.interfaceItemsProperty().removeListener(scl);
//                bsbGroup.backgroundColorProperty().removeListener(bgColorListener);
//                bsbGroup.borderColorProperty().removeListener(borderColorListener);
//                label.textFillProperty().unbind();
//                bsbGroup.titleEnabledProperty().removeListener(titleEnabledLIstener);
//                resizePane.prefWidthProperty().unbind();
//                resizePane.prefHeightProperty().unbind();
//                tooltip.textProperty().unbind();
//                bsbGroup.commentProperty().removeListener(toolTipListener);
//                BSBTooltipUtil.install(label, null);
    }

    private void updateBackgroundColor() {

        editorPanel.setBackground(new Color(0, 0, 0, 0.2f));
//        editorPanel.setBackground(bsbObj.getBackgroundColor());
//        resizePane.setBackground(
//                new Background(
//                        new BackgroundFill(bsbGroup.getBackgroundColor(), CornerRadii.EMPTY, Insets.EMPTY)));
    }

    private void updateBorderColor() {
        label.setBackground(Color.BLACK);
        editorPanel.setBorder(new LineBorder(Color.BLACK));
//        label.setBackground(
//        bsbGroup.getBorderColor()
//                new Background(
//                        new BackgroundFill(bsbGroup.getBorderColor(), new CornerRadii(4, 4, 0, 0, false), Insets.EMPTY)));
//        
//        resizePane.setBorder(new Border(new BorderStroke(bsbGroup.getBorderColor(), BorderStrokeStyle.SOLID, CornerRadii.EMPTY, new BorderWidths(1))));
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


    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return true;
    }

    public int getWidgetMinimumWidth() {
//        double base = editorPane.prefWidth(editorPane.getPrefHeight());
//        if (getTop() == label) {
//            base = Math.max(label.minWidth(label.getPrefHeight()), base);
//        }
//        return Math.max(20, (int) base);
return 0;
    }

    public int getWidgetMinimumHeight() {
//        double base = (getTop() == label) ? label.minHeight(label.getPrefWidth()) : 0;
//        return Math.max(20,
//                (int) (base + editorPane.prefHeight(editorPane.getPrefWidth())));
return 0;
    }

    public int getWidgetWidth() {
        return (int) getWidth();
    }

    public void setWidgetWidth(int width) {
        bsbObj.setWidth(width);
    }

    public int getWidgetHeight() {
        return (int) getHeight();
    }

    public void setWidgetHeight(int height) {
        double base = label.isVisible() ? label.getPreferredSize().height : 0;
        bsbObj.setHeight(height - (int) base);
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
