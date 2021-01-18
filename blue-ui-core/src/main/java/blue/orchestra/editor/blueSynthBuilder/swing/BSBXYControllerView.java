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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.components.lines.LineBoundaryDialog;
import blue.orchestra.blueSynthBuilder.BSBXYController;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.text.MessageFormat;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;

public class BSBXYControllerView extends BSBObjectView<BSBXYController>
        implements ResizeableView {

    private static MessageFormat labelMessage = new MessageFormat(
            "x: {0,number,#.####} y: {1,number,#.####}");

    private final DrawPanel drawPanel;

    JLabel label = new JLabel();

    public BSBXYControllerView(BSBXYController controller) {
        super(controller);

        drawPanel = new DrawPanel(controller);
        drawPanel.addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent e) {
                setValues(e.getX(), e.getY());
            }

        });
        drawPanel.addMouseMotionListener(new MouseMotionAdapter() {

            @Override
            public void mouseDragged(MouseEvent e) {
                setValues(e.getX(), e.getY());
            }

        });

        this.setBackground(Color.BLACK);

        this.setLayout(new BorderLayout());

        this.add(drawPanel, BorderLayout.CENTER);
        this.add(label, BorderLayout.SOUTH);

        label.setFont(new Font("Dialog", Font.PLAIN, 10));

        drawPanel.setPreferredSize(new Dimension(controller.getWidth(),
                controller.getHeight()));
        drawPanel.setBackground(Color.BLACK);

//        this.controller.addPropertyChangeListener(this);
        updateLabel();

        updateSize();
    }

//    @Override
//    public void cleanup() {
//        this.controller.removePropertyChangeListener(this);
//    }
    protected void setValues(int x, int y) {

        int newX = x;
        int newY = y;

        if (newX < 0) {
            newX = 0;
        } else if (newX > drawPanel.getWidth()) {
            newX = drawPanel.getWidth();
        }

        if (newY < 0) {
            newY = 0;
        } else if (newY > drawPanel.getHeight()) {
            newY = drawPanel.getHeight();
        }

        double xVal = newX / (double) drawPanel.getWidth();
        double yVal = (drawPanel.getHeight() - newY)
                / (double) drawPanel.getHeight();

        xVal = (xVal * (bsbObj.getXMax() - bsbObj.getXMin()))
                + bsbObj.getXMin();
        yVal = (yVal * (bsbObj.getYMax() - bsbObj.getYMin()))
                + bsbObj.getYMin();

        bsbObj.setXValue(xVal);
        bsbObj.setYValue(yVal);
    }

    private void updateSize() {

        Dimension d = new Dimension(bsbObj.getWidth(), bsbObj
                .getHeight());

        drawPanel.setPreferredSize(d);
        drawPanel.setSize(d);

        d = new Dimension(bsbObj.getWidth(), bsbObj.getHeight()
                + label.getHeight());

        this.setSize(d);
        this.setPreferredSize(d);

        // drawPanel.setSize(d);
    }

    private void updateLabel() {
        Object[] vals = new Object[]{bsbObj.getXValue(), bsbObj.getYValue()};
        label.setText(labelMessage.format(vals));
    }

