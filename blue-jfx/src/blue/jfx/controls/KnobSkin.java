/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
 * Steven Yi <stevenyi@gmail.com>
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
package blue.jfx.controls;

import javafx.beans.InvalidationListener;
import javafx.beans.binding.DoubleBinding;
import javafx.geometry.HPos;
import javafx.geometry.VPos;
import javafx.scene.Node;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.control.SkinBase;
import javafx.scene.effect.Glow;
import javafx.scene.paint.Color;
import javafx.scene.shape.Arc;
import javafx.scene.shape.ArcType;
import javafx.scene.shape.Ellipse;
import javafx.scene.shape.Path;
import javafx.scene.shape.Rectangle;
import javafx.scene.shape.Shape;
import javafx.scene.shape.StrokeType;

/**
 *
 * @author stevenyi
 */
public class KnobSkin extends SkinBase<Knob>{

    private static double ARC_LENGTH = 270.0;
    
    Shape track;

    double mouseYBase = 0.0; 
    double baseValue = 0.0; 
    
    DoubleBinding percent;
    boolean invalid = true;

    InvalidationListener invalidListener = o -> invalid = true;
    
    public KnobSkin(Knob knob) { 
        super(knob);
        knob.getStyleClass().add("knob");

        DoubleBinding range = knob.maxProperty().subtract(knob.minProperty());
        percent = knob.valueProperty().subtract(knob.minProperty()).divide(range);
        
        initHandlers(); 
     
        knob.widthProperty().addListener(invalidListener);
        knob.heightProperty().addListener(invalidListener);

    }

    private void initHandlers() {
       
        Knob knob = getSkinnable();

        knob.setOnMousePressed((e) -> {
           mouseYBase = e.getY();
           baseValue = knob.getValue();
        });
        knob.setOnMouseDragged((e) -> {
           double mouseAdjust = mouseYBase - e.getY();
           double valueAdjust = 0.01 * mouseAdjust * knob.getRange();
           double newValue = baseValue + valueAdjust;
           
           if(newValue < knob.getMin()) {
               knob.setValue(knob.getMin());
           } else if(newValue > knob.getMax()) {
               knob.setValue(knob.getMax());
           } else {
               knob.setValue(newValue);
           }
        });

    }

    private void initComponents(double w) {
        getChildren().clear();

        double width = snapSize(w);
        double radius = width / 2;
        double innerRadius = snapSize(radius * 0.5);
        
        Ellipse outer = new Ellipse(radius, radius, radius, radius);
        Ellipse inner = new Ellipse(radius, radius, innerRadius, innerRadius);
        
        Shape shape = Path.subtract(outer, inner);
        Rectangle rect = new Rectangle(radius, radius);

        Shape trackBG = Path.subtract(shape, rect);
        trackBG.setRotate(-135.0);
        trackBG.setStroke(Color.DARKGRAY);
        trackBG.setStrokeType(StrokeType.INSIDE);
        trackBG.setFill(Color.ALICEBLUE.darker());
       
        Arc mask = new Arc(radius, radius, radius + 2, radius + 2, -270, -270);
        mask.setType(ArcType.ROUND);
        mask.lengthProperty().bind(percent.multiply(-ARC_LENGTH));
        
        track = Path.subtract(shape, rect);
        track.setRotate(-135.0);
        track.setStroke(Color.ALICEBLUE);
        track.setStrokeType(StrokeType.INSIDE);
        track.setFill(Color.ALICEBLUE.deriveColor(1.0, 1.0, 1.0, 0.5));
        track.setClip(mask);
        track.setEffect(new Glow(1.0));

        Canvas c = new Canvas(width, width); 
        GraphicsContext gc = c.getGraphicsContext2D();
        gc.setStroke(Color.ALICEBLUE.brighter().brighter().brighter());
        gc.setLineWidth(2.0);
        gc.strokeLine(radius, 0, radius, radius - innerRadius - 1);
        c.rotateProperty().bind(
                percent.multiply(ARC_LENGTH).subtract(135.0));
       
        getChildren().addAll(trackBG, track, c);
        
    }

    

    @Override
    protected double computePrefHeight(double width, double topInset, double rightInset, double bottomInset, double leftInset) {
        return topInset + bottomInset + 60;
    }

    @Override
    protected double computePrefWidth(double height, double topInset, double rightInset, double bottomInset, double leftInset) {
        return leftInset + rightInset + 60;
    }

    @Override
    protected double computeMaxHeight(double width, double topInset, double rightInset, double bottomInset, double leftInset) {
        return Double.MAX_VALUE;
    }

    @Override
    protected double computeMaxWidth(double height, double topInset, double rightInset, double bottomInset, double leftInset) {
        return Double.MAX_VALUE;
    }

    @Override
    protected double computeMinHeight(double width, double topInset, double rightInset, double bottomInset, double leftInset) {
        return topInset + bottomInset + 10;
    }

    @Override
    protected double computeMinWidth(double height, double topInset, double rightInset, double bottomInset, double leftInset) {
        return leftInset + rightInset + 10;
    }


    
    @Override
    protected void layoutChildren(double contentX, double contentY, double contentWidth, double contentHeight) {
        double side = Math.min(contentWidth, contentHeight);
        double xAdjust, yAdjust;
        if(contentWidth < contentHeight) {
            xAdjust = 0; 
            yAdjust = snapPosition((contentHeight - contentWidth) / 2.0);
        } else {
            xAdjust = snapPosition((contentWidth - contentHeight) / 2.0);  
            yAdjust = 0;
        }
        
        if(invalid) {
            initComponents(side);
            invalid = false;
        }

        for(Node child : getChildren()) {
            layoutInArea(child, contentX + xAdjust, contentY + yAdjust, contentWidth, contentHeight,
                    0, HPos.LEFT, VPos.TOP);
        }                
    }

    @Override
    public void dispose() {
        getSkinnable().widthProperty().removeListener(invalidListener);
        getSkinnable().heightProperty().removeListener(invalidListener);
    }

    

}
