package blue.orchestra.editor.flowGraph;

import java.awt.BorderLayout;
import java.awt.Dimension;

import javax.swing.JLabel;
import javax.swing.JMenuItem;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JSlider;

import blue.orchestra.flowGraph.FlowGraph;
import blue.orchestra.flowGraph.UnitLibrary;

public class FlowGraphPanel extends JPanel {
    private UnitLibrary unitLibrary;

    private FlowGraph instrument;

    private FlowGraphCanvas flowGraphCanvas;

    private JLabel statusBar;

    private JSlider zoomSlider;

    private double scale;

    private JPopupMenu popupCanvas;

    private JPopupMenu popupUnit;

    private JPopupMenu popupPort;

    public FlowGraphPanel(FlowGraph instrument, UnitLibrary unitLibrary) {
        this.instrument = instrument;
        this.unitLibrary = unitLibrary;

        statusBar = new JLabel("...");
        zoomSlider = new JSlider(JSlider.HORIZONTAL, 150, 500, 350); // adjust
                                                                        // scale
                                                                        // factor
        zoomSlider.setPreferredSize(new Dimension(100, 10));
        flowGraphCanvas = new FlowGraphCanvas(this);

        this.setLayout(new BorderLayout());
        JPanel bottom = new JPanel(new BorderLayout());
        bottom.add(statusBar, BorderLayout.WEST);
        bottom.add(zoomSlider, BorderLayout.EAST);
        this.add(bottom, BorderLayout.SOUTH);
        this.add(flowGraphCanvas, BorderLayout.CENTER);

        popupCanvas = createCanvasPopupMenu();
        popupUnit = createUnitPopupMenu();
        popupPort = createPortPopupMenu();

        scale = 50.0;
    }

    private JPopupMenu createCanvasPopupMenu() {
        JPopupMenu popup = new JPopupMenu();
        JMenuItem item = new JMenuItem("add Unit");
        popup.add(item);
        return popup;
    }

    private JPopupMenu createUnitPopupMenu() {
        JPopupMenu popup = new JPopupMenu();
        JMenuItem item = new JMenuItem("add comment");
        popup.add(item);
        return popup;
    }

    private JPopupMenu createPortPopupMenu() {
        JPopupMenu popup = new JPopupMenu();
        JMenuItem item = new JMenuItem("connect to that port");
        popup.add(item);
        return popup;
    }

    public FlowGraph getFlowGraph() {
        return instrument;
    }

    public FlowGraphCanvas getFlowGraphCanvas() {
        return flowGraphCanvas;
    }

    public JLabel getStatusBar() {
        return statusBar;
    }

    public JSlider getZoomSlider() {
        return zoomSlider;
    }

    public UnitLibrary getUnitLibrary() {
        return unitLibrary;
    }

    public double getScale() {
        return scale;
    }

    public void setScale(double newScale) {
        scale = newScale;
    }

    public JPopupMenu getPopupCanvas() {
        return popupCanvas;
    }

    public JPopupMenu getPopupUnit() {
        return popupUnit;
    }

    public JPopupMenu getPopupPort() {
        return popupPort;
    }

}