//    public int getViewWidth() {
//        return controller.getWidth();
//    }
//
//    public void setViewWidth(int width) {
//        if (width <= 0) {
//            return;
//        }
//
//        controller.setWidth(width);
//    }
//
//    public int getViewHeight() {
//        return controller.getHeight();
//    }
//
//    public void setViewHeight(int height) {
//        if (height <= 0) {
//            return;
//        }
//
//        controller.setHeight(height);
//    }
//
//    public float getXMin() {
//        return controller.getXMin();
//    }
//
//    public void setXMin(float value) {
//        if (value >= controller.getXMax()) {
//            JOptionPane.showMessageDialog(null, "Error: Min value "
//                    + "can not be set greater or equals to Max value.",
//                    "Error", JOptionPane.ERROR_MESSAGE);
//            return;
//        }
//
//        String retVal = LineBoundaryDialog.getLinePointMethod();
//
//        if (retVal == null) {
//            return;
//        }
//
//        controller.setXMin(value, (retVal == LineBoundaryDialog.TRUNCATE));
//    }
//
//    public float getXMax() {
//        return controller.getXMax();
//    }
//
//    public void setXMax(float value) {
//        if (value <= controller.getXMin()) {
//            JOptionPane.showMessageDialog(null, "Error: Max value "
//                    + "can not be set less than or " + "equal to Min value.",
//                    "Error", JOptionPane.ERROR_MESSAGE);
//
//            return;
//        }
//
//        String retVal = LineBoundaryDialog.getLinePointMethod();
//
//        if (retVal == null) {
//            return;
//        }
//
//        controller.setXMax(value, (retVal == LineBoundaryDialog.TRUNCATE));
//    }
//
//    public float getYMin() {
//        return controller.getYMin();
//    }
//
//    public void setYMin(float value) {
//        if (value >= controller.getYMax()) {
//            JOptionPane.showMessageDialog(null, "Error: Min value "
//                    + "can not be set greater or equals to Max value.",
//                    "Error", JOptionPane.ERROR_MESSAGE);
//            return;
//        }
//
//        String retVal = LineBoundaryDialog.getLinePointMethod();
//
//        if (retVal == null) {
//            return;
//        }
//
//        controller.setYMin(value, (retVal == LineBoundaryDialog.TRUNCATE));
//    }
//
//    public float getYMax() {
//        return controller.getYMax();
//    }
//
//    public void setYMax(float value) {
//        if (value <= controller.getYMin()) {
//            JOptionPane.showMessageDialog(null, "Error: Max value "
//                    + "can not be set less than or " + "equal to Min value.",
//                    "Error", JOptionPane.ERROR_MESSAGE);
//
//            return;
//        }
//
//        String retVal = LineBoundaryDialog.getLinePointMethod();
//
//        if (retVal == null) {
//            return;
//        }
//
//        controller.setYMax(value, (retVal == LineBoundaryDialog.TRUNCATE));
//    }
//
//    public boolean isRandomizable() {
//        return controller.isRandomizable();
//    }
//
//    public void setRandomizable(boolean randomizable) {
//        controller.setRandomizable(randomizable);
//    }
//    @Override
//    public void propertyChange(PropertyChangeEvent evt) {
//        if (evt.getSource() != bsbObj) {
//            return;
//        }
//
//        String prop = evt.getPropertyName();
//        switch (prop) {
//            case "width":
//            case "height":
//                updateSize();
//                revalidate();
//                repaint();
//                break;
//            case "xValue":
//            case "yValue":
//                drawPanel.repaint();
//                updateLabel();
//                break;
//            case "xMin":
//            case "xMax":
//            case "yMin":
//            case "yMax":
//                updateLabel();
//                break;
//        }
//    }
    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return true;
    }

    public int getWidgetMinimumWidth() {
        return 20;
    }

    public int getWidgetMinimumHeight() {
        int base = bsbObj.isValueDisplayEnabled() ? (int) label.getHeight() : 0;
        return base + 20;
    }

    public int getWidgetWidth() {
        return bsbObj.getWidth();
    }

    public void setWidgetWidth(int width) {
        bsbObj.setWidth(Math.max(20, width));
    }

    public int getWidgetHeight() {
        int base = bsbObj.isValueDisplayEnabled() ? (int) label.getHeight() : 0;
        return bsbObj.getHeight() + base;
    }

    public void setWidgetHeight(int height) {
        int base = bsbObj.isValueDisplayEnabled() ? (int) label.getHeight() : 0;
        bsbObj.setHeight(height - base);
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

class DrawPanel extends JPanel {

    private final BSBXYController controller;

    public DrawPanel(BSBXYController controller) {
        this.controller = controller;
    }

    private double getPercent(double value, double min, double max) {
        return (value - min) / (max - min);
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        int w = this.getWidth() - 1;
        int h = this.getHeight() - 1;

        double xPercent = getPercent(controller.getXValue(), controller
                .getXMin(), controller.getXMax());
        double yPercent = getPercent(controller.getYValue(), controller
                .getYMin(), controller.getYMax());

        int x = (int) (xPercent * w);
        int y = h - ((int) (yPercent * h));

        g.setColor(Color.DARK_GRAY);
        g.drawRect(0, 0, w, h);

        g.setColor(Color.WHITE);
        g.drawLine(0, y, w, y);
        g.drawLine(x, 0, x, h);

        g.setColor(Color.GREEN);
        g.fillRect(x - 1, y - 1, 3, 3);

    }
}
