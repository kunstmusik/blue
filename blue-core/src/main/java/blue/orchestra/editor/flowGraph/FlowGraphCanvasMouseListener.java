package blue.orchestra.editor.flowGraph;

import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;

public class FlowGraphCanvasMouseListener implements MouseListener {
    private FlowGraphPanel fgPanel;

    private FlowGraphCanvas canvas;

    public FlowGraphCanvasMouseListener(FlowGraphPanel flowGraphPanel) {
        this.fgPanel = flowGraphPanel;
        this.canvas = flowGraphPanel.getFlowGraphCanvas();
    }

    @Override
    public void mouseClicked(MouseEvent me) {
        // System.out.println("click");
    }

    @Override
    public void mousePressed(MouseEvent me) {
        if (me.getButton() == MouseEvent.BUTTON3) {
            System.out.println("popup trigger");
            fgPanel.getPopupCanvas().show(me.getComponent(), me.getX(),
                    me.getY());
        }
    }

    @Override
    public void mouseReleased(MouseEvent arg0) {

    }

    @Override
    public void mouseEntered(MouseEvent arg0) {

    }

    @Override
    public void mouseExited(MouseEvent arg0) {

    }

}
