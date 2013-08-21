/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
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
package blue.application;

import java.awt.Desktop;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import org.openide.awt.HtmlBrowser.URLDisplayer;
import org.openide.modules.InstalledFileLocator;
import org.openide.util.Exceptions;

public final class CsoundManualAction implements ActionListener {

    public void actionPerformed(ActionEvent e) {
        File manualDir = InstalledFileLocator.getDefault().
                locate("csoundManual", "csound-manual", false);

        String url = "file://" + manualDir.getAbsolutePath() + "/index.html";

        url = url.replace(" ", "%20");

        try {
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().browse(new URI(url));
            } else {
                URLDisplayer.getDefault().showURL(new URL(url));
            }
        } catch (Exception ex) {
            Exceptions.printStackTrace(ex);
        }
    }
}
