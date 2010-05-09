package blue.ftable.genRoutine;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.GridLayout;

import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.SwingConstants;

import blue.ftable.FTable;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class GenericTableEdittor extends JComponent {

    FTable ft;

    BorderLayout borderLayout1 = new BorderLayout();

    JPanel bottomPanel = new JPanel();

    JPanel jPanel1 = new JPanel();

    JTextField tableNumText = new JTextField();

    JPanel topPanel = new JPanel();

    BorderLayout borderLayout2 = new BorderLayout();

    GridLayout gridLayout1 = new GridLayout();

    JLabel tableNumLabel = new JLabel();

    JPanel jPanel2 = new JPanel();

    JTextField genRoutineText = new JTextField();

    BorderLayout borderLayout3 = new BorderLayout();

    JLabel genRoutineLabel = new JLabel();

    JPanel jPanel3 = new JPanel();

    JTextField tableSizeText = new JTextField();

    BorderLayout borderLayout4 = new BorderLayout();

    JLabel tableSizeLabel = new JLabel();

    JPanel jPanel4 = new JPanel();

    JTextField actionTimeText = new JTextField();

    BorderLayout borderLayout5 = new BorderLayout();

    JLabel actionTimeLabel = new JLabel();

    BorderLayout borderLayout6 = new BorderLayout();

    JLabel jLabel1 = new JLabel();

    JScrollPane jScrollPane1 = new JScrollPane();

    JTextArea argumentText = new JTextArea();

    JLabel tableNameLabel = new JLabel();

    JPanel jPanel5 = new JPanel();

    JTextField tableNameText = new JTextField();

    BorderLayout borderLayout7 = new BorderLayout();

    public GenericTableEdittor(FTable ft) {
        this.ft = ft;
    }

    public GenericTableEdittor() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setLayout(borderLayout1);
        jPanel1.setLayout(borderLayout2);
        topPanel.setLayout(gridLayout1);
        gridLayout1.setRows(5);
        tableNumLabel.setPreferredSize(new Dimension(100, 15));
        tableNumLabel.setHorizontalAlignment(SwingConstants.RIGHT);
        tableNumLabel.setHorizontalTextPosition(SwingConstants.RIGHT);
        tableNumLabel.setText("Table Number: ");
        jPanel2.setLayout(borderLayout3);
        genRoutineLabel.setPreferredSize(new Dimension(100, 15));
        genRoutineLabel.setHorizontalAlignment(SwingConstants.RIGHT);
        genRoutineLabel.setText("Gen Routine: ");
        jPanel3.setLayout(borderLayout4);
        tableSizeText.setToolTipText("");
        tableSizeLabel.setPreferredSize(new Dimension(100, 15));
        tableSizeLabel.setHorizontalAlignment(SwingConstants.RIGHT);
        tableSizeLabel.setText("Table Size: ");
        jPanel4.setLayout(borderLayout5);
        actionTimeLabel.setPreferredSize(new Dimension(100, 15));
        actionTimeLabel.setHorizontalAlignment(SwingConstants.RIGHT);
        actionTimeLabel.setText("Action Time: ");
        bottomPanel.setLayout(borderLayout6);
        jLabel1.setPreferredSize(new Dimension(100, 15));
        jLabel1.setHorizontalAlignment(SwingConstants.RIGHT);
        jLabel1.setText("Arguments: ");
        jLabel1.setVerticalAlignment(SwingConstants.TOP);
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        tableNameLabel.setText("Table Name: ");
        tableNameLabel.setHorizontalTextPosition(SwingConstants.RIGHT);
        tableNameLabel.setHorizontalAlignment(SwingConstants.RIGHT);
        tableNameLabel.setPreferredSize(new Dimension(100, 15));
        jPanel5.setLayout(borderLayout7);
        this.add(bottomPanel, BorderLayout.CENTER);
        bottomPanel.add(jLabel1, BorderLayout.WEST);
        bottomPanel.add(jScrollPane1, BorderLayout.CENTER);
        jScrollPane1.getViewport().add(argumentText, null);
        this.add(topPanel, BorderLayout.NORTH);
        topPanel.add(jPanel5, null);
        jPanel5.add(tableNameText, BorderLayout.CENTER);
        jPanel5.add(tableNameLabel, BorderLayout.WEST);
        topPanel.add(jPanel1, null);
        jPanel1.add(tableNumText, BorderLayout.CENTER);
        jPanel1.add(tableNumLabel, BorderLayout.WEST);
        topPanel.add(jPanel4, null);
        jPanel4.add(actionTimeText, BorderLayout.CENTER);
        jPanel4.add(actionTimeLabel, BorderLayout.WEST);
        topPanel.add(jPanel3, null);
        jPanel3.add(tableSizeText, BorderLayout.CENTER);
        jPanel3.add(tableSizeLabel, BorderLayout.WEST);
        topPanel.add(jPanel2, null);
        jPanel2.add(genRoutineText, BorderLayout.CENTER);
        jPanel2.add(genRoutineLabel, BorderLayout.WEST);
    }

}