package blue.tools.scanned;

import blue.BlueSystem;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.ArrayList;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;

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

public class MatrixGridEditor extends JComponent {
    boolean[] matrix = null;

    MatrixMouseListener mml;

    private static final Color ON_COLOR = new Color(198, 226, 255);

    public static int gridHeight = 20;

    public JLabel locationLabel = null;

    public MatrixGridEditor() {
        mml = new MatrixMouseListener(this);
        this.addMouseListener(mml);
        this.addMouseMotionListener(mml);
    }

    public void setLocationLabel(JLabel locationLabel) {
        this.locationLabel = locationLabel;

    }

    public static void increaseGridSize() {
        gridHeight++;
    }

    public static void decreaseGridSize() {
        if (gridHeight > 1) {
            gridHeight--;
        }
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        if (matrix == null) {
            return;
        }

        g.setColor(Color.black);
        g.fillRect(0, 0, this.getWidth(), this.getHeight());

        int numOfMasses = numberOfMasses(matrix.length);

        int totalWidth = numOfMasses * gridHeight;
        int totalHeight = totalWidth;

        // draw patternBoxes in

        int x1, y1;

        g.setColor(ON_COLOR);
        for (int i = 0; i < matrix.length; i++) {
            if (matrix[i]) {
                x1 = (i % numOfMasses) * gridHeight;
                y1 = (i / numOfMasses) * gridHeight;
                g.fillRect(x1, y1, gridHeight, gridHeight);
            }
        }

        // draw horizontal lines
        g.setColor(Color.darkGray);
        for (int i = 0; i < numOfMasses; i++) {
            g.drawLine(0, i * gridHeight, totalWidth, i * gridHeight);
        }

        for (int i = 0; i < numOfMasses; i++) {
            /*
             * if(i % 4 == 0) { g.setColor(Color.gray); g.drawLine(i *
             * PatternsConstants.patternViewHeight, 0, i *
             * PatternsConstants.patternViewHeight, totalHeight);
             * g.drawString(Integer.toString(i + 1), (i *
             * PatternsConstants.patternViewHeight) + 3, 10); } else {
             */
            g.setColor(Color.darkGray);
            g.drawLine(i * gridHeight, 0, i * gridHeight, totalHeight);
            // }

        }

    }

    public void setMatrix(boolean[] matrix) {
        this.matrix = matrix;
        redoSize();
        mml.setMatrix(matrix);
    }

    public void loadMatrix(File matrixFile) {
        ArrayList temp = new ArrayList();
        try {
            try (BufferedReader br = new BufferedReader(new FileReader(matrixFile))) {
                String line;
                while ((line = br.readLine()) != null) {
                    temp.add(line.trim());
                }
            }
        } catch (Exception e) {
            JOptionPane.showMessageDialog(null, BlueSystem
                    .getString("scanned.errorImportingMatrix")
                    + " " + matrixFile.getAbsolutePath(), BlueSystem
                    .getString("message.error"), JOptionPane.DEFAULT_OPTION);
            System.err.println(BlueSystem
                    .getString("scanned.errorImportingMatrix")
                    + " " + matrixFile.getAbsolutePath());
            return;
        }
        System.out.println(BlueSystem.getString("scanned.size") + " "
                + temp.size());
        System.out.println(BlueSystem.getString("scanned.numMasses") + " "
                + numberOfMasses(temp.size()));

        int numOfMasses = numberOfMasses(temp.size());

        if (numOfMasses == temp.size()) {
            JOptionPane.showMessageDialog(null, BlueSystem
                    .getString("scanned.errorImportingMatrix")
                    + " " + matrixFile.getAbsolutePath(), BlueSystem
                    .getString("message.error"), JOptionPane.DEFAULT_OPTION);
            System.err.println(BlueSystem
                    .getString("scanned.errorImportingMatrix")
                    + " " + matrixFile.getAbsolutePath());
            return;
        }

        boolean[] matrix = new boolean[temp.size()];

        for (int i = 0; i < temp.size(); i++) {
            matrix[i] = temp.get(i).equals("0") ? false : true;
            // System.out.println("i: " + matrix[i]);
        }

        this.matrix = matrix;
        redoSize();
        mml.setMatrix(matrix);
    }

