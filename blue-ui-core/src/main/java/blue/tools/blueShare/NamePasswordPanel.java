/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.tools.blueShare;

import blue.BlueSystem;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;

/**
 * @author steven
 * 
 */
public class NamePasswordPanel extends JComponent {
    JLabel usernameLabel = new JLabel();

    JPasswordField passwordText = new JPasswordField();

    JLabel passwordLabel = new JLabel();

    JTextField usernameText = new JTextField();

    public NamePasswordPanel() {
        this.setLayout(new GridBagLayout());

        usernameLabel.setText(BlueSystem.getString("blueShare.userNameLabel")
                + " ");
        passwordLabel.setText(BlueSystem.getString("blueShare.passwordLabel")
                + " ");

        this.add(usernameLabel, new GridBagConstraints(0, 0, 1, 1, 0.0, 0.0,
                GridBagConstraints.EAST, GridBagConstraints.NONE, new Insets(0,
                        0, 3, 3), 0, 0));
        this.add(usernameText, new GridBagConstraints(1, 0, 1, 1, 1.0, 0.0,
                GridBagConstraints.WEST, GridBagConstraints.HORIZONTAL,
                new Insets(0, 0, 3, 0), 0, 0));
        this.add(passwordLabel, new GridBagConstraints(0, 1, 1, 1, 0.0, 0.0,
                GridBagConstraints.EAST, GridBagConstraints.NONE, new Insets(0,
                        0, 3, 3), 0, 0));
        this.add(passwordText, new GridBagConstraints(1, 1, 1, 1, 1.0, 0.0,
                GridBagConstraints.WEST, GridBagConstraints.HORIZONTAL,
                new Insets(0, 0, 3, 0), 0, 0));

    }

    public String getUsername() {
        return usernameText.getText();
    }

    public String getPassword() {
        return new String(passwordText.getPassword());
    }
}