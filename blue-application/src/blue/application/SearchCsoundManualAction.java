/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.application;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.net.MalformedURLException;
import java.net.URL;
import org.openide.DialogDescriptor;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.awt.*;
import org.openide.util.Exceptions;
import org.openide.util.NbBundle.Messages;

@ActionID(category = "SearchCsoundManualAction",
id = "blue.application.SearchCsoundManualAction")
@ActionRegistration(displayName = "#CTL_SearchCsoundManualAction")
@ActionReferences({
    @ActionReference(path = "Menu/Help", position = 1079)
})
@Messages("CTL_SearchCsoundManualAction=Search Csound Manual")
public final class SearchCsoundManualAction implements ActionListener {

    public void actionPerformed(ActionEvent e) {
        //GET SEARCH TERM

        NotifyDescriptor.InputLine descriptor = new NotifyDescriptor.InputLine(
                "Enter search terms", "Search Csound Manual");

        if (DialogDisplayer.getDefault().notify(descriptor) != NotifyDescriptor.OK_OPTION) {
            return;
        }
        
        String searchTerm = descriptor.getInputText();

        //CREATE SEARCH

        String url = String.format(
                "http://www.google.com/search?q=%s&sitesearch=csounds.com/manual/html",
                searchTerm);
        
        url = url.replace(" ", "%20");

        try {
            HtmlBrowser.URLDisplayer.getDefault().showURL(new URL(url));
        } catch (MalformedURLException ex) {
            Exceptions.printStackTrace(ex);
        }

    }
}
