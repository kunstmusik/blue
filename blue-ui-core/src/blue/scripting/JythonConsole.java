package blue.scripting;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

import javax.swing.JDialog;
import javax.swing.JTextField;

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

public class JythonConsole extends JDialog {
    JTextField code = new JTextField();

    public JythonConsole() {
        super();
        this.setTitle("Jython Prompt");
        this.getContentPane().setLayout(new BorderLayout());
        this.addWindowListener(new WindowAdapter() {
            public void windowClosing(WindowEvent e) {
                dispose();
            }
        });
        this.getContentPane().add(code, BorderLayout.CENTER);
        code.addKeyListener(new KeyAdapter() {
            public void keyReleased(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ENTER) {
                    blue.scripting.PythonProxy.processPythonInstrument(code
                            .getText());
                    code.setText("");
                } else if (e.getKeyCode() == KeyEvent.VK_ESCAPE) {
                    hide();
                    dispose();
                }
            }
        });
        code.setPreferredSize(new Dimension(250, 23));
        this.pack();
        blue.utility.GUI.centerOnScreen(this);
    }

    public void show() {
        super.show();
        code.requestFocus();
    }

    public static void main(String[] args) {
        JythonConsole jythonConsole1 = new JythonConsole();
        jythonConsole1.show();
    }

}