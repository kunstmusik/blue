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
package blue.orchestra.editor.blueSynthBuilder;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.border.LineBorder;

import org.wonderly.awt.Packer;

import blue.ui.components.IconFactory;
import blue.components.LineCanvas;
import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.orchestra.blueSynthBuilder.BSBLineObject;

public class BSBLineObjectView extends BSBObjectView implements
        PropertyChangeListener {

    LineCanvas lineCanvas = new LineCanvas();

    LineSelector lineSelector = new LineSelector();

    private BSBLineObject lineObj;

    public BSBLineObjectView(BSBLineObject lineObj) {
        this.lineObj = lineObj;
        super.setBSBObject(this.lineObj);

        this.setLayout(new BorderLayout());
        this.add(lineCanvas, BorderLayout.CENTER);
        this.add(lineSelector, BorderLayout.SOUTH);

        lineCanvas.setLocked(lineObj.isLocked());

        lineSelector.setLineCanvas(lineCanvas);

        this.setBorder(new LineBorder(Color.GRAY));

        revalidate();

        setLineList(lineObj.getLines());

        this.setSize(lineObj.getCanvasWidth(), lineObj.getCanvasHeight()
                + lineSelector.getPreferredSize().height);

        repaint();

        lineObj.addPropertyChangeListener(this);
    }

    public void cleanup() {
        lineObj.removePropertyChangeListener(this);
    }

    public LineList getLineList() {
        return lineObj.getLines();
    }

    public void setLineList(LineList lines) {
        lineObj.setLines(lines);
        lineCanvas.setLineList(lines);
        lineSelector.setLineList(lines);

        if (lines.size() > 0) {
            lineCanvas.setSelectedLine(lines.getLine(0));
        }
    }

    public BSBLineObjectView getLineObjectView() {
        return this;
    }

    public void setLineObjectView(BSBLineObjectView view) {

    }

    public int getCanvasHeight() {
        return lineObj.getCanvasHeight();
    }

    public int getCanvasWidth() {
        return lineObj.getCanvasWidth();
    }

    public void setCanvasHeight(int canvasHeight) {
        lineObj.setCanvasHeight(canvasHeight);
    }

    public void setCanvasWidth(int canvasWidth) {
        lineObj.setCanvasWidth(canvasWidth);
    }

    public boolean isLeadingZero() {
        return lineObj.isLeadingZero();
    }

    public void setLeadingZero(boolean leadingZero) {
        lineObj.setLeadingZero(leadingZero);
    }

    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() != lineObj) {
            return;
        }

        String prop = evt.getPropertyName();

        if (prop.equals("canvasWidth") || prop.equals("canvasHeight")) {
            int w = lineObj.getCanvasWidth();
            int h = lineObj.getCanvasHeight();
            lineCanvas.setSize(new Dimension(w, h));
            this.setSize(w, h + lineSelector.getPreferredSize().height);
            this.revalidate();
        } else if (prop.equals("presetValue")) {
            this.repaint();
        }

    }

    static class LineSelector extends JComponent {
        JLabel label = new JLabel();

        private LineList lines;

        private Line currentLine = null;

        private LineCanvas lineCanvas;

        public LineSelector() {

            JButton next = new JButton(IconFactory.getRightArrowIcon());
            JButton previous = new JButton(IconFactory.getLeftArrowIcon());

            next.setFocusable(false);
            previous.setFocusable(false);

            next.setMargin(new Insets(3, 3, 3, 3));
            previous.setMargin(new Insets(3, 3, 3, 3));

            next.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    nextLine();
                }

            });

            previous.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    previousLine();
                }

            });

            Packer p = new Packer(this);

            p.add(label).gridx(0).gridy(0).fillboth().west().weightx(1.0);
            p.add(previous).gridx(1).east().fillx().weightx(0);
            p.add(next).gridx(2).east().fillx().weightx(0);
        }

        public void setLineCanvas(LineCanvas lineCanvas) {
            this.lineCanvas = lineCanvas;
        }

        private void nextLine() {
            if (lines == null || currentLine == null) {
                return;
            }

            int index = lines.indexOf(currentLine);

            if (index == -1) {
                return;
            }

            index++;

            if (index >= lines.size()) {
                index = 0;
            }

            currentLine = (Line) lines.get(index);
            updateLabel();
            fireLineSelection();
        }

        private void previousLine() {
            if (lines == null || currentLine == null) {
                return;
            }

            int index = lines.indexOf(currentLine);

            if (index == -1) {
                return;
            }

            index--;

            if (index < 0) {
                index = lines.size() - 1;
            }

            currentLine = (Line) lines.get(index);
            updateLabel();
            fireLineSelection();
        }

        private void fireLineSelection() {
            if (lineCanvas != null) {
                lineCanvas.setSelectedLine(currentLine);
            }

        }

        private void updateLabel() {
            label.setText(currentLine.getVarName());
        }

        public void setLineList(LineList lines) {
            this.lines = lines;

            if (lines.size() > 0 && !lines.contains(currentLine)) {
                currentLine = (Line) lines.get(0);
                updateLabel();
            }
        }

    }

    public float getXMax() {
        return lineObj.getXMax();
    }

    public void setXMax(float max) {
        if (max <= 0.0f) {
            return;
        }
        lineObj.setXMax(max);
    }

    public boolean isRelativeXValues() {
        return lineObj.isRelativeXValues();
    }

    public void setRelativeXValues(boolean relativeXValues) {
        lineObj.setRelativeXValues(relativeXValues);
    }

    public String getSeparatorType() {
        return lineObj.getSeparatorType();
    }

    public void setSeparatorType(String separatorType) {
        lineObj.setSeparatorType(separatorType);
    }

    public boolean isLocked() {
        return lineObj.isLocked();
    }

    public void setLocked(boolean locked) {
        lineObj.setLocked(locked);
        lineCanvas.setLocked(locked);
    }

    public String toString() {
        return "";
    }
}
