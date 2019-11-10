package blue.tools.scanned;

import blue.BlueSystem;
import blue.ui.utilities.FileChooserManager;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.List;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;


/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class ScannedMatrixEditor extends JComponent {
    private static final String FILE_LOAD = "scannedMatrixEditor.load";

    private static final String FILE_SAVE = "scannedMatrixEditor.save";

    static {
        final FileChooserManager fcm = FileChooserManager.getDefault();
        fcm.setDialogTitle(FILE_LOAD, BlueSystem
                .getString("scanned.loadMatrix"));
        fcm.setDialogTitle(FILE_SAVE, BlueSystem
                .getString("scanned.saveMatrix"));
    }
    MatrixGridEditor matrixGridEditor = new MatrixGridEditor();

    JButton newButton = new JButton();

    JButton loadButton = new JButton();

    JButton saveButton = new JButton();

    JButton randomButton = new JButton();

    JLabel locationLabel = new JLabel();

    JButton plusButton = new JButton();

    JButton minusButton = new JButton();

    JScrollPane scroll = new JScrollPane();

    public ScannedMatrixEditor() {
        JTabbedPane tabs = new JTabbedPane();

        this.setLayout(new BorderLayout());

        matrixGridEditor.setLocationLabel(locationLabel);

        scroll.setViewportView(matrixGridEditor);
        scroll
                .setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
        scroll
                .setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);
        tabs.add(BlueSystem.getString("scanned.matrix"), scroll);
        tabs.add(BlueSystem.getString("menu.help.about.text"),
                new ScannedAbout());

        newButton.setText(BlueSystem.getString("common.new"));
        newButton.addActionListener((ActionEvent e) -> {
            newMatrix();
        });

        loadButton.setText(BlueSystem.getString("common.load"));
        loadButton.addActionListener((ActionEvent e) -> {
            loadMatrix();
        });

        saveButton.setText(BlueSystem.getString("common.save"));
        saveButton.addActionListener((ActionEvent e) -> {
            saveMatrix();
        });

        randomButton.setText(BlueSystem.getString("common.random"));
        randomButton.addActionListener((ActionEvent e) -> {
            randomMatrix();
        });

        plusButton.setText("+");
        plusButton.addActionListener((ActionEvent e) -> {
            MatrixGridEditor.increaseGridSize();
            matrixGridEditor.redoSize();
            scroll.revalidate();
            scroll.repaint();
        });
        minusButton.setText("-");
        minusButton.addActionListener((ActionEvent e) -> {
            MatrixGridEditor.decreaseGridSize();
            matrixGridEditor.redoSize();
            scroll.revalidate();
            scroll.repaint();
        });

        locationLabel.setText("pos (x,x)");
        locationLabel.setFont(new Font("Monospaced", Font.PLAIN, 12));
        locationLabel.setPreferredSize(new Dimension(150, 27));

        JPanel buttonPanel = new JPanel();
        buttonPanel.setLayout(new FlowLayout(FlowLayout.CENTER));
        buttonPanel.add(newButton);
        buttonPanel.add(loadButton);
        buttonPanel.add(saveButton);
        buttonPanel.add(randomButton);
        buttonPanel.add(plusButton);
        buttonPanel.add(minusButton);
        buttonPanel.add(locationLabel);

        this.add(tabs, BorderLayout.CENTER);
        this.add(buttonPanel, BorderLayout.SOUTH);

    }

    public void newMatrix() {
        String returnText = JOptionPane.showInputDialog(null, BlueSystem
                .getString("scanned.newMatrix.numMasses.message"), BlueSystem
                .getString("scanned.newMatrix.numMasses.title"),
                JOptionPane.QUESTION_MESSAGE);
        if (returnText != null) {
            try {
                int numOfMasses = Integer.parseInt(returnText);
                boolean[] matrix = new boolean[numOfMasses * numOfMasses];
                for (int i = 0; i < matrix.length; i++) {
                    matrix[i] = false;
                }
                matrixGridEditor.setMatrix(matrix);
            } catch (NumberFormatException e) {
                JOptionPane.showMessageDialog(null, BlueSystem
                        .getString("message.integerError.message"), BlueSystem
                        .getString("message.integerError.title"),
                        JOptionPane.ERROR_MESSAGE);
                return;
            }
        }
    }

    public void loadMatrix() {
        final FileChooserManager fcm = FileChooserManager.getDefault();
        List<File> rValue = fcm.showOpenDialog(FILE_LOAD, null);

        if (!rValue.isEmpty()) {
            File temp = rValue.get(0);
            matrixGridEditor.loadMatrix(temp);
        }
    }

    public void saveMatrix() {
        if (matrixGridEditor.matrix == null) {
            return;
        }
        final FileChooserManager fcm = FileChooserManager.getDefault();

        File rValue = fcm.showSaveDialog(FILE_SAVE, null);

        if (rValue != null) {
            try {
                File temp = rValue;
                try (PrintWriter out = new PrintWriter(new FileWriter(temp))) {
                    int val = 0;
                    for (int i = 0; i < matrixGridEditor.matrix.length; i++) {
                        val = matrixGridEditor.matrix[i] ? 1 : 0;
                        out.write(val + "\n");
                    }
                    out.flush();
                }
            } catch (Exception e) {
                JOptionPane.showMessageDialog(null, BlueSystem
                        .getString("message.saveError.message"), BlueSystem
                        .getString("message.saveError.title"),
                        JOptionPane.ERROR_MESSAGE);
                e.printStackTrace();
            }
        }
    }

    public void randomMatrix() {
        if (matrixGridEditor.matrix == null) {
            return;
        }

        for (int i = 0; i < matrixGridEditor.matrix.length; i++) {
            matrixGridEditor.matrix[i] = Math.random() > 0.5d;
        }
        matrixGridEditor.repaint();
    }

    public static void main(String[] args) {
        ScannedMatrixEditor scannedMatrixEditor1 = new ScannedMatrixEditor();
        // scannedMatrixEditor1.loadMatrix(new
        // File("/work/audio/csound/include/ScanMatricesRev/string-128"));

        JFrame mFrame = new JFrame();
        mFrame.setTitle("Scanned Synthesis Matrix Editor");

        mFrame.setSize(800, 600);
        mFrame.getContentPane().add(scannedMatrixEditor1);

        mFrame.show();
        mFrame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                System.exit(0);
            }
        });
    }
}