    public void redoSize() {
        if (matrix != null) {
            int numOfMasses = numberOfMasses(matrix.length);
            Dimension dim = new Dimension(numOfMasses * gridHeight, numOfMasses
                    * gridHeight);
            this.setSize(dim);
            this.setPreferredSize(dim);
            this.setMaximumSize(dim);
            this.setMinimumSize(dim);
            this.revalidate();
            this.repaint();
        }
    }

    public static final int numberOfMasses(int arrayLength) {
        int i = 0;
        while ((i * i) != arrayLength && i < arrayLength) {
            i++;
        }
        return i;
    }

    public static void main(String[] args) {
        // MatrixGridEditor matrixGridEditor1 = new MatrixGridEditor();
    }
}

class MatrixMouseListener implements MouseListener, MouseMotionListener {
    MatrixGridEditor grid;

    boolean[] matrix = null;

    boolean isWrite = false;

    public MatrixMouseListener(MatrixGridEditor grid) {
        this.grid = grid;
    }

    public void setMatrix(boolean[] matrix) {
        this.matrix = matrix;
    }

    @Override
    public void mousePressed(MouseEvent e) {
        processMousePressed(e);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        processMouseReleased(e);
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        processMouseDragged(e);
    }

    @Override
    public void mouseMoved(MouseEvent e) {
        showPosition(e);
    }

    @Override
    public void mouseExited(MouseEvent e) {
        if (matrix != null) {
            grid.locationLabel.setText("pos (x,x)");
        }
    }

    @Override
    public void mouseEntered(MouseEvent e) {
    }

    @Override
    public void mouseClicked(MouseEvent e) {
    }

    void processMousePressed(MouseEvent e) {
        if (matrix != null) {
            int x = e.getX();
            int y = e.getY();

            this.isWrite = !getMass(x, y);
            setMass(x, y, this.isWrite);
            showPosition(e);
            grid.repaint();
        }
    }

    void processMouseDragged(MouseEvent e) {
        if (grid != null) {
            showPosition(e);
            setMass(e.getX(), e.getY(), this.isWrite);
            grid.repaint();
        }
    }

    void processMouseReleased(MouseEvent e) {
    }

    void showPosition(MouseEvent e) {
        int x = e.getX();
        int y = e.getY();

        if (this.matrix == null) {
            return;
        }

        int numOfMasses = MatrixGridEditor.numberOfMasses(matrix.length);

        int yIndex = y / MatrixGridEditor.gridHeight;

        if (yIndex >= numOfMasses || yIndex < 0) {
            return;
        }

        int xIndex = x / MatrixGridEditor.gridHeight;

        if (xIndex > numOfMasses || xIndex < 0) {
            return;
        }

        this.grid.locationLabel.setText("pos (" + xIndex + "," + yIndex + ")");
    }

    public boolean getMass(int x, int y) {
        if (this.matrix == null) {
            return false;
        }

        int numOfMasses = MatrixGridEditor.numberOfMasses(matrix.length);

        int yIndex = y / MatrixGridEditor.gridHeight;

        if (yIndex >= numOfMasses || yIndex < 0) {
            return false;
        }

        int xIndex = x / MatrixGridEditor.gridHeight;

        if (xIndex > numOfMasses || xIndex < 0) {
            return false;
        }

        // System.out.println("matrix length: " + matrix.length);
        // System.out.println("index: " + ((yIndex * numOfMasses) + xIndex));

        return matrix[(yIndex * numOfMasses) + xIndex];
    }

    public void setMass(int x, int y, boolean val) {
        if (this.matrix == null) {
            return;
        }

        int numOfMasses = MatrixGridEditor.numberOfMasses(matrix.length);

        int yIndex = y / MatrixGridEditor.gridHeight;

        if (yIndex >= numOfMasses || yIndex < 0) {
            return;
        }

        int xIndex = x / MatrixGridEditor.gridHeight;

        if (xIndex > numOfMasses || xIndex < 0) {
            return;
        }

        matrix[(yIndex * numOfMasses) + xIndex] = val;
    }

}