package blue.tools.scanned;

import java.awt.BorderLayout;
import java.awt.Color;

import javax.swing.JComponent;
import javax.swing.JScrollPane;
import javax.swing.JTextPane;

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

public class ScannedAbout extends JComponent {

    public ScannedAbout() {
        this.setLayout(new BorderLayout());
        JScrollPane scroll = new JScrollPane();
        this.add(scroll, BorderLayout.CENTER);
        JTextPane text = new JTextPane();
        scroll.setViewportView(text);
        text.setForeground(Color.white);
        text.setBackground(Color.black);

        String aboutText = "Scanned Synthesis Matrix Editor\n";
        aboutText += "by Steven Yi\n\n";
        aboutText += "Version 1.00 beta 2\n\n";
        aboutText += "A matrix editor for scanned synthesis spring stiffness matrices";

        text.setText(aboutText);
    }
}