package blue.plaf;

import java.awt.BorderLayout;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.Arrays;
import java.util.Collections;
import java.util.Iterator;
import java.util.Set;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.UIDefaults;
import javax.swing.UIManager;

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

public class SwingPropertiesTest extends JComponent {

    public SwingPropertiesTest() {
        this.setLayout(new BorderLayout());
        JScrollPane jsp = new JScrollPane();
        this.add(jsp, BorderLayout.CENTER);
        JTextArea text = new JTextArea();
        jsp.setViewportView(text);

        UIDefaults ui = UIManager.getLookAndFeelDefaults();

        Set a = ui.keySet();
        java.util.List b = Arrays.asList(a.toArray());

        Collections.sort(b);

        Iterator it = b.iterator();

        StringBuffer buffer = new StringBuffer();

        buffer.append("<html><head></head><body>\n");
        buffer.append("<table>\n");

        while (it.hasNext()) {
            Object obj = it.next();

            buffer.append("<tr>");
            buffer.append("<td><em>" + obj.toString() + "</em></td>");
            if (ui.get(obj) != null) {
                buffer.append("<td>" + ui.get(obj).toString() + "</td>");
            } else {
                buffer.append("<td></td>");
            }
            buffer.append("</tr>\n");

        }
        buffer.append("</table></body></html>");

        text.setText(buffer.toString());

    }

    public static void main(String[] args) {
        try {
            UIManager.setLookAndFeel(new blue.plaf.BlueLookAndFeel());
        } catch (Exception e) {
        }

        JFrame mFrame = new JFrame();
        mFrame.setSize(800, 600);
        SwingPropertiesTest swingPropertiesTest1 = new SwingPropertiesTest();
        mFrame.getContentPane().add(swingPropertiesTest1);

        mFrame.setVisible(true);
        mFrame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                System.exit(0);
            }
        });

    }
}