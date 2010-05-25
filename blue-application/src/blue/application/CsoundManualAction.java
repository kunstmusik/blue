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

import blue.settings.GeneralSettings;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.net.MalformedURLException;
import java.net.URL;
import org.openide.awt.HtmlBrowser.URLDisplayer;
import org.openide.util.Exceptions;

public final class CsoundManualAction implements ActionListener {

    public void actionPerformed(ActionEvent e) {
        String url = GeneralSettings.getInstance().getCsoundDocRoot()
                + "index.html";

        if (!url.startsWith("http") && !url.startsWith("file://")) {
            url = "file://" + url;
        }

        url = url.replace(" ", "%20");

        try {
            URLDisplayer.getDefault().showURL(new URL(url));
        } catch (MalformedURLException ex) {
            Exceptions.printStackTrace(ex);
        }
    }
}
