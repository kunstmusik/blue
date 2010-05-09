package blue.orchestra.editor.flowGraph;

import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.geom.Point2D;

import javax.swing.JPanel;

import blue.orchestra.flowGraph.Cable;
import blue.orchestra.flowGraph.Port;
import blue.orchestra.flowGraph.Unit;

public class FlowGraphCanvas extends JPanel {
    private FlowGraphPanel fGPanel;

    private Unit selectedUnit;

    private Cable selectedCable;

    private Port focusedPort;

    private Port clickedPort;

    private Point2D.Double clickedPoint;

    private int numClicks;

    private static final int FIRST_CLICK = 0;

    private static final int SECOND_CLICK = 1;

    public FlowGraphCanvas(FlowGraphPanel flowGraphPanel) {
        this.fGPanel = flowGraphPanel;

        this.addMouseListener(new FlowGraphCanvasMouseListener(fGPanel));
    }

    public void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();

        drawBackground(g2d);
        drawUnits(g2d);
        highlightSelectedUnit(g2d);
        highlightFocusedPort(g2d);
        drawCables(g2d);
        highlightSelectedCable(g2d);
        drawClickedPort(g2d);

        g2d.dispose();
    }

    private void drawBackground(Graphics2D g2d) {
        g2d.setColor(Colors.BACKGROUND);
        g2d.fillRect(0, 0, getWidth(), getHeight());
    }

    private void drawUnits(Graphics2D g2d) {

    }

    private void highlightSelectedUnit(Graphics2D g2d) {

    }

    private void highlightFocusedPort(Graphics2D g2d) {

    }

    private void drawCables(Graphics2D g2d) {

    }

    private void highlightSelectedCable(Graphics2D g2d) {

    }

    private void drawClickedPort(Graphics2D g2d) {

    }

}
