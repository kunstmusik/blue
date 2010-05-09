package blue.components;

import javax.swing.JLabel;
import javax.swing.JTextArea;
import javax.swing.SwingConstants;
import javax.swing.event.CaretEvent;
import javax.swing.event.CaretListener;

public class CaretPositionDisplayLabel extends JLabel implements CaretListener {
    public CaretPositionDisplayLabel() {
        this.setHorizontalAlignment(SwingConstants.RIGHT);
    }

    public void caretUpdate(CaretEvent e) {
        JTextArea jTextArea = (JTextArea) e.getSource();
        String text = jTextArea.getText();
        if(text == null || text.length() == 0) {
            this.setText("1 : 0");
            return;
        }
        
        int line = 1;
        int lastNewLine = 0;
        int pos = jTextArea.getCaretPosition();
        
        for(int i = 0; i < pos; i++) {
            if(text.charAt(i) == '\n') {
                line++;
                lastNewLine = i;
            }
        }
        
        int loc = lastNewLine > 0 ? pos - lastNewLine : pos + 1;
        
        this.setText(line + " : " + loc);
    }
}
