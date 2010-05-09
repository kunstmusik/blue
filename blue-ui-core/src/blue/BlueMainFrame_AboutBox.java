/*
 * blue - object composition environment for csound Copyright (c) 2001-2003
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue;

import java.awt.AWTEvent;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Frame;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.WindowEvent;

import javax.swing.BorderFactory;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;
import javax.swing.SwingConstants;
import javax.swing.border.Border;
import javax.swing.border.EmptyBorder;

import blue.utility.TextUtilities;

public final class BlueMainFrame_AboutBox extends JDialog implements
        ActionListener {

    JPanel panel1 = new JPanel();

    JPanel bodyPanel = new JPanel();

    JPanel buttonPanel = new JPanel();

    JPanel picturePanel = new JPanel();

    JButton okay = new JButton();

    JLabel imageControl1 = new JLabel();

    ImageIcon imageIcon;

    BorderLayout borderLayout1 = new BorderLayout();

    BorderLayout borderLayout2 = new BorderLayout();

    FlowLayout flowLayout1 = new FlowLayout();

    FlowLayout flowLayout2 = new FlowLayout();

    GridLayout gridLayout1 = new GridLayout();

    JPanel textPanel = new JPanel();

    JLabel version = new JLabel("blue - " + BlueConstants.getVersion() + " ["
            + BlueConstants.getVersionDate() + "]");

    JLabel bodyText = new JLabel("...an environment for Csound");

    JLabel title2 = new JLabel("Object Composition Environment");

    JLabel copyRight = new JLabel("Copyright (c) 2000-2009 Steven Yi");

    JLabel title = new JLabel("blue");

    Border border1;

    JLabel contact = new JLabel("email: stevenyi@gmail.com");

    JTabbedPane tabs = new JTabbedPane();

    JScrollPane licenseScroll = new JScrollPane();

    JTextArea licenseText = new JTextArea();

    JScrollPane creditsScroll = new JScrollPane();

    JTextArea creditsText = new JTextArea();

    public BlueMainFrame_AboutBox(Frame parent) {
        super(parent);
        enableEvents(AWTEvent.WINDOW_EVENT_MASK);
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
        // imageControl1.setIcon(imageIcon);
        // pack();
    }

    private void jbInit() throws Exception {
        // imageIcon = new ImageIcon(getClass().getResource("[Your Image]"));
        border1 = BorderFactory.createEmptyBorder(20, 20, 20, 20);
        this.setTitle(BlueSystem.getString("menu.help.about.text"));
        setResizable(false);
        panel1.setLayout(borderLayout1);
        bodyPanel.setLayout(borderLayout2);
        buttonPanel.setLayout(flowLayout1);
        picturePanel.setLayout(flowLayout1);
        picturePanel.setBorder(new EmptyBorder(10, 10, 10, 10));
        okay.setText(BlueSystem.getString("programOptions.okButton"));
        okay.addActionListener(this);
        version.setHorizontalAlignment(SwingConstants.RIGHT);
        version.setVerticalAlignment(SwingConstants.BOTTOM);
        gridLayout1.setRows(6);
        gridLayout1.setColumns(1);
        textPanel.setLayout(gridLayout1);
        bodyText.setHorizontalAlignment(SwingConstants.RIGHT);
        bodyText.setVerticalAlignment(SwingConstants.BOTTOM);
        title2.setHorizontalAlignment(SwingConstants.RIGHT);
        title2.setVerticalAlignment(SwingConstants.BOTTOM);
        copyRight.setHorizontalAlignment(SwingConstants.RIGHT);
        copyRight.setVerticalAlignment(SwingConstants.BOTTOM);
        contact.setHorizontalAlignment(SwingConstants.RIGHT);
        contact.setVerticalAlignment(SwingConstants.BOTTOM);
        panel1.setBorder(border1);
        title.setFont(new java.awt.Font("Dialog", 0, 48));
        title.setHorizontalAlignment(SwingConstants.RIGHT);
        title.setVerticalAlignment(SwingConstants.TOP);
        licenseText.setFont(new java.awt.Font("Monospaced", 0, 12));
        creditsText.setFont(new java.awt.Font("Monospaced", 0, 12));
        picturePanel.add(imageControl1, null);
        panel1.add(title, BorderLayout.NORTH);
        bodyPanel.add(textPanel, BorderLayout.CENTER);
        textPanel.add(title2, null);
        textPanel.add(bodyText, null);
        textPanel.add(version, null);
        textPanel.add(copyRight, null);
        textPanel.add(contact, null);
        bodyPanel.add(picturePanel, BorderLayout.WEST);

        // panel1.add(buttonPanel, BorderLayout.SOUTH);
        panel1.add(bodyPanel, BorderLayout.CENTER);

        JPanel panel2 = new JPanel();
        licenseScroll.getViewport().add(licenseText);
        licenseText.setLineWrap(true);
        licenseScroll.setPreferredSize(new Dimension(395, 283));
        licenseText.setColumns(80);

        panel2.setLayout(new BorderLayout());
        panel2.add(licenseScroll, BorderLayout.CENTER);

        JPanel panel3 = new JPanel();
        creditsScroll.getViewport().add(creditsText);
        creditsText.setLineWrap(true);
        creditsScroll.setPreferredSize(new Dimension(395, 283));
        creditsText.setColumns(80);

        panel3.setLayout(new BorderLayout());
        panel3.add(creditsScroll, BorderLayout.CENTER);

        buttonPanel.add(okay, null);

        tabs.add(BlueSystem.getString("menu.help.about.text"), panel1);
        tabs.add(BlueSystem.getString("common.credits"), panel3);
        tabs.add(BlueSystem.getString("common.license"), panel2);

        JPanel mainPanel = (JPanel) this.getContentPane();
        mainPanel.setLayout(new BorderLayout());
        mainPanel.add(tabs, BorderLayout.CENTER);
        mainPanel.add(buttonPanel, BorderLayout.SOUTH);

        licenseText.setText(TextUtilities
                .getTextFromSystemResource(getClass(), "blue/resources/license.txt"));
        licenseText.select(0, 0);

        creditsText.setText(TextUtilities
                .getTextFromSystemResource(getClass(), "blue/resources/credits.txt"));
        creditsText.select(0, 0);

        this.getContentPane().setSize(640, 480);
        this.setSize(640, 480);

    }

    protected void processWindowEvent(WindowEvent e) {
        if (e.getID() == WindowEvent.WINDOW_CLOSING) {
            cancel();
        }
        super.processWindowEvent(e);
    }

    void cancel() {
        dispose();
    }

    public void actionPerformed(ActionEvent e) {
        if (e.getSource() == okay) {
            cancel();
        }
    }
}
