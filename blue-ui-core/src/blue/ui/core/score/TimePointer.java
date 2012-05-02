package blue.ui.core.score;

import java.awt.Color;
import java.awt.Graphics;
import javax.swing.JComponent;

public class TimePointer extends JComponent {

    private final Color color;

    public TimePointer(Color color) {
        super();
        this.color = color;
    }

    public void paintComponent(Graphics g) {
        g.setColor(this.color);
        g.drawLine(0, 0, 0, this.getHeight());
    }
}
