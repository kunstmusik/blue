/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.gui;

import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;

import javax.swing.JOptionPane;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;

import blue.soundObject.SoundObjectException;

/**
 * @author steven
 */
public class ExceptionDialog {

    private static JScrollPane infoScrollPane = null;

    private static JTextArea infoText = null;

    private ExceptionDialog() {
    }

    private static final void initialize() {
        infoScrollPane = new JScrollPane();
        infoText = new JTextArea();
        infoText.setFont(new Font("Monospaced", Font.PLAIN, 12));

        infoText.setEditable(false);
        infoScrollPane.getViewport().add(infoText);
        infoScrollPane.setPreferredSize(new Dimension(760, 400));

    }

    public static final void showExceptionDialog(Component parent,
            Throwable e) {
        if (infoScrollPane == null) {
            initialize();
        }

        infoText.setText(e.getMessage());

        JOptionPane.showMessageDialog(parent, infoScrollPane,
                "SoundObject Error", // TODO - TRANSLATE
                JOptionPane.PLAIN_MESSAGE);

        e.printStackTrace(); // Here for testing, to remove later
    }
}
