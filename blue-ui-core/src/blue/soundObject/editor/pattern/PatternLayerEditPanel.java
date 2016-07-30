package blue.soundObject.editor.pattern;

import blue.soundObject.PatternObject;
import blue.soundObject.pattern.Pattern;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.AdjustmentEvent;
import java.awt.event.AdjustmentListener;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTable;
import javax.swing.JViewport;
import javax.swing.ListSelectionModel;
import javax.swing.event.ListSelectionListener;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author steven yi
 * @version 1.0
 */

public class PatternLayerEditPanel extends JComponent implements
        AdjustmentListener {
    static Point posSync = new Point();

    JPanel topPanel = new JPanel();

    JPanel bottomPanel = new JPanel();

    JViewport lView = new JViewport();

    JTable layerTable;

    JButton buttonUp = new JButton("^");

    JButton buttonDown = new JButton("V");

    JButton buttonAdd = new JButton("+");

    JButton buttonRemove = new JButton("-");

    private PatternObject pattern;

    public PatternLayerEditPanel() {

        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setLayout(new BorderLayout());

        Dimension d = new Dimension(20, 17);
        buttonUp.setPreferredSize(d);
        buttonDown.setPreferredSize(d);
        buttonAdd.setPreferredSize(d);
        buttonRemove.setPreferredSize(d);

        bottomPanel.setLayout(new GridLayout());

        buttonUp.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                pushUpLayer();
            }
        });
        buttonDown.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                pushDownLayer();
            }
        });
        buttonAdd.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                addLayer();
            }
        });
        buttonRemove.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                removeLayer();
            }
        });
        bottomPanel.add(buttonUp);
        bottomPanel.add(buttonDown);
        bottomPanel.add(buttonAdd);
        bottomPanel.add(buttonRemove);

        layerTable = new JTable();
        layerTable
                .setSelectionMode(ListSelectionModel.SINGLE_INTERVAL_SELECTION);

        lView.add(layerTable);

        this.add(layerTable.getTableHeader(), BorderLayout.NORTH);
        this.add(bottomPanel, BorderLayout.SOUTH);
        this.add(lView, BorderLayout.CENTER);

        layerTable.setRowHeight(PatternsConstants.patternViewHeight);
    }

    public void addListSelectionListener(ListSelectionListener listener) {
        layerTable.getSelectionModel().addListSelectionListener(listener);
    }

    private void setTableColumnSizes() {
        layerTable.getTableHeader().setReorderingAllowed(false);
        layerTable.getTableHeader().setPreferredSize(new Dimension(17, 21));
        layerTable.getTableHeader().getColumnModel().getColumn(1)
                .setPreferredWidth(40);
        layerTable.getTableHeader().getColumnModel().getColumn(1).setMaxWidth(
                40);
        layerTable.getTableHeader().getColumnModel().getColumn(1).setMinWidth(
                40);
        // layerTable.getTableHeader().getColumnModel().getColumn(
        // 2).setPreferredWidth(
        // 40);
        // layerTable.getTableHeader().getColumnModel().getColumn(2).setMaxWidth(
        // 40);
        // layerTable.getTableHeader().getColumnModel().getColumn(2).setMinWidth(
        // 40);

    }

    public void setPatternObject(PatternObject pattern) {
        layerTable.setRowHeight(PatternsConstants.patternViewHeight);

        this.pattern = pattern;

        layerTable.setModel(pattern);

        setTableColumnSizes();
    }

    @Override
    public void adjustmentValueChanged(AdjustmentEvent ae) {
        posSync.setLocation(0, ae.getValue());
        lView.setViewPosition(posSync);
    }

    public void addLayer() {
        int selected = layerTable.getSelectedRow();
        pattern.addPattern(selected + 1);

        if (selected != -1) {
            layerTable.setRowSelectionInterval(selected, selected);
        }
    }

    public void removeLayer() {
        int selected = layerTable.getSelectedRow();

        if (selected == -1 || pattern == null) {
            return;
        }

        String message = "Please confirm deleting this pattern.";
        if (JOptionPane.showConfirmDialog(null, message) == JOptionPane.OK_OPTION) {
            pattern.removePattern(selected);
        }

    }

    public void pushUpLayer() {
        int[] selected = layerTable.getSelectedRows();
        if (selected.length == 0 || selected[0] == 0) {
            return;
        }

        pattern.pushUpPatternLayers(selected);

        layerTable.setRowSelectionInterval(selected[0] - 1,
                selected[selected.length - 1] - 1);
    }

    public void pushDownLayer() {
        int[] selected = layerTable.getSelectedRows();
        if (selected.length == 0
                || selected[selected.length - 1] == (pattern.size() - 1)) {
            return;
        }
        pattern.pushDownPatternLayers(selected);

        layerTable.setRowSelectionInterval(selected[0] + 1,
                selected[selected.length - 1] + 1);
    }

    public Pattern getSelectedPattern() {
        int selected = layerTable.getSelectedRow();
        if (selected < 0) {
            return null;
        }

        return pattern.getPattern(selected);
    }

    public JViewport getViewPort() {
        return lView;
    }
}
