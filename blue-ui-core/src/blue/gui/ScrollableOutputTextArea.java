/*
 * ScrollableOutputTextArea.java
 *
 * Created on June 6, 2005, 3:10 PM
 */

package blue.gui;

import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;

import javax.swing.JTextArea;
import javax.swing.SwingUtilities;

/**
 * JTextArea that automatically resets its preferred size property so that
 * scroll views may scroll properly. Suitable for dynamic text and whenever the
 * total text area may not be known.
 * 
 * @author mbechard
 */
public class ScrollableOutputTextArea extends JTextArea {

    protected int vertSize = 0;

    protected int horzSize = 0;

    protected int fontHeight = 0;

    protected FontMetrics fm = null;

    /** Creates a new instance of ScrollableOutputTextArea */
    public ScrollableOutputTextArea() {
        super();
        this.setFont(new Font("monospaced", Font.PLAIN, 12));
        setEditable(false);
    }

    /**
     * Implementation of the append function that readjusts the preferred size
     * dimensions whenever a new line is added. Adds a CR/LF to any text passed
     * in.
     * 
     * @param line
     *            Line to append
     */
    public void append(final String line, final boolean newLine) {
        
        SwingUtilities.invokeLater(new Runnable() {
            public void run() {
                doAppendText(line, newLine);
            }
        });
    }

    protected synchronized void doAppendText(String line, boolean newLine) {        
        int currStrSize = 0;

        initFontMetrics();

        super.append(line);
        
        if(newLine) {
            super.append("\n");
        }

        if (fm != null) {
//            vertSize += fontHeight;
            vertSize = super.getLineCount() * fontHeight;
            currStrSize = fm.stringWidth(line);
            if (currStrSize > horzSize) {
                horzSize = currStrSize;
            }
            setPreferredSize(new java.awt.Dimension(horzSize, vertSize));
            revalidate();
        }
    }

    /**
     * Resets the internal tracking variables for the total height and width of
     * the text, and empties the text area's contents. Should be called whenever
     * the text area needs to be emptied.
     */
    public synchronized void resetContent() {
        setText(null);
        vertSize = 0;
        horzSize = 0;
    }

    /**
     * Initializes the variables that are used to calculate the correct height
     * and length of a line of text, given the current font.
     */
    protected synchronized void initFontMetrics() {
        if (fm == null) {
            Graphics graphics = getGraphics();

            if (graphics != null) {
                fm = graphics.getFontMetrics(getFont());
                fontHeight = fm.getHeight();
            }
        }
    }
}
