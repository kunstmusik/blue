package blue.orchestra.editor.flowGraph;

import blue.orchestra.flowGraph.FlowGraph;
import blue.orchestra.flowGraph.UnitLibrary;
import javax.swing.JFrame;

public class TestFlowGraphEditor {

    /**
     * @param args
     */
    public static void main(String[] args) {
        FlowGraph instrument = new FlowGraph();
        UnitLibrary library = new UnitLibrary();

        FlowGraphPanel fPanel = new FlowGraphPanel(instrument, library);

        JFrame window = new JFrame();
        window.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        window.getContentPane().add(fPanel);
        window.setSize(500, 500);
        window.setVisible(true);
    }

}
